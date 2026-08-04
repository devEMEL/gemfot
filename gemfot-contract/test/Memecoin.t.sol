// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {IERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Permit.sol";

import {Memecoin} from "@gemfot/Memecoin.sol";
import {IMemecoin} from "@gemfot-interfaces/IMemecoin.sol";

/**
 * @dev Minimal stand-in for the `Launch` ERC721 contract. `Memecoin` only ever
 * calls `tokenId`, `ownerOf`, and `memecoinTreasury` on it, and treats whoever
 * called `initialize()` as the `launch` contract for the `onlyLaunch` modifier.
 * Because Solidity resolves external calls by selector rather than by the
 * imported type's actual bytecode, this mock is ABI-compatible without needing
 * the real `Launch` contract.
 */
contract MockLaunch {
    mapping(address => uint) internal _tokenId;
    mapping(uint => address) internal _ownerOf;
    mapping(uint => bool) internal _revertOwnerOf;
    mapping(uint => address payable) internal _treasury;

    function setTokenId(address _memecoin, uint _id) external {
        _tokenId[_memecoin] = _id;
    }

    function tokenId(
        address _memecoin
    ) external view returns (uint) {
        return _tokenId[_memecoin];
    }

    function setOwner(uint _id, address _owner) external {
        _ownerOf[_id] = _owner;
    }

    function setRevertOnOwnerOf(uint _id, bool _shouldRevert) external {
        _revertOwnerOf[_id] = _shouldRevert;
    }

    function ownerOf(
        uint _id
    ) external view returns (address) {
        if (_revertOwnerOf[_id]) revert("nonexistent token");
        return _ownerOf[_id];
    }

    function setTreasury(uint _id, address payable _treasuryAddress) external {
        _treasury[_id] = _treasuryAddress;
    }

    function memecoinTreasury(
        uint _id
    ) external view returns (address payable) {
        return _treasury[_id];
    }
}

