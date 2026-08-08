import { useCallback, useState } from 'react';
import { useAccount, usePublicClient, useWalletClient } from 'wagmi';
import { parseUnits, parseEventLogs } from 'viem';
import { CONTRACTS } from '@/config/networks';
import GemFotManagerAbi from '@/abi/GemFotManager.json';
import { uploadTokenMetadata } from '@/lib/pinata';

/** Default supply minted for a memecoin (100 billion, 18 decimals) */
export const DEFAULT_TOTAL_SUPPLY = 100_000_000_000n * 10n ** 18n;

export interface LaunchFormValues {
  name: string;
  symbol: string;
  description: string;
  image: File | null;
  /** Total supply minted, in whole tokens (human units) */
  totalSupply: string;
  /** % of total supply sold on the fair launch curve (e.g. 40) */
  fairLaunchPercent: number;
  /** Fair launch window in seconds */
  fairLaunchDuration: number;
  /** Target market cap for the curve, in USDC (human units) */
  targetMarketCap: string;
  /** Multiple applied to the curve end price (uint8) */
  multiple: number;
  /** Creator share of swap fees as a % (mapped to uint24, 100_00 = 100%) */
  creatorFeeAllocationPercent: number;
  /** Optional premine, % of total supply bought by the creator at launch */
  preminePercent: number;
  /** Seconds from now until the pool opens (0 = immediately) */
  startsInSeconds: number;
}

export type LaunchStep = 'idle' | 'uploading' | 'approving' | 'signing' | 'confirming' | 'done' | 'error';

export interface LaunchResult {
  txHash: `0x${string}`;
  memecoin: `0x${string}`;
  poolId: `0x${string}`;
  tokenUri: string;
}

export function useLaunchToken() {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [step, setStep] = useState<LaunchStep>('idle');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LaunchResult | null>(null);

  const reset = useCallback(() => {
    setStep('idle');
    setError(null);
    setResult(null);
  }, []);

  const launch = useCallback(
    async (values: LaunchFormValues): Promise<LaunchResult | null> => {
      if (!walletClient || !address || !publicClient) {
        setError('Connect your wallet first.');
        setStep('error');
        return null;
      }

      setError(null);
      setResult(null);

      try {
        /* ------------------------------------------------ 1. IPFS ---- */
        setStep('uploading');
        const { tokenUri } = await uploadTokenMetadata(
          {
            name: values.name.trim(),
            symbol: values.symbol.trim().toUpperCase(),
            description: values.description.trim(),
          },
          values.image
        );

        /* --------------------------------------- 2. Build params ----- */
        const totalSupply =
          values.totalSupply && Number(values.totalSupply) > 0
            ? parseUnits(values.totalSupply, 18)
            : DEFAULT_TOTAL_SUPPLY;

        const initialTokenFairLaunch =
          (totalSupply * BigInt(Math.round(values.fairLaunchPercent * 100))) / 10_000n;

        // Premine is specified as a % of the fair launch supply
        const premineAmount =
          values.preminePercent > 0
            ? (initialTokenFairLaunch * BigInt(Math.round(values.preminePercent * 100))) / 10_000n
            : 0n;

        const usdcMarketCap = parseUnits(
          values.targetMarketCap || '0',
          CONTRACTS.nativeTokenDecimals
        );

        const nowSec = BigInt(Math.floor(Date.now() / 1000));
        const launchAt = values.startsInSeconds > 0 ? nowSec + BigInt(values.startsInSeconds) : 0n;

        // Matches GemFotManager.LaunchParams
        const params = {
          name: values.name.trim(),
          symbol: values.symbol.trim().toUpperCase(),
          tokenUri,
          initialTokenFairLaunch,
          fairLaunchDuration: BigInt(values.fairLaunchDuration),
          premineAmount,
          creator: address,
          creatorFeeAllocation: Math.round(values.creatorFeeAllocationPercent * 100), // uint24
          launchAt,
          totalSupply,
          usdcMarketCap,
          multiple: Math.max(1, Math.min(255, Math.round(values.multiple))), // uint8
        };

        // Query launch fee (USDC native token)
        let launchFee = 0n;
        try {
          launchFee = (await publicClient.readContract({
            address: CONTRACTS.gemfotManager,
            abi: GemFotManagerAbi as any,
            functionName: 'getLaunchingFee',
          })) as bigint;
        } catch {
          launchFee = parseUnits('10', CONTRACTS.nativeTokenDecimals);
        }

        /* -------------------------------- 3. Approve USDC fee -------- */
        if (launchFee > 0n) {
          const currentAllowance = (await publicClient.readContract({
            address: CONTRACTS.nativeToken,
            abi: [
              {
                inputs: [
                  { name: 'owner', type: 'address' },
                  { name: 'spender', type: 'address' },
                ],
                name: 'allowance',
                outputs: [{ name: '', type: 'uint256' }],
                stateMutability: 'view',
                type: 'function',
              },
            ],
            functionName: 'allowance',
            args: [address, CONTRACTS.gemfotManager],
          })) as bigint;

          if (currentAllowance < launchFee) {
            setStep('approving');
            const approveTxHash = await walletClient.writeContract({
              address: CONTRACTS.nativeToken,
              abi: [
                {
                  inputs: [
                    { name: 'spender', type: 'address' },
                    { name: 'amount', type: 'uint256' },
                  ],
                  name: 'approve',
                  outputs: [{ name: '', type: 'bool' }],
                  stateMutability: 'nonpayable',
                  type: 'function',
                },
              ],
              functionName: 'approve',
              args: [CONTRACTS.gemfotManager, launchFee],
              account: address,
            });

            await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
          }
        }

        /* ---------------------------------------- 4. Send launch tx -- */
        console.log('GemFot Launch Parameters:', {
          formValues: values,
          contractParams: {
            ...params,
            initialTokenFairLaunch: params.initialTokenFairLaunch.toString(),
            fairLaunchDuration: params.fairLaunchDuration.toString(),
            premineAmount: params.premineAmount.toString(),
            launchAt: params.launchAt.toString(),
            totalSupply: params.totalSupply.toString(),
            usdcMarketCap: params.usdcMarketCap.toString(),
          },
          launchFee: launchFee.toString(),
        });

        setStep('signing');
        const txHash = await walletClient.writeContract({
          address: CONTRACTS.gemfotManager,
          abi: (GemFotManagerAbi as any).abi || GemFotManagerAbi,
          functionName: 'launch',
          args: [params],
          account: address,
        });

        setStep('confirming');
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        if (receipt.status !== 'success') {
          throw new Error('Transaction reverted on-chain.');
        }

        const logs = parseEventLogs({
          abi: GemFotManagerAbi as any,
          logs: receipt.logs,
          eventName: 'PoolCreated',
        }) as any[];

        const created = logs[0];
        const launchResult: LaunchResult = {
          txHash,
          memecoin: (created?.args?._memecoin ?? '0x') as `0x${string}`,
          poolId: (created?.args?._poolId ?? '0x') as `0x${string}`,
          tokenUri,
        };

        setResult(launchResult);
        setStep('done');
        return launchResult;
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
    [walletClient, address, publicClient]
  );

  return {
    launch,
    step,
    error,
    result,
    reset,
    isBusy: ['uploading', 'approving', 'signing', 'confirming'].includes(step),
  };
}
