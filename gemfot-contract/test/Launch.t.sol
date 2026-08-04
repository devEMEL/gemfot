// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {ERC721} from "@solady/tokens/ERC721.sol";

import {Ownable} from "@solady/auth/Ownable.sol";

import {GemFotManager} from "@gemfot/GemFotManager.sol";
import {Launch} from "@gemfot/Launch.sol";
import {Memecoin} from "@gemfot/Memecoin.sol";

/**
 * @dev Stand-in for the {MemecoinTreasury} implementation. `Launch` only clones this
 * address and stores the result, so an empty contract is enough to prove the clone
 * was deployed without pulling in the treasury's own dependencies.
 */
contract MockTreasury {}

contract LaunchTest is Test {
    Launch launch;
    Memecoin memecoinImplementation;
    MockTreasury treasuryImplementation;

    /// The {GemFotManager} is only used for its address (the `onlyGemFotManager` gate and
    /// as the recipient of the initial supply), so we use a plain address rather than
    /// deploying the hook, which would require a {PoolManager} and a mined hook address.
    address manager = makeAddr("gemfotManager");

    address creator = makeAddr("creator");
    address stranger = makeAddr("stranger");

    function setUp() public {
        launch = new Launch();
        memecoinImplementation = new Memecoin();
        treasuryImplementation = new MockTreasury();

        launch.initialize(
            address(memecoinImplementation), "", GemFotManager(payable(manager)), address(treasuryImplementation)
        );
    }

    function test_LaunchDeploysTokenAndMintsOwnershipNft() public {
        (address memecoin, address payable treasury, uint tokenId) = _launch(_defaultParams());

        // The creator holds the ERC721 that proves pool ownership
        assertEq(tokenId, 1, "first token ID should be 1");
        assertEq(launch.ownerOf(tokenId), creator, "creator should own the NFT");
        assertEq(launch.nextTokenId(), 2, "next token ID should be incremented");

        // The implementations were cloned and recorded against the token ID
        assertTrue(memecoin != address(0), "memecoin should be deployed");
        assertTrue(treasury != address(0), "treasury should be deployed");
        assertEq(launch.memecoin(tokenId), memecoin, "memecoin should be stored");
        assertEq(launch.memecoinTreasury(tokenId), treasury, "treasury should be stored");
        assertEq(launch.tokenId(memecoin), tokenId, "reverse lookup should resolve");

        // The memecoin was initialized with the launch metadata and fully minted to the manager
        Memecoin _memecoin = Memecoin(memecoin);
        assertEq(_memecoin.name(), "Test Coin");
        assertEq(_memecoin.symbol(), "TEST");
        assertEq(_memecoin.tokenURI(), "https://gemfot.xyz/token.json");
        assertEq(_memecoin.balanceOf(manager), 1000 ether, "supply should be minted to the manager");
    }

    function test_LaunchIncrementsTokenIdsAcrossLaunches() public {
        (address firstMemecoin, , uint firstTokenId) = _launch(_defaultParams());

        GemFotManager.LaunchParams memory params = _defaultParams();
        params.name = "Second Coin";
        params.symbol = "SECOND";
        (address secondMemecoin, , uint secondTokenId) = _launch(params);

        assertEq(firstTokenId, 1);
        assertEq(secondTokenId, 2);
        assertTrue(firstMemecoin != secondMemecoin, "each launch deploys its own memecoin");
        assertEq(launch.nextTokenId(), 3);
    }

    function test_RevertWhen_CallerIsNotGemFotManager() public {
        vm.expectRevert(Launch.CallerIsNotGemFotManager.selector);
        vm.prank(stranger);
        launch.launch(_defaultParams());
    }

    function test_RevertWhen_LaunchIsScheduledTooFarAhead() public {
        GemFotManager.LaunchParams memory params = _defaultParams();
        params.launchAt = block.timestamp + launch.MAX_SCHEDULE_DURATION() + 1;

        vm.expectRevert(Launch.InvalidLaunchSchedule.selector);
        _launch(params);
    }

    function test_RevertWhen_InitialSupplyExceedsTotalSupply() public {
        GemFotManager.LaunchParams memory params = _defaultParams();
        params.initialTokenFairLaunch = params.totalSupply + 1;

        vm.expectRevert(
            abi.encodeWithSelector(Launch.InvalidInitialSupply.selector, params.initialTokenFairLaunch)
        );
        _launch(params);
    }

    function test_RevertWhen_PremineExceedsInitialAmount() public {
        GemFotManager.LaunchParams memory params = _defaultParams();
        params.premineAmount = params.initialTokenFairLaunch + 1;

        vm.expectRevert(
            abi.encodeWithSelector(
                Launch.PremineExceedsInitialAmount.selector, params.premineAmount, params.initialTokenFairLaunch
            )
        );
        _launch(params);
    }

    function test_RevertWhen_CreatorFeeAllocationIsTooHigh() public {
        uint maxAllocation = launch.MAX_CREATOR_ALLOCATION();

        GemFotManager.LaunchParams memory params = _defaultParams();
        params.creatorFeeAllocation = uint24(maxAllocation + 1);

        vm.expectRevert(
            abi.encodeWithSelector(
                Launch.CreatorFeeAllocationInvalid.selector, params.creatorFeeAllocation, maxAllocation
            )
        );
        _launch(params);
    }

    function test_TokenUriFallsBackToMemecoinUriWhenBaseUriIsEmpty() public {
        (, , uint tokenId) = _launch(_defaultParams());
        assertEq(launch.tokenURI(tokenId), "https://gemfot.xyz/token.json");
    }

    function test_TokenUriUsesBaseUriWhenSet() public {
        (, , uint tokenId) = _launch(_defaultParams());

        launch.setBaseURI("https://gemfot.xyz/launch/");
        assertEq(launch.tokenURI(tokenId), "https://gemfot.xyz/launch/1");
    }

    function test_RevertWhen_TokenUriRequestedForUnknownToken() public {
        // Resolve the arguments up front, as `expectRevert` applies to the very next
        // call made after it (which would otherwise be `nextTokenId()`).
        uint unmintedTokenId = launch.nextTokenId();

        vm.expectRevert(ERC721.TokenDoesNotExist.selector);
        launch.tokenURI(0);

        vm.expectRevert(ERC721.TokenDoesNotExist.selector);
        launch.tokenURI(unmintedTokenId);
    }

    function test_RevertWhen_StrangerCallsOwnerOnlySetters() public {
        vm.startPrank(stranger);

        vm.expectRevert(Ownable.Unauthorized.selector);
        launch.setBaseURI("https://evil.xyz/");

        vm.expectRevert(Ownable.Unauthorized.selector);
        launch.setMemecoinImplementation(stranger);

        vm.expectRevert(Ownable.Unauthorized.selector);
        launch.setMemecoinTreasuryImplementation(stranger);

        vm.stopPrank();
    }

    /**
     * Calls `launch` as the {GemFotManager}, which is the only permitted caller.
     */
    function _launch(
        GemFotManager.LaunchParams memory _params
    ) internal returns (address memecoin_, address payable memecoinTreasury_, uint tokenId_) {
        vm.prank(manager);
        return launch.launch(_params);
    }

    function _defaultParams() internal view returns (GemFotManager.LaunchParams memory) {
        return GemFotManager.LaunchParams({
            name: "Test Coin",
            symbol: "TEST",
            tokenUri: "https://gemfot.xyz/token.json",
            initialTokenFairLaunch: 500 ether,
            fairLaunchDuration: 1 days,
            premineAmount: 0,
            creator: creator,
            creatorFeeAllocation: 10_00,
            launchAt: block.timestamp,
            totalSupply: 1000 ether,
            usdcMarketCap: 100_000e6,
            multiple: 1
        });
    }
}
