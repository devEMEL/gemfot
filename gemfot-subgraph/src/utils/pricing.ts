import { BigDecimal, BigInt } from '@graphprotocol/graph-ts'

import { exponentToBigDecimal, safeDiv } from '../utils/index'
import { Pool, Token } from '../../generated/schema'
import { ADDRESS_ZERO, ONE_BD, ZERO_BD, ZERO_BI } from './constants'

const Q192 = BigInt.fromI32(2).pow(192 as u8)
export function sqrtPriceX96ToTokenPrices(
  sqrtPriceX96: BigInt,
  token0: Token,
  token1: Token
): BigDecimal[] {
  const token0Decimals = token0.decimals
  const token1Decimals = token1.decimals

  const num = sqrtPriceX96.times(sqrtPriceX96).toBigDecimal()
  const denom = BigDecimal.fromString(Q192.toString())
  const price1 = num.div(denom).times(exponentToBigDecimal(token0Decimals)).div(exponentToBigDecimal(token1Decimals))

  const price0 = safeDiv(BigDecimal.fromString('1'), price1)
  // return [price0, price1]
  return [price1, price0];

}

export function getNativePriceInUSD(stablecoinWrappedNativePoolId: string, stablecoinIsToken0: boolean): BigDecimal {
  const stablecoinWrappedNativePool = Pool.load(stablecoinWrappedNativePoolId)
  if (stablecoinWrappedNativePool !== null) {
    return stablecoinIsToken0 ? stablecoinWrappedNativePool.token0Price : stablecoinWrappedNativePool.token1Price
  } else {
    return ZERO_BD
  }
}

/**
 * Search through graph to find derived USDC per token.
 * @todo update to be derived USDC (add stablecoin estimates)
 **/
export function findNativePerToken(
  token: Token,
  wrappedNativeAddress: string,
  stablecoinAddresses: string[],
): BigDecimal {
  
  const whiteList = token.whitelistPools
  const stablecoins = stablecoinAddresses.map<string>(a => a.toLowerCase())

  if (token.id == wrappedNativeAddress || token.id == ADDRESS_ZERO) {
    return ONE_BD
  }


  // for now just take USD from pool with greatest TVL
  // need to update this to actually detect best rate based on liquidity distribution
  // let largestLiquidityETH = ZERO_BD
  let priceSoFar = ZERO_BD

  // hardcoded fix for incorrect rates
  // if whitelist includes token - get the safe price
  if (stablecoins.includes(token.id)) {
    priceSoFar = ONE_BD
  } else {
    for (let i = 0; i < whiteList.length; ++i) {
      const poolAddress = whiteList[i]
      const pool = Pool.load(poolAddress)

      if (pool) {
        // if (pool.liquidity.gt(ZERO_BI)) {
          if (pool.token0 == token.id) {
            // whitelist token is token1
            const token1 = Token.load(pool.token1)
            // get the derived usdc in pool
            if (token1) {
              let token1DerivedUSDC = token1.derivedUSDC as BigDecimal;
              if (stablecoinAddresses.includes(token1.id)) {
                token1DerivedUSDC = ONE_BD;
              }
              priceSoFar = pool.token0Price.times(token1DerivedUSDC);
              return priceSoFar;
            }
          }
          if (pool.token1 == token.id) {
            const token0 = Token.load(pool.token0)
            if (token0) {
              let token0DerivedUSDC = token0.derivedUSDC as BigDecimal;
              if (stablecoinAddresses.includes(token0.id)) {
                token0DerivedUSDC = ONE_BD;
              }
              priceSoFar = pool.token1Price.times(token0DerivedUSDC);
              return priceSoFar;
            }
          }
        }
      }
    // }
  }
  return priceSoFar
}

/**
 * Accepts tokens and amounts, return tracked amount based on token whitelist
 * If one token on whitelist, return amount in that token converted to USD * 2.
 * If both are, return sum of two amounts
 * If neither is, return 0
 */
export function getTrackedAmountUSD(
  tokenAmount0: BigDecimal,
  token0: Token,
  tokenAmount1: BigDecimal,
  token1: Token,
  whitelistTokens: string[],
): BigDecimal {

  const price0USD = token0.derivedUSDC
  const price1USD = token1.derivedUSDC

  // both are whitelist tokens, return sum of both amounts
  if (whitelistTokens.includes(token0.id) && whitelistTokens.includes(token1.id)) {
    return tokenAmount0.times(price0USD).plus(tokenAmount1.times(price1USD))
  }

  // take double value of the whitelisted token amount
  if (whitelistTokens.includes(token0.id) && !whitelistTokens.includes(token1.id)) {
    return tokenAmount0.times(price0USD).times(BigDecimal.fromString('2'))
  }

  // take double value of the whitelisted token amount
  if (!whitelistTokens.includes(token0.id) && whitelistTokens.includes(token1.id)) {
    return tokenAmount1.times(price1USD).times(BigDecimal.fromString('2'))
  }

  // neither token is on white list, tracked amount is 0
  return ZERO_BD
}

export function calculateAmountUSD(
  amount0: BigDecimal,
  amount1: BigDecimal,
  token0DerivedUSDC: BigDecimal,
  token1DerivedUSDC: BigDecimal,
): BigDecimal {
  return amount0.times(token0DerivedUSDC).plus(amount1.times(token1DerivedUSDC))
}
