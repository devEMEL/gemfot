// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Initializable} from "@solady/utils/Initializable.sol";
import {ReentrancyGuard} from "@solady/utils/ReentrancyGuard.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

import {GemFotManager} from "@gemfot/GemFotManager.sol";
import {TreasuryActionManager} from "@gemfot/treasury/ActionManager.sol";
import {MemecoinFinder} from "@gemfot/types/MemecoinFinder.sol";

import {ITreasuryAction} from "@gemfot-interfaces/ITreasuryAction.sol";

/**
 * Allows approved actions to be executed by the `PoolCreator` for their specific pool, using
 * tokens in their {MemecoinTreasury}.
 */
contract MemecoinTreasury is Initializable, ReentrancyGuard {
    using MemecoinFinder for PoolKey;
    using PoolIdLibrary for PoolKey;

    error ActionNotApproved();
    error Unauthorized();

    event ActionExecuted(address indexed _action, PoolKey _poolKey, bytes _data);

    /// The native token used by the Launch {PositionManager}
    address public nativeToken;

    /// The {TreasuryActionManager} contract that stores approved actions
    TreasuryActionManager public actionManager;

    /// The {GemFotManager} that fees will be claimed from
    GemFotManager public gemfotManager;

    /// The `PoolKey` that is attached to this {MemecoinTreasury}
    PoolKey public poolKey;

    /**
     * Sets the Launch {PositionManager} and native token, and initializes with the `PoolKey`.
     *
     * @param _actionManager The {TreasuryActionManager} contract address
     * @param _nativeToken The native token address used by Launch
     * @param _poolKey The pool that is being actioned against
     */
    function initialize(
        address payable _gemfotManager,
        address _actionManager,
        address _nativeToken,
        PoolKey memory _poolKey
    ) public initializer {
        actionManager = TreasuryActionManager(_actionManager);
        nativeToken = _nativeToken;
        poolKey = _poolKey;
        gemfotManager = GemFotManager(_gemfotManager);
    }

    /**
     * Executes an approved {ITreasuryAction}.
     *
     * @dev Only to `PoolCreator` can make this call, otherwise reverted with `Unauthorized`
     *
     * @param _action The {ITreasuryAction} address to execute
     * @param _data Additional data that the {ITreasuryAction} may require
     */
    function executeAction(
        address _action,
        bytes memory _data
    ) public nonReentrant {
        // Ensure the action is approved
        if (!actionManager.approvedActions(_action)) {
            revert ActionNotApproved();
        }

        // Make sure the caller is the owner of the corresponding ERC721
        address poolCreator = poolKey.memecoin(nativeToken).creator();
        if (poolCreator != msg.sender) {
            revert Unauthorized();
        }

        IERC20 token0 = IERC20(Currency.unwrap(poolKey.currency0));
        IERC20 token1 = IERC20(Currency.unwrap(poolKey.currency1));

        // Approve all tokens to be used before execution
        token0.approve(_action, type(uint).max);
        token1.approve(_action, type(uint).max);

        // Claim fees before executing, keeping as fleth to ensure full treasury balances
        claimFees();

        // Call the execute function on the action contract
        ITreasuryAction(_action).execute(poolKey, _data);
        emit ActionExecuted(_action, poolKey, _data);

        // Unapprove all tokens after execution
        token0.approve(_action, 0);
        token1.approve(_action, 0);
    }

    /**
     * Claims any pending fees allocated to the {MemecoinTreasury}.
     *
     * @dev This call does not require protection and can be called by anyone
     */
    function claimFees() public {
        gemfotManager.feeEscrow().withdrawFees(address(this));
    }

    receive() external payable {}
}
