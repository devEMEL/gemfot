// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {BuyBackAction} from "@gemfot/treasury/actions/BuyBack.sol";

/**
 * Deploys the {BuyBackAction} treasury action.
 *
 * Required environment variables:
 * - NATIVE_TOKEN : the USDC (native) token address used by the protocol
 * - POOL_SWAP    : the deployed {PoolSwap} address
 *
 * @dev Must be approved on the {TreasuryActionManager} by the protocol owner via
 * `approveAction(address)` before it can be used.
 */
contract DeployBuyBackAction is Script {
    function run() external returns (address buyBackAction_) {
        address nativeToken = vm.envAddress("NATIVE_TOKEN");
        address poolSwap = vm.envAddress("POOL_SWAP");

        vm.startBroadcast();
        BuyBackAction buyBackAction = new BuyBackAction(nativeToken, poolSwap);
        vm.stopBroadcast();

        buyBackAction_ = address(buyBackAction);

        console.log("BuyBackAction:", buyBackAction_);
    }
}
