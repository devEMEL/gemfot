// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {FairLaunch} from "@gemfot/hooks/FairLaunch.sol";

/**
 * Deploys the {FairLaunch} contract.
 *
 * Required environment variables:
 * - POOL_MANAGER : the Uniswap V4 {PoolManager} address
 *
 * @dev `DEFAULT_ADMIN_ROLE` is granted to the deployer (`msg.sender`), so the deployer must later
 * call `grantRole(ProtocolRoles.GEMFOT_MANAGER, gemFotManager)`.
 */
contract DeployFairLaunch is Script {
    function run() external returns (address fairLaunch_) {
        address poolManager = vm.envAddress("POOL_MANAGER");

        vm.startBroadcast();
        FairLaunch fairLaunch = new FairLaunch(IPoolManager(poolManager));
        vm.stopBroadcast();

        fairLaunch_ = address(fairLaunch);

        console.log("FairLaunch:", fairLaunch_);
    }
}
