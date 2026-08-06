import { useCallback, useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { maxUint256, parseUnits } from 'viem';
import { CONTRACTS } from '@/config/networks';
import GemFotManagerAbi from '@/abi/GemFotManager.json';
import PoolSwapAbi from '@/abi/PoolSwap.json';
import Erc20Abi from '@/abi/ERC20.json';

/** Uniswap v4 price limits (TickMath.MIN/MAX_SQRT_PRICE +/- 1) */
const MIN_SQRT_PRICE = 4295128739n + 1n;
const MAX_SQRT_PRICE = 1461446703485210103287273052203988822378723970342n - 1n;

export interface PoolKeyStruct {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
}

export type SwapStep = 'idle' | 'approving' | 'signing' | 'confirming' | 'done' | 'error';

export function useSwap(memecoin?: string) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [step, setStep] = useState<SwapStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const reset = useCallback(() => {
    setStep('idle');
    setError(null);
    setTxHash(null);
  }, []);

  /**
   * Swaps an exact amount of one side of the pool into the other.
   *
   * @param amount human amount of the token being sold
   * @param direction 'buy' spends the native token (USDC) for the memecoin,
   *                  'sell' spends the memecoin for the native token
   */
  const swap = useCallback(
    async (amount: string, direction: 'buy' | 'sell') => {
      if (!walletClient || !publicClient || !address) {
        setError('Connect your wallet first.');
        setStep('error');
        return null;
      }
      if (!memecoin) {
        setError('Unknown token.');
        setStep('error');
        return null;
      }

      setError(null);
      setTxHash(null);

      try {
        const poolKey = (await publicClient.readContract({
          address: CONTRACTS.gemfotManager,
          abi: GemFotManagerAbi as any,
          functionName: 'poolKey',
          args: [memecoin as `0x${string}`],
        })) as PoolKeyStruct;

        const tokenIn = (
          direction === 'buy' ? CONTRACTS.nativeToken : memecoin
        ).toLowerCase() as `0x${string}`;

        const decimalsIn = direction === 'buy' ? CONTRACTS.nativeTokenDecimals : 18;
        const amountIn = parseUnits(amount || '0', decimalsIn);
        if (amountIn <= 0n) throw new Error('Enter an amount greater than zero.');

        // zeroForOne is true when we sell currency0 for currency1
        const zeroForOne = poolKey.currency0.toLowerCase() === tokenIn;

        /* ------------------------------------------------- approvals -- */
        const allowance = (await publicClient.readContract({
          address: tokenIn,
          abi: Erc20Abi as any,
          functionName: 'allowance',
          args: [address, CONTRACTS.poolSwap],
        })) as bigint;

        if (allowance < amountIn) {
          setStep('approving');
          const approveHash = await walletClient.writeContract({
            address: tokenIn,
            abi: Erc20Abi as any,
            functionName: 'approve',
            args: [CONTRACTS.poolSwap, maxUint256],
            account: address,
          });
          await publicClient.waitForTransactionReceipt({ hash: approveHash });
        }

        /* ------------------------------------------------------ swap -- */
        setStep('signing');
        const hash = await walletClient.writeContract({
          address: CONTRACTS.poolSwap,
          abi: PoolSwapAbi as any,
          functionName: 'swap',
          args: [
            poolKey,
            {
              zeroForOne,
              // negative = exact input
              amountSpecified: -amountIn,
              sqrtPriceLimitX96: zeroForOne ? MIN_SQRT_PRICE : MAX_SQRT_PRICE,
            },
          ],
          account: address,
        });

        setTxHash(hash);
        setStep('confirming');
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') throw new Error('Transaction reverted on-chain.');

        setStep('done');
        return hash;
      } catch (e: any) {
        const message: string =
          e?.shortMessage || e?.details || e?.message || 'Something went wrong.';
        setError(
          message.includes('User rejected') || message.includes('User denied')
            ? 'Transaction rejected in wallet.'
            : message
        );
        setStep('error');
        return null;
      }
    },
    [walletClient, publicClient, address, memecoin]
  );

  return {
    swap,
    step,
    error,
    txHash,
    reset,
    isBusy: ['approving', 'signing', 'confirming'].includes(step),
  };
}
