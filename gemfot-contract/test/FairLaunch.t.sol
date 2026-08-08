// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IERC20Minimal} from "@uniswap/v4-core/src/interfaces/external/IERC20Minimal.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {Position} from "@uniswap/v4-core/src/libraries/Position.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";

import {FairLaunch} from "@gemfot/hooks/FairLaunch.sol";
import {LinearBondingCurve} from "@gemfot/libraries/LinearBondingCurve.sol";
import {ProtocolRoles} from "@gemfot/libraries/ProtocolRoles.sol";
import {TickFinder} from "@gemfot/types/TickFinder.sol";

/**
 * Minimal ERC20 so the PoolManager can actually settle the liquidity that
 * `closePosition` provisions. 6 decimals mirror the protocol's USDC.
 */
contract MockToken is IERC20Minimal {
    string public name;
    string public symbol;
    uint8 public immutable decimals;

    uint private _totalSupply;
    mapping(address => uint) private _balances;
    mapping(address => mapping(address => uint)) private _allowances;

    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function mint(address _to, uint _amount) external {
        _totalSupply += _amount;
        _balances[_to] += _amount;
        emit Transfer(address(0), _to, _amount);
    }

    function totalSupply() external view returns (uint) {
        return _totalSupply;
    }

    function balanceOf(address _account) external view returns (uint) {
        return _balances[_account];
    }

    function allowance(address _owner, address _spender) external view returns (uint) {
        return _allowances[_owner][_spender];
    }

    function approve(address _spender, uint _amount) external returns (bool) {
        _allowances[msg.sender][_spender] = _amount;
        emit Approval(msg.sender, _spender, _amount);
        return true;
    }

    function transfer(address _to, uint _amount) external returns (bool) {
        _balances[msg.sender] -= _amount;
        _balances[_to] += _amount;
        emit Transfer(msg.sender, _to, _amount);
        return true;
    }

    function transferFrom(address _from, address _to, uint _amount) external returns (bool) {
        if (_allowances[_from][msg.sender] != type(uint).max) {
            _allowances[_from][msg.sender] -= _amount;
        }
        _balances[_from] -= _amount;
        _balances[_to] += _amount;
        emit Transfer(_from, _to, _amount);
        return true;
    }
}

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
 * `closePosition` is exercised against a live Uniswap V4 {PoolManager} through the
 * standard `unlock` callback, and the positions it mints are verified with
 * {StateLibrary}.
 */
