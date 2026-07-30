// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@solady/auth/Ownable.sol";

import {IHooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

import {Launch} from "@gemfot/Launch.sol";

/**
 * Creates an evolving list of pools on Launch and maps its corresponding token
 * information for onchain lookups.
 */
contract IndexerSubscriber is Ownable {
    using PoolIdLibrary for PoolKey;

    error InvalidTokenId(address _launch, uint _tokenId);

    /**
     * Contains index information for a token.
     *
     * @custom:member launch The {Launch} contract that launched the token
     * @custom:member memecoin The ERC20 memecoin address
     * @custom:member memecoinTreasury The contract address for the memecoin treasury
     * @custom:member tokenId The ERC721 {Launch} token created with the memecoin
     */
    struct Index {
        address launch;
        address memecoin;
        address memecoinTreasury;
        uint tokenId;
    }

    /**
     * Contains information required for created a legacy index.
     *
     * @custom:member launch The {Launch} contract that launched the token
     * @custom:member tokenId The ERC721 {Launch} token IDs created with the memecoin
     */
    struct AddIndexParams {
        address launch;
        uint[] tokenIds;
    }

    /// Maps a PoolId to the token index information
    mapping(PoolId _poolId => Index _index) internal _poolIndex;

    /// Maps a PoolId to a Launch contract
    mapping(PoolId _poolId => Launch _launch) internal _poolLaunch;

    /// Maps each notifier to the launch contract that it will represent
    mapping(address _notifier => address _launch) internal _notifierLaunch;

    /**
     * Registers the owner of the contract.
     */
    constructor() {
        _initializeOwner(msg.sender);
    }

    /**
     * Called when the contract is subscribed to the Notifier.
     *
     * We have no subscription requirements, so we can just confirm immediately.
     *
     * @dev This must return `true` to be subscribed.
     */
    function subscribe(
        bytes memory /* _data */
    ) public pure returns (bool) {
        return true;
    }

    /**
     * Whenever a token is launched, we will index the token information onchain.
     *
     * @dev Called when `afterInitialize` is triggered.
     *
     * @param _poolId The poolId that has been initialized
     * @param _key The notification key
     * @param _data Contains the tokenId, as well as unused params
     */
    function notify(
        PoolId _poolId,
        bytes4 _key,
        bytes calldata _data
    ) public {
        // We only want to deal with the `afterInitialize` key
        if (_key != IHooks.afterInitialize.selector) {
            return;
        }

        // If the notifier has not been allocated a launch contract, then we cannot
        // proceed with our indexing.
        if (_notifierLaunch[msg.sender] == address(0)) {
            return;
        }

        // Register our launch contract relative to the notifier
        Launch launch = Launch(_notifierLaunch[msg.sender]);

        // Unpack our tokenId from our passed initialization data
        (uint tokenId) = abi.decode(_data, (uint));

        // Store our token information, relative to the PoolId
        _poolIndex[_poolId] = Index({
            launch: address(launch),
            memecoin: launch.memecoin(tokenId),
            memecoinTreasury: launch.memecoinTreasury(tokenId),
            tokenId: tokenId
        });

        // Store our launch contract relative to the PoolId
        _poolLaunch[_poolId] = launch;
    }

    /**
     * Returns the index information for a given PoolId.
     *
     * @dev To conform to existing integrations, we return the struct members individually.
     *
     * @param _poolId The PoolId to get the index information for
     * @return launch_ The {Launch} contract that launched the token
     * @return memecoin_ The memecoin address
     * @return memecoinTreasury_ The memecoin treasury address
     * @return tokenId_ The tokenId created with the pool (0 if burned)
     */
    function poolIndex(
        PoolId _poolId
    ) public view returns (address launch_, address memecoin_, address memecoinTreasury_, uint tokenId_) {
        // Get the index information for the given PoolId
        Index memory poolIndex_ = _poolIndex[_poolId];

        // Before returning the tokenId that was used to create the pool, we need to first check if
        // the ownership of the token has been burned. If it has been burned and future contract calls
        // depend on this value, then they could receive a revert.
        if (poolIndex_.tokenId != 0) {
            try _poolLaunch[_poolId].ownerOf(poolIndex_.tokenId) returns (
                address owner
            ) {
            //
            }
            catch {
                poolIndex_.tokenId = 0;
            }
        }

        return (poolIndex_.launch, poolIndex_.memecoin, poolIndex_.memecoinTreasury, poolIndex_.tokenId);
    }

    /**
     * For tokens that were launched before this Notifier was put in place, we allow the
     * information to be back-filled. The data is validated before being written and will
     * revert if it is deemed invalid.
     *
     * @param _params Information to add legacy indexes
     */
    function addIndex(
        AddIndexParams[] calldata _params
    ) public {
        // Declare our global variables
        AddIndexParams memory params;
        Launch launch;
        PoolId poolId;
        uint tokenId;

        // Iterate over all tokens to sync them
        uint paramsLength = _params.length;
        for (uint i; i < paramsLength; ++i) {
            params = _params[i];
            launch = Launch(params.launch);

            // Iterate over our tokenIds
            uint tokenIdsLength = params.tokenIds.length;
            for (uint k; k < tokenIdsLength; ++k) {
                tokenId = params.tokenIds[k];

                /**
                 * Validate the data provided by checking the token information and confirming
                 * that it matches the tokenId provided. We can do this because our protocol has
                 * a uni-directional lookup which is why this subscriber is created to make it
                 * multi-directional.
                 */

                // Confirm that the memecoin correctly matches the tokenId
                address memecoin = launch.memecoin(tokenId);
                if (launch.tokenId(memecoin) != tokenId) {
                    revert InvalidTokenId(address(launch), tokenId);
                }

                // Find the PoolKey by the memecoin address
                poolId = launch.gemfotManager().poolKey(memecoin).toId();

                // Store our validated index data
                _poolIndex[poolId] = Index({
                    launch: address(launch),
                    memecoin: memecoin,
                    memecoinTreasury: launch.memecoinTreasury(tokenId),
                    tokenId: tokenId
                });

                // Store our launch contract relative to the PoolId
                _poolLaunch[poolId] = launch;
            }
        }
    }

    /**
     * Allows our owner to set {Launch} contracts for each {Notifier}.
     *
     * @param _notifier The {Notifier} contract address
     * @param _launch The {Launch} contract of the Notifier
     */
    function setNotifierLaunch(
        address _notifier,
        address _launch
    ) public onlyOwner {
        _notifierLaunch[_notifier] = _launch;
    }
}
