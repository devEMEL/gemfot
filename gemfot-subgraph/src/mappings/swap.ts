// import { Address, BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'

// import { Swap as SwapEvent } from '../../generated/PoolManager/PoolManager'
// import { Pool, PoolManager, Swap, Token } from '../../generated/schema'
// import { getSubgraphConfig, SubgraphConfig } from '../utils/chains'
// import { ONE_BD, ONE_BI, ZERO_BD } from '../utils/constants'
// import { convertTokenToDecimal, loadTransaction, safeDiv } from '../utils/index'
// import {
//   updatePoolDayData,
//   updatePoolHourData,
//   updateTokenDayData,
//   updateTokenHourData,
//   updateUniswapDayData,
// } from '../utils/intervalUpdates'
// import {
//   findNativePerToken,
//   getTrackedAmountUSD,
//   sqrtPriceX96ToTokenPrices,
// } from '../utils/pricing'

// export function handleSwap(event: SwapEvent): void {
//   handleSwapHelper(event)
// }


// export function handleSwapHelper(event: SwapEvent, subgraphConfig: SubgraphConfig = getSubgraphConfig()): void {
//   const poolManagerAddress = subgraphConfig.poolManagerAddress
//   const stablecoinWrappedNativePoolId = subgraphConfig.stablecoinWrappedNativePoolId
//   const stablecoinIsToken0 = subgraphConfig.stablecoinIsToken0
//   const wrappedNativeAddress = subgraphConfig.wrappedNativeAddress
//   const stablecoinAddresses = subgraphConfig.stablecoinAddresses
//   const minimumNativeLocked = subgraphConfig.minimumNativeLocked
//   const whitelistTokens = subgraphConfig.whitelistTokens

//   const poolManager = PoolManager.load(poolManagerAddress)!
//   const poolId = event.params.id.toHexString()
//   const pool = Pool.load(poolId)

//   if (!pool) {
//     log.warning('Pool not found: {}', [poolId])
//     return
//   }

//   const token0 = Token.load(pool.token0)
//   const token1 = Token.load(pool.token1)

//   if (token0 && token1) {
//     // amounts - 0/1 are token deltas: can be positive or negative
//     // Unlike V3, a negative amount represents that amount is being sent to the pool and vice versa, so invert the sign
//     const amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals).times(BigDecimal.fromString('-1'))
//     const amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals).times(BigDecimal.fromString('-1'))

//     // Update the pool feeTier with the fee from the swap event
//     // This is important for dynamic fee pools where we want to keep store the actual last fee rather storing the dynamic flag (8388608)
//     pool.feeTier = BigInt.fromI32(event.params.fee)

//     // need absolute amounts for volume
//     let amount0Abs = amount0
//     if (amount0.lt(ZERO_BD)) {
//       amount0Abs = amount0.times(BigDecimal.fromString('-1'))
//     }
//     let amount1Abs = amount1
//     if (amount1.lt(ZERO_BD)) {
//       amount1Abs = amount1.times(BigDecimal.fromString('-1'))
//     }

//     ////////////////////////////////////////////////////////


//     token0.derivedUSDC = findNativePerToken(token0, wrappedNativeAddress, stablecoinAddresses)
//     token1.derivedUSDC = findNativePerToken(token1, wrappedNativeAddress, stablecoinAddresses)

//     let amountTotalUSDTracked: BigDecimal

//     // get amount that should be tracked only - div 2 because cant count both input and output as volume
//     amountTotalUSDTracked = getTrackedAmountUSD(amount0Abs, token0, amount1Abs, token1, whitelistTokens).div(
//     BigDecimal.fromString('2'),
//     )
    
//     const feesUSD = amountTotalUSDTracked.times(pool.feeTier.toBigDecimal()).div(BigDecimal.fromString('1000000'))

//     // 3. Update pool prices
//     const prices = sqrtPriceX96ToTokenPrices(pool.sqrtPrice, token0, token1)
//     pool.token0Price = prices[0]
//     pool.token1Price = prices[1]

