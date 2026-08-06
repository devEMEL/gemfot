// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {Memecoin} from "@gemfot/Memecoin.sol";

/**
 * Deploys the {Memecoin} implementation contract that is cloned by {Launch}.
 */
contract DeployMemecoin is Script {
    function run() external returns (address memecoinImplementation_) {
        vm.startBroadcast();
        Memecoin memecoinImplementation = new Memecoin();
        vm.stopBroadcast();

        memecoinImplementation_ = address(memecoinImplementation);

        console.log("Memecoin (implementation):", memecoinImplementation_);
    }
}
