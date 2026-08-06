import { useState } from 'react'
import { useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi'
import { zeroAddress } from 'viem'
import type { ToastType } from '@/components/Toast';
import { TOKENS } from '@/config/tokens';
import POOL_MANAGER_ABI from '../../abi/PoolManager.json';
import { redis } from '@/lib/redis';
import { POOLMANAGER_ADDRESS } from '@/lib/constants';

import { priceToSqrtPriceX96, sqrtPriceX96ToTick } from '@/utils/liquidityMath/liquidityAmounts';

export interface Token {
  address: string
  symbol: string
  decimals: number
  name: string
  logo: string
}

export interface InitializePoolParams {
  tokenA: Token
  tokenB: Token
  fee: number
  tickSpacing: number
  hooks?: `0x${string}`
  priceRatioA: string 
  priceRatioB: string
}

interface ToastState {
  show: boolean
  type: ToastType
  title: string
  message: string
  txHash?: string
}


// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * sqrtPriceX96 = floor(sqrt(A / B) * 2 ** 96)
 */

////////////////////// OLD ///////////////


// function isqrt(n: bigint): bigint {
//   if (n < 0n) throw new Error("Square root of negative number")
//   if (n === 0n) return 0n
//   if (n === 1n) return 1n

//   let x = n
//   let y = (x + 1n) >> 1n

//   while (y < x) {
//     x = y
//     y = (x + n / x) >> 1n
//   }

//   return x
// }
// export function calculateSqrtPriceX96(amount1: bigint, amount0: bigint): bigint {
//   if (amount0 === 0n) throw new Error("amount0 cannot be zero")
//   if (amount1 === 0n) throw new Error("amount1 cannot be zero")

//   const numerator = amount1 << 192n   // amount1 * 2^192
//   const ratio     = numerator / amount0
//   return isqrt(ratio)
// }

// const sqrtPriceX96 = calculateSqrtPriceX96(
//         BigInt(priceRatio1) * 10n ** BigInt(token1.decimals),  // token1 raw
//         BigInt(priceRatio0) * 10n ** BigInt(token0.decimals)   // token0 raw
//       );




/////////////////////////////////


function isqrt(n: bigint): bigint {
  if (n < 0n) throw new Error("Square root of negative number")
  if (n === 0n) return 0n
  if (n === 1n) return 1n

  let x = n
  let y = (x + 1n) >> 1n

  while (y < x) {
    x = y
    y = (x + n / x) >> 1n
  }

  return x
}
export function calculateSqrtPriceX96(amount1: bigint, amount0: bigint): bigint {
  if (amount0 === 0n) throw new Error("amount0 cannot be zero")
  if (amount1 === 0n) throw new Error("amount1 cannot be zero")

  const numerator = amount1 << 192n   // amount1 * 2^192
  const ratio     = numerator / amount0
  return isqrt(ratio)
}

/**
 * if (tokenA > tokenB) { (token0, token1) = (tokenB, tokenA) }
 */
function sortTokens(tokenA: Token, tokenB: Token): [Token, Token] {
  return tokenA.address.toLowerCase() > tokenB.address.toLowerCase()
    ? [tokenB, tokenA]
    : [tokenA, tokenB]
}


// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePool() {
  const publicClient = usePublicClient()
  const { writeContractAsync } = useWriteContract()

  const [toast, setToast] = useState<ToastState>({
    show:    false,
    type:    'pending',
    title:   '',
    message: '',
    txHash:  undefined,
  })

  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [isInitializing, setIsInitializing] = useState(false)

  const { isLoading: isConfirmingTx } = useWaitForTransactionReceipt({ hash: txHash })
  const isConfirming = isConfirmingTx || isInitializing

  // ── Toast helpers ─────────────────────────────────────────────────────────

  function showToast(
    type: ToastType,
    title: string,
    message: string,
    txHash?: string
  ) {
    setToast({ show: true, type, title, message, txHash })
  }

  function dismissToast() {
    setToast(prev => ({ ...prev, show: false }))
  }


  // ── Main function ─────────────────────────────────────────────────────────

  async function initializePool({
    tokenA,
    tokenB,
    fee,
    tickSpacing,
    hooks,
    priceRatioA,
    priceRatioB,
  }: InitializePoolParams) {
 
    console.log({
      tokenA,
      tokenB,
      fee,
      tickSpacing,
      hooks,
      priceRatioA,
      priceRatioB,
    });

    // 1. Validate tokens are in our token list
    const tokenAInList = TOKENS.find(
      t => t.address.toLowerCase() === tokenA.address.toLowerCase()
    )
    const tokenBInList = TOKENS.find(
      t => t.address.toLowerCase() === tokenB.address.toLowerCase()
    )

    if (!tokenAInList) {
      showToast('error', 'Invalid Token', `${tokenA.symbol} is not in the supported token list.`)
      return
    }

    if (!tokenBInList) {
      showToast('error', 'Invalid Token', `${tokenB.symbol} is not in the supported token list.`)
      return
    }

    if (tokenA.address.toLowerCase() === tokenB.address.toLowerCase()) {
      showToast('error', 'Invalid Pair', 'Cannot create a pool with the same token on both sides.')
      return
    }

    try {
      setIsInitializing(true)
      // Sort tokens
      const [token0, token1] = sortTokens(tokenA, tokenB)
      const swapped = token0.address.toLowerCase() !== tokenA.address.toLowerCase();

      // Assign price ratios to match sorted order
      const priceRatio0 = swapped ? priceRatioB : priceRatioA  // ratio for token0
      const priceRatio1 = swapped ? priceRatioA : priceRatioB  // ratio for token1
      console.log({priceRatio0, priceRatio1});

      // Calculate sqrtPriceX96 with correct sorted ratios + decimals
      const sqrtPriceX96 = calculateSqrtPriceX96(
        BigInt(priceRatio1) * 10n ** BigInt(token1.decimals),  // token1 raw
        BigInt(priceRatio0) * 10n ** BigInt(token0.decimals)   // token0 raw
      );
      console.log({sqrtPriceX96Check1: sqrtPriceX96});
      const sqrtPriceX96Check2 = priceToSqrtPriceX96(100, 6, 18);

      console.log({sqrtPriceX96Check2: sqrtPriceX96Check2.toString()});

      // Build pool key
      const poolKey = {
        currency0:   token0.address as `0x${string}`,
        currency1:   token1.address as `0x${string}`,
        fee,
        tickSpacing,
        hooks,
      }

      // Log all params before contract call
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🏊 Initializing Pool — Params')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('PoolManager address :', POOLMANAGER_ADDRESS);

      console.log('Token0 (currency0) (decimals):', token0.symbol, token0.address, token0.decimals)
      console.log('Token1 (currency1) (decimals):', token1.symbol, token1.address, token1.decimals)
      console.log('Fee                :', fee, `(${fee / 10000}%)`)
      console.log('TickSpacing        :', tickSpacing)
      console.log('Hooks              :', hooks)
      console.log('Price Ratio        :', `${priceRatio0}:${priceRatio1}`)
      console.log('sqrtPriceX96       :', sqrtPriceX96.toString())
      console.log('Full Pool Key      :', poolKey)
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

      // Pending toast
      showToast(
        'pending',
        'Transaction Pending',
        `Initializing ${token0.symbol}/${token1.symbol} pool at ${priceRatio0}:${priceRatio1} ratio...`
      )

      // Call PoolManager.initialize
      console.log({
        poolKey, sqrtPriceX96
      });
      
      const hash = await writeContractAsync({
        address: POOLMANAGER_ADDRESS as `0x${string}`,
        abi: POOL_MANAGER_ABI.abi,
        functionName: 'initialize',
        args: [poolKey, sqrtPriceX96],
      })

      setTxHash(hash)

      showToast(
        'pending',
        'Transaction Submitted',
        `Initializing ${token0.symbol}/${token1.symbol} pool on-chain...`,
        hash
      )

      if (!publicClient) throw new Error("Public client not available");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'reverted') {
        throw new Error('Transaction reverted on-chain');
      }

      showToast(
        'success',
        'Pool Initialized!',
        `${token0.symbol}/${token1.symbol} pool created successfully.`,
        hash
      )

      try {
        await redis.del("mlswap:pools");
        console.log("Invalidated pools cache");
      } catch (e) {
        console.error("Failed to invalidate cache", e);
      }

      setIsInitializing(false)
      return hash

    } catch (err: any) {
      console.error('Pool initialization failed:', err)
      setIsInitializing(false)
      setTxHash(undefined)
      showToast(
        'error',
        'Transaction Failed',
        err?.shortMessage ?? err?.message ?? 'Pool initialization failed. Please try again.'
      )
    }
  }

  return {
    initializePool,
    isConfirming,
    toast,
    dismissToast,
  }
}