// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {Notifier} from "@gemfot/hooks/Notifier.sol";

/**
 * Deploys the {Notifier} contract.
 *
 * Required environment variables:
 * - PROTOCOL_OWNER : the EOA that will own the contract (can add / remove subscribers)
 */
contract DeployNotifier is Script {
    function run() external returns (address notifier_) {
        address protocolOwner = vm.envAddress("PROTOCOL_OWNER");

        vm.startBroadcast();
        Notifier notifier = new Notifier(protocolOwner);
        vm.stopBroadcast();

        notifier_ = address(notifier);

        console.log("Notifier:", notifier_);
    }
}
