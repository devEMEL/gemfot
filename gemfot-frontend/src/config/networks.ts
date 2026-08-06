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
    startBlock: 55488155,
    contracts: {
      nativeToken: '0x36bEE8F2DF69Cf3AFAb5c5ccA973fEb6441cAb11',
      nativeTokenSymbol: 'USDC',
      nativeTokenDecimals: 6,

      poolManager: '0xC8d4D8fd9121D92ba790A70a60c07143A2C0Cd98',
      positionManager: '0xae44E6C67c2Bd22512727009C20Eba2F8bcF95b0',
      stateView: '0x289168d534c9cC5639537653Ddcb418e22c8ee59',
      permit2: '0xC733B042D7f7785af5606012831705797A7285f1',

      gemfotManager: '0xCa510bB4ae1e45Dcd4141b82b152C239282cAFDc',
      launch: '0xf77D6A335Cfcd2AE97bD605ECE54422622372826',
      fairLaunch: '0xDE612935787716E271a4b9f6f05a6B22b976ee11',
      bidWall: '0x5a9560747b1F8Fb2111654d4c1Fa217c7277b002',
      initialPrice: '0xaEeD0a3fa4072309d43298b887a1A39aa9CC070e',
      feeEscrow: '0xc1825a35a64403ecc99E96FDd755BA79E20D025F',
      feeExemptions: '0xBc501fB24D104860A81F8b140807Ad71b3a172Ea',
      actionManager: '0x873C117aDd0aa5A03771b8E631835d46b4bb3C6a',
      notifier: '0x21736318Fd5c4AB081DF8232a8439E6de65b669c',
      indexer: '0x7336AE990Bc60264aa88A0B11E5a5b1978B80CD6',
      protocolFeeRecipient: '0x0eb175D987Ad3d9775c7507C0Ce8b34D2a0f54a3',
      memecoinImplementation: '0xA885c8660520c62CA755918d5ee32eA8872f14de',
      memecoinTreasuryImplementation: '0xa85f4311d81efb5EFaA3Dd321DF34D8599b31262',
      poolSwap: '0x84ba46e373910C6b0d7115410D61b4C4493AA6B5',
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
