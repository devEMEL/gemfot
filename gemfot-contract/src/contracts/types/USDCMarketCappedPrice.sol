// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * The struct of data passed from the launching flow to define the
 * desired market cap when a token is launched.
 *
 * @custom:member usdcMarketCap The USDC price of the token market cap (scaled by USDC's 6 decimals)
 */
struct MarketCappedPriceParams {
    uint totalSupply;
    uint usdcMarketCap;
    uint targetRaise; // The exact amount to raise (in USDC 6 decimals)
}

