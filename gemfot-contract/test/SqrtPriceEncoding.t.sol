// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {USDCMarketCappedPrice} from "@gemfot/price/MarketCappedPrice.sol";
import {LinearBondingCurve} from "@gemfot/libraries/LinearBondingCurve.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";

contract SqrtPriceEncodingTest is Test {
    uint256 constant MAX_SUPPLY = 1_000_000_000e18;
    uint256 constant TARGET_MCAP = 100_000e6; // USDC 6-decimal
    uint8 constant MULTIPLE = 7;
    uint256 constant Q96 = 2 ** 96;

    // TickMath bounds - poolManager.initialize reverts outside this range.
    uint160 constant MIN_SQRT_RATIO = 4295128739;
    uint160 constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    USDCMarketCappedPrice pricer;
    uint256 p0;

    function setUp() public {
        // owner/exemption addresses don't matter for pure pricing math
        pricer = new USDCMarketCappedPrice(address(this));
        p0 = LinearBondingCurve.computeP0(TARGET_MCAP, MAX_SUPPLY, MULTIPLE);
    }

    /// @notice Fixed, convention-independent decode: this is how Uniswap
    /// itself defines sqrtPriceX96 -> price, regardless of how encodeSqrtPrice
    /// is implemented internally.
    /// @dev Must use FullMath (512-bit-safe) here, not plain a*b/c - for
    /// realistic sqrtPriceX96 magnitudes, squaring it and multiplying by 1e18
    /// overflows uint256 well before the division brings it back down.
    function decodePriceX18(uint160 sqrtPriceX96) internal pure returns (uint256) {
        // b = sqrtPriceX96 * 1e18 fits comfortably in uint256 on its own
        // (sqrtPriceX96 <= ~2^160, times ~2^60 for 1e18 is well under 2^256).
        // FullMath.mulDiv then handles the sqrtPriceX96 * b product safely
        // even though THAT intermediate product would overflow plain 256-bit
        // math, dividing by Q96^2 before returning.
        uint256 b = uint256(sqrtPriceX96) * 1e18;
        return FullMath.mulDiv(uint256(sqrtPriceX96), b, Q96 * Q96);
    }

    function _checkBothBranches(uint256 sold, string memory label) internal {
        uint256 priceRaw = pricer.getPricing(TARGET_MCAP, MAX_SUPPLY, p0, sold);
        console2.log(string.concat("--- ", label, " ---"));
        console2.log("priceRaw (atomic USDC per whole token):", priceRaw);

        // Branch 1: nativeIsZero = true -> token0=USDC, token1=project token
        uint160 sqrtP0 = pricer.encodeSqrtPrice(priceRaw, 1e18);
        uint256 decoded0 = decodePriceX18(sqrtP0);
        uint256 expected0 = (1e18 * 1e18) / priceRaw;
        console2.log("nativeIsZero=true  sqrtPriceX96:", sqrtP0);
        console2.log("  decoded (x1e18):", decoded0, " expected:", expected0);
        assertApproxEqAbs(decoded0, expected0, expected0 / 1000 + 1, "nativeIsZero=true mismatch");
        assertGe(sqrtP0, MIN_SQRT_RATIO, "below MIN_SQRT_RATIO");
        assertLe(sqrtP0, MAX_SQRT_RATIO, "above MAX_SQRT_RATIO");

        // Branch 2: nativeIsZero = false -> token0=project token, token1=USDC
        uint160 sqrtP1 = pricer.encodeSqrtPrice(1e18, priceRaw);
        uint256 decoded1 = decodePriceX18(sqrtP1);
        uint256 expected1 = priceRaw;
        console2.log("nativeIsZero=false sqrtPriceX96:", sqrtP1);
        console2.log("  decoded (x1e18):", decoded1, " expected:", expected1);
        // Allow off-by-a-few from double-flooring (sqrt then square) - this
        // is expected rounding, not a logic error. Tolerance is intentionally
        // an absolute few units, not a percentage, since priceRaw itself can
        // be a very small integer early in the curve.
        assertApproxEqAbs(decoded1, expected1, 2, "nativeIsZero=false mismatch");
        assertGe(sqrtP1, MIN_SQRT_RATIO, "below MIN_SQRT_RATIO");
        assertLe(sqrtP1, MAX_SQRT_RATIO, "above MAX_SQRT_RATIO");
    }

    function test_EncodeSqrtPrice_AtLaunch() public {
        _checkBothBranches(0, "sold=0 (launch price)");
    }

    function test_EncodeSqrtPrice_MidCurve() public {
        _checkBothBranches(500_000_000e18, "sold=500M (mid curve)");
    }

    function test_EncodeSqrtPrice_NearSellout() public {
        _checkBothBranches(999_000_000e18, "sold=999M (near sellout)");
    }

    /// @notice If p0 ever rounds down to 0 (e.g. tiny mcap + high multiple vs
    /// a huge maxSupply), calculateBuyAmount already reverts in the flat-price
    /// branch - but encodeSqrtPrice(0, 1e18) would ALSO revert (division by
    /// zero inside FullMath.mulDiv) if ever reached with a zero priceRaw from
    /// some other path. Documenting the expectation here.
    function test_EncodeSqrtPrice_RevertsOnZeroPrice() public {
        vm.expectRevert();
        pricer.encodeSqrtPrice(0, 1e18);
    }

}

// forge test test/SqrtPriceEncoding.t.sol -vvv