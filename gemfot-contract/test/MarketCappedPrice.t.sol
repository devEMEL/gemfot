// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";

import {USDCMarketCappedPrice} from "@gemfot/price/MarketCappedPrice.sol";

contract MarketCappedPrice is Test {
    USDCMarketCappedPrice price;

    address owner = makeAddr("owner");
    address notOwner = makeAddr("notOwner");

    uint256 constant DEFAULT_LAUNCH_FEE = 10 * 1e6; // 10 USDC

    event LaunchFeeUpdated(uint256 _launchFee);

    function setUp() public {
        price = new USDCMarketCappedPrice(owner);
    }

    // -----------------------------------------------------------------
    // Owner
    // -----------------------------------------------------------------

    function test_ConstructorSetsOwner() public view {
        assertEq(price.owner(), owner);
    }

    function test_OwnerIsNotNotOwner() public view {
        assertNotEq(price.owner(), notOwner);
    }

    // -----------------------------------------------------------------
    // launchFee / getLaunchingFee
    // -----------------------------------------------------------------

    function test_DefaultLaunchFeeIsTenUsdc() public view {
        assertEq(price.launchFee(), DEFAULT_LAUNCH_FEE);
        assertEq(price.getLaunchingFee(), DEFAULT_LAUNCH_FEE);
    }

    function test_OwnerCanSetLaunchFee() public {
        uint256 newFee = 25 * 1e6;

        vm.prank(owner);
        price.setLaunchFee(newFee);

        assertEq(price.launchFee(), newFee);
        assertEq(price.getLaunchingFee(), newFee);
    }

    function test_SetLaunchFeeEmitsEvent() public {
        uint256 newFee = 5 * 1e6;

        vm.expectEmit(true, true, true, true);
        emit LaunchFeeUpdated(newFee);

        vm.prank(owner);
        price.setLaunchFee(newFee);
    }

    function test_SetLaunchFeeToZero() public {
        vm.prank(owner);
        price.setLaunchFee(0);

        assertEq(price.launchFee(), 0);
    }

    function test_RevertWhen_NonOwnerSetsLaunchFee() public {
        vm.prank(notOwner);
        vm.expectRevert(); // Ownable: Unauthorized()
        price.setLaunchFee(1 * 1e6);
    }

    function testFuzz_OwnerCanSetAnyLaunchFee(uint256 newFee) public {
        vm.prank(owner);
        price.setLaunchFee(newFee);

        assertEq(price.launchFee(), newFee);
    }

    function testFuzz_RevertWhen_NonOwnerSetsAnyLaunchFee(
        address caller,
        uint256 newFee
    ) public {
        vm.assume(caller != owner);

        vm.prank(caller);
        vm.expectRevert();
        price.setLaunchFee(newFee);
    }
}

// forge test test/MarketCappedPrice.t.sol -vvv