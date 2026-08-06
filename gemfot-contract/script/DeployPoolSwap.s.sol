// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {PoolSwap} from "@gemfot/zaps/PoolSwap.sol";

/**
 * Deploys the {PoolSwap} zap contract used by the treasury actions.
 *
 * Required environment variables:
 * - POOL_MANAGER : the Uniswap V4 {PoolManager} address
 */
contract DeployPoolSwap is Script {
    function run() external returns (address poolSwap_) {
        address poolManager = vm.envAddress("POOL_MANAGER");

        vm.startBroadcast();
        PoolSwap poolSwap = new PoolSwap(IPoolManager(poolManager));
        vm.stopBroadcast();

        poolSwap_ = address(poolSwap);

        console.log("PoolSwap:", poolSwap_);
    }
}
