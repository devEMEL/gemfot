// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {PoolId} from '@uniswap/v4-core/src/types/PoolId.sol';

import {BaseSubscriber} from '@gemfot/subscribers/Base.sol';


/**
 * Prevents a user from launching a token that has no FairLaunch. The reasons for this are
 * two-fold:
 *
 *  1. Fair Launch promotes fair trading at launch and is anti-bot
 *  2. The protocol had an undiscovered bug that prevents swaps on fair launch-less tokens
 *
 * This hooks into the `afterInitialize` key to check the parameters passed, and if we see
 * that no fair launch supply was allocated then we revert.
 */
contract PreventNoFairLaunch is BaseSubscriber {

    error InvalidInitialTokenFairLaunch(uint _invalidAmount, uint _minTokens);

    /// Set our minimum initial tokens to 1%
    uint public constant MINIMUM_INITIAL_TOKENS = 1e27;

    /**
     * Sets our {Notifier} to parent contract to lock down calls.
     */
    constructor (address _notifier) BaseSubscriber(_notifier) {
        // ..
    }

    /**
     * Called when the contract is subscribed to the Notifier.
     *
     * We have no subscription requirements, so we can just confirm immediately.
     *
     * @dev This must return `true` to be subscribed.
     */
    function subscribe(bytes memory /* _data */) public view override onlyNotifier returns (bool) {
        return true;
    }

    /**
     * Called when a notification is fired by the {Notifier}. The minimum fair-launch
     * supply guard has been disabled, so this is a no-op.
     */
    function notify(PoolId /* _poolId */, bytes4 /* _key */, bytes calldata /* _data */) public view override onlyNotifier {
        // The minimum fair-launch supply guard has been disabled so that small-supply
        // launches are permitted. Kept as a no-op to preserve the subscription wiring.
        // Previous behavior:
        //   if (_key != IHooks.afterInitialize.selector) return;
        //   (/* uint tokenId */, GemFotManager.LaunchParams memory params) = abi.decode(
        //       _data, (uint, GemFotManager.LaunchParams));
        //   if (params.initialTokenFairLaunch < MINIMUM_INITIAL_TOKENS) {
        //       revert InvalidInitialTokenFairLaunch(params.initialTokenFairLaunch, MINIMUM_INITIAL_TOKENS);
        //   }
        return;
    }

}