//     // 4. Update TVL
//     pool.totalValueLockedUSD = pool.totalValueLockedToken0
//       .times(token0.derivedUSDC)
//       .plus(pool.totalValueLockedToken1.times(token1.derivedUSDC))

      
//     // 5. Create and save the Swap entity
//     const transaction = loadTransaction(event)
//     const swap = new Swap(transaction.id.toString() + '-' + event.logIndex.toString())
//     swap.transaction = transaction.id
//     swap.timestamp = transaction.timestamp
//     swap.pool = pool.id
//     swap.token0 = pool.token0
//     swap.token1 = pool.token1
//     swap.sender = event.params.sender
//     swap.origin = event.transaction.from
//     swap.amount0 = amount0
//     swap.amount1 = amount1
//     swap.amountUSD = amountTotalUSDTracked
//     swap.sqrtPriceX96 = event.params.sqrtPriceX96
//     swap.tick = BigInt.fromI32(event.params.tick)
//     swap.logIndex = event.logIndex
//     swap.save()
// /////////////////////////////////////////////


//     // global updates
//     poolManager.txCount = poolManager.txCount.plus(ONE_BI)
//     poolManager.totalVolumeUSD = poolManager.totalVolumeUSD.plus(amountTotalUSDTracked)
//     poolManager.totalFeesUSD = poolManager.totalFeesUSD.plus(feesUSD)

//     // pool volume
//     pool.volumeToken0 = pool.volumeToken0.plus(amount0Abs)
//     pool.volumeToken1 = pool.volumeToken1.plus(amount1Abs)
//     pool.volumeUSD = pool.volumeUSD.plus(amountTotalUSDTracked)
//     pool.feesUSD = pool.feesUSD.plus(feesUSD)
//     pool.txCount = pool.txCount.plus(ONE_BI)

//     // Update the pool with the new active liquidity, price, and tick.
//     pool.liquidity = event.params.liquidity
//     pool.sqrtPrice = event.params.sqrtPriceX96
//     pool.tick = BigInt.fromI32(event.params.tick)

//     pool.totalValueLockedToken0 = pool.totalValueLockedToken0.plus(amount0)
//     pool.totalValueLockedToken1 = pool.totalValueLockedToken1.plus(amount1)
    

//     // update token0 data
//     token0.volume = token0.volume.plus(amount0Abs)
//     token0.totalValueLocked = token0.totalValueLocked.plus(amount0)
//     token0.volumeUSD = token0.volumeUSD.plus(amountTotalUSDTracked)
//     token0.feesUSD = token0.feesUSD.plus(feesUSD)
//     token0.txCount = token0.txCount.plus(ONE_BI)

//     // update token1 data
//     token1.volume = token1.volume.plus(amount1Abs)
//     token1.totalValueLocked = token1.totalValueLocked.plus(amount1)
//     token1.volumeUSD = token1.volumeUSD.plus(amountTotalUSDTracked)
//     token1.feesUSD = token1.feesUSD.plus(feesUSD)
//     token1.txCount = token1.txCount.plus(ONE_BI)

//     // updated pool rates
//     // const prices = sqrtPriceX96ToTokenPrices(pool.sqrtPrice, token0, token1)
//     // pool.token0Price = prices[0]
//     // pool.token1Price = prices[1]
    

//     // token0.derivedUSDC = findNativePerToken(token0, wrappedNativeAddress, stablecoinAddresses)
//     // token1.derivedUSDC = findNativePerToken(token1, wrappedNativeAddress, stablecoinAddresses)
//     ///
//     ///
  

//     const oldPoolTotalValueLockedUSD = pool.totalValueLockedUSD

//     pool.totalValueLockedUSD = pool.totalValueLockedToken0
//       .times(token0.derivedUSDC)
//       .plus(pool.totalValueLockedToken1.times(token1.derivedUSDC))

//     poolManager.totalValueLockedUSD = poolManager.totalValueLockedUSD
//       .minus(oldPoolTotalValueLockedUSD)
//       .plus(pool.totalValueLockedUSD)

      
//     token0.totalValueLockedUSD = token0.totalValueLocked.times(token0.derivedUSDC)
//     token1.totalValueLockedUSD = token1.totalValueLocked.times(token1.derivedUSDC)

