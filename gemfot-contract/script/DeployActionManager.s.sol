// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {TreasuryActionManager} from "@gemfot/treasury/ActionManager.sol";

/**
 * Deploys the {TreasuryActionManager} contract.
 *
 * Required environment variables:
 * - PROTOCOL_OWNER : the EOA that will own the contract (able to approve actions)
 */
contract DeployActionManager is Script {
    function run() external returns (address actionManager_) {
        address protocolOwner = vm.envAddress("PROTOCOL_OWNER");

        vm.startBroadcast();
        TreasuryActionManager actionManager = new TreasuryActionManager(protocolOwner);
        vm.stopBroadcast();

        actionManager_ = address(actionManager);

        console.log("TreasuryActionManager:", actionManager_);
    }
}
