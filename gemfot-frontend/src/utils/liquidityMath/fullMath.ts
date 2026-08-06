import { toBigInt } from 'ethers';
// https://github.com/Uniswap/sdks/blob/30b98e09d0486cd5cc3e4360e3277eb7cb60d2d5/sdks/v3-sdk/src/utils/fullMath.ts#L4
export abstract class FullMath {
  // public static mulDivRoundingUp(a: BigInt, b: BigInt, denominator: BigInt): BigInt {
  //   const product = a.times(b)
  //   let result = product.div(denominator)
  //   if (!product.mod(denominator).isZero()) result = result.plus(ONE_BI)
  //   return result
  // }

}

export function sqrtRatioX96ToPrice(sqrtRatioX96: bigint | string | number, token0Decimals: number, token1Decimals: number): [number, number] {
  const sqrtPriceStr = sqrtRatioX96.toString()
  const sqrtPriceNum = parseFloat(sqrtPriceStr)
  const q96 = Math.pow(2, 96)
  const ratio = sqrtPriceNum / q96
  const price0 = (ratio * ratio) / Math.pow(10, token1Decimals - token0Decimals)
  const price1 = price0 > 0 ? 1 / price0 : 0
  return [price0, price1]
}
