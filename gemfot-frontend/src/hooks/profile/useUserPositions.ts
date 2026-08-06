import { useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { fetchSubgraph, GET_POSITIONS_BY_OWNER } from '@/lib/queries';
import { POSITION_MANAGER_ADDRESS } from '@/lib/constants';
import { tickToPrice } from '@/utils/liquidityMath/liquidityAmounts';
import { TOKENS } from '@/config/tokens';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SubgraphPosition {
  id: string;
  tokenId: string;
  owner: string;
  origin: string;
  createdAtTimestamp: string;
}

interface PoolKey {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
}

/** Unpacked from PositionInfo uint256 */
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

/** Lookup token metadata (name, symbol, decimals, logo) from our config, or fall back to address */
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

export interface UserPosition {
  tokenId: string;
  subgraphId: string;
  createdAtTimestamp: number;

  // Pool info
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;           // raw fee e.g. 3000
  feePct: string;        // human "0.3%"
  tickSpacing: number;
  hooks: `0x${string}`;

  // Ticks + prices
  tickLower: number;
  tickUpper: number;
  priceLower: number;    // token1 per token0 at tickLower
  priceUpper: number;    // token1 per token0 at tickUpper

  // Token metadata resolved from config
  token0: ReturnType<typeof resolveToken>;
  token1: ReturnType<typeof resolveToken>;
}

// ─── ABI snippet ──────────────────────────────────────────────────────────────

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

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUserPositions() {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();

  const [positions, setPositions] = useState<UserPosition[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userAddress || !publicClient) {
      setPositions([]);
      return;
    }

    let cancelled = false;

    const fetchPositions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // 1. Get position token IDs from subgraph
        const sgData = await fetchSubgraph<{ positions: SubgraphPosition[] }>(
          GET_POSITIONS_BY_OWNER,
          { owner: userAddress.toLowerCase() }
        );

        if (cancelled) return;
        if (!sgData.positions.length) {
          setPositions([]);
          return;
        }

        // 2. For each tokenId, fetch poolKey + packed info from the chain in parallel
        const onChainResults = await Promise.all(
          sgData.positions.map(async (pos) => {
            try {
              const [poolKey, info] = (await publicClient.readContract({
                address: POSITION_MANAGER_ADDRESS as `0x${string}`,
                abi: GET_POOL_AND_POSITION_INFO_ABI,
                functionName: 'getPoolAndPositionInfo',
                args: [BigInt(pos.tokenId)],
              })) as [PoolKey, bigint];

              return { pos, poolKey, info };
            } catch (e) {
              console.warn(`Failed to fetch on-chain data for tokenId ${pos.tokenId}:`, e);
              return null;
            }
          })
        );

        if (cancelled) return;

        // 3. Decode info → ticks → prices, resolve token metadata
        const resolved: UserPosition[] = onChainResults
          .filter((r): r is NonNullable<typeof r> => r !== null)
          .map(({ pos, poolKey, info }) => {
            const { tickLower, tickUpper } = unpackPositionInfo(info);

            const token0 = resolveToken(poolKey.currency0);
            const token1 = resolveToken(poolKey.currency1);

            const priceLower = tickToPrice(tickLower, token0.decimals, token1.decimals);
            const priceUpper = tickToPrice(tickUpper, token0.decimals, token1.decimals);

            const feePct = `${(poolKey.fee / 10000).toFixed(poolKey.fee % 10000 === 0 ? 0 : 2)}%`;

            return {
              tokenId: pos.tokenId,
              subgraphId: pos.id,
              createdAtTimestamp: Number(pos.createdAtTimestamp),
              currency0: poolKey.currency0,
              currency1: poolKey.currency1,
              fee: poolKey.fee,
              feePct,
              tickSpacing: poolKey.tickSpacing,
              hooks: poolKey.hooks,
              tickLower,
              tickUpper,
              priceLower,
              priceUpper,
              token0,
              token1,
            };
          });

        setPositions(resolved);
      } catch (e: any) {
        console.error('useUserPositions error:', e);
        setError(e?.message ?? 'Failed to load positions');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchPositions();
    return () => { cancelled = true; };
  }, [userAddress, publicClient]);

  return { positions, isLoading, error };
}
