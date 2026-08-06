// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {FeeEscrow} from "@gemfot/escrows/FeeEscrow.sol";

/**
 * Deploys the {FeeEscrow} contract.
 *
 * Required environment variables:
 * - NATIVE_TOKEN : the USDC (native) token address used by the protocol
 * - INDEXER      : the deployed {IndexerSubscriber} address
 *
 * @dev Ownership is assigned to the deployer (`msg.sender`).
 */
contract DeployFeeEscrow is Script {
    function run() external returns (address feeEscrow_) {
        address nativeToken = vm.envAddress("NATIVE_TOKEN");
        address indexer = vm.envAddress("INDEXER");

        vm.startBroadcast();
        FeeEscrow feeEscrow = new FeeEscrow(nativeToken, indexer);
        vm.stopBroadcast();

        feeEscrow_ = address(feeEscrow);

        console.log("FeeEscrow:", feeEscrow_);
    }
}
