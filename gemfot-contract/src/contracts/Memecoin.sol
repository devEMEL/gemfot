// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {
    ERC20PermitUpgradeable
} from "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20PermitUpgradeable.sol";

import {Launch} from "@gemfot/Launch.sol";

import {IMemecoin} from "@gemfot-interfaces/IMemecoin.sol";

/**
 * The ERC20 memecoin created when a new token is launched.
 */
contract Memecoin is ERC20PermitUpgradeable, IMemecoin {
    error MintAddressIsZero();
    error CallerNotLaunch();
    error Permit2AllowanceIsFixedAtInfinity();

    /// Emitted when the metadata is updated for the token
    event MetadataUpdated(string _name, string _symbol);

    /// Token name
    string private _name;

    /// Token symbol
    string private _symbol;

    /// Token URI
    string public tokenURI;

    /// The respective Launch ERC721 for this contract
    Launch public launch;

    /// @dev The canonical Permit2 address.
    /// For signature-based allowance granting for single transaction ERC20 `transferFrom`.
    /// To enable, override `_givePermit2InfiniteAllowance()`.
    /// [Github](https://github.com/Uniswap/permit2)
    /// [Etherscan](https://etherscan.io/address/0x000000000022D473030F116dDEE9F6B43aC78BA3)
    // address internal constant _PERMIT2 = 0x000000000022D473030F116dDEE9F6B43aC78BA3;

    // use arc network permit2 address or mlswap permit2 address
    // arc
    // mlswap: 0xC733B042D7f7785af5606012831705797A7285f1
    address internal constant _PERMIT2 = 0xC733B042D7f7785af5606012831705797A7285f1;

    /**
     * Calling this in the constructor will prevent the contract from being initialized or
     * reinitialized. It is recommended to use this to lock implementation contracts that
     * are designed to be called through proxies.
     */
    constructor() {
        _disableInitializers();
    }

    /**
     * Sets our initial token metadata, registers our inherited contracts
     *
     * @param name_ The name for the token
     * @param symbol_ The symbol for the token
     * @param tokenUri_ The URI for the token
     */
    function initialize(
        string calldata name_,
        string calldata symbol_,
        string calldata tokenUri_
    ) public override initializer {
        // Initialises our token based on the implementation
        _name = name_;
        _symbol = symbol_;
        tokenURI = tokenUri_;

        launch = Launch(msg.sender);

        __ERC20_init(name_, symbol_);
        __ERC20Permit_init(name_);
    }

    /**
     * Allows our creating contract to mint additional ERC20 tokens when required.
     *
     * @param _to The recipient of the minted token
     * @param _amount The number of tokens to mint
     */
    function mint(
        address _to,
        uint _amount
    ) public virtual override onlyLaunch {
        if (_to == address(0)) {
            revert MintAddressIsZero();
        }
        _mint(_to, _amount);
    }

    /**
     * Destroys a `value` amount of tokens from the caller.
     *
     * See {ERC20-_burn}.
     */
    function burn(
        uint value
    ) public override {
        _burn(msg.sender, value);
    }

    function _update(
        address from,
        address to,
        uint amount
    ) internal override(ERC20Upgradeable) {
        super._update(from, to, amount);
    }

    /**
     * Destroys a `value` amount of tokens from `account`, deducting from
     * the caller's allowance.
     *
     * See {ERC20-_burn} and {ERC20-allowance}.
     */
    function burnFrom(
        address account,
        uint value
    ) public override {
        _spendAllowance(account, msg.sender, value);
        _burn(account, value);
    }

    /**
     * Allows a contract owner to update the name and symbol of the ERC20 token so
     * that if one is created with malformed, unintelligible or offensive data then
     * we can replace it.
     *
     * @param name_ The new name for the token
     * @param symbol_ The new symbol for the token
     */
    function setMetadata(
        string calldata name_,
        string calldata symbol_
    ) public override onlyLaunch {
        _name = name_;
        _symbol = symbol_;

        emit MetadataUpdated(_name, _symbol);
    }

    /**
     * Returns the name of the token.
     */
    function name() public view override(ERC20Upgradeable, IMemecoin) returns (string memory) {
        return _name;
    }

    /**
     * Returns the symbol of the token, usually a shorter version of the name.
     */
    function symbol() public view override(ERC20Upgradeable, IMemecoin) returns (string memory) {
        return _symbol;
    }

    /**
     * Finds the "creator" of the memecoin, which equates to the owner of the {Launch} ERC721. This
     * means that if the NFT is traded, then the new holder would become the creator.
     *
     * @dev This also means that if the token is burned we can expect a zero-address response
     *
     * @return creator_ The "creator" of the memecoin
     */
    function creator() public view override returns (address creator_) {
        uint tokenId = launch.tokenId(address(this));

        // Handle case where the token has been burned. This is wrapped in a try/catch as we don't
        // want to revert if the token has a zero address owner (the default ERC721 logic).
        try launch.ownerOf(tokenId) returns (address owner) {
            creator_ = owner;
        } catch {}
    }

    /**
     * Finds the {MemecoinTreasury} contract associated with the memecoin.
     *
     * @dev This will still be non-zero even if the held token is burned.
     *
     * @return The address of the {MemecoinTreasury}
     */
    function treasury() public view override returns (address payable) {
        uint tokenId = launch.tokenId(address(this));
        return launch.memecoinTreasury(tokenId);
    }

    /*´:°•.°+.*•´.*:˚.°*.˚•´.°:°•.°•.*•´.*:˚.°*.˚•´.°:°•.°+.*•´.*:*/
    /*                          PERMIT2                           */
    /*.•°:°.´+˚.*°.˚:*.´•*.+°.•°:´*.´•*.•°.•°:°.´:•˚°.*°.˚:*.´+°.•*/

    /**
     * Returns whether to fix the Permit2 contract's allowance at infinity.
     */
    function _givePermit2InfiniteAllowance() internal view virtual returns (bool) {
        return true;
    }

    /**
     * Override to support Permit2 infinite allowance.
     */
    function allowance(
        address owner,
        address spender
    ) public view override(ERC20Upgradeable, IERC20) returns (uint) {
        if (_givePermit2InfiniteAllowance()) {
            if (spender == _PERMIT2) {
                return type(uint).max;
            }
        }
        return super.allowance(owner, spender);
    }

    /**
     * Override to support Permit2 infinite allowance.
     */
    function approve(
        address spender,
        uint amount
    ) public override(ERC20Upgradeable, IERC20) returns (bool) {
        if (_givePermit2InfiniteAllowance()) {
            if (spender == _PERMIT2 && amount != type(uint).max) {
                revert Permit2AllowanceIsFixedAtInfinity();
            }
        }
        return super.approve(spender, amount);
    }

    function version() external view virtual returns (string memory) {
        return "1.0.2";
    }

    /*Define our supported interfaces through contract extension.
     *
     */
    function supportsInterface(
        bytes4 _interfaceId
    ) public view virtual returns (bool) {
        return (
            // Base token interfaces
            _interfaceId == type(IERC20).interfaceId || 

                // Permit interface
                _interfaceId == type(IERC20Permit).interfaceId || 

                // Memecoin interface
                _interfaceId == type(IMemecoin).interfaceId
        );
    }

    /**
     * Ensures that only it's respective Launch contract is making the call.
     */
    modifier onlyLaunch() {
        if (msg.sender != address(launch)) {
            revert CallerNotLaunch();
        }
        _;
    }
}
