// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * Holds global variable for the total token supply during launching.
 */
library TokenSupply {
    uint public constant MIN_TOTAL_SUPPLY = 1e24; // 1 MILLION
    uint public constant MAX_TOTAL_SUPPLY = 1e29; // 100 BILLION
}
