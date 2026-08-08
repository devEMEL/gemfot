/**
 * Client-side replication of the on-chain fair-launch bonding curve math
 * (LinearBondingCurve.sol + FairLaunch.fillFromPosition) so the frontend can
 * show an exact "estimated receive" that matches the real trade tape.
 *
 * All arithmetic mirrors the Solidity integer math (floor division, floor sqrt)
 * using BigInt, so the quote is bit-for-bit identical to what
 * `GemFotManager.buyFairLaunch` computes for the same inputs.
 */

const ONE_E_18 = 10n ** 18n;

/** floor(a * b / denom), non-negative BigInts */
function mulDiv(a: bigint, b: bigint, denom: bigint): bigint {
  if (a === 0n || b === 0n) return 0n;
  return (a * b) / denom;
}

/** floor integer square root */
function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  let x = n;
  let y = (x + 1n) / 2n;
  while (y < x) {
    x = y;
    y = (x + n / x) / 2n;
  }
  return x;
}

/**
 * p0 = (M / S) / multiple, scaled by 1e18, floored at the minimum
 * representable price (1 native wei per whole token). Mirrors
 * `LinearBondingCurve.computeP0`.
 */
export function computeP0(targetMarketCap: bigint, maxSupply: bigint, multiple: bigint): bigint {
  if (maxSupply <= 0n) return 0n;
  const p0_ = mulDiv(targetMarketCap, ONE_E_18, maxSupply * multiple);
  return p0_ === 0n ? 1n : p0_;
}

/**
 * Tokens received for `nativeIn`, starting from `sold` tokens already sold.
 * Mirrors `LinearBondingCurve.calculateBuyAmount` exactly.
 */
export function calculateBuyAmount(
  targetMarketCap: bigint,
  maxSupply: bigint,
  p0: bigint,
  sold: bigint,
  nativeIn: bigint
): bigint {
  if (sold > maxSupply) throw new Error('Already at max bonding curve supply');
  if (nativeIn === 0n) return 0n;

  const initialMarketCapFloor = mulDiv(p0, maxSupply, ONE_E_18);

  // Flat price region: M doesn't exceed the floor, so price is constant p0.
  if (targetMarketCap <= initialMarketCapFloor) {
    return mulDiv(nativeIn, ONE_E_18, p0);
  }

  const kNumerator = targetMarketCap - initialMarketCapFloor;

  // b = currentPrice(sold), in real (unscaled) price units.
  const b = p0 + mulDiv(mulDiv(kNumerator, sold, maxSupply), ONE_E_18, maxSupply);

  // T = S_real * b = maxSupply * b / 1e18.
  const T = mulDiv(maxSupply, b, ONE_E_18);

  // discriminant = T^2 + 2*K*C
  const discriminant = T * T + 2n * kNumerator * nativeIn;

  const sqrtDiscriminant = isqrt(discriminant);

  // tokensOut = maxSupply * (sqrt(discriminant) - T) / K
  return mulDiv(maxSupply, sqrtDiscriminant - T, kNumerator);
}

export interface FairLaunchQuoteParams {
  targetMarketCap: string;
  initialTokenFairLaunch: string;
  multiple: string;
  remainingSupply: string;
}

/**
 * Full quote for a fair-launch buy, mirroring `FairLaunch.fillFromPosition`
 * (curve math + remaining-supply cap that scales nativeIn back proportionally).
 */
export function quoteFairLaunchBuy(
  params: FairLaunchQuoteParams,
  nativeIn: bigint
): { nativeIn: bigint; tokensOut: bigint } {
  const M = BigInt(params.targetMarketCap || '0');
  const S = BigInt(params.initialTokenFairLaunch || '0');
  const multiple = BigInt(params.multiple || '1');
  const remainingSupply = BigInt(params.remainingSupply ?? S);
  const sold = S - remainingSupply;

  const p0 = computeP0(M, S, multiple);
  let tokensOut = calculateBuyAmount(M, S, p0, sold, nativeIn);

  // If the computed tokens exceed what's left in the fair launch, cap the tokens
  // and scale back nativeIn proportionally (mirrors the on-chain behavior).
  let effectiveNativeIn = nativeIn;
  if (tokensOut > remainingSupply) {
    const percentage = (remainingSupply * ONE_E_18) / tokensOut;
    effectiveNativeIn = (nativeIn * percentage) / ONE_E_18;
    tokensOut = remainingSupply;
  }

  return { nativeIn: effectiveNativeIn, tokensOut };
}