contract FairLaunchTest is Test {
    using PoolIdLibrary for PoolKey;

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

    /// A live V4 PoolManager so `closePosition` can provision real liquidity
    PoolManager poolManager;

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

        poolManager = new PoolManager(address(this));

        fairLaunch = new FairLaunch(poolManager);
        fairLaunch.grantRole(ProtocolRoles.GEMFOT_MANAGER, manager);
        // The test contract drives `closePosition` inside the PoolManager unlock
        // callback, so it also needs the role and will hold the USDC / memecoin
        // balances that seed the positions.
        fairLaunch.grantRole(ProtocolRoles.GEMFOT_MANAGER, address(this));

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
    /*                                closePosition                               */
    /* -------------------------------------------------------------------------- */

    /// USDC is `currency0` (`nativeIsZero = true`), the ordering used in production.
    function test_ClosePositionMintsPositions_UsdcAsCurrency0() public {
        _createAndVerifyClose(true);
    }

    /// USDC is `currency1` (`nativeIsZero = false`) when the memecoin address sorts lower.
    function test_ClosePositionMintsPositions_UsdcAsCurrency1() public {
        _createAndVerifyClose(false);
    }

    function test_RevertWhen_StrangerClosesPosition() public {
        (MockToken usdc_, MockToken meme_, PoolKey memory key_) = _deployCloseFixture(true);
        PoolId pid = key_.toId();

        vm.prank(manager);
        fairLaunch.createPosition(pid, launchesAt, MAX_SUPPLY, FAIR_LAUNCH_DURATION, TARGET_MCAP, MULTIPLE, p0);

        vm.expectRevert(FairLaunch.NotGemFotManager.selector);
        vm.prank(stranger);
        fairLaunch.closePosition(key_, 0, true, TickMath.getSqrtPriceAtTick(0));
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

    /**
     * Runs the full `closePosition` flow against a live {PoolManager}:
     *  1. deploy a token pair ordered so USDC is either `currency0` or `currency1`,
     *  2. book a fair launch and accrue revenue against its pool id,
     *  3. fund the caller (this test, standing in for the GemFotManager) and close
     *     the position from inside an unlocked {PoolManager} context,
     *  4. verify both minted positions through {StateLibrary}.
     */
    function _createAndVerifyClose(bool _usdcIsCurrency0) internal {
        (MockToken usdc_, MockToken meme_, PoolKey memory key_) = _deployCloseFixture(_usdcIsCurrency0);
        PoolId pid = key_.toId();
        uint160 sqrtPriceX96 = TickMath.getSqrtPriceAtTick(0);

        (uint revenue, uint tokenFees, uint memeHeld) = _bookAndFund(usdc_, meme_, pid);
        _close(pid, key_, tokenFees, _usdcIsCurrency0, sqrtPriceX96);

        _assertClosedAndInitialized(pid, sqrtPriceX96);

        (int24 usdcLower, int24 usdcUpper, int24 memeLower, int24 memeUpper) = _tickBounds(_usdcIsCurrency0);

        _assertUsdcPosition(pid, _usdcIsCurrency0, usdcLower, usdcUpper, revenue);
        _assertMemePosition(pid, _usdcIsCurrency0, memeLower, memeUpper, memeHeld, tokenFees);
        _assertTokenFlows(usdc_, meme_, revenue, tokenFees, memeHeld);
    }

    function _bookAndFund(
        MockToken _usdc,
        MockToken _meme,
        PoolId _pid
    ) internal returns (uint revenue_, uint tokenFees_, uint memeHeld_) {
        // Book a fair launch and accrue revenue into the pool's info
        vm.prank(manager);
        fairLaunch.createPosition(_pid, launchesAt, MAX_SUPPLY, FAIR_LAUNCH_DURATION, TARGET_MCAP, MULTIPLE, p0);
        vm.prank(manager);
        fairLaunch.fillFromPosition(_pid, int(BUY_SIZE));
        revenue_ = fairLaunch.fairLaunchInfo(_pid).revenue;

        // The caller holds the USDC raised plus the unsold memecoin it will deploy.
        tokenFees_ = 10_000e18;
        uint memeDeposit = 490_000e18;
        _usdc.mint(address(this), revenue_ + 1_000);
        _meme.mint(address(this), memeDeposit + tokenFees_ + 1_000);
        _usdc.approve(address(fairLaunch), type(uint).max);
        _meme.approve(address(fairLaunch), type(uint).max);
        memeHeld_ = _meme.balanceOf(address(this));
    }

    function _close(
        PoolId _pid,
        PoolKey memory _key,
        uint _tokenFees,
        bool _usdcIsCurrency0,
        uint160 _sqrtPriceX96
    ) internal {
        poolManager.initialize(_key, _sqrtPriceX96);
        poolManager.unlock(abi.encode(_key, _tokenFees, _usdcIsCurrency0, _sqrtPriceX96));
    }

    function _assertClosedAndInitialized(PoolId _pid, uint160 _sqrtPriceX96) internal view {
        // The fair launch is marked closed
        FairLaunch.FairLaunchInfo memory info = fairLaunch.fairLaunchInfo(_pid);
        assertTrue(info.closed, "fair launch should be marked closed");
        assertEq(info.endsAt, block.timestamp, "endsAt should be backdated to the close time");

        // The pool is initialized at the closing price
        (uint160 poolSqrtPriceX96,,,) = StateLibrary.getSlot0(poolManager, _pid);
        assertEq(poolSqrtPriceX96, _sqrtPriceX96, "pool should be initialized at the closing price");
    }

    function _tickBounds(
        bool _usdcIsCurrency0
    ) internal pure returns (int24 usdcLower_, int24 usdcUpper_, int24 memeLower_, int24 memeUpper_) {
        if (_usdcIsCurrency0) {
            usdcLower_ = 60;
            usdcUpper_ = usdcLower_ + TickFinder.TICK_SPACING;
            memeLower_ = TickFinder.MIN_TICK;
            memeUpper_ = -60;
        } else {
            usdcLower_ = -120;
            usdcUpper_ = usdcLower_ + TickFinder.TICK_SPACING;
            memeLower_ = 60;
            memeUpper_ = TickFinder.MAX_TICK;
        }
    }

    function _assertUsdcPosition(
        PoolId _pid,
        bool _usdcIsCurrency0,
        int24 _tickLower,
        int24 _tickUpper,
        uint _revenue
    ) internal view {
        (uint128 liquidity, uint256 fg0, uint256 fg1) =
            StateLibrary.getPositionInfo(poolManager, _pid, address(fairLaunch), _tickLower, _tickUpper, "");
        uint128 expected = _usdcIsCurrency0
            ? LiquidityAmounts.getLiquidityForAmount0(
                TickMath.getSqrtPriceAtTick(_tickLower), TickMath.getSqrtPriceAtTick(_tickUpper), _revenue
            )
            : LiquidityAmounts.getLiquidityForAmount1(
                TickMath.getSqrtPriceAtTick(_tickLower), TickMath.getSqrtPriceAtTick(_tickUpper), _revenue
            );
        assertGt(liquidity, 0, "USDC position should have liquidity");
        assertEq(liquidity, expected, "USDC liquidity should match the accrued revenue");
        assertEq(fg0, 0, "no fees earned before any swaps");
        assertEq(fg1, 0, "no fees earned before any swaps");

        // The lower boundary tick references the newly minted position
        (uint128 lowerGross,) = StateLibrary.getTickLiquidity(poolManager, _pid, _tickLower);
        assertEq(lowerGross, liquidity, "USDC lower tick should reference the position");
    }

    function _assertMemePosition(
        PoolId _pid,
        bool _usdcIsCurrency0,
        int24 _tickLower,
        int24 _tickUpper,
        uint _memeHeld,
        uint _tokenFees
    ) internal view {
        (uint128 liquidity, uint256 fg0, uint256 fg1) =
            StateLibrary.getPositionInfo(poolManager, _pid, address(fairLaunch), _tickLower, _tickUpper, "");
        uint deposit = _memeHeld - _tokenFees;
        uint128 expected = _usdcIsCurrency0
            ? LiquidityAmounts.getLiquidityForAmount1(
                TickMath.getSqrtPriceAtTick(_tickLower), TickMath.getSqrtPriceAtTick(_tickUpper), deposit
            )
            : LiquidityAmounts.getLiquidityForAmount0(
                TickMath.getSqrtPriceAtTick(_tickLower), TickMath.getSqrtPriceAtTick(_tickUpper), deposit
            );
        assertGt(liquidity, 0, "memecoin position should have liquidity");
        assertEq(liquidity, expected, "memecoin liquidity should match the unsold supply");
        assertEq(fg0, 0, "no fees earned before any swaps");
        assertEq(fg1, 0, "no fees earned before any swaps");

        // `getPositionLiquidity` agrees with `getPositionInfo`
        bytes32 positionId = Position.calculatePositionKey(address(fairLaunch), _tickLower, _tickUpper, "");
        assertEq(
            StateLibrary.getPositionLiquidity(poolManager, _pid, positionId),
            liquidity,
            "getPositionLiquidity should match getPositionInfo"
        );

        // The upper boundary tick references the newly minted position
        (uint128 upperGross,) = StateLibrary.getTickLiquidity(poolManager, _pid, _tickUpper);
        assertEq(upperGross, liquidity, "memecoin upper tick should reference the position");
    }

    function _assertTokenFlows(
        MockToken _usdc,
        MockToken _meme,
        uint _revenue,
        uint _tokenFees,
        uint _memeHeld
    ) internal view {
        // The tokens actually moved into the pool
        uint usdcInPool = _usdc.balanceOf(address(poolManager));
        uint memeInPool = _meme.balanceOf(address(poolManager));
        assertGe(usdcInPool, _revenue - 2, "pool should receive the USDC raised");
        assertLe(usdcInPool, _revenue + 2, "pool should receive the USDC raised");
        assertGe(memeInPool, _memeHeld - _tokenFees - 2, "pool should receive the unsold memecoin");
        assertLe(memeInPool, _memeHeld - _tokenFees + 2, "pool should receive the unsold memecoin");
        assertGe(_meme.balanceOf(address(this)), _tokenFees, "tokenFees should stay with the caller");
        assertLe(_meme.balanceOf(address(this)), _tokenFees + 1_000, "tokenFees should stay with the caller");
    }

    /**
     * Deploys a fresh USDC / memecoin pair with deterministic addresses so the pool
     * currencies are ordered the way the caller asks for.
     */
    function _deployCloseFixture(bool _usdcIsCurrency0) internal returns (
        MockToken usdc_,
        MockToken meme_,
        PoolKey memory key_
    ) {
        if (_usdcIsCurrency0) {
            // USDC sorts before the memecoin, so it becomes `currency0`
            usdc_ = _deployMockToken(address(0x1001), "USDC", 6);
            meme_ = _deployMockToken(address(0x1002), "MEME", 18);
            key_ = _poolKey(usdc_, meme_, true);
        } else {
            // The memecoin sorts before USDC, so USDC becomes `currency1`
            meme_ = _deployMockToken(address(0x2001), "MEME", 18);
            usdc_ = _deployMockToken(address(0x2002), "USDC", 6);
            key_ = _poolKey(usdc_, meme_, false);
        }
    }

    function _poolKey(
        MockToken _usdc,
        MockToken _meme,
        bool _usdcIsCurrency0
    ) internal pure returns (PoolKey memory) {
        return PoolKey({
            currency0: Currency.wrap(_usdcIsCurrency0 ? address(_usdc) : address(_meme)),
            currency1: Currency.wrap(_usdcIsCurrency0 ? address(_meme) : address(_usdc)),
            fee: 0,
            tickSpacing: 60,
            hooks: IHooks(address(0))
        });
    }

    function _deployMockToken(address _where, string memory _symbol, uint8 _decimals) internal returns (MockToken) {
        deployCodeTo("FairLaunch.t.sol:MockToken", abi.encode(_symbol, _symbol, _decimals), _where);
        return MockToken(_where);
    }

    /**
     * Called back by the {PoolManager} while it is unlocked. See `_createAndVerifyClose`.
     */
    function unlockCallback(
        bytes calldata _data
    ) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "Only PoolManager");
        (PoolKey memory key, uint tokenFees, bool nativeIsZero, uint160 sqrtPriceX96) =
            abi.decode(_data, (PoolKey, uint, bool, uint160));
        fairLaunch.closePosition(key, tokenFees, nativeIsZero, sqrtPriceX96);
        return "";
    }
}