//     // interval data
//     const uniswapDayData = updateUniswapDayData(event, poolManagerAddress)
//     const poolDayData = updatePoolDayData(event.params.id.toHexString(), event)
//     const poolHourData = updatePoolHourData(event.params.id.toHexString(), event)
//     const token0DayData = updateTokenDayData(token0, event)
//     const token1DayData = updateTokenDayData(token1, event)
//     const token0HourData = updateTokenHourData(token0, event)
//     const token1HourData = updateTokenHourData(token1, event)

//     // update volume metrics
//     uniswapDayData.volumeUSD = uniswapDayData.volumeUSD.plus(amountTotalUSDTracked)
//     uniswapDayData.feesUSD = uniswapDayData.feesUSD.plus(feesUSD)

//     poolDayData.volumeUSD = poolDayData.volumeUSD.plus(amountTotalUSDTracked)
//     poolDayData.volumeToken0 = poolDayData.volumeToken0.plus(amount0Abs)
//     poolDayData.volumeToken1 = poolDayData.volumeToken1.plus(amount1Abs)
//     poolDayData.feesUSD = poolDayData.feesUSD.plus(feesUSD)

//     poolHourData.volumeUSD = poolHourData.volumeUSD.plus(amountTotalUSDTracked)
//     poolHourData.volumeToken0 = poolHourData.volumeToken0.plus(amount0Abs)
//     poolHourData.volumeToken1 = poolHourData.volumeToken1.plus(amount1Abs)
//     poolHourData.feesUSD = poolHourData.feesUSD.plus(feesUSD)

//     token0DayData.volume = token0DayData.volume.plus(amount0Abs)
//     token0DayData.volumeUSD = token0DayData.volumeUSD.plus(amountTotalUSDTracked)
    
//     token0DayData.feesUSD = token0DayData.feesUSD.plus(feesUSD)

//     token0HourData.volume = token0HourData.volume.plus(amount0Abs)
//     token0HourData.volumeUSD = token0HourData.volumeUSD.plus(amountTotalUSDTracked)
//     token0HourData.feesUSD = token0HourData.feesUSD.plus(feesUSD)
//     token1DayData.volume = token1DayData.volume.plus(amount1Abs)
//     token1DayData.volumeUSD = token1DayData.volumeUSD.plus(amountTotalUSDTracked)
//     token1DayData.feesUSD = token1DayData.feesUSD.plus(feesUSD)
//     token1HourData.volume = token1HourData.volume.plus(amount1Abs)
//     token1HourData.volumeUSD = token1HourData.volumeUSD.plus(amountTotalUSDTracked)
//     token1HourData.feesUSD = token1HourData.feesUSD.plus(feesUSD)

//     token0DayData.save()
//     token1DayData.save()
//     uniswapDayData.save()
//     poolDayData.save()
//     poolHourData.save()
//     token0HourData.save()
//     token1HourData.save()


//     poolManager.save()
//     pool.save()
//     token0.save()
//     token1.save()
//   }
// }


import { BigDecimal, BigInt, log } from '@graphprotocol/graph-ts'

import { Swap as SwapEvent } from '../../generated/PoolManager/PoolManager'
import { Pool, PoolManager, Swap, Token } from '../../generated/schema'
import { getSubgraphConfig, SubgraphConfig } from '../utils/chains'
import { ONE_BI, ZERO_BD } from '../utils/constants'
import { convertTokenToDecimal, loadTransaction } from '../utils/index'
import {
  updatePoolDayData,
  updatePoolHourData,
  updateTokenDayData,
  updateTokenHourData,
  updateUniswapDayData,
} from '../utils/intervalUpdates'
import {
  findNativePerToken,
  getTrackedAmountUSD,
  sqrtPriceX96ToTokenPrices,
} from '../utils/pricing'

export function handleSwap(event: SwapEvent): void {
  handleSwapHelper(event)
}

