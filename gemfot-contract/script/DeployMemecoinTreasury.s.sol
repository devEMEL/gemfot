// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {MemecoinTreasury} from "@gemfot/treasury/MemecoinTreasury.sol";

/**
 * Deploys the {MemecoinTreasury} implementation contract that is cloned by {Launch}.
 */
contract DeployMemecoinTreasury is Script {
    function run() external returns (address memecoinTreasuryImplementation_) {
        vm.startBroadcast();
        MemecoinTreasury memecoinTreasuryImplementation = new MemecoinTreasury();
        vm.stopBroadcast();

        memecoinTreasuryImplementation_ = address(memecoinTreasuryImplementation);

        console.log("MemecoinTreasury (implementation):", memecoinTreasuryImplementation_);
    }
}
