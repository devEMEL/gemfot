// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";

import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";

import {HookMiner} from "v4-hooks-public/src/utils/HookMiner.sol";

import {GemFotManager} from "@gemfot/GemFotManager.sol";
import {FeeDistributor} from "@gemfot/hooks/FeeDistributor.sol";
import {FeeExemptions} from "@gemfot/hooks/FeeExemptions.sol";
import {FairLaunch} from "@gemfot/hooks/FairLaunch.sol";
import {BidWall} from "@gemfot/bidwall/BidWall.sol";
import {TreasuryActionManager} from "@gemfot/treasury/ActionManager.sol";

import {IInitialPrice} from "@gemfot-interfaces/IInitialPrice.sol";

/**
 * Mines a valid hook address and deploys the {GemFotManager} Uniswap V4 hook via CREATE2.
 *
 * Required environment variables:
 * - NATIVE_TOKEN           : the USDC (native) token address used by the protocol
 * - POOL_MANAGER           : the Uniswap V4 {PoolManager} address
 * - SWAP_FEE               : the default swap fee (e.g. 300 == 3%)
 * - PROTOCOL_FEE           : the protocol split of the swap fee (e.g. 200 == 2%)
 * - FEE_DISTRIBUTION_ACTIVE: whether the fee distribution is active (true / false)
 * - INITIAL_PRICE          : the deployed {USDCMarketCappedPrice} address
 * - PROTOCOL_OWNER         : the EOA that will own the contract
 * - PROTOCOL_FEE_RECIPIENT : the deployed {ProtocolFeeRecipient} address
 * - FEE_ESCROW             : the deployed {FeeEscrow} address
 * - FEE_EXEMPTIONS         : the deployed {FeeExemptions} address
 * - ACTION_MANAGER         : the deployed {TreasuryActionManager} address
 * - BID_WALL               : the deployed {BidWall} address
 * - FAIR_LAUNCH            : the deployed {FairLaunch} address
 */
contract DeployGemFotManager is Script {
    /// The canonical deterministic CREATE2 deployer
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;

    function run() external returns (address gemFotManager_) {
        GemFotManager.ConstructorParams memory params = GemFotManager.ConstructorParams({
            nativeToken: vm.envAddress("NATIVE_TOKEN"),
            poolManager: IPoolManager(vm.envAddress("POOL_MANAGER")),
            feeDistribution: FeeDistributor.FeeDistribution({
                swapFee: uint24(vm.envUint("SWAP_FEE")),
                protocol: uint24(vm.envUint("PROTOCOL_FEE")),
                active: vm.envBool("FEE_DISTRIBUTION_ACTIVE")
            }),
            initialPrice: IInitialPrice(vm.envAddress("INITIAL_PRICE")),
            protocolOwner: vm.envAddress("PROTOCOL_OWNER"),
            protocolFeeRecipient: vm.envAddress("PROTOCOL_FEE_RECIPIENT"),
            feeEscrow: vm.envAddress("FEE_ESCROW"),
            feeExemptions: FeeExemptions(vm.envAddress("FEE_EXEMPTIONS")),
            actionManager: TreasuryActionManager(vm.envAddress("ACTION_MANAGER")),
            bidWall: BidWall(vm.envAddress("BID_WALL")),
            fairLaunch: FairLaunch(vm.envAddress("FAIR_LAUNCH"))
        });

        // These flags must match `GemFotManager.getHookPermissions()`
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG
                | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
                | Hooks.AFTER_DONATE_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
                | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );

        bytes memory constructorArgs = abi.encode(params);

        // Mine a salt that will produce a hook address with the correct flags
        (address hookAddress, bytes32 salt) =
            HookMiner.find(CREATE2_DEPLOYER, flags, type(GemFotManager).creationCode, constructorArgs);

        vm.startBroadcast();
        GemFotManager gemFotManager = new GemFotManager{salt: salt}(params);
        vm.stopBroadcast();

        require(address(gemFotManager) == hookAddress, "DeployGemFotManager: hook address mismatch");

        gemFotManager_ = address(gemFotManager);

        console.log("GemFotManager:", gemFotManager_);
    }
}
