// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ILaunch} from "@gemfot-interfaces/ILaunch.sol";
import {IMemecoin} from "@gemfot-interfaces/IMemecoin.sol";
import {GemFotManager} from "@gemfot/GemFotManager.sol";
import {TokenSupply} from "@gemfot/libraries/TokenSupply.sol";
import {MarketCappedPriceParams} from "@gemfot/types/USDCMarketCappedPrice.sol";
import {Ownable} from "@solady/auth/Ownable.sol";
import {ERC721} from "@solady/tokens/ERC721.sol";
import {Initializable} from "@solady/utils/Initializable.sol";
import {LibClone} from "@solady/utils/LibClone.sol";
import {LibString} from "@solady/utils/LibString.sol";
import {PoolId} from "@uniswap/v4-core/src/types/PoolId.sol";
/**
 * The Launch ERC721 NFT that is created when a new position is by the {PositionManager} launched.
 * This is used to prove ownership of a pool, so transferring this token would result in a new
 * pool creator being assigned.
 *
 */

contract Launch is ERC721, ILaunch, Initializable, Ownable {
    error InvalidLaunchSchedule();
    error CallerIsNotGemFotManager();
    error CreatorFeeAllocationInvalid(uint24 _allocation, uint _maxAllocation);
    error InvalidInitialSupply(uint _initialSupply);
    error PremineExceedsInitialAmount(uint _buyAmount, uint _initialSupply);

    event BaseURIUpdated(string _newBaseURI);
    event MemecoinImplementationUpdated(address _newImplementation);
    event MemecoinTreasuryImplementationUpdated(address _newImplementation);

    /**
     * Stores related memecoin contract implementation addresses.
     *
     * @custom:member memecoin The ERC20 {Memecoin} address
     * @custom:member memecoinTreasury The {MemecoinTreasury} address
     */
    struct TokenInfo {
        address memecoin;
        address payable memecoinTreasury;
    }

    /// The maximum value of a creator's fee allocation
    uint public constant MAX_CREATOR_ALLOCATION = 100_00;

    /// The maximum duration of a launch schedule
    uint public constant MAX_SCHEDULE_DURATION = 30 days;

    /// Our basic token information
    string internal _name = "Launch Revenue Streams";
    string internal _symbol = "LAUNCH";

    /// The base URI to represent the metadata
    string public baseURI;

    /// Stores the next tokenId that will be minted. This can be used as an indication of how
    /// many tokens currently exist in the protocol.
    uint public nextTokenId = 1;

    /// The Launch {GemFotManager} contract
    GemFotManager public gemfotManager;

    /// Our token implementations that will be deployed when a new token is launched
    address public memecoinImplementation;
    address public memecoinTreasuryImplementation;

    /// Maps `TokenInfo` for each token ID
    mapping(uint _tokenId => TokenInfo _tokenInfo) internal tokenInfo;

    /// Maps a {Memecoin} ERC20 address to it's token ID
    mapping(address _memecoin => uint _tokenId) public tokenId;

    constructor() {
        _initializeOwner(msg.sender);
        _disableInitializers();
    }

    /**
     * Initializes the Launch protocol contract addresses.
     *
     * @param _memecoinImplementation The {Memecoin} implementation address
     * @param _baseURI The default baseUri for the ERC721
     * @param _gemfotManager The {GemFotManager} contract
     * @param _memecoinTreasuryImplementation The {MemecoinTreasury} implementation address
     */
    function initialize(
        address _memecoinImplementation,
        string memory _baseURI,
        GemFotManager _gemfotManager,
        address _memecoinTreasuryImplementation
    ) external onlyOwner initializer {
        memecoinImplementation = _memecoinImplementation;
        baseURI = _baseURI;

        gemfotManager = _gemfotManager;
        memecoinTreasuryImplementation = _memecoinTreasuryImplementation;
    }

    /**
     * Launches a new token, deploying the required implementations and creating a new ERC721. The
     * tokens are sent to the `_creator` to prove ownership of the pool.
     */
    function launch(
        GemFotManager.LaunchParams calldata _params
    )
        external
        override
        onlyGemFotManager
        returns (address memecoin_, address payable memecoinTreasury_, uint tokenId_)
    {
        (MarketCappedPriceParams memory params) = abi.decode(_params.initialPriceParams, (MarketCappedPriceParams));

        // Check if the launch timestamp surpasses the max schedule duration
        if (_params.launchAt > block.timestamp + MAX_SCHEDULE_DURATION) {
            revert InvalidLaunchSchedule();
        }

        // Ensure that the initial supply falls within an accepted range
        if (_params.initialTokenFairLaunch > params.totalSupply) {
            revert InvalidInitialSupply(_params.initialTokenFairLaunch);
        }

        // Check that user isn't trying to premine too many tokens
        if (_params.premineAmount > _params.initialTokenFairLaunch) {
            revert PremineExceedsInitialAmount(_params.premineAmount, _params.initialTokenFairLaunch);
        }

        // A creator cannot set their allocation above a threshold
        if (_params.creatorFeeAllocation > MAX_CREATOR_ALLOCATION) {
            revert CreatorFeeAllocationInvalid(_params.creatorFeeAllocation, MAX_CREATOR_ALLOCATION);
        }

        // Store the current token ID and increment the next token ID
        tokenId_ = nextTokenId;
        unchecked {
            nextTokenId++;
        }

        // Mint ownership token to the creator
        _mint(_params.creator, tokenId_);

        // Deploy the memecoin
        memecoin_ = LibClone.cloneDeterministic(memecoinImplementation, bytes32(tokenId_));

        // Store the token ID
        tokenId[memecoin_] = tokenId_;

        // Initialize the memecoin with the metadata
        IMemecoin _memecoin = IMemecoin(memecoin_);
        _memecoin.initialize(_params.name, _params.symbol, _params.tokenUri, params.totalSupply);

        // Deploy the memecoin treasury
        memecoinTreasury_ = payable(LibClone.cloneDeterministic(memecoinTreasuryImplementation, bytes32(tokenId_)));

        // Store the token info
        tokenInfo[tokenId_] = TokenInfo(memecoin_, memecoinTreasury_);

        // Mint our initial supply to the {GemFotManager}
        _memecoin.mint(address(gemfotManager), params.totalSupply);
    }

    /**
     * Helper to show the {PoolId} address for the ERC721 token.
     *
     * @param _tokenId The token ID to get the {PoolId} for
     *
     * @return PoolId The {PoolId} for the token
     */
    function poolId(
        uint _tokenId
    ) public view returns (PoolId) {
        return gemfotManager.poolKey(tokenInfo[_tokenId].memecoin).toId();
    }

    /**
     * Helper to show the {Memecoin} address for the ERC721.
     *
     * @param _tokenId The token ID to get the {Memecoin} for
     *
     * @return address {Memecoin} address
     */
    function memecoin(
        uint _tokenId
    ) public view returns (address) {
        return tokenInfo[_tokenId].memecoin;
    }

    /**
     * Helper to show the {MemecoinTreasury} address for the ERC721.
     *
     * @param _tokenId The token ID to get the {MemecoinTreasury} for
     *
     * @return address {MemecoinTreasury} address
     */
    function memecoinTreasury(
        uint _tokenId
    ) public view returns (address payable) {
        return tokenInfo[_tokenId].memecoinTreasury;
    }

    /**
     * Allows the contract owner to update the memecoin implementation address.
     *
     * @param _memecoinImplementation The new memecoin implementation address
     */
    function setMemecoinImplementation(
        address _memecoinImplementation
    ) external onlyOwner {
        memecoinImplementation = _memecoinImplementation;
        emit MemecoinImplementationUpdated(_memecoinImplementation);
    }

    /**
     * Allows the contract owner to update the memecoin treasury implementation address.
     *
     * @param _memecoinTreasuryImplementation The new memecoin treasury implementation address
     */
    function setMemecoinTreasuryImplementation(
        address _memecoinTreasuryImplementation
    ) external onlyOwner {
        memecoinTreasuryImplementation = _memecoinTreasuryImplementation;
        emit MemecoinTreasuryImplementationUpdated(_memecoinTreasuryImplementation);
    }

    /**
     * Allows a contract owner to update the name and symbol of the ERC20 token so
     * that if one is created with malformed, unintelligible or offensive data then
     * we can replace it. (WE CAN ALWAYS CHANGE IT TO ALLOW TOKEN CREATOR UPDATE INSTEAD)
     *
     * @param _memecoin The memecoin address
     * @param name_ The new name for the token
     * @param symbol_ The new symbol for the token
     */
    function setMemecoinMetadata(
        address _memecoin,
        string calldata name_,
        string calldata symbol_
    ) external onlyOwner {
        IMemecoin(_memecoin).setMetadata(name_, symbol_);
    }

    /**
     * Allows a contract owner to update the base URI for the creator ERC721 tokens.
     *
     * @param _baseURI The new base URI
     */
    function setBaseURI(
        string memory _baseURI
    ) external onlyOwner {
        baseURI = _baseURI;
        emit BaseURIUpdated(_baseURI);
    }

    /**
     * Burns `tokenId` by sending it to `address(0)`.
     *
     * @dev The caller must own `tokenId` or be an approved operator.
     *
     * @param _tokenId The token ID to check
     */
    function burn(
        uint _tokenId
    ) public {
        _burn(msg.sender, _tokenId);
    }

    /**
     * Returns the ERC721 name.
     */
    function name() public view override returns (string memory) {
        return _name;
    }

    /**
     * Returns the ERC721 symbol.
     */
    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    /**
     * Returns the Uniform Resource Identifier (URI) for token id.
     *
     * @dev We prevent the token from erroring if it was burned, and instead we just check against
     * the current tokenId iteration we have stored.
     *
     * @param _tokenId The token ID to get the URI for
     */
    function tokenURI(
        uint _tokenId
    ) public view override returns (string memory) {
        // If we are ahead of our tracked tokenIds, then revert
        if (_tokenId == 0 || _tokenId >= nextTokenId) {
            revert TokenDoesNotExist();
        }

        // If the base URI is empty, return the memecoin token URI
        if (bytes(baseURI).length == 0) {
            return IMemecoin(tokenInfo[_tokenId].memecoin).tokenURI();
        }

        // Otherwise, concatenate the base URI and the token ID
        return LibString.concat(baseURI, LibString.toString(_tokenId));
    }

    /**
     * Ensures that only the immutable {GemfotManager} can call the function.
     */
    modifier onlyGemFotManager() {
        if (msg.sender != address(gemfotManager)) {
            revert CallerIsNotGemFotManager();
        }
        _;
    }

    /**
     * Override to return true to make `_initializeOwner` prevent double-initialization.
     *
     * @return bool Set to `true` to prevent owner being reinitialized.
     */
    function _guardInitializeOwner() internal pure override returns (bool) {
        return true;
    }
}
