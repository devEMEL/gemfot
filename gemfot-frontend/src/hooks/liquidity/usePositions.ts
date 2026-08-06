import { useEffect, useState, useCallback, useMemo } from 'react';
import { usePublicClient } from 'wagmi';
import { keccak256, encodeAbiParameters } from 'viem';
import { getSqrtRatioAtTick, LiquidityAmounts, sqrtPriceX96ToPrice, tickToPrice } from '@/utils/liquidityMath/liquidityAmounts';
import { POSITION_MANAGER_ADDRESS, STATEVIEW_ADDRESS } from '@/lib/constants';
import { TOKENS } from '@/config/tokens';
import { fetchSubgraph, GET_TOKEN_PRICES_BY_IDS } from '@/lib/queries';

const STATE_VIEW_ABI = [
  {
    type: 'function',
    name: 'getSlot0',
    inputs: [{ name: 'poolId', type: 'bytes32' }],
    outputs: [
      { name: 'sqrtPriceX96', type: 'uint160' },
      { name: 'tick', type: 'int24' },
      { name: 'protocolFee', type: 'uint24' },
      { name: 'lpFee', type: 'uint24' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPositionInfo',
    inputs: [
      { name: 'poolId', type: 'bytes32' },
      { name: 'owner', type: 'address' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
      { name: 'salt', type: 'bytes32' },
    ],
    outputs: [
      { name: 'liquidity', type: 'uint128' },
      { name: 'feeGrowthInside0LastX128', type: 'uint256' },
      { name: 'feeGrowthInside1LastX128', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getFeeGrowthInside',
    inputs: [
      { name: 'poolId', type: 'bytes32' },
      { name: 'tickLower', type: 'int24' },
      { name: 'tickUpper', type: 'int24' },
    ],
    outputs: [
      { name: 'feeGrowthInside0X128', type: 'uint256' },
      { name: 'feeGrowthInside1X128', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const;

const GET_POOL_AND_POSITION_INFO_ABI = [
  {
    type: 'function',
    name: 'getPoolAndPositionInfo',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [
      {
        name: 'poolKey',
        type: 'tuple',
        components: [
          { name: 'currency0', type: 'address' },
          { name: 'currency1', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'tickSpacing', type: 'int24' },
          { name: 'hooks', type: 'address' },
        ],
      },
      { name: 'info', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const;

export interface PoolKey {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
}

export interface PositionData {
  // raw liquidity
  liquidity: bigint;

  // liquidity broken down into token amounts
  amount0: bigint;
  amount1: bigint;
  amount0Human: number;
  amount1Human: number;

  // unclaimed fees (raw)
  fees0: bigint;
  fees1: bigint;
  fees0Human: number;
  fees1Human: number;
}

export interface ResolvedPositionDetails {
  tokenId: string;
  poolKey: PoolKey;
  tickLower: number;
  tickUpper: number;
  priceLower: number;
  priceUpper: number;
  token0: ReturnType<typeof resolveToken> & { derivedusdc?: number };
  token1: ReturnType<typeof resolveToken> & { derivedusdc?: number };
  poolId: `0x${string}`;
  feePct: string;
  
  // Slot0 info
  currentSqrtPriceX96: bigint;
  currentTick: number;
  currentPrice: number;
  
  // Position amounts & fees
  liquidity: bigint;
  amount0: bigint;
  amount1: bigint;
  amount0Human: number;
  amount1Human: number;
  fees0: bigint;
  fees1: bigint;
  fees0Human: number;
  fees1Human: number;
  
  // Status helper
  status: 'In Range' | 'Out of Range';
}

const computePoolId = (poolKey: PoolKey): `0x${string}` => {
  return keccak256(
    encodeAbiParameters(
      [
        {
          type: 'tuple',
          components: [
            { name: 'currency0', type: 'address' },
            { name: 'currency1', type: 'address' },
            { name: 'fee', type: 'uint24' },
            { name: 'tickSpacing', type: 'int24' },
            { name: 'hooks', type: 'address' },
          ],
        },
      ],
      [poolKey]
    )
  );
};

function unpackPositionInfo(info: bigint): { tickLower: number; tickUpper: number; hasSubscriber: boolean } {
  const tickLowerRaw = (info >> 8n) & 0xffffffn;
  const tickUpperRaw = (info >> 32n) & 0xffffffn;

  const signExtend24 = (v: bigint): number =>
    (v & 0x800000n) !== 0n ? Number(v - 0x1000000n) : Number(v);

  return {
    hasSubscriber: (info & 1n) === 1n,
    tickLower: signExtend24(tickLowerRaw),
    tickUpper: signExtend24(tickUpperRaw),
  };
}

function resolveToken(address: string) {
  const lc = address.toLowerCase();
  return (
    TOKENS.find((t) => t.address.toLowerCase() === lc) ?? {
      address: address as `0x${string}`,
      symbol: `${address.slice(0, 6)}…`,
      name: 'Unknown',
      decimals: 18,
      logo: '',
    }
  );
}

export const usePositionData = () => {
  const publicClient = usePublicClient();

  const getPositionData = useCallback(async (
    tokenId: bigint,
    poolKey: PoolKey,
    tickLower: number,
    tickUpper: number,
    decimals0: number,
    decimals1: number,
  ): Promise<PositionData> => {
    const poolId = computePoolId(poolKey);
    const salt = `0x${tokenId.toString(16).padStart(64, '0')}` as `0x${string}`;

    if (!publicClient) {
      throw new Error('Public client not connected');
    }

    // fetch everything in parallel
    const [slot0, positionInfo, feeGrowthInside] = await Promise.all([
      publicClient.readContract({
        address: STATEVIEW_ADDRESS as `0x${string}`,
        abi: STATE_VIEW_ABI,
        functionName: 'getSlot0',
        args: [poolId],
      }),
      publicClient.readContract({
        address: STATEVIEW_ADDRESS as `0x${string}`,
        abi: STATE_VIEW_ABI,
        functionName: 'getPositionInfo',
        args: [poolId, POSITION_MANAGER_ADDRESS as `0x${string}`, tickLower, tickUpper, salt],
      }),
      publicClient.readContract({
        address: STATEVIEW_ADDRESS as `0x${string}`,
        abi: STATE_VIEW_ABI,
        functionName: 'getFeeGrowthInside',
        args: [poolId, tickLower, tickUpper],
      }),
    ]);

    const [sqrtPriceX96] = slot0;
    const [liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128] = positionInfo;
    const [feeGrowthInside0X128, feeGrowthInside1X128] = feeGrowthInside;

    // 1. Liquidity broken into token amounts
    const sqrtPriceLowerX96 = getSqrtRatioAtTick(tickLower);
    const sqrtPriceUpperX96 = getSqrtRatioAtTick(tickUpper);

    const [amount0, amount1] = LiquidityAmounts.getAmountsForLiquidity(
      sqrtPriceX96,
      sqrtPriceLowerX96,
      sqrtPriceUpperX96,
      liquidity,
    );
    console.log("onchain sqrtPriceX96: ", sqrtPriceX96)

    // 2. Unclaimed fees
    const Q128 = 2n ** 128n;
    const feeGrowthDelta0 = (feeGrowthInside0X128 - feeGrowthInside0LastX128 + Q128) % Q128;
    const feeGrowthDelta1 = (feeGrowthInside1X128 - feeGrowthInside1LastX128 + Q128) % Q128;

    const fees0 = (liquidity * feeGrowthDelta0) / Q128;
    const fees1 = (liquidity * feeGrowthDelta1) / Q128;

    return {
      liquidity,

      amount0,
      amount1,
      amount0Human: Number(amount0) / 10 ** decimals0,
      amount1Human: Number(amount1) / 10 ** decimals1,

      fees0,
      fees1,
      fees0Human: Number(fees0) / 10 ** decimals0,
      fees1Human: Number(fees1) / 10 ** decimals1,
    };
  }, [publicClient]);

  return useMemo(() => ({ getPositionData }), [getPositionData]);
};

export function usePositionDetails(tokenId: string | undefined) {
  const publicClient = usePublicClient();
  const { getPositionData } = usePositionData();
  const [details, setDetails] = useState<ResolvedPositionDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDetails = useCallback(async () => {
    if (!tokenId || !publicClient) return;
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch poolKey + info
      const [poolKey, info] = (await publicClient.readContract({
        address: POSITION_MANAGER_ADDRESS as `0x${string}`,
        abi: GET_POOL_AND_POSITION_INFO_ABI,
        functionName: 'getPoolAndPositionInfo',
        args: [BigInt(tokenId)],
      })) as [PoolKey, bigint];

      const { tickLower, tickUpper } = unpackPositionInfo(info);
      const token0 = resolveToken(poolKey.currency0);
      const token1 = resolveToken(poolKey.currency1);
      const poolId = computePoolId(poolKey);

      // Fetch prices from subgraph
      let derivedusdc0 = 0;
      let derivedusdc1 = 0;
      try {
        const priceData = await fetchSubgraph<{ tokens: { id: string; derivedUSDC: string }[] }>(
          GET_TOKEN_PRICES_BY_IDS,
          { ids: [poolKey.currency0.toLowerCase(), poolKey.currency1.toLowerCase()] }
        );
        const t0Price = priceData?.tokens?.find(t => t.id === poolKey.currency0.toLowerCase());
        const t1Price = priceData?.tokens?.find(t => t.id === poolKey.currency1.toLowerCase());
        if (t0Price) derivedusdc0 = Number(t0Price.derivedUSDC);
        if (t1Price) derivedusdc1 = Number(t1Price.derivedUSDC);
      } catch (priceErr) {
        console.warn('Failed to fetch token prices from subgraph:', priceErr);
      }

      // 2. Fetch slot0
      const slot0 = (await publicClient.readContract({
        address: STATEVIEW_ADDRESS as `0x${string}`,
        abi: STATE_VIEW_ABI,
        functionName: 'getSlot0',
        args: [poolId],
      })) as [bigint, number, number, number];

      const [sqrtPriceX96, tick] = slot0;

      // 3. Fetch position data (amounts & fees)
      const data = await getPositionData(
        BigInt(tokenId),
        poolKey,
        tickLower,
        tickUpper,
        token0.decimals,
        token1.decimals
      );

      const priceLower = tickToPrice(tickLower, token0.decimals, token1.decimals);
      const priceUpper = tickToPrice(tickUpper, token0.decimals, token1.decimals);
      const currentPrice = sqrtPriceX96ToPrice(sqrtPriceX96, token0.decimals, token1.decimals);

      const inRange = tick >= tickLower && tick <= tickUpper;
      const feePct = `${(poolKey.fee / 10000).toFixed(poolKey.fee % 10000 === 0 ? 0 : 2)}%`;

      setDetails({
        tokenId,
        poolKey,
        tickLower,
        tickUpper,
        priceLower,
        priceUpper,
        token0: { ...token0, derivedusdc: derivedusdc0 },
        token1: { ...token1, derivedusdc: derivedusdc1 },
        poolId,
        feePct,
        currentSqrtPriceX96: sqrtPriceX96,
        currentTick: tick,
        currentPrice,
        liquidity: data.liquidity,
        amount0: data.amount0,
        amount1: data.amount1,
        amount0Human: data.amount0Human,
        amount1Human: data.amount1Human,
        fees0: data.fees0,
        fees1: data.fees1,
        fees0Human: data.fees0Human,
        fees1Human: data.fees1Human,
        status: inRange ? 'In Range' : 'Out of Range',
      });
    } catch (e: any) {
      console.error('fetchDetails error:', e);
      setError(e?.shortMessage ?? e?.message ?? 'Failed to fetch position details');
    } finally {
      setIsLoading(false);
    }
  }, [tokenId, publicClient, getPositionData]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  return { details, isLoading, error, refetch: fetchDetails };
}
