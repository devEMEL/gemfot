export const SUBGRAPH_ENDPOINT = "https://api.studio.thegraph.com/query/1749160/mlswap-subgraph/version/latest";

// Global Data Queries
export const GET_GLOBAL_DATA = `
  query GetGlobalData {
    poolManagers(first: 1) {
      id
      poolCount
      txCount
      totalVolumeUSD
      totalFeesUSD
      totalValueLockedUSD
      owner
    }
    uniswapDayDatas(first: 1, orderBy: date, orderDirection: desc) {
      date
      volumeUSD
      feesUSD
    }
  }
`;

// Token Queries
export const GET_TOKENS = `
  query GetTokens($first: Int = 100, $skip: Int = 0, $orderBy: Token_orderBy = totalValueLockedUSD, $orderDirection: OrderDirection = desc) {
    tokens(first: $first, skip: $skip, orderBy: $orderBy, orderDirection: $orderDirection) {
      id
      symbol
      name
      decimals
      totalSupply
      volumeUSD
      feesUSD
      txCount
      poolCount
      totalValueLocked
      totalValueLockedUSD
      derivedUSDC
    }
  }
`;

export const GET_TOKEN_BY_ID = `
  query GetTokenById($id: ID!) {
    token(id: $id) {
      id
      symbol
      name
      decimals
      totalSupply
      volume
      volumeUSD
      feesUSD
      txCount
      poolCount
      totalValueLocked
      totalValueLockedUSD
      derivedUSDC
    }
  }
`;

// Fetch derivedUSDC for a batch of token addresses in one request.
// Token IDs in the subgraph are lowercased addresses.
export const GET_TOKEN_PRICES_BY_IDS = `
  query GetTokenPricesByIds($ids: [ID!]!) {
    tokens(where: { id_in: $ids }) {
      id
      symbol
      derivedUSDC
    }
  }
`;


// Pool Queries
export const GET_POOLS = `
  query GetPools($first: Int = 1000, $skip: Int = 0, $orderBy: Pool_orderBy = createdAtTimestamp, $orderDirection: OrderDirection = desc) {
    pools(first: $first, skip: $skip, orderBy: $orderBy, orderDirection: $orderDirection) {
      id
      createdAtTimestamp
      token0 {
        id
        symbol
        name
        decimals
        derivedUSDC
      }
      token1 {
        id
        symbol
        name
        decimals
        derivedUSDC
      }
      feeTier
      liquidity
      sqrtPrice
      token0Price
      token1Price
      tick
      tickSpacing
      volumeUSD
      feesUSD
      txCount
      totalValueLockedToken0
      totalValueLockedToken1
      totalValueLockedUSD
      hooks
      poolDayData(first: 1, orderBy: date, orderDirection: desc) {
        date
        volumeUSD
        feesUSD
      }
    }
  }
`;

export const GET_POOL_BY_ID = `
  query GetPoolById($id: ID!) {
    pool(id: $id) {
      id
      createdAtTimestamp
      token0 {
        id
        symbol
        name
        decimals
        derivedUSDC
      }
      token1 {
        id
        symbol
        name
        decimals
        derivedUSDC
      }
      feeTier
      liquidity
      sqrtPrice
      token0Price
      token1Price
      tick
      tickSpacing
      volumeToken0
      volumeToken1
      volumeUSD
      feesUSD
      txCount
      collectedFeesToken0
      collectedFeesToken1
      collectedFeesUSD
      totalValueLockedToken0
      totalValueLockedToken1
      totalValueLockedUSD
      hooks
      poolDayData(first: 7, orderBy: date, orderDirection: desc) {
        date
        volumeUSD
        feesUSD
      }
      swaps(first: 10, orderBy: timestamp, orderDirection: desc) {
        id
        timestamp
        sender
        origin
        amount0
        amount1
        amountUSD
        sqrtPriceX96
        tick
        transaction {
          id
        }
      }
    }
  }
`;

