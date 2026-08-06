// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {IndexerSubscriber} from "@gemfot/subscribers/Indexer.sol";

/**
 * Deploys the {IndexerSubscriber} contract.
 *
 * @dev Ownership is assigned to the deployer (`msg.sender`), so the deployer will need to call
 * `setNotifierLaunch(notifier, launch)` once the {Notifier} and {Launch} contracts are known.
 */
contract DeployIndexer is Script {
    function run() external returns (address indexer_) {
        vm.startBroadcast();
        IndexerSubscriber indexer = new IndexerSubscriber();
        vm.stopBroadcast();

        indexer_ = address(indexer);

        console.log("IndexerSubscriber:", indexer_);
    }
}
