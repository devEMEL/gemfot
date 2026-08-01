// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {SafeCast} from "@uniswap/v4-core/src/libraries/SafeCast.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {BalanceDelta, toBalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, toBeforeSwapDelta} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {LiquidityAmounts} from "@uniswap/v4-core/test/utils/LiquidityAmounts.sol";

import {LinearBondingCurve} from "../libraries/LinearBondingCurve.sol";

import {ProtocolRoles} from "@gemfot/libraries/ProtocolRoles.sol";
import {TickFinder} from "@gemfot/types/TickFinder.sol";
import {ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {CurrencySettler} from "@uniswap/v4-core/test/utils/CurrencySettler.sol";

/**
 * Adds functionality to the {GemFotManager} that promotes a fair token launch.
 *
 * This creates a time window right after the token is launched that keeps the token at
 * the same price in a single tick position. Fees earned from this are kept within the
 * position and cannot be sold into until the fair launch window has finished.
 *
 * Once the FairLaunch period has ended, the ETH raised and the remaining tokens are
 * both deployed into a Uniswap position to facilitate ongoing transactions and create
 * a price discovery.
 *
 * @dev Based on: https://github.com/fico23/fundraise-hook
 */
contract FairLaunch is AccessControl {
    using CurrencySettler for Currency;
    using PoolIdLibrary for PoolKey;
    using SafeCast for *;
    using TickFinder for int24;

    error CannotModifyLiquidityDuringFairLaunch();
    error CannotSellTokenDuringFairLaunch();
    error NotGemFotManager();
    error FairLaunchWindowHasClosed();

    /// Emitted when a Fair Launch position is created
    event FairLaunchCreated(PoolId indexed _poolId, uint _tokens, uint _startsAt, uint _endsAt);

    /// Emitted when a Fair Launch is ended and rebalanced
    event FairLaunchEnded(PoolId indexed _poolId, uint _revenue, uint _initialSupply, uint _remainingSupply, uint _endedAt);

    /// Emitted when tokens are bought during Fair Launch
    event FairLaunchBought(PoolId indexed _poolId, uint _nativeIn, uint _tokensOut, uint _sold);

    /**
     * Holds FairLaunch information for a Pool.
     *
     * @custom:member startsAt The unix timestamp that the FairLaunch window starts
     * @custom:member endsAt The unix timestamp that the FairLaunch window ends
     * @custom:member initialTick The tick that the FairLaunch position was created at
     * @custom:member revenue The amount of revenue earned by the FairLaunch position
     * @custom:member initialSupply The amount of supply in the FairLaunch
     * @custom:member remainingSupply The amount of supply remaining in the FairLaunch
     * @custom:member closed If the FairLaunch has been closed
     */
    struct FairLaunchInfo {
        uint startsAt;
        uint endsAt;
        uint revenue;
        uint initialSupply;
        uint remainingSupply;
        bool closed;
        uint targetMarketCap;
        uint targetRaise;
        uint p0;
    }

    /// Maps a PoolId to a FairLaunchInfo struct
    mapping(PoolId _poolId => FairLaunchInfo _info) internal _fairLaunchInfo;

    /// Our Uniswap V4 {PoolManager} contract address
    IPoolManager public immutable poolManager;

    /**
     * Stores our native token.
     *
     * @param _poolManager The Uniswap V4 {PoolManager} contract
     */
    constructor(
        IPoolManager _poolManager
    ) {
        poolManager = _poolManager;

        // Set our caller to have the default admin of protocol roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    }


    /**
     * Checks if the {PoolKey} is within the fair launch window.
     *
     * @param _poolId The ID of the PoolKey
     *
     * @return If the {PoolKey} is within the fair launch window
     */
    function inFairLaunchWindow(
        PoolId _poolId
    ) public view returns (bool) {
        FairLaunchInfo memory info = _fairLaunchInfo[_poolId];
        return block.timestamp >= info.startsAt && block.timestamp < info.endsAt;
    }

    /**
     * Helper function to call the FairLaunchInfo struct for a pool.
     *
     * @param _poolId The ID of the PoolKey
     *
     * @return The FairLaunchInfo for the pool
     */
    function fairLaunchInfo(
        PoolId _poolId
    ) public view returns (FairLaunchInfo memory) {
        return _fairLaunchInfo[_poolId];
    }

    /**
     * Creates an initial fair launch position.
     *
     * @param _poolId The ID for the pool being initialized
     * @param _initialTokenFairLaunch The amount of tokens to add as single sided fair launch liquidity
     */
    function createPosition(
        PoolId _poolId,
        uint _launchesAt,
        uint _initialTokenFairLaunch,
        uint _fairLaunchDuration,
        uint _targetMarketCap,
        uint _targetRaise,
        uint _p0
    ) public virtual onlyGemFotManager returns (FairLaunchInfo memory) {
        // If we have no initial tokens, then we need to overwrite our fair launch duration to zero
        if (_initialTokenFairLaunch == 0) {
            _fairLaunchDuration = 0;
        }

        // Determine the time that the fair launch window will close
        uint endsAt = _launchesAt + _fairLaunchDuration;

        // Map these tokens into an pseudo-escrow that we can reference during the sale
        // and activate our pool fair launch window.
        _fairLaunchInfo[_poolId] = FairLaunchInfo({
            startsAt: _launchesAt,
            endsAt: endsAt,
            revenue: 0,
            initialSupply: _initialTokenFairLaunch,
            remainingSupply: _initialTokenFairLaunch,
            closed: false,
            targetMarketCap: _targetMarketCap,
            targetRaise: _targetRaise,
            p0: _p0
        });

        emit FairLaunchCreated(_poolId, _initialTokenFairLaunch, _launchesAt, endsAt);
        return _fairLaunchInfo[_poolId];
    }

    /**
     * Closes the FairLaunch position and recreates the position as a wide range position immediately
     * above the tick for our memecoin. This position is comprised of tokens not allocated to the
     * Fair Launch. Any unsold tokens from the Fair Launch will be burned.
     *
     * @param _poolKey The PoolKey we are closing the FairLaunch position of
     * @param _tokenFees The amount of token fees that need to remain in the {GemFotManager}
     * @param _nativeIsZero If our native token is `currency0`
     * @param _sqrtPriceX96 The _sqrtPriceX96 where the position should be created
     */
    function closePosition(
        PoolKey memory _poolKey,
        uint _tokenFees,
        bool _nativeIsZero,
        uint160 _sqrtPriceX96
    ) public onlyGemFotManager returns (FairLaunchInfo memory) {
        // Reference the pool's FairLaunchInfo, ready to store updated values
        FairLaunchInfo storage info = _fairLaunchInfo[_poolKey.toId()];

        int24 initialTick = TickMath.getTickAtSqrtPrice(_sqrtPriceX96);

        int24 tickLower;
        int24 tickUpper;

        if (_nativeIsZero) {
            // USDC position
            tickLower = (initialTick + 1).validTick(false);
            tickUpper = tickLower + TickFinder.TICK_SPACING;
            _createImmutablePosition(_poolKey, tickLower, tickUpper, info.revenue, true);

            // memecoin position (unsold fair launch supply gets burned in GemFotManager)
            tickLower = TickFinder.MIN_TICK;
            tickUpper = (initialTick - 1).validTick(true);
            _createImmutablePosition(
                _poolKey,
                tickLower,
                tickUpper,
                _poolKey.currency1.balanceOf(msg.sender) - _tokenFees,
                false
            );
        } else {
            // USDC position
            tickUpper = (initialTick - 1).validTick(true);
            tickLower = tickUpper - TickFinder.TICK_SPACING;
            _createImmutablePosition(_poolKey, tickLower, tickUpper, info.revenue, false);

            // memecoin position (unsold fair launch supply gets burned in GemFotManager)
            tickLower = (initialTick + 1).validTick(false);
            tickUpper = TickFinder.MAX_TICK;
            _createImmutablePosition(
                _poolKey,
                tickLower,
                tickUpper,
                _poolKey.currency0.balanceOf(msg.sender) - _tokenFees,
                true
            );
        }

        // Mark our position as closed
        info.endsAt = block.timestamp;
        info.closed = true;

        // Emit the event with the balance of the currency we hold before we create a position with
        // it. We determine the end time by seeing if it has ended early, or if we are past the point
        // it was meant to end then we backdate it.
        emit FairLaunchEnded(_poolKey.toId(), info.revenue, info.initialSupply, info.remainingSupply, info.endsAt);

        return info;
    }

    /**
     * @notice Function to buy in fairlaunch
     * When we are filling from our Fair Launch position, we will always be buying tokens
     * with ETH. The amount specified that is passed in, however, could be positive or negative.
     *
     * The positive / negative flag will require us to calculate the amount the user will get in
     * a different way. Positive: How much ETH it costs to get amount. Negative: How many tokens
     * I can get for amount.
     *
     * The amount requested **can** exceed the Fair Launch position, but we will additionally
     * have to call `_closeFairLaunchPosition` to facilitate it during this call. This will
     * provide additional liquidity before the swap actually takes place.
     *
     * @dev `zeroForOne` will always be equal to `_nativeIsZero` as it will always be ETH -> Token.
     *
     * @param poolId The PoolId we are filling from
     * @param _amountSpecified The amount specified in the swap
     *
     * @return nativeIn The amount of native token user pays 
     * @return tokensOut The amount of tokens user wants to buy 
     * @return fairLaunchInfo_ The token fairLaunch info 
     */
    function fillFromPosition(
        PoolId poolId,
        int _amountSpecified
    )
        public
        onlyGemFotManager
        returns (uint nativeIn, uint tokensOut, FairLaunchInfo memory fairLaunchInfo_)
    {
        FairLaunchInfo storage info = _fairLaunchInfo[poolId];

        // No tokens, no fun.
        if (_amountSpecified == 0) {
            return (0, 0, info);
        }

        uint sold = info.initialSupply - info.remainingSupply;

        // If we have a negative amount specified, then we have an ETH amount passed in.
        // Bonding curve exact input requires inverse calculation which is complex; assuming exact output.
        if (_amountSpecified < 0) {
            revert("Exact input not supported for bonding curve");
        }
        // Otherwise, if we have a positive amount specified, then we know the number of tokens that
        // are being purchased and need to calculate the amount of ETH required.
        else {
            tokensOut = uint(_amountSpecified);
            
            if (tokensOut > info.remainingSupply) {
                tokensOut = info.remainingSupply;
            }
            
            nativeIn = LinearBondingCurve.calculateBuyCost(
                info.targetMarketCap,
                info.initialSupply,
                info.p0,
                sold,
                tokensOut
            );

        }

        // If the user has requested more tokens than are available in the fair launch, then we
        // need to strip back the amount that we can fulfill.
        if (tokensOut > info.remainingSupply) {
            // Calculate the percentage of tokensOut relative to the threshold and reduce the `nativeIn`
            // value by the same amount. There may be some slight accuracy loss, but it's all good.
            uint percentage = info.remainingSupply * 1e18 / tokensOut;
            nativeIn = (nativeIn * percentage) / 1e18;

            // Update our `tokensOut` to the remainingSupply limit
            tokensOut = info.remainingSupply;
        }


        info.revenue += nativeIn;
        info.remainingSupply -= tokensOut;
        emit FairLaunchBought(poolId, nativeIn, tokensOut, sold);

        return (nativeIn, tokensOut, info);
    }

    /**
     * Allows calls from the {GemFotManager} to modify the amount of revenue stored against a pool's
     * FairLaunch position. This is required to correctly attribute fees taken.
     *
     * @param _poolId The ID of the PoolKey
     * @param _revenue The revenue amount to add or subtract
     */
    function modifyRevenue(
        PoolId _poolId,
        int _revenue
    ) public onlyGemFotManager {
        if (_revenue < 0) {
            _fairLaunchInfo[_poolId].revenue -= uint(-_revenue);
        } else if (_revenue > 0) {
            _fairLaunchInfo[_poolId].revenue += uint(_revenue);
        }
    }

    /**
     * Creates an immutable, single-sided position when the FairLaunch window is closed.
     *
     * @param _poolKey The PoolKey to create a position against
     * @param _tickLower The lower tick of the position
     * @param _tickUpper The upper tick of the position
     * @param _tokens The number of tokens to put into the position
     * @param _tokenIsZero True if the position is created `currency0`; false is `currency1`
     */
    function _createImmutablePosition(
        PoolKey memory _poolKey,
        int24 _tickLower,
        int24 _tickUpper,
        uint _tokens,
        bool _tokenIsZero
    ) internal {
        // Calculate the liquidity delta based on the tick range and token amount
        uint128 liquidityDelta = _tokenIsZero
            ? LiquidityAmounts.getLiquidityForAmount0({
                sqrtPriceAX96: TickMath.getSqrtPriceAtTick(_tickLower),
                sqrtPriceBX96: TickMath.getSqrtPriceAtTick(_tickUpper),
                amount0: _tokens
            })
            : LiquidityAmounts.getLiquidityForAmount1({
                sqrtPriceAX96: TickMath.getSqrtPriceAtTick(_tickLower),
                sqrtPriceBX96: TickMath.getSqrtPriceAtTick(_tickUpper),
                amount1: _tokens
            });

        // If we have no liquidity, then exit before creating the position which would revert
        if (liquidityDelta == 0) {
            return;
        }

        // Create our single-sided position
        (BalanceDelta delta,) = poolManager.modifyLiquidity({
            key: _poolKey,
            params: ModifyLiquidityParams({
                tickLower: _tickLower, tickUpper: _tickUpper, liquidityDelta: liquidityDelta.toInt128(), salt: ""
            }),
            hookData: ""
        });

        // Settle the tokens that are required to fill the position
        if (delta.amount0() < 0) {
            _poolKey.currency0.settle(poolManager, msg.sender, uint(-int(delta.amount0())), false);
        }

        if (delta.amount1() < 0) {
            _poolKey.currency1.settle(poolManager, msg.sender, uint(-int(delta.amount1())), false);
        }
    }



    /**
     * Ensures that only a {GemFotManager} can call the function.
     */
    modifier onlyGemFotManager() {
        if (!hasRole(ProtocolRoles.GEMFOT_MANAGER, msg.sender)) {
            revert NotGemFotManager();
        }
        _;
    }
}