// Transaction & Swap Queries
export const GET_SWAPS = `
  query GetSwaps($first: Int = 100, $skip: Int = 0, $where: Swap_filter, $orderBy: Swap_orderBy = timestamp, $orderDirection: OrderDirection = desc) {
    swaps(first: $first, skip: $skip, where: $where, orderBy: $orderBy, orderDirection: $orderDirection) {
      id
      timestamp
      pool {
        id
      }
      token0 {
        id
        symbol
      }
      token1 {
        id
        symbol
      }
      sender
      origin
      amount0
      amount1
      amountUSD
      sqrtPriceX96
      tick
      transaction {
        id
      }
    }
  }
`;

export const GET_POOL_SWAPS = `
  query GetPoolSwaps($poolId: String!, $first: Int = 100, $skip: Int = 0) {
    swaps(where: { pool: $poolId }, first: $first, skip: $skip, orderBy: timestamp, orderDirection: desc) {
      id
      timestamp
      token0 {
        id
        symbol
      }
      token1 {
        id
        symbol
      }
      sender
      origin
      amount0
      amount1
      amountUSD
      sqrtPriceX96
      tick
      transaction {
        id
      }
    }
  }
`;

// Position Queries
export const GET_POSITIONS_BY_OWNER = `
  query GetPositionsByOwner($owner: String!) {
    positions(where: { owner: $owner }) {
      id
      tokenId
      owner
      origin
      createdAtTimestamp
    }
  }
`;

// Historical Data Queries
export const GET_UNISWAP_DAY_DATA = `
  query GetUniswapDayData($first: Int = 30, $orderBy: UniswapDayData_orderBy = date, $orderDirection: OrderDirection = desc) {
    uniswapDayDatas(first: $first, orderBy: $orderBy, orderDirection: $orderDirection) {
      id
      date
      volumeUSD
      feesUSD
      txCount
      tvlUSD
    }
  }
`;

export const GET_POOL_DAY_DATA = `
  query GetPoolDayData($poolId: String!, $first: Int = 30) {
    poolDayDatas(where: { pool: $poolId }, first: $first, orderBy: date, orderDirection: desc) {
      id
      date
      liquidity
      sqrtPrice
      token0Price
      token1Price
      tvlUSD
      volumeToken0
      volumeToken1
      volumeUSD
      feesUSD
      txCount
    }
  }
`;

export const GET_TOKEN_DAY_DATA = `
  query GetTokenDayData($tokenId: String!, $first: Int = 30) {
    tokenDayDatas(where: { token: $tokenId }, first: $first, orderBy: date, orderDirection: desc) {
      id
      date
      volume
      volumeUSD
      totalValueLocked
      totalValueLockedUSD
      priceUSD
      feesUSD
    }
  }
`;

export const GET_GLOBAL_TRANSACTIONS = `
  query GetGlobalTransactions($first: Int = 100, $skip: Int = 0, $where: Transaction_filter) {
    transactions(first: $first, skip: $skip, where: $where, orderBy: timestamp, orderDirection: desc) {
      id
      timestamp
      swaps {
        id
        amount0
        amount1
        amountUSD
        token0 {
          id
          symbol
        }
        token1 {
          id
          symbol
        }
      }
      modifyLiquiditys {
        id
        amount
        amount0
        amount1
        amountUSD
        token0 {
          id
          symbol
        }
        token1 {
          id
          symbol
        }
      }
      transfers {
        id
        tokenId
        from
        to
      }
      subscriptions {
        id
        tokenId
        address
      }
      unsubscriptions {
        id
        tokenId
        address
      }
    }
  }
`;

export const GET_GLOBAL_MODIFY_LIQUIDITIES = `
  query GetGlobalModifyLiquidities($first: Int = 100, $skip: Int = 0, $where: ModifyLiquidity_filter) {
    modifyLiquidities(first: $first, skip: $skip, where: $where, orderBy: timestamp, orderDirection: desc) {
      id
      timestamp
      amount
      amount0
      amount1
      amountUSD
      token0 {
        id
        symbol
      }
      token1 {
        id
        symbol
      }
      transaction {
        id
      }
    }
  }
`;

