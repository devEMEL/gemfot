import { defineChain } from '@reown/appkit/networks';

/**
 * GemFot network registry.
 *
 * Only `arc_testnet` is supported for now. To add another chain later, append a
 * new entry to `NETWORKS` with the same shape and (optionally) flip
 * `DEFAULT_NETWORK_KEY`.
 */

export interface GemFotContracts {
  /** The native/quote token of every launch pool (USDC on Arc). */
  nativeToken: `0x${string}`;
  nativeTokenSymbol: string;
  nativeTokenDecimals: number;

  /** Uniswap v4 core */
  poolManager: `0x${string}`;
  positionManager: `0x${string}`;
  stateView: `0x${string}`;
  permit2: `0x${string}`;

  /** GemFot protocol */
  gemfotManager: `0x${string}`;
  launch: `0x${string}`;
  fairLaunch: `0x${string}`;
  bidWall: `0x${string}`;
  initialPrice: `0x${string}`;
  feeEscrow: `0x${string}`;
  feeExemptions: `0x${string}`;
  actionManager: `0x${string}`;
  notifier: `0x${string}`;
  indexer: `0x${string}`;
  protocolFeeRecipient: `0x${string}`;
  memecoinImplementation: `0x${string}`;
  memecoinTreasuryImplementation: `0x${string}`;
  poolSwap: `0x${string}`;
}

export interface GemFotNetwork {
  key: string;
  /** Human label shown in the UI */
  label: string;
  chainId: number;
  /** The graph-node network name used by the subgraph */
  subgraphNetwork: string;
  subgraphUrl: string;
  explorerUrl: string;
  rpcUrls: string[];
  /** Block the GemFotManager hook was deployed at (subgraph startBlock) */
  startBlock: number;
  contracts: GemFotContracts;
}

export const arcTestnet = defineChain({
  id: 5042002,
  caipNetworkId: 'eip155:5042002',
  chainNamespace: 'eip155',
  name: 'Arc Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: {
    default: {
      http: [
        'https://arc-testnet.drpc.org',
        'https://rpc.testnet.arc.network',
        'https://5042002.rpc.thirdweb.com',
      ],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arcscan',
      url: 'https://testnet.arcscan.app',
    },
  },
});

export const NETWORKS = {
  arc_testnet: {
    key: 'arc_testnet',
    label: 'Arc Testnet',
    chainId: 5042002,
    subgraphNetwork: 'arc-testnet',
    subgraphUrl:
      import.meta.env.VITE_GEMFOT_SUBGRAPH_URL ||
      'https://api.studio.thegraph.com/query/1749160/gemfot-subgraph/version/latest',
    explorerUrl: 'https://testnet.arcscan.app',
    rpcUrls: [
      'https://arc-testnet.drpc.org',
      'https://rpc.testnet.arc.network',
      'https://5042002.rpc.thirdweb.com',
    ],
    startBlock: 56182133,
    contracts: {
      nativeToken: '0x36bEE8F2DF69Cf3AFAb5c5ccA973fEb6441cAb11',
      nativeTokenSymbol: 'USDC',
      nativeTokenDecimals: 6,

      poolManager: '0xC8d4D8fd9121D92ba790A70a60c07143A2C0Cd98',
      positionManager: '0xae44E6C67c2Bd22512727009C20Eba2F8bcF95b0',
      stateView: '0x289168d534c9cC5639537653Ddcb418e22c8ee59',
      permit2: '0xC733B042D7f7785af5606012831705797A7285f1',

      gemfotManager: '0xBE8a58E61b4C86d2Bb154A3abBa8168aa851EfDc',
      launch: '0xeE7b3100DF6d1842B9987D8a947083B4f90f8524',
      fairLaunch: '0xe0FAb59e4F3FD3c862e3636B508e18acfb779486',
      bidWall: '0xE375E568Ca670FfAf069De4c2E95f7716B42b814',
      initialPrice: '0xA0A5195503dDd58F4c214f5Eee4c74a0252812Ea',
      feeEscrow: '0xdd04B98FDd5e755Ee427f726d9F1a9Cc8a609Ed6',
      feeExemptions: '0xDe543D54CdF231126957a931ec4A198DdC3e8cB0',
      actionManager: '0xFde64a0bc399e91c3Def1ba757B30816825f556c',
      notifier: '0x32AC1f9a32c4e7764D9EF21dc15AF205A084B9CA',
      indexer: '0x2E0AD712C9A3902fb4409F305d76E105459E8729',
      protocolFeeRecipient: '0xC14d1A8bF0092E0368A946e5465E556E8a2d0a94',
      memecoinImplementation: '0xbD6E9972381A49E3931c4f2AfBE21Cc976881452',
      memecoinTreasuryImplementation: '0x49a6025730c9a7F20F8dAbCB37155D886a27087a',
      poolSwap: '0xdE4f33F13813dE31B229c3e8da98867828649747',
    },
  },
} satisfies Record<string, GemFotNetwork>;

export type NetworkKey = keyof typeof NETWORKS;

export const DEFAULT_NETWORK_KEY: NetworkKey = 'arc_testnet';

export const activeNetwork: GemFotNetwork = NETWORKS[DEFAULT_NETWORK_KEY];

export const CONTRACTS = activeNetwork.contracts;

/** Every chain the app is wired for (AppKit / wagmi) */
export const SUPPORTED_CHAINS = [arcTestnet];

export function explorerTx(hash: string): string {
  return `${activeNetwork.explorerUrl}/tx/${hash}`;
}

export function explorerAddress(address: string): string {
  return `${activeNetwork.explorerUrl}/address/${address}`;
}
