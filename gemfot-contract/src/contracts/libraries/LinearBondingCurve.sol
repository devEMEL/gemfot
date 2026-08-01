// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title LinearBondingCurve
 * @notice Computes linear bonding curve pricing with a non-zero starting price floor (p0).
 * Price in $
 * Price formula: price(x) = p0 + ((M/S - p0) / S) * x
 * Cost formula: cost(x, Δx) = p0 * Δx + ((M - p0*S) / (2*S^2)) * (2*x*Δx + (Δx)^2)
 */
library LinearBondingCurve {
    /**
     * @notice Computes the cost in reserve currency to purchase `amount` tokens starting at `sold` tokens.
     * @param targetMarketCap M - The target market cap valuation at max supply (in reserve currency units, e.g. USDC 6 decimals)
     * @param maxSupply S - Total supply of tokens available on the curve (e.g. 18 decimals)
     * @param p0 Starting price floor at x = 0
     * @param sold x - Amount of tokens sold so far
     * @param amount Δx - Amount of tokens to purchase
     * @return cost Total cost required in reserve currency
     */
    function calculateBuyCost(
        uint256 targetMarketCap,
        uint256 maxSupply,
        uint256 p0,
        uint256 sold,
        uint256 amount
    ) internal pure returns (uint256 cost) {
        require(sold + amount <= maxSupply, "Exceeds max bonding curve supply");
        if (amount == 0) return 0;

        // Base cost from floor price p0 * Δx
        uint256 baseCost = (p0 * amount) / 1e18;

        // Ensure target market cap is >= initial market cap floor
        uint256 initialMarketCapFloor = (p0 * maxSupply) / 1e18;
        if (targetMarketCap <= initialMarketCapFloor) {
            return baseCost;
        }

        uint256 kNumerator = targetMarketCap - initialMarketCapFloor;

        // deltaTerm = 2 * x * Δx + (Δx)^2
        uint256 deltaTerm = (2 * sold * amount) + (amount * amount);

        // slopeCost = (kNumerator * deltaTerm) / (2 * S^2)
        uint256 slopeCost = (kNumerator * deltaTerm) / (2 * maxSupply * maxSupply);

        cost = baseCost + slopeCost; // output lands in 6 decimals, we good
    }

    /**
     * @notice Computes the current token price given `sold` tokens.
     */
    function currentPrice(
        uint256 targetMarketCap,
        uint256 maxSupply,
        uint256 p0,
        uint256 sold
    ) internal pure returns (uint256) {
        if (maxSupply == 0) return p0;
        uint256 initialMarketCapFloor = (p0 * maxSupply) / 1e18;
        if (targetMarketCap <= initialMarketCapFloor) {
            return p0;
        }
        uint256 kNumerator = targetMarketCap - initialMarketCapFloor;
        return p0 + (kNumerator * sold) / (maxSupply * maxSupply);
    }

    /**
     * @notice Computes the starting price floor (p0) required to achieve a specific target raise. Each token has itw own p0
     * @param targetMarketCap M - The target market cap valuation at max supply
     * @param targetRaise R - The exact total amount we want to raise
     * @param maxSupply S - Total supply of tokens available on the curve
     * @return p0 The required starting price floor, scaled by 1e18
     */
    function computeP0(
        uint256 targetMarketCap,
        uint256 targetRaise,
        uint256 maxSupply
    ) internal pure returns (uint256 p0) {
        require(maxSupply > 0, "Max supply must be positive");
        require(2 * targetRaise >= targetMarketCap, "Raise too low for standard linear curve (min 50% of M)");
        require(targetRaise <= targetMarketCap, "Raise cannot exceed market cap (max 100% of M)");
        
        uint256 numerator = (2 * targetRaise) - targetMarketCap;
        return (numerator * 1e18) / maxSupply;
    }
}