contract MemecoinTest is Test {
    Memecoin memecoin;
    MockLaunch launch;
    address implementation;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address stranger = makeAddr("stranger");

    // Matches the hardcoded `_PERMIT2` constant in Memecoin.sol
    address constant PERMIT2 = 0xC733B042D7f7785af5606012831705797A7285f1;

    string constant NAME = "Test Memecoin";
    string constant SYMBOL = "TEST";
    string constant TOKEN_URI = "ipfs://token-uri";
    uint constant TOTAL_SUPPLY = 1_000_000 ether;

    event MetadataUpdated(string _name, string _symbol);

    function setUp() public {
        implementation = address(new Memecoin());
        launch = new MockLaunch();

        bytes memory initData = abi.encodeWithSelector(
            Memecoin.initialize.selector,
            NAME,
            SYMBOL,
            TOKEN_URI,
            TOTAL_SUPPLY
        );

        // Deploy the proxy as `launch` so `Memecoin.initialize()` sees
        // `msg.sender == address(launch)` and stores it as the Launch contract.
        vm.prank(address(launch));
        ERC1967Proxy proxy = new ERC1967Proxy(implementation, initData);

        memecoin = Memecoin(address(proxy));
    }

    // -----------------------------------------------------------------
    // Initialization
    // -----------------------------------------------------------------

    function test_InitializeSetsMetadata() public view {
        assertEq(memecoin.name(), NAME);
        assertEq(memecoin.symbol(), SYMBOL);
        assertEq(memecoin.tokenURI(), TOKEN_URI);
        assertEq(memecoin.totalSupply(), TOTAL_SUPPLY);
    }

    function test_InitializeSetsLaunch() public view {
        assertEq(address(memecoin.launch()), address(launch));
    }

    function test_RevertWhen_InitializedTwice() public {
        vm.expectRevert();
        memecoin.initialize(NAME, SYMBOL, TOKEN_URI, TOTAL_SUPPLY);
    }

    function test_RevertWhen_ImplementationInitializedDirectly() public {
        Memecoin freshImplementation = new Memecoin();

        vm.expectRevert();
        freshImplementation.initialize(NAME, SYMBOL, TOKEN_URI, TOTAL_SUPPLY);
    }

    // -----------------------------------------------------------------
    // mint (onlyLaunch)
    // -----------------------------------------------------------------

    function test_LaunchCanMint() public {
        vm.prank(address(launch));
        memecoin.mint(alice, 100 ether);

        assertEq(memecoin.balanceOf(alice), 100 ether);
    }

    function test_RevertWhen_NonLaunchMints() public {
        vm.prank(stranger);
        vm.expectRevert(Memecoin.CallerNotLaunch.selector);
        memecoin.mint(alice, 100 ether);
    }

    function test_RevertWhen_MintingToZeroAddress() public {
        vm.prank(address(launch));
        vm.expectRevert(Memecoin.MintAddressIsZero.selector);
        memecoin.mint(address(0), 100 ether);
    }

    // -----------------------------------------------------------------
    // burn / burnFrom
    // -----------------------------------------------------------------

    function test_HolderCanBurnOwnTokens() public {
        vm.prank(address(launch));
        memecoin.mint(alice, 100 ether);

        vm.prank(alice);
        memecoin.burn(40 ether);

        assertEq(memecoin.balanceOf(alice), 60 ether);
    }

    function test_BurnFromSpendsAllowance() public {
        vm.prank(address(launch));
        memecoin.mint(alice, 100 ether);

        vm.prank(alice);
        memecoin.approve(bob, 50 ether);

        vm.prank(bob);
        memecoin.burnFrom(alice, 30 ether);

        assertEq(memecoin.balanceOf(alice), 70 ether);
        assertEq(memecoin.allowance(alice, bob), 20 ether);
    }

    function test_RevertWhen_BurnFromExceedsAllowance() public {
        vm.prank(address(launch));
        memecoin.mint(alice, 100 ether);

        vm.prank(alice);
        memecoin.approve(bob, 10 ether);

        vm.prank(bob);
        vm.expectRevert();
        memecoin.burnFrom(alice, 30 ether);
    }

    // -----------------------------------------------------------------
    // setMetadata (onlyLaunch)
    // -----------------------------------------------------------------

    function test_LaunchCanSetMetadata() public {
        vm.expectEmit(true, true, true, true);
        emit MetadataUpdated("New Name", "NEW");

        vm.prank(address(launch));
        memecoin.setMetadata("New Name", "NEW");

        assertEq(memecoin.name(), "New Name");
        assertEq(memecoin.symbol(), "NEW");
    }

    function test_RevertWhen_NonLaunchSetsMetadata() public {
        vm.prank(stranger);
        vm.expectRevert(Memecoin.CallerNotLaunch.selector);
        memecoin.setMetadata("New Name", "NEW");
    }

    // -----------------------------------------------------------------
    // creator()
    // -----------------------------------------------------------------

    function test_CreatorReturnsLaunchNftOwner() public {
        launch.setTokenId(address(memecoin), 1);
        launch.setOwner(1, alice);

        assertEq(memecoin.creator(), alice);
    }

    function test_CreatorReturnsZeroAddressWhenTokenBurned() public {
        launch.setTokenId(address(memecoin), 1);
        launch.setRevertOnOwnerOf(1, true);

        assertEq(memecoin.creator(), address(0));
    }

    // -----------------------------------------------------------------
    // treasury()
    // -----------------------------------------------------------------

    function test_TreasuryReturnsLaunchTreasury() public {
        launch.setTokenId(address(memecoin), 1);
        launch.setTreasury(1, payable(bob));

        assertEq(memecoin.treasury(), bob);
    }

    // -----------------------------------------------------------------
    // Permit2 infinite allowance
    // -----------------------------------------------------------------

    function test_Permit2AllowanceIsInfiniteByDefault() public view {
        assertEq(memecoin.allowance(alice, PERMIT2), type(uint).max);
    }

    function test_RevertWhen_ApprovingPermit2ForFiniteAmount() public {
        vm.prank(alice);
        vm.expectRevert(Memecoin.Permit2AllowanceIsFixedAtInfinity.selector);
        memecoin.approve(PERMIT2, 100 ether);
    }

    function test_ApprovingPermit2ForMaxSucceeds() public {
        vm.prank(alice);
        bool success = memecoin.approve(PERMIT2, type(uint).max);

        assertTrue(success);
        assertEq(memecoin.allowance(alice, PERMIT2), type(uint).max);
    }

    function test_NormalApprovalsAreUnaffected() public {
        vm.prank(alice);
        memecoin.approve(bob, 50 ether);

        assertEq(memecoin.allowance(alice, bob), 50 ether);
    }

    // -----------------------------------------------------------------
    // supportsInterface
    // -----------------------------------------------------------------

    function test_SupportsIERC20() public view {
        assertTrue(memecoin.supportsInterface(type(IERC20).interfaceId));
    }

    function test_SupportsIERC20Permit() public view {
        assertTrue(memecoin.supportsInterface(type(IERC20Permit).interfaceId));
    }

    function test_SupportsIMemecoin() public view {
        assertTrue(memecoin.supportsInterface(type(IMemecoin).interfaceId));
    }

    function test_DoesNotSupportRandomInterface() public view {
        assertFalse(memecoin.supportsInterface(bytes4(0xdeadbeef)));
    }

    // -----------------------------------------------------------------
    // version()
    // -----------------------------------------------------------------

    function test_Version() public view {
        assertEq(memecoin.version(), "1.0.2");
    }
}


// forge test test/Memecoin.t.sol -vvv