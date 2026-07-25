// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from '@solady/auth/Ownable.sol';

import {FullMath} from '@uniswap/v4-core/src/libraries/FullMath.sol';
import {PoolId, PoolIdLibrary} from '@uniswap/v4-core/src/types/PoolId.sol';
import {PoolKey} from '@uniswap/v4-core/src/types/PoolKey.sol';

import {LaunchFeeExemption} from '../price/LaunchFeeExemption.sol'; // Adjust path based on directory structure
import {TokenSupply} from '../libraries/TokenSupply.sol'; // Adjust path based on directory structure

import {IInitialPrice} from '../../interfaces/IInitialPrice.sol'; // Adjust path based on directory structure

/**
 * @title USDCMarketCappedPrice
 * @notice Sets the initial price of a Launch memecoin where the native token
 * of the Launch pool is already USDC (or another USD stablecoin).
 * 
 * Since the native currency of the launch pool is already USDC, we do NOT need
 * an oracle pool to convert ETH/USDC. The market cap input directly represents
 * the native token (USDC) amount.
 */
contract USDCMarketCappedPrice is IInitialPrice, Ownable {

    using PoolIdLibrary for PoolKey;

    error MarketCapTooSmall(uint _usdcMarketCap, uint _usdcMarketCapMinimum);

    event LaunchFeeThresholdUpdated(uint _launchFeeThreshold);

    /**
     * The struct of data passed from the launching flow to define the
     * desired market cap when a token is launched.
     *
     * @member usdcMarketCap The USDC price of the token market cap (scaled by USDC's 6 decimals)
     */
    struct MarketCappedPriceParams {
        uint usdcMarketCap;
    }

    /// Sets a minimum market cap threshold ($1,000, scaled to USDC's 6 decimals)
    uint public constant MINIMUM_USDC_MARKET_CAP = 1000 * 1e6;

    /// The minimum launch price that would incur a launching fee
    uint public launchFeeThreshold;

    /// The {LaunchFeeExemption} contract
    LaunchFeeExemption public immutable launchFeeExemption;

    /**
     * @param _protocolOwner The address of the owner
     * @param _launchFeeExemption The {LaunchFeeExemption} contract address
     */
    constructor(
        address _protocolOwner,
        address _launchFeeExemption
    ) {
        launchFeeExemption = LaunchFeeExemption(_launchFeeExemption);
        _initializeOwner(_protocolOwner);
    }

    /**
     * @notice Gets the Launching fee, which is 0.1% (1/1000) of the desired market cap.
     * Paid in USDC since USDC is the native token of the launchpool.
     *
     * @param _sender The address launching, which may be excluded from launching fees
     * @param _initialPriceParams Parameters containing the target market cap
     *
     * @return The fee taken from the user for Launching a token
     */
    function getLaunchingFee(address _sender, bytes calldata _initialPriceParams) public view returns (uint) {
        (MarketCappedPriceParams memory params) = abi.decode(_initialPriceParams, (MarketCappedPriceParams));

        // If the fee is below our set threshold, then we want to exclude the fee
        if (params.usdcMarketCap <= launchFeeThreshold) {
            return 0;
        }

        // Check if our `_sender` is fee excluded
        if (launchFeeExemption.feeExcluded(_sender)) {
            return 0;
        }

        // 0.1% of the market cap in USDC units
        return params.usdcMarketCap / 1000;
    }

    /**
     * @notice Returns the target market cap in USDC directly.
     *
     * @param _initialPriceParams Parameters for the initial pricing
     * @return The USDC value of the market cap
     */
    function getMarketCap(bytes calldata _initialPriceParams) public view returns (uint) {
        (MarketCappedPriceParams memory params) = abi.decode(_initialPriceParams, (MarketCappedPriceParams));

        // Ensure that our requested market cap is sufficient
        if (params.usdcMarketCap < MINIMUM_USDC_MARKET_CAP) {
            revert MarketCapTooSmall(params.usdcMarketCap, MINIMUM_USDC_MARKET_CAP);
        }

        return params.usdcMarketCap;
    }

    /**
     * @notice Computes the Uniswap V4 sqrtPriceX96 for the pool based on target USDC market cap.
     *
     * @param _flipped If the PoolKey currencies are flipped
     * @param _initialPriceParams Parameters for the initial pricing
     *
     * @return sqrtPriceX96_ The `sqrtPriceX96` value
     */
    function getSqrtPriceX96(
        address /* _sender */, 
        bool _flipped, 
        bytes calldata _initialPriceParams
    ) public view virtual returns (uint160 sqrtPriceX96_) {
        // Since native token is USDC, the target valuation is simply the market cap amount
        uint usdcAmount = getMarketCap(_initialPriceParams);
        
        return _calculateSqrtPriceX96(usdcAmount, TokenSupply.INITIAL_SUPPLY, !_flipped);
    }

    /**
     * @notice Calculates a sqrtPriceX96 based on USDC and Memecoin amounts.
     *
     * @param _usdcAmount The amount of USDC for the pool
     * @param _tokenAmount The number of tokens for the pool
     * @param _isUsdcToken0 If USDC will be token0
     *
     * @return sqrtPriceX96_ The calculated sqrtPriceX96 value
     */
    function _calculateSqrtPriceX96(
        uint _usdcAmount, 
        uint _tokenAmount, 
        bool _isUsdcToken0
    ) internal pure returns (uint160 sqrtPriceX96_) {
        require(_usdcAmount > 0 && _tokenAmount > 0, 'Amounts must be greater than zero');

        // Calculate the price ratio depending on token order
        if (_isUsdcToken0) {
            // USDC is token0, TOKEN is token1
            return uint160(_sqrt(FullMath.mulDiv(_tokenAmount, 1 << 192, _usdcAmount)));
        }

        // TOKEN is token0, USDC is token1
        return uint160(_sqrt(FullMath.mulDiv(_usdcAmount, 1 << 192, _tokenAmount)));
    }

    /**
     * Helper function for square root.
     */
    function _sqrt(uint _x) internal pure returns (uint result_) {
        if (_x == 0) return 0;
        uint z = (_x + 1) / 2;
        result_ = _x;
        while (z < result_) {
            result_ = z;
            z = (_x / z + z) / 2;
        }
    }

    /**
     * Allows the `launchFeeThreshold` to be updated.
     *
     * @param _launchFeeThreshold The new launch fee threshold
     */
    function setLaunchFeeThreshold(uint _launchFeeThreshold) public onlyOwner {
        launchFeeThreshold = _launchFeeThreshold;
        emit LaunchFeeThresholdUpdated(_launchFeeThreshold);
    }

    function _guardInitializeOwner() internal pure virtual override returns (bool) {
        return true;
    }
}
