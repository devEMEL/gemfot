export const USDC_ADDRESS = "0x3600000000000000000000000000000000000000";


export const POOLMANAGER_ADDRESS = "0xC8d4D8fd9121D92ba790A70a60c07143A2C0Cd98";
export const V4_QUOTER_ADDRESS = "0xA4486183f478315f2d5635Fdb4eD37D4841eC904";
export const PERMIT2_ADDRESS = "0xC733B042D7f7785af5606012831705797A7285f1";
export const WETH_ADDRESS="0x4528a9E9793ce5952fA6B360Db0a534FC84Bf620";
export const 
POSITION_MANAGER_ADDRESS="0xae44E6C67c2Bd22512727009C20Eba2F8bcF95b0";
export const STATEVIEW_ADDRESS= "0x289168d534c9cC5639537653Ddcb418e22c8ee59";
export const UNIVERSALROUTER_ADDRESS="0xd03307a0d5092B17C12cA9380f707f7d7FCD8f09";

export const FAUCET_ADDRESS="0xB777176ea921D4aA8Ab9aD6163c8bafacdCbeD44";
export const POINTSHOOK_ADDRESS="0xd523232b30b61be4c74937be5313d2cbd1748040";

export const ACTIONS = {
  // --- Liquidity Actions (PositionManager) ---
  INCREASE_LIQUIDITY: 0x00,              // 0
  DECREASE_LIQUIDITY: 0x01,              // 1
  MINT_POSITION: 0x02,                   // 2
  BURN_POSITION: 0x03,                   // 3
  INCREASE_LIQUIDITY_FROM_DELTAS: 0x04,  // 4
  MINT_POSITION_FROM_DELTAS: 0x05,       // 5

  // --- Swap Actions (Router) ---
  SWAP_EXACT_IN_SINGLE: 0x06,            // 6
  SWAP_EXACT_IN: 0x07,                   // 7
  SWAP_EXACT_OUT_SINGLE: 0x08,           // 8
  SWAP_EXACT_OUT: 0x09,                  // 9

  // --- Utility & Payments ---
  DONATE: 0x0a,                          // 10
  SETTLE: 0x0b,                          // 11
  SETTLE_ALL: 0x0c,                      // 12
  SETTLE_PAIR: 0x0d,                     // 13
  TAKE: 0x0e,                            // 14
  TAKE_ALL: 0x0f,                        // 15
  TAKE_PORTION: 0x10,                    // 16
  TAKE_PAIR: 0x11,                       // 17
  CLOSE_CURRENCY: 0x12,                  // 18
  CLEAR_OR_TAKE: 0x13,                   // 19
  SWEEP: 0x14,                           // 20
  WRAP: 0x15,                            // 21
  UNWRAP: 0x16,                          // 22

  // --- ERC-6909 Actions ---
  MINT_6909: 0x17,                       // 23
  BURN_6909: 0x18                        // 24
} as const;


