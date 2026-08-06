// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {Launch} from "@gemfot/Launch.sol";
import {GemFotManager} from "@gemfot/GemFotManager.sol";

/**
 * Deploys and initializes the {Launch} ERC721 contract.
 *
 * Required environment variables:
 * - MEMECOIN_IMPLEMENTATION          : the deployed {Memecoin} implementation address
 * - MEMECOIN_TREASURY_IMPLEMENTATION : the deployed {MemecoinTreasury} implementation address
 * - GEMFOT_MANAGER                   : the deployed {GemFotManager} hook address
 * - BASE_URI                         : the ERC721 base token URI
 *
 * @dev The {GemFotManager} owner must call `setLaunch(launch)` afterwards.
 */
contract DeployLaunch is Script {
    function run() external returns (address launch_) {
        address memecoinImplementation = vm.envAddress("MEMECOIN_IMPLEMENTATION");
        address memecoinTreasuryImplementation = vm.envAddress("MEMECOIN_TREASURY_IMPLEMENTATION");
        address gemFotManager = vm.envAddress("GEMFOT_MANAGER");
        string memory baseUri = vm.envString("BASE_URI");

        vm.startBroadcast();
        Launch launch = new Launch();
        launch.initialize(
            memecoinImplementation,
            baseUri,
            GemFotManager(payable(gemFotManager)),
            memecoinTreasuryImplementation
        );
        vm.stopBroadcast();

        launch_ = address(launch);

        console.log("Launch:", launch_);
    }
}
