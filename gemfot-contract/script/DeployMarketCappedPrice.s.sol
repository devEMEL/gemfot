// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {USDCMarketCappedPrice} from "@gemfot/price/MarketCappedPrice.sol";

/**
 * Deploys the {USDCMarketCappedPrice} contract (IInitialPrice implementation).
 *
 * Required environment variables:
 * - PROTOCOL_OWNER : the EOA that will own the contract
 */
contract DeployMarketCappedPrice is Script {
    function run() external returns (address initialPrice_) {
        address protocolOwner = vm.envAddress("PROTOCOL_OWNER");

        vm.startBroadcast();
        USDCMarketCappedPrice initialPrice = new USDCMarketCappedPrice(protocolOwner);
        vm.stopBroadcast();

        initialPrice_ = address(initialPrice);

        console.log("USDCMarketCappedPrice:", initialPrice_);
    }
}
