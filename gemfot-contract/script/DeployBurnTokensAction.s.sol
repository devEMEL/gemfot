// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {BurnTokensAction} from "@gemfot/treasury/actions/BurnTokens.sol";

/**
 * Deploys the {BurnTokensAction} treasury action.
 *
 * Required environment variables:
 * - NATIVE_TOKEN : the USDC (native) token address used by the protocol
 *
 * @dev Must be approved on the {TreasuryActionManager} by the protocol owner via
 * `approveAction(address)` before it can be used.
 */
contract DeployBurnTokensAction is Script {
    function run() external returns (address burnTokensAction_) {
        address nativeToken = vm.envAddress("NATIVE_TOKEN");

        vm.startBroadcast();
        BurnTokensAction burnTokensAction = new BurnTokensAction(nativeToken);
        vm.stopBroadcast();

        burnTokensAction_ = address(burnTokensAction);

        console.log("BurnTokensAction:", burnTokensAction_);
    }
}
