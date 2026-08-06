// ─── Types shared between Pools pages and Campaigns pages ────────────────────

export interface HookConfig {
  address: `0x${string}`;
  name: string;
  description: string;
  rewardType: string;
}

/** Used by /pools and /pools/[id] to badge active hooks on pool rows */
export const HOOKS_DETAILS: HookConfig[] = [
  {
    address: "0xd523232b30b61be4c74937be5313d2cbd1748040" as `0x${string}`,
    name: "PointsHook",
    description: "Swap & Accumulate Points.\n\nEvery swap you make in this pool earns you Points equivalent to 1% of your swap volume! Points are unique to this specific pool and are minted directly to your wallet as collectible ERC1155 tokens. Use them to track your rank and unlock future reward campaigns.",
    rewardType: "ERC-1155 Tokens",
  },
];

// ─── Campaigns ───────────────────────────────────────────────────────────────

export interface PoolKey {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
}

/**
 * A campaign is a hook with one or more pools attached.
 * Each pool in poolKeys gets its own leaderboard section on the detail page.
 */
export interface HookCampaign extends HookConfig {
  active: boolean;
  poolKeys: PoolKey[];
}

/**
 * Add new campaigns here. Each element is one campaign card on /campaigns.
 * Its index in this array is used as the URL id: /campaigns/0, /campaigns/1, etc.
 */
export const campaigns: HookCampaign[] = [
  {
    active: true,
    address: "0xd523232b30b61be4c74937be5313d2cbd1748040" as `0x${string}`,
    name: "PointsHook",
    description: "Swap & Accumulate Points.\n\nEvery swap you make in this pool earns you Points equivalent to 1% of your swap volume! Points are unique to this specific pool and are minted directly to your wallet as collectible ERC1155 tokens. Use them to track your rank and unlock future reward campaigns.",
    rewardType: "ERC-1155 Tokens",
    poolKeys: [
      // mUSDC / MONKE
      {
        currency0: "0x36bEE8F2DF69Cf3AFAb5c5ccA973fEb6441cAb11" as `0x${string}`,
        currency1: "0x57700E377d85328322574FB8d92d4F017a2106E2" as `0x${string}`,
        fee: 3000,
        tickSpacing: 60,
        hooks: "0xd523232b30b61be4c74937be5313d2cbd1748040" as `0x${string}`,
      },
      // RCH / mUSDC
      {
        currency0: "0x10a2A353598E85Ea959B9176a6432a63C086A1Be" as `0x${string}`,
        currency1: "0x36bEE8F2DF69Cf3AFAb5c5ccA973fEb6441cAb11" as `0x${string}`,
        fee: 3000,
        tickSpacing: 60,
        hooks: "0xd523232b30b61be4c74937be5313d2cbd1748040" as `0x${string}`,
      },
      // mUSDC / SOFT
      {
        currency0: "0x36bEE8F2DF69Cf3AFAb5c5ccA973fEb6441cAb11" as `0x${string}`,
        currency1: "0x8c277c071D42987Ef7712d135C4da1f46EA8Af8d" as `0x${string}`,
        fee: 3000,
        tickSpacing: 60,
        hooks: "0xd523232b30b61be4c74937be5313d2cbd1748040" as `0x${string}`,
      },
    ],
  },
];
