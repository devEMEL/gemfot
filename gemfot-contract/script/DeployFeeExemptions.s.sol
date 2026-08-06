// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {FeeExemptions} from "@gemfot/hooks/FeeExemptions.sol";

/**
 * Deploys the {FeeExemptions} contract.
 *
 * Required environment variables:
 * - PROTOCOL_OWNER : the EOA that will own the contract
 */
contract DeployFeeExemptions is Script {
    function run() external returns (address feeExemptions_) {
        address protocolOwner = vm.envAddress("PROTOCOL_OWNER");

        vm.startBroadcast();
        FeeExemptions feeExemptions = new FeeExemptions(protocolOwner);
        vm.stopBroadcast();

        feeExemptions_ = address(feeExemptions);

        console.log("FeeExemptions:", feeExemptions_);
    }
}