// Example of a generalized fetch function if they aren't using a GraphQL client
export async function fetchSubgraph<T>(query: string, variables: Record<string, any> = {}): Promise<T> {
  const response = await fetch(SUBGRAPH_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const { data, errors } = await response.json();

  if (errors) {
    console.error('GraphQL errors:', errors);
    throw new Error('Error fetching subgraph data');
  }

  return data;
}

export const GET_USER_ACTIVITY = `
  query GetUserActivity($user: String!, $userBytes: Bytes!, $first: Int = 50) {
    swaps(first: $first, where: { origin: $userBytes }, orderBy: timestamp, orderDirection: desc) {
      id
      timestamp
      amount0
      amount1
      amountUSD
      token0 {
        id
        symbol
      }
      token1 {
        id
        symbol
      }
      transaction {
        id
      }
    }
    modifyLiquidities(first: $first, where: { origin: $userBytes }, orderBy: timestamp, orderDirection: desc) {
      id
      timestamp
      amount
      amount0
      amount1
      amountUSD
      token0 {
        id
        symbol
      }
      token1 {
        id
        symbol
      }
      transaction {
        id
      }
    }
  }
`;

export const GET_POSITION_TRANSACTIONS = `
  query GetPositionTransactions($poolId: String!, $tickLower: BigInt!, $tickUpper: BigInt!, $origin: Bytes!, $first: Int = 50) {
    modifyLiquidities(
      first: $first
      where: { pool: $poolId, tickLower: $tickLower, tickUpper: $tickUpper, origin: $origin }
      orderBy: timestamp
      orderDirection: desc
    ) {
      id
      timestamp
      amount
      amount0
      amount1
      amountUSD
      transaction {
        id
      }
    }
  }
`;

export const GET_POSITION_OWNER = `
  query GetPositionOwner($tokenId: ID!) {
    position(id: $tokenId) {
      id
      tokenId
      origin
      owner
    }
  }
`;

// ============================================================
// PointsHook Indexer (ERC1155 Leaderboard + Reward Mints)
// ============================================================

export const POINTSHOOK_SUBGRAPH_ENDPOINT = "https://api.studio.thegraph.com/query/1749160/mlswap-pointshook-subgraph/version/latest";

/** Leaderboard: all holders for a given poolId (= tokenId in ERC1155) */
export const GET_POINTS_LEADERBOARD = `
  query GetPointsLeaderboard($tokenId: BigInt!, $first: Int = 50, $skip: Int = 0) {
    pointsBalances(
      where: { tokenId: $tokenId }
      orderBy: balance
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      tokenId
      owner
      balance
      transfers(orderBy: timestamp, orderDirection: asc, first: 1) {
        timestamp
      }
    }
  }
`;

/** Latest reward mint transactions (from = zero address) for a poolId */
export const GET_POINTS_TRANSFERS = `
  query GetPointsTransfers($tokenId: String!, $first: Int = 20, $skip: Int = 0) {
    transferSingles(
      where: { tokenId: $tokenId, from: "0x0000000000000000000000000000000000000000" }
      orderBy: timestamp
      orderDirection: desc
      first: $first
      skip: $skip
    ) {
      id
      tokenId
      from
      to
      value
      timestamp
      transaction {
        id
      }
    }
  }
`;

export async function fetchPointsHookSubgraph<T>(query: string, variables: Record<string, any> = {}): Promise<T> {
  const response = await fetch(POINTSHOOK_SUBGRAPH_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  const { data, errors } = await response.json();
  if (errors) {
    console.error('PointsHook GraphQL errors:', errors);
    throw new Error('Error fetching PointsHook subgraph data');
  }
  return data;
}
