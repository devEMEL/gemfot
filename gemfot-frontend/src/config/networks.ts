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
    startBlock: 55990736,
    contracts: {
      nativeToken: '0x36bEE8F2DF69Cf3AFAb5c5ccA973fEb6441cAb11',
      nativeTokenSymbol: 'USDC',
      nativeTokenDecimals: 6,

      poolManager: '0xC8d4D8fd9121D92ba790A70a60c07143A2C0Cd98',
      positionManager: '0xae44E6C67c2Bd22512727009C20Eba2F8bcF95b0',
      stateView: '0x289168d534c9cC5639537653Ddcb418e22c8ee59',
      permit2: '0xC733B042D7f7785af5606012831705797A7285f1',

      gemfotManager: '0x930304FdbAAdCd689B71B581c727e223cAA7afdC',
      launch: '0xf0dCE41Ea7d2e68857546236507A574C2748E527',
      fairLaunch: '0xDc888959343e0341d423c6B509eB77a199B20b2f',
      bidWall: '0x496C2CF27577473a4e44b3E995dDf46D643482bF',
      initialPrice: '0x8e897F00Eb3FB9a42459efEfAdB3c14bf19E808B',
      feeEscrow: '0x08d33F9f234460444381123F1D22a235cA3b0BF9',
      feeExemptions: '0xDcD836367ef845543f24c3730d4aB2957Ea779D4',
      actionManager: '0xe07700CD7105ECF24d50EFafe2eFA2f5585bDc17',
      notifier: '0x437Fd8534e411D978f8d92445dD32DFEDB08caa4',
      indexer: '0xB792C3CcaA4E42e8f9ffb89258C31eD08157F1E4',
      protocolFeeRecipient: '0x931C02daaf99B91767d666cd8FC019be6FAF4Ce2',
      memecoinImplementation: '0xDF6166bEf93B3aE8BFCe73225Dc5348c5A0Ad96A',
      memecoinTreasuryImplementation: '0xF611321abdeb9fbcb36C8238a694712f8B196392',
      poolSwap: '0xCD5F5d183b449940C8E4ab3E3B95Ef7d725B0d65',
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
