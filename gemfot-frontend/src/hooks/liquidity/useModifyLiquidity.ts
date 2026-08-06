import { useState } from 'react';
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { encodePacked, encodeAbiParameters } from 'viem';
import { getSqrtRatioAtTick, sqrtPriceX96ToTick,LiquidityAmounts, priceToSqrtPriceX96 } from "@/utils/liquidityMath/liquidityAmounts";
import { useApproval } from '../shared/useApproval';
import { POSITION_MANAGER_ADDRESS, STATEVIEW_ADDRESS, ACTIONS, PERMIT2_ADDRESS } from '../../lib/constants';
import StateViewABI from '../../abi/StateView.json';

import PositionManagerABI from '../../abi/PositionManager.json';
import ERC20_ABI from '../../abi/ERC20.json';
import type { ToastType } from '../../components/Toast';
import { redis } from '@/lib/redis';

export const MIN_TICK = -887272;
export const MAX_TICK = 887272;

interface ToastState {
  show: boolean;
  type: ToastType;
  title: string;
  message: string;
  txHash?: string;
}



function nearestUsableTick(tick: any, tickSpacing: any) {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing;
  if (rounded < MIN_TICK) return rounded + tickSpacing;
  if (rounded > MAX_TICK) return rounded - tickSpacing;
  return rounded;
}

