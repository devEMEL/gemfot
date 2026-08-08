import { activeNetwork } from '@/config/networks';

export const GEMFOT_SUBGRAPH_URL = activeNetwork.subgraphUrl;

export async function gemfotQuery<T>(
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  const res = await fetch(GEMFOT_SUBGRAPH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });

  const { data, errors } = await res.json();
  if (errors?.length) {
    console.error('GemFot subgraph errors:', errors);
    throw new Error(errors[0]?.message ?? 'Subgraph query failed');
  }
  return data as T;
}

export const GET_LAUNCHES = /* GraphQL */ `
  query GetLaunches($first: Int!, $skip: Int!, $orderBy: Launch_orderBy!, $orderDirection: OrderDirection!) {
    launches(first: $first, skip: $skip, orderBy: $orderBy, orderDirection: $orderDirection) {
      id
      poolId
      memecoin
      name
      symbol
      tokenUri
      creator {
        id
      }
      tokenId
      currencyFlipped
      initialTokenFairLaunch
      fairLaunchDuration
      fairLaunchStartsAt
      fairLaunchEndsAt
      fairLaunchClosed
      targetMarketCap
      multiple
      creatorFeeAllocation
      premineAmount
      revenue
      remainingSupply
      buyCount
      createdAtTimestamp
      createdAtBlock
      transactionHash
    }
  }
`;

export const GET_LAUNCH = /* GraphQL */ `
  query GetLaunch($id: ID!) {
    launch(id: $id) {
      id
      poolId
      memecoin
      name
      symbol
      tokenUri
      creator {
        id
      }
      tokenId
      currencyFlipped
      initialTokenFairLaunch
      fairLaunchDuration
      fairLaunchStartsAt
      fairLaunchEndsAt
      fairLaunchClosed
      targetMarketCap
      multiple
      creatorFeeAllocation
      premineAmount
      revenue
      remainingSupply
      buyCount
      createdAtTimestamp
      transactionHash
      buys(first: 50, orderBy: timestamp, orderDirection: desc) {
        id
        nativeIn
        tokensOut
        totalSold
        timestamp
        transactionHash
      }
    }
  }
`;

/**
 * Protocol-wide volume: every fair-launch buy is USDC in.
 * `since` lets us slice the trailing 24h window.
 */
export const GET_VOLUME = /* GraphQL */ `
  query GetVolume($since: BigInt!) {
    allTime: fairLaunchBuys(first: 1000, orderBy: timestamp, orderDirection: desc) {
      id
      nativeIn
      timestamp
    }
    recent: fairLaunchBuys(
      first: 1000
      where: { timestamp_gte: $since }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      nativeIn
      timestamp
    }
  }
`;

export const GET_LAUNCHES_BY_CREATOR = /* GraphQL */ `
  query GetLaunchesByCreator($creator: Bytes!, $first: Int!) {
    launches(
      where: { creator: $creator }
      first: $first
      orderBy: createdAtTimestamp
      orderDirection: desc
    ) {
      id
      memecoin
      name
      symbol
      tokenUri
      revenue
      fairLaunchEndsAt
      fairLaunchClosed
      createdAtTimestamp
    }
  }
`;

export interface SubgraphLaunch {
  id: string;
  poolId: string;
  memecoin: string;
  name: string;
  symbol: string;
  tokenUri: string;
  /** Related entity id (also accepts the raw `{ id }` shape before normalization) */
  creator: string | { id: string };
  tokenId: string;
  currencyFlipped: boolean;
  initialTokenFairLaunch: string;
  fairLaunchDuration: string;
  fairLaunchStartsAt: string;
  fairLaunchEndsAt: string;
  fairLaunchClosed: boolean;
  targetMarketCap: string;
  multiple: string;
  creatorFeeAllocation: string;
  premineAmount: string;
  revenue: string;
  remainingSupply: string;
  buyCount: string;
  createdAtTimestamp: string;
  createdAtBlock?: string;
  transactionHash: string;
}
