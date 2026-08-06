// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks, IHooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";

import {GemFotManager} from "@gemfot/GemFotManager.sol";
import {Launch} from "@gemfot/Launch.sol";
import {Memecoin} from "@gemfot/Memecoin.sol";
import {FairLaunch} from "@gemfot/hooks/FairLaunch.sol";
import {FeeDistributor} from "@gemfot/hooks/FeeDistributor.sol";
import {FeeExemptions} from "@gemfot/hooks/FeeExemptions.sol";
import {BidWall} from "@gemfot/bidwall/BidWall.sol";
import {FeeEscrow} from "@gemfot/escrows/FeeEscrow.sol";
import {USDCMarketCappedPrice} from "@gemfot/price/MarketCappedPrice.sol";
import {TreasuryActionManager} from "@gemfot/treasury/ActionManager.sol";
import {MemecoinTreasury} from "@gemfot/treasury/MemecoinTreasury.sol";
import {ProtocolRoles} from "@gemfot/libraries/ProtocolRoles.sol";
import {LinearBondingCurve} from "@gemfot/libraries/LinearBondingCurve.sol";
import {IInitialPrice} from "@gemfot-interfaces/IInitialPrice.sol";
import {IMemecoin} from "@gemfot-interfaces/IMemecoin.sol";

/**
 * Mock USDC token for testing (6 decimals to match real USDC)
 */
