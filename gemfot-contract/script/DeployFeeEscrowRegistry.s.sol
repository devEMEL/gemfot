// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {FeeEscrowRegistry} from "@gemfot/escrows/FeeEscrowRegistry.sol";

/**
 * Deploys the {FeeEscrowRegistry} contract.
 *
 * @dev Ownership is assigned to the deployer (`msg.sender`). This contract is optional and is
 * only used to track valid {FeeEscrow} contracts.
 */
contract DeployFeeEscrowRegistry is Script {
    function run() external returns (address feeEscrowRegistry_) {
        vm.startBroadcast();
        FeeEscrowRegistry feeEscrowRegistry = new FeeEscrowRegistry();
        vm.stopBroadcast();

        feeEscrowRegistry_ = address(feeEscrowRegistry);

        console.log("FeeEscrowRegistry:", feeEscrowRegistry_);
    }
}
