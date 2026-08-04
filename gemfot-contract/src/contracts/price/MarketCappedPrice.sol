// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@solady/auth/Ownable.sol";

import {FullMath} from "@uniswap/v4-core/src/libraries/FullMath.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";

import {TokenSupply} from "../libraries/TokenSupply.sol"; 

import {LinearBondingCurve} from "../libraries/LinearBondingCurve.sol";

/**
 * @title USDCMarketCappedPrice
 * @notice Sets the initial price of a Launch memecoin where the native token
 * of the Launch pool is already USDC (or another USD stablecoin).
 *
 * Since the native currency of the launch pool is already USDC, we do NOT need
 * an oracle pool to convert ETH/USDC. The market cap input directly represents
 * the native token (USDC) amount.
 */
contract USDCMarketCappedPrice is Ownable {
    using PoolIdLibrary for PoolKey;

    error MarketCapTooSmall(uint _usdcMarketCap, uint _usdcMarketCapMinimum);
    error TotalSupplyOutOfRange(uint _totalSupply, uint _totalSupplyMinimum, uint _totalSupplyMaximum);

    event LaunchFeeUpdated (uint256 _launchFee);

    /// Sets a minimum market cap threshold ($1,000, scaled to USDC's 6 decimals)
    uint public constant MINIMUM_USDC_MARKET_CAP = 1000 * 1e6;

    uint public launchFee = 10 * 1e6; // 10 USDC



    /**
     * @param _protocolOwner The address of the owner
     */
    constructor(
        address _protocolOwner
    ) {
        _initializeOwner(_protocolOwner);
    }

    /**
     * @notice Gets the Launching fee.
     * Paid in USDC since USDC is the native token of the launchpool.
     * @return The fee taken from the user for Launching a token
     */
    function getLaunchingFee() public view returns (uint) {
        return launchFee; 
    }



    /**
     * @notice Helper function for square root.
     */
    function _sqrt(
        uint _x
    ) internal pure returns (uint result_) {
        if (_x == 0) {
            return 0;
        }
        uint z = (_x + 1) / 2;
        result_ = _x;
        while (z < result_) {
            result_ = z;
            z = (_x / z + z) / 2;
        }
    }

    /**
     * @notice Computes the current token price given the bonding curve parameters.
     */
    function getPricing(
        uint256 usdcMarketCap,
        uint256 totalSupply,
        uint p0,
        uint256 sold
    ) public pure returns (uint256) {
        return LinearBondingCurve.currentPrice(usdcMarketCap, totalSupply, p0, sold);
    }
    

    /**
     * @notice Computes the Uniswap V4 sqrtPriceX96 given token reserves and decimals.
     */
    // function encodeSqrtPrice(
    //     uint256 a,
    //     uint256 b,
    //     uint8 aDecimals,
    //     uint8 bDecimals
    // ) public pure returns (uint160) {
    //     // Adjust for decimal differences to find the true ratio
    //     // If a has 18 decimals and b has 6, then 1 token A = 10^18 base units, 1 token B = 10^6 base units.
    //     // The price of A in terms of B is (b * 10^aDecimals) / (a * 10^bDecimals)
    //     // sqrtPriceX96 = sqrt(b * 10^aDecimals / (a * 10^bDecimals)) * 2^96
        
    //     uint256 bAdjusted = b;
    //     uint256 aAdjusted = a;
        
    //     if (aDecimals > bDecimals) {
    //         bAdjusted = b * (10 ** (aDecimals - bDecimals));
    //     } else if (bDecimals > aDecimals) {
    //         aAdjusted = a * (10 ** (bDecimals - aDecimals));
    //     }
        
    //     return uint160(_sqrt(FullMath.mulDiv(bAdjusted, 1 << 192, aAdjusted)));
    // }



    /**
     * @notice Computes the Uniswap V4 sqrtPriceX96 given two already-raw, equivalent-value amounts.
     * @param a Raw base-unit amount of token A (e.g. 1e18 for 1 whole 18-decimal token)
     * @param b Raw base-unit amount of token B representing the equivalent value (e.g. priceRaw in 6-decimal USDC)
     * @return sqrtPriceX96 The Uniswap V4-compatible sqrt price, Q64.96 format
     */
    function encodeSqrtPrice(
        uint256 a,
        uint256 b
    ) public pure returns (uint160) {
        // Both a and b are already raw, equivalent-value amounts — no decimal adjustment needed.
        // price = b / a
        // sqrtPriceX96 = sqrt(b / a) * 2^96
        return uint160(_sqrt(FullMath.mulDiv(b, 1 << 192, a)));
    }



    /**
     * Allows the `launchFee` to be updated.
     *
     * @param _launchFee The new fee for launching a token
     */
    function setLaunchFee(
        uint256 _launchFee
    ) public onlyOwner {
        launchFee = _launchFee;
        emit LaunchFeeUpdated(_launchFee);
    }



    function _guardInitializeOwner() internal pure virtual override returns (bool) {
        return true;
    }
}
