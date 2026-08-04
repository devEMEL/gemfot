// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;


interface IInitialPrice {

    function getLaunchingFee() external view returns (uint);

    function getPricing(
        uint _targetMarketCap,
        uint _initialSupply,
        uint _p0,
        uint _sold
    ) external view returns (uint);

    function getSqrtPriceX96(
        address _sender,
        bool _flipped,
        bytes calldata _initialPriceParams
    ) external view returns (uint160);

    function encodeSqrtPrice(
        uint _token0Amount,
        uint _token1Amount
    ) external view returns (uint160);
}
