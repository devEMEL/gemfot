// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/**
 * @title LinearBondingCurve
 * @notice Computes linear bonding curve pricing with a non-zero starting price floor (p0).
 * Price in $
 * Price formula: price(x) = p0 + ((M/S - p0) / S) * x
 * Cost formula: cost(x, Δx) = p0 * Δx + ((M - p0*S) / (2*S^2)) * (2*x*Δx + (Δx)^2)
 */
library LinearBondingCurve {
    uint8 internal constant MIN_MULTIPLE = 1;
    uint8 internal constant MAX_MULTIPLE = 20;


    /**
    * @notice Computes the number of tokens received for a given amount of native
    * currency deposited, starting at `sold` tokens already sold.
    * @dev Inverts the cost integral by solving the quadratic:
    *      K*Δx^2 + 2*(b*S^2)*Δx - 2*S^2*C = 0
    *      where b = currentPrice(sold), K = M - p0*S, C = nativeIn.
    *      Solved as Δx = S^2 * (sqrt(b^2 + 2*K*C/S^2) - b) / K.
    *
    *      IMPORTANT: S^2 here must be S_real^2 (real token count squared), not
    *      maxSupply^2 directly. maxSupply is wei-scaled (S_real * 1e18), so squaring
    *      it raw inflates S^2 by 1e36x, which crushes the 2*K*C/S^2 correction term
    *      to 0 for any realistic buy size — silently returning tokensOut = 0 for
    *      every buyer. We instead work with T = S_real * b (via maxSupply * b / 1e18,
    *      which cancels one factor of the wei-scaling), keeping magnitudes correct
    *      without ever squaring the raw wei value.
    * @param targetMarketCap M - The target market cap valuation at max supply (in reserve currency units)
    * @param maxSupply S - Total supply of tokens available on the curve (e.g. 18 decimals)
    * @param p0 Starting price floor at x = 0
    * @param sold x - Amount of tokens sold so far
    * @param nativeIn C - Amount of native/reserve currency being deposited
    * @return tokensOut Total amount of tokens received for `nativeIn`
    */
    function calculateBuyAmount(
        uint256 targetMarketCap,
        uint256 maxSupply,
        uint256 p0,
        uint256 sold,
        uint256 nativeIn
    ) internal pure returns (uint256 tokensOut) {
        require(sold <= maxSupply, "Already at max bonding curve supply");
        if (nativeIn == 0) return 0;

        uint256 initialMarketCapFloor = Math.mulDiv(p0, maxSupply, 1e18);

        // Flat price region: M doesn't exceed the floor, so price is constant p0.
        if (targetMarketCap <= initialMarketCapFloor) {
            require(p0 > 0, "Zero price floor cannot be inverted");
            return Math.mulDiv(nativeIn, 1e18, p0);
        }

        uint256 kNumerator = targetMarketCap - initialMarketCapFloor;

        // b = currentPrice(sold), in real (unscaled) price units.
        uint256 b = p0 + Math.mulDiv(Math.mulDiv(kNumerator, sold, maxSupply), 1e18, maxSupply);

        // T = S_real * b = maxSupply * b / 1e18. This is the correctly-scaled
        // replacement for the old "S^2 * b" term — magnitude stays sane instead
        // of exploding by 1e18x from squaring raw wei supply.
        uint256 T = Math.mulDiv(maxSupply, b, 1e18);

        // discriminant = T^2 + 2*K*C  (equivalent to S_real^2 * (b^2 + 2*K*C/S_real^2),
        // just rearranged to avoid ever computing S_real^2 directly)
        uint256 discriminant = T * T + 2 * kNumerator * nativeIn;

        uint256 sqrtDiscriminant = Math.sqrt(discriminant);

        // Δx (wei) = maxSupply * (sqrt(discriminant) - T) / K
        tokensOut = Math.mulDiv(maxSupply, sqrtDiscriminant - T, kNumerator);
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
        uint256 initialMarketCapFloor = Math.mulDiv(p0, maxSupply, 1e18);
        if (targetMarketCap <= initialMarketCapFloor) {
            return p0;
        }
        uint256 kNumerator = targetMarketCap - initialMarketCapFloor;
        return p0 + Math.mulDiv(Math.mulDiv(kNumerator, sold, maxSupply), 1e18, maxSupply);
    }

    /**
     * @notice Computes the starting price floor (p0) required to achieve the
     * creator-chosen price multiple (peak price / starting price) across the
     * curve, given only the target market cap. The resulting raise is a fixed
     * fraction of M dependent on `multiple`, and should be surfaced on the
     * frontend rather than taken as a separate input.
     * @param targetMarketCap M - The target market cap valuation at max supply
     * @param maxSupply S - Total supply of tokens available on the curve
     * @param multiple Creator-chosen ratio of peak price to starting price (1-20, e.g. 10 for 10x)
     * @return p0 The required starting price floor
     */
    function computeP0(
        uint256 targetMarketCap,
        uint256 maxSupply,
        uint8 multiple
    ) internal pure returns (uint256 p0) {
        require(maxSupply > 0, "Max supply must be positive");
        require(multiple >= MIN_MULTIPLE && multiple <= MAX_MULTIPLE, "Multiple out of bounds");
        // p0 = (M/S) / multiple, scaled by 1e18, via mulDiv to avoid precision loss
        // for small maxSupply or large multiple.
        return Math.mulDiv(targetMarketCap, 1e18, maxSupply * multiple);
    }


     /**
    * @notice Computes the expected total raise at full sellout for a given
    * target market cap and multiple. Pure helper for frontends — not used in
    * the buy path.
    * @return raise R = M * (multiple + 1) / (2 * multiple)
    */
    function computeExpectedRaise(
        uint256 targetMarketCap,
        uint8 multiple
    ) internal pure returns (uint256 raise) {
        require(multiple >= MIN_MULTIPLE && multiple <= MAX_MULTIPLE, "Multiple out of bounds");
        return (targetMarketCap * (multiple + 1)) / (2 * multiple);
    }

}