contract MockUSDC is IERC20 {
    string public constant name = "USD Coin";
    string public constant symbol = "USDC";
    uint8 public constant decimals = 6;

    mapping(address => uint) private _balances;
    mapping(address => mapping(address => uint)) private _allowances;
    uint private _totalSupply;

    function mint(address to, uint amount) external {
        _balances[to] += amount;
        _totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }

    function totalSupply() external view returns (uint) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint) {
        return _balances[account];
    }

    function transfer(address to, uint amount) external returns (bool) {
        _balances[msg.sender] -= amount;
        _balances[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }

    function allowance(address owner, address spender) external view returns (uint) {
        return _allowances[owner][spender];
    }

    function approve(address spender, uint amount) external returns (bool) {
        _allowances[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transferFrom(address from, address to, uint amount) external returns (bool) {
        if (_allowances[from][msg.sender] != type(uint).max) {
            _allowances[from][msg.sender] -= amount;
        }
        _balances[from] -= amount;
        _balances[to] += amount;
        emit Transfer(from, to, amount);
        return true;
    }
}

/**
 * Mock Indexer for FeeEscrow
 */
contract MockIndexer {
    function poolIndex(PoolId) external pure returns (address, address, address, uint) {
        return (address(0), address(0), address(0), 0);
    }
}

/**
 * Tests the GemFotManager contract which orchestrates token launches, fair launch periods,
 * and ongoing swap mechanics through Uniswap V4 hooks.
 */
contract GemFotManagerTest is Test {
    using PoolIdLibrary for PoolKey;

    GemFotManager manager;
    PoolManager poolManager;
    Launch launchContract;
    FairLaunch fairLaunch;
    BidWall bidWall;
    FeeEscrow feeEscrow;
    FeeExemptions feeExemptions;
    USDCMarketCappedPrice initialPrice;
    TreasuryActionManager actionManager;
    MockUSDC usdc;

    address protocolOwner = makeAddr("protocolOwner");
    address protocolFeeRecipient = makeAddr("protocolFeeRecipient");
    address creator = makeAddr("creator");
    address buyer = makeAddr("buyer");
    address stranger = makeAddr("stranger");

    Memecoin memecoinImplementation;
    MemecoinTreasury memecoinTreasuryImplementation;

    // Test constants matching USDC decimals (6) and token decimals (18)
    uint constant USDC_DECIMALS = 6;
    uint constant TOKEN_DECIMALS = 18;
    uint constant TARGET_MARKET_CAP = 100_000 * 10 ** USDC_DECIMALS; // $100k
    uint constant TOTAL_SUPPLY = 1_000_000_000 * 10 ** TOKEN_DECIMALS; // 1B tokens
    uint constant FAIR_LAUNCH_SUPPLY = 500_000_000 * 10 ** TOKEN_DECIMALS; // 500M tokens
    uint constant FAIR_LAUNCH_DURATION = 7 days;
    uint8 constant MULTIPLE = 7;

    /**
     * The address the hook must be deployed to, encoding the permissions returned by
     * `GemFotManager.getHookPermissions()`:
     *
     * beforeInitialize | beforeAddLiquidity | afterAddLiquidity | beforeRemoveLiquidity |
     * afterRemoveLiquidity | beforeSwap | afterSwap | afterDonate | beforeSwapReturnDelta |
     * afterSwapReturnDelta
     */
    address constant HOOK_ADDRESS = address(
        uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.BEFORE_ADD_LIQUIDITY_FLAG
                | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.BEFORE_REMOVE_LIQUIDITY_FLAG
                | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
                | Hooks.AFTER_DONATE_FLAG | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG
                | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        )
    );

    function setUp() public {
        vm.warp(1 days); // Move away from timestamp 0

        // Deploy mock USDC
        usdc = new MockUSDC();

        // Deploy Uniswap V4 PoolManager
        poolManager = new PoolManager(protocolOwner);

        // Deploy implementations
        memecoinImplementation = new Memecoin();
        memecoinTreasuryImplementation = new MemecoinTreasury();

        // Deploy initial price calculator
        initialPrice = new USDCMarketCappedPrice(protocolOwner);

        // Deploy fee exemptions
        feeExemptions = new FeeExemptions(protocolOwner);

        // Deploy action manager
        actionManager = new TreasuryActionManager(protocolOwner);

        // Deploy indexer mock for fee escrow
        MockIndexer indexer = new MockIndexer();

        // Deploy fee escrow
        feeEscrow = new FeeEscrow(address(usdc), address(indexer));

        // Deploy fair launch. The deployer receives `DEFAULT_ADMIN_ROLE`, so this test contract
        // retains the ability to grant the manager role below.
        fairLaunch = new FairLaunch(poolManager);

        // Deploy bid wall
        bidWall = new BidWall(address(usdc), address(poolManager), protocolOwner);

        // Uniswap V4 validates that a hook contract lives at an address whose lowest bits
        // encode its enabled hook permissions. Rather than mining a salt, we etch the
        // GemFotManager bytecode onto a pre-computed address carrying the correct flags.
        GemFotManager.ConstructorParams memory constructorParams = GemFotManager.ConstructorParams({
            nativeToken: address(usdc),
            poolManager: poolManager,
            feeDistribution: FeeDistributor.FeeDistribution({
                swapFee: 3_00, // 3%
                protocol: 2_00, // 2%
                active: true
            }),
            initialPrice: IInitialPrice(address(initialPrice)),
            protocolOwner: protocolOwner,
            protocolFeeRecipient: protocolFeeRecipient,
            feeEscrow: address(feeEscrow),
            feeExemptions: feeExemptions,
            actionManager: actionManager,
            bidWall: bidWall,
            fairLaunch: fairLaunch
        });

        vm.prank(protocolOwner);
        deployCodeTo(
            "GemFotManager.sol:GemFotManager", abi.encode(constructorParams), HOOK_ADDRESS
        );
        manager = GemFotManager(payable(HOOK_ADDRESS));

        // Grant manager role to GemFotManager. `FairLaunch` grants admin to its deployer (this
        // test contract), whereas `BidWall` grants admin to the protocol owner.
        fairLaunch.grantRole(ProtocolRoles.GEMFOT_MANAGER, address(manager));

        vm.prank(protocolOwner);
        bidWall.grantRole(ProtocolRoles.GEMFOT_MANAGER, address(manager));

        // Deploy Launch contract. `Launch` assigns ownership to its deployer, so this test
        // contract calls `initialize` directly.
        launchContract = new Launch();
        launchContract.initialize(
            address(memecoinImplementation),
            "",
            manager,
            address(memecoinTreasuryImplementation)
        );

        // Set launch contract on manager
        vm.prank(protocolOwner);
        manager.setLaunch(address(launchContract));

        // Mint USDC to test addresses
        usdc.mint(creator, 1_000_000 * 10 ** USDC_DECIMALS);
        usdc.mint(buyer, 1_000_000 * 10 ** USDC_DECIMALS);
        usdc.mint(stranger, 1_000_000 * 10 ** USDC_DECIMALS);
    }

    /* -------------------------------------------------------------------------- */
    /*                               Constructor                                  */
    /* -------------------------------------------------------------------------- */

    function test_ConstructorSetsCorrectParameters() public view {
        assertEq(address(manager.poolManager()), address(poolManager));
        assertEq(address(manager.nativeToken()), address(usdc));
        assertEq(address(manager.initialPrice()), address(initialPrice));
        assertEq(address(manager.bidWall()), address(bidWall));
        assertEq(address(manager.fairLaunch()), address(fairLaunch));
        assertEq(address(manager.feeExemptions()), address(feeExemptions));
        assertEq(address(manager.actionManager()), address(actionManager));
    }

    function test_ConstructorGrantsOwnershipToProtocolOwner() public view {
        assertEq(manager.owner(), protocolOwner);
    }

    /* -------------------------------------------------------------------------- */
    /*                                  launch                                    */
    /* -------------------------------------------------------------------------- */

    function test_LaunchCreatesNewToken() public {
        GemFotManager.LaunchParams memory params = _defaultLaunchParams();

        // Approve launch fee
        vm.startPrank(creator);
        usdc.approve(address(manager), initialPrice.getLaunchingFee());
        address memecoin = manager.launch(params);
        vm.stopPrank();

        assertTrue(memecoin != address(0), "Memecoin should be deployed");
        assertEq(IMemecoin(memecoin).name(), "Test Token");
        assertEq(IMemecoin(memecoin).symbol(), "TEST");
    }

    function test_LaunchEmitsPoolCreatedEvent() public {
        GemFotManager.LaunchParams memory params = _defaultLaunchParams();

        vm.startPrank(creator);
        usdc.approve(address(manager), initialPrice.getLaunchingFee());

        vm.expectEmit(false, false, false, false);
        emit GemFotManager.PoolCreated(
            PoolId.wrap(bytes32(0)), address(0), address(0), 0, false, 0, params
        );

        manager.launch(params);
        vm.stopPrank();
    }

    function test_RevertWhen_LaunchFeeNotApproved() public {
        GemFotManager.LaunchParams memory params = _defaultLaunchParams();

        vm.expectRevert();
        vm.prank(creator);
        manager.launch(params);
    }

    function test_LaunchStoresPoolKey() public {
        GemFotManager.LaunchParams memory params = _defaultLaunchParams();

        vm.startPrank(creator);
        usdc.approve(address(manager), initialPrice.getLaunchingFee());
        address memecoin = manager.launch(params);
        vm.stopPrank();

        PoolKey memory key = manager.poolKey(memecoin);
        assertTrue(key.tickSpacing != 0, "PoolKey should be stored");
    }

    /* -------------------------------------------------------------------------- */
    /*                             buyFairLaunch                                  */
    /* -------------------------------------------------------------------------- */

    function test_BuyFairLaunchPurchasesTokens() public {
        // Launch token
        address memecoin = _launchToken();
        PoolKey memory key = manager.poolKey(memecoin);

        // Buy tokens during fair launch
        uint buyAmount = 1_000 * 10 ** USDC_DECIMALS; // $1000 USDC
        uint initialBalance = IERC20(memecoin).balanceOf(buyer);

        vm.startPrank(buyer);
        usdc.approve(address(manager), buyAmount * 2); // Approve extra for fees
        manager.buyFairLaunch(key, buyAmount);
        vm.stopPrank();

        uint finalBalance = IERC20(memecoin).balanceOf(buyer);
        assertGt(finalBalance, initialBalance, "Buyer should receive tokens");
    }

    function test_RevertWhen_BuyFairLaunchAfterWindowClosed() public {
        address memecoin = _launchToken();
        PoolKey memory key = manager.poolKey(memecoin);

        // Warp past fair launch window
        vm.warp(block.timestamp + FAIR_LAUNCH_DURATION + 1);

        uint buyAmount = 1_000 * 10 ** USDC_DECIMALS;

        vm.startPrank(buyer);
        usdc.approve(address(manager), buyAmount * 2);
        vm.expectRevert(FairLaunch.FairLaunchWindowHasClosed.selector);
        manager.buyFairLaunch(key, buyAmount);
        vm.stopPrank();
    }

    /* -------------------------------------------------------------------------- */
    /*                         closeExpiredFairLaunch                             */
    /* -------------------------------------------------------------------------- */

    /**
     * `closeExpiredFairLaunch` seeds the pool with single sided liquidity, which requires the
     * {PoolManager} to be unlocked. Callers therefore have to route the call through
     * `IPoolManager.unlock`, which this test does via `_closeFairLaunch`.
     */
    function test_CloseExpiredFairLaunchInitializesPool() public {
        address memecoin = _launchToken();
        PoolKey memory key = manager.poolKey(memecoin);
        PoolId poolId = key.toId();

        // Check fair launch is not closed
        FairLaunch.FairLaunchInfo memory infoBefore = fairLaunch.fairLaunchInfo(poolId);
        assertFalse(infoBefore.closed, "Fair launch should not be closed initially");

        // Warp past fair launch window
        vm.warp(block.timestamp + FAIR_LAUNCH_DURATION + 1);

        // Close fair launch from within an unlocked {PoolManager} context
        _closeFairLaunch(key);

        // Verify fair launch is closed
        FairLaunch.FairLaunchInfo memory infoAfter = fairLaunch.fairLaunchInfo(poolId);
        assertTrue(infoAfter.closed, "Fair launch should be closed");

        // The pool should now be live with a non-zero price
        (uint160 sqrtPriceX96,,,) = StateLibrary.getSlot0(poolManager, poolId);
        assertGt(sqrtPriceX96, 0, "Pool should be initialized");
    }

    function test_RevertWhen_CloseFairLaunchWhileActive() public {
        address memecoin = _launchToken();
        PoolKey memory key = manager.poolKey(memecoin);

        vm.expectRevert("Fair launch still active");
        manager.closeExpiredFairLaunch(key);
    }

    /* -------------------------------------------------------------------------- */
    /*                             getLaunchingFee                                */
    /* -------------------------------------------------------------------------- */

    function test_GetLaunchingFeeReturnsCorrectAmount() public view {
        uint fee = manager.getLaunchingFee();
        assertEq(fee, initialPrice.getLaunchingFee());
    }

    /* -------------------------------------------------------------------------- */
    /*                            setInitialPrice                                 */
    /* -------------------------------------------------------------------------- */

    function test_SetInitialPriceUpdatesAddress() public {
        address newInitialPrice = makeAddr("newInitialPrice");

        vm.expectEmit(true, false, false, false);
        emit GemFotManager.InitialPriceUpdated(newInitialPrice);

        vm.prank(protocolOwner);
        manager.setInitialPrice(newInitialPrice);

        assertEq(address(manager.initialPrice()), newInitialPrice);
    }

    function test_RevertWhen_NonOwnerSetsInitialPrice() public {
        address newInitialPrice = makeAddr("newInitialPrice");

        vm.expectRevert();
        vm.prank(stranger);
        manager.setInitialPrice(newInitialPrice);
    }

    /* -------------------------------------------------------------------------- */
    /*                              setLaunch                                     */
    /* -------------------------------------------------------------------------- */

    function test_SetLaunchUpdatesLaunchContract() public {
        address newLaunch = makeAddr("newLaunch");

        vm.prank(protocolOwner);
        manager.setLaunch(newLaunch);

        assertEq(address(manager.launchContract()), newLaunch);
    }

    function test_RevertWhen_NonOwnerSetsLaunch() public {
        address newLaunch = makeAddr("newLaunch");

        vm.expectRevert();
        vm.prank(stranger);
        manager.setLaunch(newLaunch);
    }

    /* -------------------------------------------------------------------------- */
    /*                           getHookPermissions                               */
    /* -------------------------------------------------------------------------- */

    function test_GetHookPermissionsReturnsCorrectFlags() public view {
        Hooks.Permissions memory perms = manager.getHookPermissions();

        assertTrue(perms.beforeInitialize);
        assertTrue(perms.beforeAddLiquidity);
        assertTrue(perms.afterAddLiquidity);
        assertTrue(perms.beforeRemoveLiquidity);
        assertTrue(perms.afterRemoveLiquidity);
        assertTrue(perms.beforeSwap);
        assertTrue(perms.afterSwap);
        assertTrue(perms.afterDonate);
        assertTrue(perms.beforeSwapReturnDelta);
        assertTrue(perms.afterSwapReturnDelta);
    }

    /* -------------------------------------------------------------------------- */
    /*                                Helpers                                     */
    /* -------------------------------------------------------------------------- */

    function _defaultLaunchParams() internal view returns (GemFotManager.LaunchParams memory) {
        return GemFotManager.LaunchParams({
            name: "Test Token",
            symbol: "TEST",
            tokenUri: "https://test.com/token.json",
            initialTokenFairLaunch: FAIR_LAUNCH_SUPPLY,
            fairLaunchDuration: FAIR_LAUNCH_DURATION,
            premineAmount: 0,
            creator: creator,
            creatorFeeAllocation: 10_00, // 10%
            launchAt: block.timestamp,
            totalSupply: TOTAL_SUPPLY,
            usdcMarketCap: TARGET_MARKET_CAP,
            multiple: MULTIPLE
        });
    }

    function _launchToken() internal returns (address memecoin_) {
        GemFotManager.LaunchParams memory params = _defaultLaunchParams();

        vm.startPrank(creator);
        usdc.approve(address(manager), initialPrice.getLaunchingFee());
        memecoin_ = manager.launch(params);
        vm.stopPrank();
    }

    /**
     * Calls `GemFotManager.closeExpiredFairLaunch` from within an unlocked {PoolManager}
     * context, as the liquidity provisioning it performs requires the lock to be taken.
     */
    function _closeFairLaunch(
        PoolKey memory _key
    ) internal {
        poolManager.unlock(abi.encode(_key));
    }

    /**
     * Called back by the {PoolManager} while it is unlocked. See `_closeFairLaunch`.
     */
    function unlockCallback(
        bytes calldata _data
    ) external returns (bytes memory) {
        require(msg.sender == address(poolManager), "Only PoolManager");
        manager.closeExpiredFairLaunch(abi.decode(_data, (PoolKey)));
        return "";
    }
}