export function handleSwapHelper(
  event: SwapEvent,
  subgraphConfig: SubgraphConfig = getSubgraphConfig(),
): void {
  log.debug('SWAP_HANDLER_ENTERED', [])
  const poolManagerAddress = subgraphConfig.poolManagerAddress
  const wrappedNativeAddress = subgraphConfig.wrappedNativeAddress
  const stablecoinAddresses = subgraphConfig.stablecoinAddresses
  const whitelistTokens = subgraphConfig.whitelistTokens

  const poolManager = PoolManager.load(poolManagerAddress)!
  const poolId = event.params.id.toHexString()
  const pool = Pool.load(poolId)

  if (!pool) {
    log.warning('Pool not found: {}', [poolId])
    return
  }

  const token0 = Token.load(pool.token0)
  const token1 = Token.load(pool.token1)

  if (!token0 || !token1) return

  // ─── 1. Raw amounts (Uniswap v4 sign convention: negate to get pool-relative delta) ───
  const amount0 = convertTokenToDecimal(event.params.amount0, token0.decimals)
  
  // .times(
  //   BigDecimal.fromString('-1'),
  // )
  const amount1 = convertTokenToDecimal(event.params.amount1, token1.decimals)
  
  // .times(
  //   BigDecimal.fromString('-1'),
  // )

  const amount0Abs = amount0.lt(ZERO_BD) ? amount0.times(BigDecimal.fromString('-1')) : amount0
  const amount1Abs = amount1.lt(ZERO_BD) ? amount1.times(BigDecimal.fromString('-1')) : amount1

  // ─── 2. Refresh token prices FIRST so all USD calcs use current prices ───
  token0.derivedUSDC = findNativePerToken(token0, wrappedNativeAddress, stablecoinAddresses)
  token1.derivedUSDC = findNativePerToken(token1, wrappedNativeAddress, stablecoinAddresses)

  // ─── 3. USD volume & fees ───
  const amountTotalUSDTracked = getTrackedAmountUSD(
    amount0Abs, token0, amount1Abs, token1, whitelistTokens,
  ).div(BigDecimal.fromString('2'))

  // Dynamic fee pools emit the actual fee in the event; store it over the init value
  pool.feeTier = BigInt.fromI32(event.params.fee)
  const feesUSD = amountTotalUSDTracked
    .times(pool.feeTier.toBigDecimal())
    .div(BigDecimal.fromString('1000000'))

  // ─── 4. Update pool state from event ───
  pool.liquidity = event.params.liquidity
  pool.sqrtPrice = event.params.sqrtPriceX96
  pool.tick = BigInt.fromI32(event.params.tick)

  const prices = sqrtPriceX96ToTokenPrices(pool.sqrtPrice, token0, token1)
  pool.token0Price = prices[0]
  pool.token1Price = prices[1]

  // ─── 5. TVL (token amounts first, then USD) ───
  pool.totalValueLockedToken0 = pool.totalValueLockedToken0.plus(amount0)
  pool.totalValueLockedToken1 = pool.totalValueLockedToken1.plus(amount1)

  const oldPoolTVLUSD = pool.totalValueLockedUSD
  pool.totalValueLockedUSD = pool.totalValueLockedToken0
    .times(token0.derivedUSDC)
    .plus(pool.totalValueLockedToken1.times(token1.derivedUSDC))

  // ─── 6. Volume & fee accumulators ───
  pool.volumeToken0 = pool.volumeToken0.plus(amount0Abs)
  pool.volumeToken1 = pool.volumeToken1.plus(amount1Abs)
  pool.volumeUSD = pool.volumeUSD.plus(amountTotalUSDTracked)
  pool.feesUSD = pool.feesUSD.plus(feesUSD)
  pool.txCount = pool.txCount.plus(ONE_BI)

  // ─── 7. PoolManager aggregates ───
  poolManager.txCount = poolManager.txCount.plus(ONE_BI)
  poolManager.totalVolumeUSD = poolManager.totalVolumeUSD.plus(amountTotalUSDTracked)
  poolManager.totalFeesUSD = poolManager.totalFeesUSD.plus(feesUSD)
  poolManager.totalValueLockedUSD = poolManager.totalValueLockedUSD
    .minus(oldPoolTVLUSD)
    .plus(pool.totalValueLockedUSD)

  // ─── 8. Token aggregates ───
  token0.volume = token0.volume.plus(amount0Abs)
  token0.volumeUSD = token0.volumeUSD.plus(amountTotalUSDTracked)
  token0.feesUSD = token0.feesUSD.plus(feesUSD)
  token0.txCount = token0.txCount.plus(ONE_BI)
  token0.totalValueLocked = token0.totalValueLocked.plus(amount0)
  token0.totalValueLockedUSD = token0.totalValueLocked.times(token0.derivedUSDC)

  token1.volume = token1.volume.plus(amount1Abs)
  token1.volumeUSD = token1.volumeUSD.plus(amountTotalUSDTracked)
  token1.feesUSD = token1.feesUSD.plus(feesUSD)
  token1.txCount = token1.txCount.plus(ONE_BI)
  token1.totalValueLocked = token1.totalValueLocked.plus(amount1)
  token1.totalValueLockedUSD = token1.totalValueLocked.times(token1.derivedUSDC)

  // ─── 9. Swap entity ───
  const transaction = loadTransaction(event)
  const swap = new Swap(transaction.id.toString() + '-' + event.logIndex.toString())
  swap.transaction = transaction.id
  swap.timestamp = transaction.timestamp
  swap.pool = pool.id
  swap.token0 = pool.token0
  swap.token1 = pool.token1
  swap.sender = event.params.sender
  swap.origin = event.transaction.from
  swap.amount0 = amount0
  swap.amount1 = amount1
  swap.amountUSD = amountTotalUSDTracked
  swap.sqrtPriceX96 = event.params.sqrtPriceX96
  swap.tick = BigInt.fromI32(event.params.tick)
  swap.logIndex = event.logIndex
  swap.save()

  // ─── 10. Time-series snapshots ───
  const uniswapDayData = updateUniswapDayData(event, poolManagerAddress)
  const poolDayData = updatePoolDayData(poolId, event)
  const poolHourData = updatePoolHourData(poolId, event)
  const token0DayData = updateTokenDayData(token0, event)
  const token1DayData = updateTokenDayData(token1, event)
  const token0HourData = updateTokenHourData(token0, event)
  const token1HourData = updateTokenHourData(token1, event)

  uniswapDayData.volumeUSD = uniswapDayData.volumeUSD.plus(amountTotalUSDTracked)
  uniswapDayData.feesUSD = uniswapDayData.feesUSD.plus(feesUSD)

  poolDayData.volumeUSD = poolDayData.volumeUSD.plus(amountTotalUSDTracked)
  poolDayData.volumeToken0 = poolDayData.volumeToken0.plus(amount0Abs)
  poolDayData.volumeToken1 = poolDayData.volumeToken1.plus(amount1Abs)
  poolDayData.feesUSD = poolDayData.feesUSD.plus(feesUSD)

  poolHourData.volumeUSD = poolHourData.volumeUSD.plus(amountTotalUSDTracked)
  poolHourData.volumeToken0 = poolHourData.volumeToken0.plus(amount0Abs)
  poolHourData.volumeToken1 = poolHourData.volumeToken1.plus(amount1Abs)
  poolHourData.feesUSD = poolHourData.feesUSD.plus(feesUSD)

  token0DayData.volume = token0DayData.volume.plus(amount0Abs)
  token0DayData.volumeUSD = token0DayData.volumeUSD.plus(amountTotalUSDTracked)
  token0DayData.feesUSD = token0DayData.feesUSD.plus(feesUSD)

  token1DayData.volume = token1DayData.volume.plus(amount1Abs)
  token1DayData.volumeUSD = token1DayData.volumeUSD.plus(amountTotalUSDTracked)
  token1DayData.feesUSD = token1DayData.feesUSD.plus(feesUSD)

  token0HourData.volume = token0HourData.volume.plus(amount0Abs)
  token0HourData.volumeUSD = token0HourData.volumeUSD.plus(amountTotalUSDTracked)
  token0HourData.feesUSD = token0HourData.feesUSD.plus(feesUSD)

  token1HourData.volume = token1HourData.volume.plus(amount1Abs)
  token1HourData.volumeUSD = token1HourData.volumeUSD.plus(amountTotalUSDTracked)
  token1HourData.feesUSD = token1HourData.feesUSD.plus(feesUSD)

  // ─── 11. Persist everything ───
  uniswapDayData.save()
  poolDayData.save()
  poolHourData.save()
  token0DayData.save()
  token1DayData.save()
  token0HourData.save()
  token1HourData.save()
  poolManager.save()
  pool.save()
  token0.save()
  token1.save()
}