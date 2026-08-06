const Q96 = 2n ** 96n;

/**
 * Calculates floor(a * b / denominator)
 * Note: In JS, BigInt handles arbitrary precision, so we don't 
 * need the complex overflow logic Solidity requires.
 */
function mulDiv(a: bigint | number, b: bigint | number, denominator: bigint | number): bigint {
    const result = (BigInt(a) * BigInt(b)) / BigInt(denominator);
    return result;
}

/**
/**
 * Validates uint128 overflow
 */
function toUint128(x: bigint | number): bigint {
    const value = BigInt(x);
    const uint128Max = (2n ** 128n) - 1n;
    if (value < 0n || value > uint128Max) throw new Error("Liquidity overflow");
    return value;
}

const MIN_TICK = -887272;
const MAX_TICK = 887272;



function bigIntSqrt(n: bigint): bigint {
  if (n < 0n) throw new Error('sqrt of negative');
  if (n === 0n) return 0n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

export const priceToSqrtPriceX96 = (price: number, decimals0: number, decimals1: number): bigint => {
  // Convert price to a BigInt-safe fixed-point integer (18 decimal places of precision)
  const SCALE = 10n ** 18n;
  const Q96 = 2n ** 96n;

  // e.g. price=100.5 → 100500000000000000000n
  // Instead of multiplying as float then converting, scale carefully
  const PRECISION = 10n ** 9n; // safe for float multiplication
  const priceBig = BigInt(Math.round(price * Number(PRECISION))) * (SCALE / PRECISION);

  // raw price = human price * 10^decimals1 / 10^decimals0
  const decimalAdjNumerator = 10n ** BigInt(decimals1);
  const decimalAdjDenominator = 10n ** BigInt(decimals0);

  // adjustedPrice * SCALE (keep SCALE^2 so sqrt brings it back to SCALE)
  const adjustedPriceScaled = priceBig * decimalAdjNumerator * SCALE / decimalAdjDenominator;

  // sqrt(adjustedPrice * SCALE^2) = sqrt(adjustedPrice) * SCALE
  const sqrtAdjusted = bigIntSqrt(adjustedPriceScaled); // = sqrt(adjustedPrice) * SCALE

  // multiply by Q96 then divide out the SCALE
  return sqrtAdjusted * Q96 / SCALE;
}

export const sqrtPriceX96ToPrice = (
  sqrtPriceX96: bigint,
  decimals0: number,
  decimals1: number
): number => {
  const Q96 = 2n ** 96n;
  const SCALE = 10n ** 18n;

  const priceScaled = (sqrtPriceX96 * sqrtPriceX96 * SCALE) / (Q96 * Q96);
  const rawPrice = Number(priceScaled) / Number(SCALE);

  const decimalAdjustment = Math.pow(10, decimals0 - decimals1);
  return rawPrice * decimalAdjustment;
};


export const tickToPrice = (tick: number, decimals0: number, decimals1: number): number => {
  return sqrtPriceX96ToPrice(getSqrtRatioAtTick(tick), decimals0, decimals1);
};


/**
 * Replicates TickMath.getSqrtRatioAtTick from Solidity
 * Calculates sqrt(1.0001^tick) * 2^96
*/

export const getSqrtRatioAtTick = (tick: number): bigint => {
    const absTick = tick < 0 ? -tick : tick;
    if (absTick > MAX_TICK) throw new Error("TICK_OUT_OF_BOUNDS");

    let ratio = (absTick & 0x1) !== 0
        ? 0xfffcb933bd6fad37aa2d162d1a594001n
        : 0x100000000000000000000000000000000n;

    if ((absTick & 0x2) !== 0)     ratio = (ratio * 0xfff97272373d413259a46990580e213an) >> 128n;
    if ((absTick & 0x4) !== 0)     ratio = (ratio * 0xfff2e50f5f656932ef12357cf3c7fdccn) >> 128n;
    if ((absTick & 0x8) !== 0)     ratio = (ratio * 0xffe5caca7e10e4e61c3624eaa0941cd0n) >> 128n;
    if ((absTick & 0x10) !== 0)    ratio = (ratio * 0xffcb9843d60f6159c9db58835c926644n) >> 128n;
    if ((absTick & 0x20) !== 0)    ratio = (ratio * 0xff973b41fa98c081472e6896dfb254c0n) >> 128n;
    if ((absTick & 0x40) !== 0)    ratio = (ratio * 0xff2ea16466c96a3843ec78b326b52861n) >> 128n;
    if ((absTick & 0x80) !== 0)    ratio = (ratio * 0xfe5dee046a99a2a811c461f1969c3053n) >> 128n;
    if ((absTick & 0x100) !== 0)   ratio = (ratio * 0xfcbe86c7900a88aedcffc83b479aa3a4n) >> 128n;
    if ((absTick & 0x200) !== 0)   ratio = (ratio * 0xf987a7253ac413176f2b074cf7815e54n) >> 128n;
    if ((absTick & 0x400) !== 0)   ratio = (ratio * 0xf3392b0822b70005940c7a398e4b70f3n) >> 128n;
    if ((absTick & 0x800) !== 0)   ratio = (ratio * 0xe7159475a2c29b7443b29c7fa6e889d9n) >> 128n;
    if ((absTick & 0x1000) !== 0)  ratio = (ratio * 0xd097f3bdfd2022b8845ad8f792aa5825n) >> 128n;
    if ((absTick & 0x2000) !== 0)  ratio = (ratio * 0xa9f746462d870fdf8a65dc1f90e061e5n) >> 128n;
    if ((absTick & 0x4000) !== 0)  ratio = (ratio * 0x70d869a156d2a1b890bb3df62baf32f7n) >> 128n;
    if ((absTick & 0x8000) !== 0)  ratio = (ratio * 0x31be135f97d08fd981231505542fcfa6n) >> 128n;
    if ((absTick & 0x10000) !== 0) ratio = (ratio * 0x9aa508b5b7a84e1c677de54f3e99bc9n) >> 128n;
    if ((absTick & 0x20000) !== 0) ratio = (ratio * 0x5d6af8dedb81196699c329225ee604n) >> 128n;
    if ((absTick & 0x40000) !== 0) ratio = (ratio * 0x2216e584f5fa1ea926041bedfe98n) >> 128n;
    if ((absTick & 0x80000) !== 0) ratio = (ratio * 0x48a170391f7dc42444e8fa2n) >> 128n;

    if (tick > 0) ratio = (2n ** 256n - 1n) / ratio;

    // Round up
    const shifted = ratio >> 32n;
    const remainder = ratio % (1n << 32n);
    return remainder === 0n ? shifted : shifted + 1n;
};

export const sqrtPriceX96ToTick = (sqrtPriceX96: bigint): number => {
    const Q96 = 2n ** 96n;
    const SCALE = 10n ** 18n;

    const priceScaled = (sqrtPriceX96 * sqrtPriceX96 * SCALE) / (Q96 * Q96);
    const price = Number(priceScaled) / Number(SCALE);

    let tick = Math.floor(Math.log(price) / Math.log(1.0001));

    tick = Math.max(MIN_TICK, Math.min(MAX_TICK - 1, tick));

    while (getSqrtRatioAtTick(tick + 1) <= sqrtPriceX96) tick++;
    while (getSqrtRatioAtTick(tick) > sqrtPriceX96) tick--;

    return tick;
};


export const LiquidityAmounts = {
    getLiquidityForAmount0(
        sqrtPriceAX96: bigint | number,
        sqrtPriceBX96: bigint | number,
        amount0: bigint | number
    ) {
        let priceA = BigInt(sqrtPriceAX96);
        let priceB = BigInt(sqrtPriceBX96);
        const amt0 = BigInt(amount0);

        if (priceA > priceB) [priceA, priceB] = [priceB, priceA];
        
        const intermediate = mulDiv(priceA, priceB, Q96);
        return toUint128(mulDiv(amt0, intermediate, priceB - priceA));
    },

    getLiquidityForAmount1(
        sqrtPriceAX96: bigint | number,
        sqrtPriceBX96: bigint | number,
        amount1: bigint | number
    ) {
        let priceA = BigInt(sqrtPriceAX96);
        let priceB = BigInt(sqrtPriceBX96);
        const amt1 = BigInt(amount1);

        if (priceA > priceB) [priceA, priceB] = [priceB, priceA];
        
        return toUint128(mulDiv(amt1, Q96, priceB - priceA));
    },

    getAmountsForLiquidity(
        sqrtPriceX96: bigint | number,
        sqrtPriceAX96: bigint | number,
        sqrtPriceBX96: bigint | number,
        liquidity: bigint | number
    ) {
        let priceX = BigInt(sqrtPriceX96);
        let priceA = BigInt(sqrtPriceAX96);
        let priceB = BigInt(sqrtPriceBX96);
        const liq = BigInt(liquidity);

        // Standardize range: priceA must be the lower price
        if (priceA > priceB) [priceA, priceB] = [priceB, priceA];

        let amount0 = 0n;
        let amount1 = 0n;

        if (priceX <= priceA) {
            // Case 1: Price is below the range (Position is 100% Token 0)
            amount0 = this.getAmount0ForLiquidity(priceA, priceB, liq);
        } else if (priceX < priceB) {
            // Case 2: Price is inside the range (Position is a mix of both tokens)
            amount0 = this.getAmount0ForLiquidity(priceX, priceB, liq);
            amount1 = this.getAmount1ForLiquidity(priceA, priceX, liq);
        } else {
            // Case 3: Price is above the range (Position is 100% Token 1)
            amount1 = this.getAmount1ForLiquidity(priceA, priceB, liq);
        }

        return [amount0, amount1];
    },

    getLiquidityForAmounts(
        sqrtPriceX96: bigint | number,
        sqrtPriceAX96: bigint | number,
        sqrtPriceBX96: bigint | number,
        amount0: bigint | number,
        amount1: bigint | number
    ) {
        let priceX = BigInt(sqrtPriceX96);
        let priceA = BigInt(sqrtPriceAX96);
        let priceB = BigInt(sqrtPriceBX96);

        if (priceA > priceB) [priceA, priceB] = [priceB, priceA];

        if (priceX <= priceA) {
            return this.getLiquidityForAmount0(priceA, priceB, amount0);
        } else if (priceX < priceB) {
            const liquidity0 = this.getLiquidityForAmount0(priceX, priceB, amount0);
            const liquidity1 = this.getLiquidityForAmount1(priceA, priceX, amount1);
            return liquidity0 < liquidity1 ? liquidity0 : liquidity1;
        } else {
            return this.getLiquidityForAmount1(priceA, priceB, amount1);
        }
    },

    getAmount0ForLiquidity(
        sqrtPriceAX96: bigint | number,
        sqrtPriceBX96: bigint | number,
        liquidity: bigint | number
    ) {
        let priceA = BigInt(sqrtPriceAX96);
        let priceB = BigInt(sqrtPriceBX96);
        const liq = BigInt(liquidity);

        if (priceA > priceB) [priceA, priceB] = [priceB, priceA];

        // Solidity: (uint256(liquidity) << 96) * (priceB - priceA) / priceB / priceA
        return mulDiv(liq << 96n, priceB - priceA, priceB) / priceA;
    },

    getAmount1ForLiquidity(
        sqrtPriceAX96: bigint | number,
        sqrtPriceBX96: bigint | number,
        liquidity: bigint | number
    ) {
        let priceA = BigInt(sqrtPriceAX96);
        let priceB = BigInt(sqrtPriceBX96);
        const liq = BigInt(liquidity);

        if (priceA > priceB) [priceA, priceB] = [priceB, priceA];

        return mulDiv(liq, priceB - priceA, Q96);
    }
};