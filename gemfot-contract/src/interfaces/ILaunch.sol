// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {GemFotManager} from "@gemfot/GemFotManager.sol";

interface ILaunch {
    function launch(
        GemFotManager.LaunchParams calldata
    ) external returns (address memecoin_, address payable memecoinTreasury_, uint tokenId_);

    function memecoin(
        uint _tokenId
    ) external view returns (address);
    function memecoinTreasury(
        uint _tokenId
    ) external view returns (address payable);
}
