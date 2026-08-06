import { ethers } from "ethers"

export const formatPrice = (price: string) => {
  const num = parseFloat(price)
  if (num === 0) return "0"

  // subscript digits map
  const subscriptMap: Record<string, string> = {
    '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
    '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉'
  }

  if (num < 0.0001) {
    // count leading zeros after decimal point
    const str         = num.toFixed(20)

    const afterDecimal = str.split('.')[1]
    let zeroCount     = 0
    for (const char of afterDecimal) {
      if (char === '0') zeroCount++
      else break
    }
    const significant = afterDecimal.slice(zeroCount, zeroCount + 4).replace(/0+$/, '')
    const subscript   = String(zeroCount).split('').map(d => subscriptMap[d]).join('')
    return `0.0${subscript}${significant}`
    // 0.000001 → "0.0₅1"
    // 0.0000034 → "0.0₅34"
  }

  if (num < 1) return num.toFixed(6).replace(/0+$/, '')   // trim trailing zeros
  if (Number.isInteger(num)) return num.toLocaleString("en-US")
  if (num < 1000) return num.toFixed(4).replace(/0+$/, '')
  return num.toLocaleString("en-US", { maximumFractionDigits: 2 })
}

export const getDisplayPrice = (pool: any) => {
    if (!pool) return '';
    
    const t0Sym = pool.token0?.symbol || '';
    const t1Sym = pool.token1?.symbol || '';
    
    const getPriority = (symbol: string) => {
      const sym = symbol.toUpperCase();
      if (sym === 'USDC') return 100;
      if (sym === 'EURC') return 90;
      if (sym === 'MUSDC') return 80;
      if (sym === 'USDT' || sym === 'DAI') return 70;
      if (sym === 'ETH' || sym === 'WETH') return 50;
      return 0;
    };
    
    const p0 = getPriority(t0Sym);
    const p1 = getPriority(t1Sym);
    
    let baseSymbol = t0Sym;
    let quoteSymbol = t1Sym;
    let rawPrice = pool.token0Price || '0';
    
    if (p0 > p1) {
      baseSymbol = t1Sym;
      quoteSymbol = t0Sym;
      rawPrice = pool.token1Price || '0';
    }
    
    // const formattedPrice = Number(formatPrice(rawPrice)).toFixed(3);
    const formattedPrice = formatPrice(rawPrice);

    
    const qSymUpper = quoteSymbol.toUpperCase();
    if (qSymUpper === 'USDC' || qSymUpper === 'MUSDC' || qSymUpper === 'USDT') {
      return `1 ${baseSymbol} = $${formattedPrice}`;
    } else if (qSymUpper === 'EURC') {
      return `1 ${baseSymbol} = €${formattedPrice}`;
    } else {
      return `1 ${baseSymbol} = ${formattedPrice} ${quoteSymbol}`;
    }
  };

  const computePoolId = (poolKey: { currency0: string; currency1: string; fee: number; tickSpacing: number; hooks: string }) => {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint24", "int24", "address"],
      [
        poolKey.currency0,
        poolKey.currency1,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks,
      ]
    );
    return ethers.keccak256(encoded);
  };