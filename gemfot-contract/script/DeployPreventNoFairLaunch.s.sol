// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {PreventNoFairLaunch} from "@gemfot/subscribers/PreventNoFairLaunch.sol";

/**
 * Deploys the {PreventNoFairLaunch} subscriber.
 *
 * Required environment variables:
 * - NOTIFIER : the deployed {Notifier} address
 *
 * @dev The {Notifier} owner must then call `subscribe(subscriber, data)` to register it.
 */
contract DeployPreventNoFairLaunch is Script {
    function run() external returns (address preventNoFairLaunch_) {
        address notifier = vm.envAddress("NOTIFIER");

        vm.startBroadcast();
        PreventNoFairLaunch preventNoFairLaunch = new PreventNoFairLaunch(notifier);
        vm.stopBroadcast();

        preventNoFairLaunch_ = address(preventNoFairLaunch);

        console.log("PreventNoFairLaunch:", preventNoFairLaunch_);
    }
}
