// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {SafeCastLib} from '@solady/utils/SafeCastLib.sol';

import {BalanceDelta} from '@uniswap/v4-core/src/types/BalanceDelta.sol';
import {Currency} from '@uniswap/v4-core/src/types/Currency.sol';
import {IPoolManager} from '@uniswap/v4-core/src/interfaces/IPoolManager.sol';
import {PoolKey} from '@uniswap/v4-core/src/types/PoolKey.sol';

import {PoolSwap} from '@gemfot/zaps/PoolSwap.sol';

import {IMemecoin} from '@gemfot-interfaces/IMemecoin.sol';
import {ITreasuryAction} from '@gemfot-interfaces/ITreasuryAction.sol';
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {SafeTransferLib} from "@solady/utils/SafeTransferLib.sol";


/**
 * Spends native token to buy non-native tokens from the pool.
 */
contract BuyBackAction is ITreasuryAction {

    using SafeCastLib for uint;
    using SafeTransferLib for address;


    /// The native token used by the Launch {PositionManager}
    Currency public immutable nativeToken;

    /// The PoolSwap contract to be used for the buy-back swap
    PoolSwap public immutable poolSwap;

    /**
     * Sets the native token used by the Launch {PositionManager}
     *
     * @param _nativeToken The ERC20 native token
     * @param _poolSwap The PoolSwap contract to action the buy-back swaps
     */
    constructor (address _nativeToken, address _poolSwap) {
        nativeToken = Currency.wrap(_nativeToken);
        poolSwap = PoolSwap(_poolSwap);
    }

    /**
     * Implement the execute function to burn non-native tokens. This takes the entire caller
     * balance.
     *
     * @param _poolKey The PoolKey to execute against
     * @param _data `uint160` encoded `sqrtPriceLimitX96`
     */
    function execute(PoolKey memory _poolKey, bytes memory _data) external override {
        // Capture the amount of native token held by the sender
        uint amountSpecified = nativeToken.balanceOf(msg.sender);
        if (amountSpecified == 0) return;

        // Decode the `sqrtPriceLimitX96` from our `_data`
        (uint160 sqrtPriceLimitX96) = abi.decode(_data, (uint160));

        // Pull in tokens from the caller and approve the swap contract to use them
        IMemecoin memecoin = IMemecoin(Currency.unwrap(nativeToken));

        Currency.unwrap(nativeToken).safeTransferFrom(msg.sender, address(this), amountSpecified);

        memecoin.approve(address(poolSwap), amountSpecified);

        // Action our swap against the {PoolSwap} contract
        BalanceDelta delta = poolSwap.swap({
            _key: _poolKey,
            _params: SwapParams({
                zeroForOne: nativeToken == _poolKey.currency0,
                amountSpecified: -amountSpecified.toInt256(),
                sqrtPriceLimitX96: sqrtPriceLimitX96
            })
        });

        // Transfer swapped and remaining tokens back to the caller
        _poolKey.currency0.transfer(msg.sender, _poolKey.currency0.balanceOfSelf());
        _poolKey.currency1.transfer(msg.sender, _poolKey.currency1.balanceOfSelf());

        emit ActionExecuted(_poolKey, delta.amount0(), delta.amount1());
    }

}
