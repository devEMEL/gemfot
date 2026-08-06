// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {BlankAction} from "@gemfot/treasury/actions/Blank.sol";

/**
 * Deploys the {BlankAction} treasury action.
 *
 * @dev Must be approved on the {TreasuryActionManager} by the protocol owner via
 * `approveAction(address)` before it can be used.
 */
contract DeployBlankAction is Script {
    function run() external returns (address blankAction_) {
        vm.startBroadcast();
        BlankAction blankAction = new BlankAction();
        vm.stopBroadcast();

        blankAction_ = address(blankAction);

        console.log("BlankAction:", blankAction_);
    }
}