export function useModifyLiquidity() {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const { checkAllowance, approveTokenWithPermit2 } = useApproval();

  const [toast, setToast] = useState<ToastState>({
    show: false,
    type: 'pending',
    title: '',
    message: '',
    txHash: undefined,
  });

  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [isApproving, setIsApproving] = useState(false);
  const [isMinting, setIsMinting] = useState(false);

  const { isLoading: isConfirmingTx } = useWaitForTransactionReceipt({ hash: txHash });
  const isConfirming = isConfirmingTx || isApproving || isMinting;

  function showToast(
    type: ToastType,
    title: string,
    message: string,
    txHash?: string
  ) {
    setToast({ show: true, type, title, message, txHash });
  }

  function dismissToast() {
    setToast(prev => ({ ...prev, show: false }));
  }

  // All together
  const priceToTick = (price: any, decimals0: any, decimals1: any, tickSpacing: any) => {
    console.log({price, decimals0, decimals1, tickSpacing})
    const sqrtPriceX96 = priceToSqrtPriceX96(price, decimals0, decimals1);
    console.log({sqrtPriceX96});
    const tick = sqrtPriceX96ToTick(sqrtPriceX96);
    console.log({nearestUsableTick: nearestUsableTick(tick, tickSpacing)})
    return nearestUsableTick(tick, tickSpacing);
  }

  const mintPosition = async (params: {
    token0: string;
    token1: string;
    feeTier: string;
    tickSpacing: string;
    hooks: string;
    poolId: string;
    amount0: string;
    amount1: string;
    minTick: number;
    maxTick: number;
    sqrtPrice: string;
  }) => {

    console.log({mintParams: params});

    if (!userAddress) {
      showToast('error', 'Wallet Not Connected', 'Please connect your wallet to mint a position.');
      return;
    }

    if (!publicClient) {
      showToast('error', 'Public Client Not Found', 'Unable to initialize public client.');
      return;
    }

    if (!params.amount0 || !params.amount1 || isNaN(Number(params.amount0)) || isNaN(Number(params.amount1))) {
      console.warn("Token amounts cannot be empty or invalid");
      showToast('error', 'Invalid Input', 'Please enter valid amounts for both tokens.');
      return;
    }

    try {
      setIsMinting(true);
      setIsApproving(true);

      console.log("Reading pool state from StateView...");
      const poolData = await publicClient.readContract({
        address: STATEVIEW_ADDRESS as `0x${string}`,
        abi: StateViewABI.abi,
        functionName: 'getSlot0',
        args: [params.poolId as `0x${string}`]
      }) as [bigint, number, number, number];
      console.log("Pool state from StateView:", poolData);

      const amount0Big = BigInt(params.amount0);
      const amount1Big = BigInt(params.amount1);

      const amount0Max = amount0Big + 1n; 
      const amount1Max = amount1Big + 1n;  
      console.log({amount0Big, amount1Big});

      const sqrtPriceAX96 = BigInt(getSqrtRatioAtTick(params.minTick)).toString();
      const sqrtPriceBX96 = BigInt(getSqrtRatioAtTick(params.maxTick)).toString();
      console.log({sqrtPriceAX96, sqrtPriceBX96});

      const L = LiquidityAmounts.getLiquidityForAmounts(
          BigInt(params.sqrtPrice),
          BigInt(sqrtPriceAX96),
          BigInt(sqrtPriceBX96),
          amount0Max,//amount0Big,
          amount1Max//amount1Big
      );
      console.log({L});

      ////////////////////////////////////////////////
      const actualAmount0 = LiquidityAmounts.getAmount0ForLiquidity(
        BigInt(params.sqrtPrice),
        BigInt(sqrtPriceBX96),
        L
      );
      const actualAmount1 = LiquidityAmounts.getAmount1ForLiquidity(
        BigInt(params.sqrtPrice),
        BigInt(sqrtPriceAX96),
        L
      );
      // const [actualAmount0, actualAmount1] = LiquidityAmounts.getAmountsForLiquidity(
      //   BigInt(params.sqrtPrice),
      //   BigInt(sqrtPriceAX96),
      //   BigInt(sqrtPriceBX96),
      //   L
      // );

    console.log({
      actualAmount0,
      actualAmount1,
      amount0Max,
      amount1Max,
      sufficient0: amount0Max >= actualAmount0,
      sufficient1: amount1Max >= actualAmount1,
    });

    console.log({
      sqrtPrice: params.sqrtPrice,
      sqrtPriceAX96,
      sqrtPriceBX96,
      inRange:
        BigInt(params.sqrtPrice) >= BigInt(sqrtPriceAX96) &&
        BigInt(params.sqrtPrice) <= BigInt(sqrtPriceBX96)
    });

      ///////////////////////////////////////////////////

      if (L === 0n) {
        showToast('error', 'Zero Liquidity', 'Calculated liquidity delta is zero. Please check your ranges and token amounts.');
        setIsApproving(false);
        setIsMinting(false);
        return;
      }

      // 1. Check balances
      const getTokenBalance = async (tokenAddress: `0x${string}`, ownerAddress: `0x${string}`) => {
        if (tokenAddress === '0x0000000000000000000000000000000000000000') {
          return await publicClient.getBalance({ address: ownerAddress });
        } else {
          return (await publicClient.readContract({
            address: tokenAddress,
            abi: ERC20_ABI.abi,
            functionName: 'balanceOf',
            args: [ownerAddress],
          })) as bigint;
        }
      };

      const balance0 = await getTokenBalance(params.token0 as `0x${string}`, userAddress);
      const balance1 = await getTokenBalance(params.token1 as `0x${string}`, userAddress);

      if (balance0 < amount0Max) {
        showToast('error', 'Insufficient Balance', `You do not have enough token0. Required: ${params.amount0}, Available: ${balance0.toString()}`);
        setIsApproving(false);
        setIsMinting(false);
        return;
      }
      if (balance1 < amount1Max) {
        showToast('error', 'Insufficient Balance', `You do not have enough token1. Required: ${params.amount1}, Available: ${balance1.toString()}`);
        setIsApproving(false);
        setIsMinting(false);
        return;
      }

      // 2. Check and approve allowances
      // Token 0
      console.log("CHECKING TOKENS APPROVAL.............")
      if (params.token0 !== '0x0000000000000000000000000000000000000000') {
        const { tokenToPermit2, p2ToSpenderAmount, p2ToSpenderExpiration } = await checkAllowance(
          params.token0 as `0x${string}`,
          userAddress,
          POSITION_MANAGER_ADDRESS as `0x${string}`
        );
        const now = Math.floor(Date.now() / 1000);
        const isExpired = p2ToSpenderExpiration <= now;
        console.log({tokenToPermit2, p2ToSpenderAmount, p2ToSpenderExpiration, isExpired});
        const needsApproval = p2ToSpenderAmount < amount1Max || isExpired;
        if (needsApproval) {
          showToast('pending', 'Approving Token 0', 'Approving Permit2 & Position Manager for Token 0...');
          await approveTokenWithPermit2(params.token0 as `0x${string}`, amount0Max, POSITION_MANAGER_ADDRESS as `0x${string}`);
        }
      }


      // Token 1


      if (params.token1 !== '0x0000000000000000000000000000000000000000') {
        const { tokenToPermit2, p2ToSpenderAmount, p2ToSpenderExpiration } = await checkAllowance(
          params.token1 as `0x${string}`,
          userAddress,
          POSITION_MANAGER_ADDRESS as `0x${string}`
        );
        
        const now = Math.floor(Date.now() / 1000);
        const isExpired = p2ToSpenderExpiration <= now;
        console.log({tokenToPermit2, p2ToSpenderAmount, p2ToSpenderExpiration, isExpired});
        const needsApproval = p2ToSpenderAmount < amount1Max || isExpired;
        if (needsApproval) {
          showToast('pending', 'Approving Token 1', 'Approving Permit2 & Position Manager for Token 1...');
          await approveTokenWithPermit2(params.token1 as `0x${string}`, amount1Max, POSITION_MANAGER_ADDRESS as `0x${string}`)
        }
      }

// Add this before the mint call to confirm

const [usdc_to_permit2, honey_to_permit2] = await Promise.all([
  publicClient.readContract({
    address: params.token0 as `0x${string}`,
    abi: ERC20_ABI.abi,
    functionName: 'allowance',
    args: [userAddress, PERMIT2_ADDRESS],
  }),
  publicClient.readContract({
    address: params.token1 as `0x${string}`,
    abi: ERC20_ABI.abi,
    functionName: 'allowance',
    args: [userAddress, PERMIT2_ADDRESS],
  }),
]);

console.log({ usdc_to_permit2, honey_to_permit2, amount0Max, amount1Max });


      setIsApproving(false);

      // 3. Prepare transaction details
      const recipient = userAddress;

      const actions = encodePacked(
        ['uint8', 'uint8'],
        [ACTIONS.MINT_POSITION, ACTIONS.SETTLE_PAIR] 
      );

      const paramsArray = [
        encodeAbiParameters(
          [
            {
              type: 'tuple',
              components: [
                { name: 'currency0', type: 'address' },
                { name: 'currency1', type: 'address' },
                { name: 'fee', type: 'uint24' },
                { name: 'tickSpacing', type: 'int24' },
                { name: 'hooks', type: 'address' }
              ]
            },
            { type: 'int24' },
            { type: 'int24' },
            { type: 'uint256' },
            { type: 'uint128' },
            { type: 'uint128' },
            { type: 'address' },
            { type: 'bytes' }
          ],
          [
            {
              currency0: params.token0 as `0x${string}`,
              currency1: params.token1 as `0x${string}`,
              fee: Number(params.feeTier),
              tickSpacing: Number(params.tickSpacing),
              hooks: params.hooks as `0x${string}`
            },
            params.minTick,
            params.maxTick,
            L,
            amount0Max,
            amount1Max,
            recipient,
            '0x'
          ]
        ),
        encodeAbiParameters(
          [{ type: 'address' }, { type: 'address' }],
          [params.token0 as `0x${string}`, params.token1 as `0x${string}`]
        )
      ];

      const unlockData = encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'bytes[]' }],
        [actions, paramsArray]
      );

      const deadline = Math.floor(Date.now() / 1000) + 60 * 20;

      // Determine transaction native value (if any native ETH is being sent)
      let value = 0n;
      if (params.token0 === '0x0000000000000000000000000000000000000000') {
        value = amount0Max;
      } else if (params.token1 === '0x0000000000000000000000000000000000000000') {
        value = amount1Max;
      }

      showToast('pending', 'Confirming Transaction', 'Confirm transaction in your wallet...');
      console.log({actions, paramsArray});

      try {
  await publicClient.simulateContract({
    address: POSITION_MANAGER_ADDRESS as `0x${string}`,
    abi: PositionManagerABI.abi,
    functionName: 'modifyLiquidities',
    args: [unlockData, BigInt(deadline)],
    value,
    account: userAddress,
  });
} catch (simError: any) {
  console.error('SIMULATION ERROR:', simError);
  // This will give you the exact revert reason
}

      const hash = await writeContractAsync({
        address: POSITION_MANAGER_ADDRESS as `0x${string}`,
        abi: PositionManagerABI.abi,
        functionName: 'modifyLiquidities',
        args: [unlockData, BigInt(deadline)],
        value,
      });

      setTxHash(hash);
      showToast('pending', 'Transaction Submitted', 'Waiting for confirmation...', hash);

      if (!publicClient) throw new Error("Public client not available");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log("Transaction confirmed:", receipt.transactionHash);

      if (receipt.status === 'reverted') {
        throw new Error('Transaction reverted on-chain');
      }

      // Extract Token ID (tokenId) from ERC-721 Transfer event
      let tokenId: string | undefined;
      const transferEvent = receipt.logs.find(
        log => log.address.toLowerCase() === POSITION_MANAGER_ADDRESS.toLowerCase() &&
               log.topics[0] === '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
      );
      if (transferEvent && transferEvent.topics[3]) {
        tokenId = BigInt(transferEvent.topics[3]).toString();
      }
      console.log({transferEvent});

      if (tokenId) {
        showToast('success', 'Position Minted!', `Successfully minted position #${tokenId}`, hash);
      } else {
        showToast('success', 'Position Minted!', 'Successfully minted liquidity position.', hash);
      }
      setIsMinting(false);
      // delete cache
      try {
        await redis.del("mlswap:pools");
        console.log("Invalidated pools cache");
      } catch (e) {
        console.error("Failed to invalidate cache", e);
      }

    } catch (err: any) {
      console.error("Failed to mint position:", err);
      setIsApproving(false);
      setIsMinting(false);
      setTxHash(undefined);
      showToast('error', 'Transaction Failed', err?.shortMessage ?? err?.message ?? 'Failed to mint position.');
    }
  };

  return { MIN_TICK, MAX_TICK, priceToTick, mintPosition, toast, dismissToast, isConfirming };
}
