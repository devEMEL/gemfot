// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {BidWall} from "@gemfot/bidwall/BidWall.sol";

/**
 * Deploys the {BidWall} contract.
 *
 * Required environment variables:
 * - NATIVE_TOKEN   : the USDC (native) token address used by the protocol
 * - POOL_MANAGER   : the Uniswap V4 {PoolManager} address
 * - PROTOCOL_OWNER : the EOA that will own the contract (also receives `DEFAULT_ADMIN_ROLE`)
 *
 * @dev The protocol owner must later call `grantRole(ProtocolRoles.GEMFOT_MANAGER, gemFotManager)`.
 */
contract DeployBidWall is Script {
    function run() external returns (address bidWall_) {
        address nativeToken = vm.envAddress("NATIVE_TOKEN");
        address poolManager = vm.envAddress("POOL_MANAGER");
        address protocolOwner = vm.envAddress("PROTOCOL_OWNER");

        vm.startBroadcast();
        BidWall bidWall = new BidWall(nativeToken, poolManager, protocolOwner);
        vm.stopBroadcast();

        bidWall_ = address(bidWall);

        console.log("BidWall:", bidWall_);
    }
}
