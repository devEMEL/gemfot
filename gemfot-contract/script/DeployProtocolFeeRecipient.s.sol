// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {ProtocolFeeRecipient} from "@gemfot/ProtocolFeeRecipient.sol";

/**
 * Deploys the {ProtocolFeeRecipient} contract.
 *
 * @dev Ownership is assigned to the deployer (`msg.sender`). The deployer must later call
 * `setFeeEscrow(feeEscrow, true)` to register the {FeeEscrow} to claim from.
 */
contract DeployProtocolFeeRecipient is Script {
    function run() external returns (address protocolFeeRecipient_) {
        vm.startBroadcast();
        ProtocolFeeRecipient protocolFeeRecipient = new ProtocolFeeRecipient();
        vm.stopBroadcast();

        protocolFeeRecipient_ = address(protocolFeeRecipient);

        console.log("ProtocolFeeRecipient:", protocolFeeRecipient_);
    }
}
