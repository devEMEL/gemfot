// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {LaunchFeeExemption} from "@gemfot/price/LaunchFeeExemption.sol";

interface IInitialPrice {
    function launchFeeExemption() external returns (LaunchFeeExemption);

    function getLaunchingFee(
        address _sender,
        bytes calldata _initialPriceParams
    ) external view returns (uint);

    function getSqrtPriceX96(
        address _sender,
        bool _flipped,
        bytes calldata _initialPriceParams
    ) external view returns (uint160);
}
