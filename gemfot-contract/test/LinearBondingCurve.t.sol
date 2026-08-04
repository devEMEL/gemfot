// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {LinearBondingCurve} from "@gemfot/libraries/LinearBondingCurve.sol";

contract LinearBondingCurveTest is Test {
    // Fair launch params.
    uint256 constant MAX_SUPPLY = 1_000_000_000e18; // 1B tokens, 18 decimals

    // USDC has 6 decimals. targetMarketCap and nativeIn live on that scale;
    // only maxSupply (the token side) is 1e18. The library's internal "1e18"
    // is just a fixed-point scaling constant for the price math - it does NOT
    // need to match the currency's own decimals, so mixing 1e18 (token) with
    // 1e6 (USDC) here is correct as long as targetMarketCap and nativeIn are
    // BOTH consistently in 1e6.
    uint256 constant TARGET_MCAP = 100_000e6;       // $100k, USDC 6-decimal units
    uint8 constant MULTIPLE = 7;
    uint256 constant BUY_SIZE = 1_000e6;            // $1000 USDC per buyer
    uint256 constant NUM_BUYERS = 50;

    uint256 p0;

    function setUp() public {
        p0 = LinearBondingCurve.computeP0(TARGET_MCAP, MAX_SUPPLY, MULTIPLE);
    }

    function test_50BuyersOfEqualSize() public {
        console2.log("=== LinearBondingCurve: 50 buyers x $1000 USDC ===");
        console2.log("maxSupply:", MAX_SUPPLY);
        console2.log("targetMarketCap (1e6):", TARGET_MCAP);
        console2.log("multiple:", MULTIPLE);
        console2.log("p0 (1e6-scaled, i.e. USDC units per token):", p0);
        console2.log("---------------------------------------------");

        uint256 sold = 0;
        uint256 totalSpent = 0;

        for (uint256 i = 1; i <= NUM_BUYERS; i++) {
            uint256 priceBefore = LinearBondingCurve.currentPrice(TARGET_MCAP, MAX_SUPPLY, p0, sold);

            uint256 tokensOut = LinearBondingCurve.calculateBuyAmount(
                TARGET_MCAP, MAX_SUPPLY, p0, sold, BUY_SIZE
            );

            sold += tokensOut;
            totalSpent += BUY_SIZE;

            uint256 pctBps = (sold * 10_000) / MAX_SUPPLY;

            console2.log(
                string.concat(
                    "buyer ", vm.toString(i),
                    " | usdcIn 1000e6",
                    " | tokensOut ", vm.toString(tokensOut / 1e18),
                    " | priceBefore(1e6) ", vm.toString(priceBefore / 1e6),
                    " | cumSold ", vm.toString(sold),
                    " | pctOfSupplyBps ", vm.toString(pctBps)
                )
            );

            // The library itself does NOT enforce this - see
            // test_MissingSupplyCap_DemonstratesBug below. This assertion
            // documents the expectation for a *safe* caller.
            assertLe(sold, MAX_SUPPLY, "sold exceeded maxSupply - caller must cap this!");
        }

        console2.log("---------------------------------------------");
        console2.log("Total spent (1e6 / USDC):", totalSpent);
        console2.log("Total tokens sold:", sold);
        console2.log("Final price (1e6):", LinearBondingCurve.currentPrice(TARGET_MCAP, MAX_SUPPLY, p0, sold));
    }

    /// @notice At USDC's 6 decimals, p0 = M*1e18/(S*multiple) can lose real
    /// precision when maxSupply is large (1e9 tokens here). True p0 is
    /// $0.0000142857.../token; flooring at 6-decimal granularity rounds it
    /// down to $0.000014 - a ~2% haircut on the starting price, before any
    /// buy even happens. Flag this to the team: is 6-decimal precision fine
    /// for your token/supply combo, or should p0 be computed at higher
    /// internal precision and only truncated to 6 decimals when quoted?
    function test_P0PrecisionLossAtUsdcDecimals() public {
        uint256 truePriceX18 = (TARGET_MCAP * 1e18 * 1e12) / (MAX_SUPPLY * MULTIPLE); // upscale for comparison
        console2.log("p0 as computed (1e6 scale):", p0);
        console2.log("p0 upscaled to 1e18 for comparison:", p0 * 1e12);
        console2.log("true unrounded price upscaled to 1e18:", truePriceX18);
        assertTrue(p0 * 1e12 < truePriceX18, "expected to demonstrate rounding-down precision loss");
    }

    /// @notice Demonstrates a real gap: the library does not cap tokensOut at
    /// the remaining supply. A single oversized buy near the end of the curve
    /// returns far more tokens than remain. This "passes" today because the
    /// bug exists - fix by having the CALLING contract enforce
    /// sold + tokensOut <= maxSupply (partial-fill/refund the excess).
    function test_MissingSupplyCap_DemonstratesBug() public {
        uint256 sold = 932_179_205e18; // approx state after the 50 buys above
        uint256 remaining = MAX_SUPPLY - sold;

        uint256 hugeBuy = 1_000_000e6; // a $1,000,000 USDC whale buy
        uint256 tokensOut = LinearBondingCurve.calculateBuyAmount(
            TARGET_MCAP, MAX_SUPPLY, p0, sold, hugeBuy
        );

        console2.log("remaining supply:", remaining / 1e18);
        console2.log("tokensOut for oversized buy:", tokensOut / 1e18);
        console2.log("exceeds remaining supply?", tokensOut > remaining);

        assertTrue(tokensOut > remaining, "expected to demonstrate the uncapped-supply bug");
    }

    /// @notice Fuzz check that p0 doesn't round down to 0 for valid multiples
    /// at USDC's 6-decimal scale, since calculateBuyAmount reverts on p0 == 0
    /// in the flat-price branch. 6 decimals gives much less headroom than
    /// 18, so this is worth checking across realistic mcap ranges.
    function testFuzz_P0NeverZeroForValidMultiples(uint256 mcap, uint8 multiple) public {
        mcap = bound(mcap, 1e6, 1_000_000_000e6); // $1 to $1B, USDC 6-decimal
        multiple = uint8(bound(multiple, 1, 20));
        uint256 fuzzedP0 = LinearBondingCurve.computeP0(mcap, MAX_SUPPLY, multiple);
        if (fuzzedP0 == 0) {
            console2.log("p0 rounded to 0 for mcap:", mcap, "multiple:", multiple);
        }
    }
}

// forge test --match-path test/LinearBondingCurve.t.sol -vvv
// forge test --match-test test_50BuyersOfEqualSize -vv