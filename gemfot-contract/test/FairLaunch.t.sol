// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";

import {FairLaunch} from "@gemfot/hooks/FairLaunch.sol";
import {LinearBondingCurve} from "@gemfot/libraries/LinearBondingCurve.sol";
import {ProtocolRoles} from "@gemfot/libraries/ProtocolRoles.sol";

/**
 * Covers the accounting surface of {FairLaunch}: position creation, the bonding
 * curve buy path, revenue adjustments and access control.
 *
 * @dev The native currency of the protocol is USDC, which carries **6 decimals**,
 * while the memecoin supply is 18 decimals. Every `nativeIn` / `revenue` /
 * `targetMarketCap` value in this file is therefore expressed in `1e6` units and
 * every supply figure in `1e18`. The `1e18` inside {LinearBondingCurve} is only a
 * fixed-point scaling constant for the price math and is intentionally unrelated to
 * the currency's own decimals.
 *
 * `closePosition` is deliberately excluded here as it calls into a live Uniswap V4
 * {PoolManager} within an unlock callback, which belongs in an integration test
 * rather than this unit suite.
 */
contract FairLaunchTest is Test {
    /// 1B memecoin supply, 18 decimals
    uint constant MAX_SUPPLY = 1_000_000_000e18;

    /// $100k target market cap, USDC 6-decimal units
    uint constant TARGET_MCAP = 100_000e6;

    /// Creator-chosen peak-to-floor price ratio
    uint8 constant MULTIPLE = 7;

    /// A "normal sized" retail buy of $1,000 USDC
    uint constant BUY_SIZE = 1_000e6;

    uint constant FAIR_LAUNCH_DURATION = 1 days;

    FairLaunch fairLaunch;

    /// The {GemFotManager} is only referenced through the `GEMFOT_MANAGER` role, so a
    /// plain address avoids deploying the hook (which needs a mined address).
    address manager = makeAddr("gemfotManager");
    address stranger = makeAddr("stranger");

    PoolId poolId = PoolId.wrap(keccak256("poolId"));

    uint launchesAt;
    uint p0;

    function setUp() public {
        // Move away from timestamp 0 so `startsAt` can be in the future
        vm.warp(1 days);
        launchesAt = block.timestamp;

        fairLaunch = new FairLaunch(IPoolManager(address(0)));
        fairLaunch.grantRole(ProtocolRoles.GEMFOT_MANAGER, manager);

        p0 = LinearBondingCurve.computeP0(TARGET_MCAP, MAX_SUPPLY, MULTIPLE);
    }

    /* -------------------------------------------------------------------------- */
    /*                               createPosition                               */
    /* -------------------------------------------------------------------------- */

    function test_CreatePositionStoresFairLaunchInfo() public {
        vm.expectEmit(true, false, false, true);
        emit FairLaunch.FairLaunchCreated(
            poolId, MAX_SUPPLY, launchesAt, launchesAt + FAIR_LAUNCH_DURATION
        );
        _createPosition(MAX_SUPPLY, FAIR_LAUNCH_DURATION);

        FairLaunch.FairLaunchInfo memory info = fairLaunch.fairLaunchInfo(poolId);
        assertEq(info.startsAt, launchesAt);
        assertEq(info.endsAt, launchesAt + FAIR_LAUNCH_DURATION);
        assertEq(info.revenue, 0, "no revenue before any buys");
        assertEq(info.initialSupply, MAX_SUPPLY);
        assertEq(info.remainingSupply, MAX_SUPPLY, "full supply available at the start");
        assertEq(info.targetMarketCap, TARGET_MCAP, "market cap is held in USDC 1e6 units");
        assertEq(info.multiple, MULTIPLE);
        assertEq(info.p0, p0);
        assertFalse(info.closed);
    }

    function test_CreatePositionWithNoTokensCollapsesTheWindow() public {
        _createPosition(0, FAIR_LAUNCH_DURATION);

        FairLaunch.FairLaunchInfo memory info = fairLaunch.fairLaunchInfo(poolId);
        assertEq(info.endsAt, info.startsAt, "duration should be zeroed with no supply");
        assertFalse(fairLaunch.inFairLaunchWindow(poolId), "an empty launch is never open");
    }

    function test_RevertWhen_StrangerCreatesPosition() public {
        vm.expectRevert(FairLaunch.NotGemFotManager.selector);
        vm.prank(stranger);
        fairLaunch.createPosition(
            poolId, launchesAt, MAX_SUPPLY, FAIR_LAUNCH_DURATION, TARGET_MCAP, MULTIPLE, p0
        );
    }

    /* -------------------------------------------------------------------------- */
    /*                            inFairLaunchWindow                              */
    /* -------------------------------------------------------------------------- */

    function test_InFairLaunchWindowTracksTheSchedule() public {
        // A pool with no position has a zeroed struct, so it is never in window
        assertFalse(fairLaunch.inFairLaunchWindow(poolId), "unknown pool is not in window");

        // Schedule the launch an hour into the future
        launchesAt = block.timestamp + 1 hours;
        _createPosition(MAX_SUPPLY, FAIR_LAUNCH_DURATION);
        assertFalse(fairLaunch.inFairLaunchWindow(poolId), "not open before it starts");

        vm.warp(launchesAt);
        assertTrue(fairLaunch.inFairLaunchWindow(poolId), "open on the start boundary");

        vm.warp(launchesAt + FAIR_LAUNCH_DURATION - 1);
        assertTrue(fairLaunch.inFairLaunchWindow(poolId), "open right up to the end");

        vm.warp(launchesAt + FAIR_LAUNCH_DURATION);
        assertFalse(fairLaunch.inFairLaunchWindow(poolId), "closed on the end boundary");
    }

    /* -------------------------------------------------------------------------- */
    /*                              fillFromPosition                              */
    /* -------------------------------------------------------------------------- */

    function test_FillFromPositionSellsTokensForUsdc() public {
        _createPosition(MAX_SUPPLY, FAIR_LAUNCH_DURATION);

        uint expectedTokens =
            LinearBondingCurve.calculateBuyAmount(TARGET_MCAP, MAX_SUPPLY, p0, 0, BUY_SIZE);

        vm.expectEmit(true, false, false, true);
        emit FairLaunch.FairLaunchBought(poolId, BUY_SIZE, expectedTokens, 0);
        (uint nativeIn, uint tokensOut,) = _fill(int(BUY_SIZE));

        assertEq(nativeIn, BUY_SIZE, "the full USDC deposit is consumed");
        assertEq(tokensOut, expectedTokens, "tokens should match the bonding curve");
        assertGt(tokensOut, 0, "a $1,000 USDC buy must return tokens");

        FairLaunch.FairLaunchInfo memory info = fairLaunch.fairLaunchInfo(poolId);
        assertEq(info.revenue, BUY_SIZE, "revenue is accrued in USDC 1e6 units");
        assertEq(info.remainingSupply, MAX_SUPPLY - tokensOut, "supply is drawn down");
    }

    function test_FillFromPositionPriceIncreasesAlongTheCurve() public {
        _createPosition(MAX_SUPPLY, FAIR_LAUNCH_DURATION);

        (, uint firstTokensOut,) = _fill(int(BUY_SIZE));
        (, uint secondTokensOut,) = _fill(int(BUY_SIZE));

        // The same USDC amount buys fewer tokens as the curve price rises
        assertLt(secondTokensOut, firstTokensOut, "later buyers should receive fewer tokens");

        FairLaunch.FairLaunchInfo memory info = fairLaunch.fairLaunchInfo(poolId);
        assertEq(info.revenue, BUY_SIZE * 2, "revenue accumulates across buys");
        assertEq(info.remainingSupply, MAX_SUPPLY - firstTokensOut - secondTokensOut);
    }

    function test_FillFromPositionCapsAtRemainingSupplyAndScalesUsdcBack() public {
        // A tiny fair launch allocation so a single buy blows straight through it
        uint smallSupply = 1_000e18;
        _createPosition(smallSupply, FAIR_LAUNCH_DURATION);

        uint whaleBuy = 1_000_000e6; // $1m USDC
        (uint nativeIn, uint tokensOut,) = _fill(int(whaleBuy));

        assertEq(tokensOut, smallSupply, "cannot sell more than the fair launch holds");
        assertLt(nativeIn, whaleBuy, "the unused USDC is scaled back out of the fill");

        FairLaunch.FairLaunchInfo memory info = fairLaunch.fairLaunchInfo(poolId);
        assertEq(info.remainingSupply, 0, "the curve is exhausted");
        assertEq(info.revenue, nativeIn, "only the consumed USDC is booked as revenue");
    }

    function test_FillFromPositionReturnsNothingOnceExhausted() public {
        uint smallSupply = 1_000e18;
        _createPosition(smallSupply, FAIR_LAUNCH_DURATION);

        _fill(int(1_000_000e6));
        assertEq(fairLaunch.fairLaunchInfo(poolId).remainingSupply, 0);

        (uint nativeIn, uint tokensOut,) = _fill(int(BUY_SIZE));
        assertEq(nativeIn, 0, "no USDC should be taken from the buyer");
        assertEq(tokensOut, 0, "no tokens remain to be sold");
        assertEq(fairLaunch.fairLaunchInfo(poolId).revenue, _revenueAfterExhaustion(smallSupply));
    }

    function test_FillFromPositionWithZeroAmountIsANoOp() public {
        _createPosition(MAX_SUPPLY, FAIR_LAUNCH_DURATION);

        (uint nativeIn, uint tokensOut,) = _fill(0);
        assertEq(nativeIn, 0);
        assertEq(tokensOut, 0);

        FairLaunch.FairLaunchInfo memory info = fairLaunch.fairLaunchInfo(poolId);
        assertEq(info.revenue, 0);
        assertEq(info.remainingSupply, MAX_SUPPLY);
    }

    function test_RevertWhen_FillIsExactOutput() public {
        _createPosition(MAX_SUPPLY, FAIR_LAUNCH_DURATION);

        vm.expectRevert("Exact output not supported for bonding curve");
        _fill(-int(BUY_SIZE));
    }

    function test_RevertWhen_StrangerFillsFromPosition() public {
        _createPosition(MAX_SUPPLY, FAIR_LAUNCH_DURATION);

        vm.expectRevert(FairLaunch.NotGemFotManager.selector);
        vm.prank(stranger);
        fairLaunch.fillFromPosition(poolId, int(BUY_SIZE));
    }

    /* -------------------------------------------------------------------------- */
    /*                               modifyRevenue                                */
    /* -------------------------------------------------------------------------- */

    function test_ModifyRevenueAddsAndSubtractsUsdc() public {
        _createPosition(MAX_SUPPLY, FAIR_LAUNCH_DURATION);
        _fill(int(BUY_SIZE));

        vm.prank(manager);
        fairLaunch.modifyRevenue(poolId, int(500e6));
        assertEq(fairLaunch.fairLaunchInfo(poolId).revenue, BUY_SIZE + 500e6);

        vm.prank(manager);
        fairLaunch.modifyRevenue(poolId, -int(200e6));
        assertEq(fairLaunch.fairLaunchInfo(poolId).revenue, BUY_SIZE + 300e6);

        // A zero delta leaves the balance untouched
        vm.prank(manager);
        fairLaunch.modifyRevenue(poolId, 0);
        assertEq(fairLaunch.fairLaunchInfo(poolId).revenue, BUY_SIZE + 300e6);
    }

    function test_RevertWhen_ModifyRevenueUnderflows() public {
        _createPosition(MAX_SUPPLY, FAIR_LAUNCH_DURATION);
        _fill(int(BUY_SIZE));

        // Removing more revenue than exists must revert rather than wrap around
        vm.expectRevert();
        vm.prank(manager);
        fairLaunch.modifyRevenue(poolId, -int(BUY_SIZE + 1));
    }

    function test_RevertWhen_StrangerModifiesRevenue() public {
        vm.expectRevert(FairLaunch.NotGemFotManager.selector);
        vm.prank(stranger);
        fairLaunch.modifyRevenue(poolId, int(1e6));
    }

    /* -------------------------------------------------------------------------- */
    /*                                   Fuzz                                     */
    /* -------------------------------------------------------------------------- */

    /// @dev Bounds the deposit between $0.01 and $10m of USDC to stay in a realistic
    /// range for a 6-decimal currency.
    function testFuzz_FillNeverExceedsSupplyAndAlwaysBooksRevenue(
        uint _usdcIn
    ) public {
        _usdcIn = bound(_usdcIn, 1e4, 10_000_000e6);
        _createPosition(MAX_SUPPLY, FAIR_LAUNCH_DURATION);

        (uint nativeIn, uint tokensOut,) = _fill(int(_usdcIn));

        assertLe(tokensOut, MAX_SUPPLY, "cannot oversell the fair launch");
        assertLe(nativeIn, _usdcIn, "cannot charge more than the buyer deposited");

        FairLaunch.FairLaunchInfo memory info = fairLaunch.fairLaunchInfo(poolId);
        assertEq(info.revenue, nativeIn);
        assertEq(info.remainingSupply, MAX_SUPPLY - tokensOut);
    }

    /* -------------------------------------------------------------------------- */
    /*                                  Helpers                                   */
    /* -------------------------------------------------------------------------- */

    function _createPosition(
        uint _initialTokenFairLaunch,
        uint _duration
    ) internal returns (FairLaunch.FairLaunchInfo memory) {
        vm.prank(manager);
        return fairLaunch.createPosition(
            poolId, launchesAt, _initialTokenFairLaunch, _duration, TARGET_MCAP, MULTIPLE, p0
        );
    }

    function _fill(
        int _amountSpecified
    ) internal returns (uint nativeIn_, uint tokensOut_, FairLaunch.FairLaunchInfo memory info_) {
        vm.prank(manager);
        return fairLaunch.fillFromPosition(poolId, _amountSpecified);
    }

    /**
     * The USDC actually consumed when a whale buy is capped at `_supply` tokens.
     */
    function _revenueAfterExhaustion(
        uint _supply
    ) internal view returns (uint) {
        uint tokensOut = LinearBondingCurve.calculateBuyAmount(TARGET_MCAP, _supply, p0, 0, 1_000_000e6);
        uint percentage = _supply * 1e18 / tokensOut;
        return (1_000_000e6 * percentage) / 1e18;
    }
}
