const SUBGRAPH_ENDPOINT = "https://api.studio.thegraph.com/query/1749160/mlswap-subgraph/version/latest";
const POINTSHOOK_SUBGRAPH_ENDPOINT = "https://api.studio.thegraph.com/query/1749160/mlswap-pointshook-subgraph/version/latest";

async function querySubgraph(endpoint: string, query: string, variables: any = {}) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  if (json.errors) {
    throw new Error(`GraphQL Errors: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

async function main() {
  const uniqueUsers = new Set<string>();
  const swapUsers = new Set<string>();
  const liquidityUsers = new Set<string>();
  const positionUsers = new Set<string>();
  const pointsUsers = new Set<string>();

  console.log("Fetching global metadata...");
  try {
    const globalData = await querySubgraph(SUBGRAPH_ENDPOINT, `
      query {
        poolManagers(first: 1) {
          txCount
          poolCount
        }
      }
    `);
    console.log("Global poolManagers state:", globalData.poolManagers[0]);
  } catch (e) {
    console.error("Error fetching global metadata:", e);
  }

  // 1. Fetch Swaps
  console.log("Fetching swaps...");
  let lastSwapTimestamp = "0";
  let hasMoreSwaps = true;
  let swapCount = 0;
  while (hasMoreSwaps) {
    const data = await querySubgraph(SUBGRAPH_ENDPOINT, `
      query GetSwaps($lastTimestamp: BigInt!) {
        swaps(first: 1000, where: { timestamp_gt: $lastTimestamp }, orderBy: timestamp, orderDirection: asc) {
          timestamp
          sender
          origin
        }
      }
    `, { lastTimestamp: lastSwapTimestamp });

    const swaps = data.swaps;
    if (swaps.length === 0) {
      hasMoreSwaps = false;
    } else {
      swapCount += swaps.length;
      for (const swap of swaps) {
        const sender = swap.sender.toLowerCase();
        const origin = swap.origin.toLowerCase();
        swapUsers.add(sender);
        swapUsers.add(origin);
        uniqueUsers.add(sender);
        uniqueUsers.add(origin);
      }
      lastSwapTimestamp = swaps[swaps.length - 1].timestamp;
      if (swaps.length < 1000) {
        hasMoreSwaps = false;
      }
    }
  }
  console.log(`Fetched ${swapCount} swaps. Found ${swapUsers.size} unique swap addresses.`);

  // 2. Fetch Modify Liquidities
  console.log("Fetching modify liquidities...");
  let lastLiqTimestamp = "0";
  let hasMoreLiq = true;
  let liqCount = 0;
  while (hasMoreLiq) {
    const data = await querySubgraph(SUBGRAPH_ENDPOINT, `
      query GetModifyLiquidities($lastTimestamp: BigInt!) {
        modifyLiquidities(first: 1000, where: { timestamp_gt: $lastTimestamp }, orderBy: timestamp, orderDirection: asc) {
          timestamp
          sender
          origin
        }
      }
    `, { lastTimestamp: lastLiqTimestamp });

    const modifyLiquidities = data.modifyLiquidities;
    if (modifyLiquidities.length === 0) {
      hasMoreLiq = false;
    } else {
      liqCount += modifyLiquidities.length;
      for (const liq of modifyLiquidities) {
        const sender = liq.sender ? liq.sender.toLowerCase() : "";
        const origin = liq.origin.toLowerCase();
        if (sender) {
          liquidityUsers.add(sender);
          uniqueUsers.add(sender);
        }
        liquidityUsers.add(origin);
        uniqueUsers.add(origin);
      }
      lastLiqTimestamp = modifyLiquidities[modifyLiquidities.length - 1].timestamp;
      if (modifyLiquidities.length < 1000) {
        hasMoreLiq = false;
      }
    }
  }
  console.log(`Fetched ${liqCount} modifyLiquidities. Found ${liquidityUsers.size} unique liquidity addresses.`);

  // 3. Fetch Positions
  console.log("Fetching positions...");
  let lastPosTimestamp = "0";
  let hasMorePos = true;
  let posCount = 0;
  while (hasMorePos) {
    const data = await querySubgraph(SUBGRAPH_ENDPOINT, `
      query GetPositions($lastTimestamp: BigInt!) {
        positions(first: 1000, where: { createdAtTimestamp_gt: $lastTimestamp }, orderBy: createdAtTimestamp, orderDirection: asc) {
          createdAtTimestamp
          owner
          origin
        }
      }
    `, { lastTimestamp: lastPosTimestamp });

    const positions = data.positions;
    if (positions.length === 0) {
      hasMorePos = false;
    } else {
      posCount += positions.length;
      for (const pos of positions) {
        const owner = pos.owner.toLowerCase();
        const origin = pos.origin.toLowerCase();
        positionUsers.add(owner);
        positionUsers.add(origin);
        uniqueUsers.add(owner);
        uniqueUsers.add(origin);
      }
      lastPosTimestamp = positions[positions.length - 1].createdAtTimestamp;
      if (positions.length < 1000) {
        hasMorePos = false;
      }
    }
  }
  console.log(`Fetched ${posCount} positions. Found ${positionUsers.size} unique position owner/origin addresses.`);

  // 4. Fetch Subscriptions & Unsubscriptions
  console.log("Fetching subscriptions...");
  let lastSubTimestamp = "0";
  let hasMoreSub = true;
  let subCount = 0;
  while (hasMoreSub) {
    const data = await querySubgraph(SUBGRAPH_ENDPOINT, `
      query GetSubscribes($lastTimestamp: BigInt!) {
        subscribes(first: 1000, where: { timestamp_gt: $lastTimestamp }, orderBy: timestamp, orderDirection: asc) {
          timestamp
          address
          origin
        }
      }
    `, { lastTimestamp: lastSubTimestamp });

    const subscribes = data.subscribes;
    if (!subscribes || subscribes.length === 0) {
      hasMoreSub = false;
    } else {
      subCount += subscribes.length;
      for (const sub of subscribes) {
        const addr = sub.address.toLowerCase();
        const origin = sub.origin.toLowerCase();
        uniqueUsers.add(addr);
        uniqueUsers.add(origin);
      }
      lastSubTimestamp = subscribes[subscribes.length - 1].timestamp;
      if (subscribes.length < 1000) {
        hasMoreSub = false;
      }
    }
  }
  console.log(`Fetched ${subCount} subscriptions.`);

  // 5. Fetch Points balances (PointsHook Subgraph)
  console.log("Fetching points balances from points hook subgraph...");
  try {
    let lastPointsId = "";
    let hasMorePoints = true;
    let pointsCount = 0;
    while (hasMorePoints) {
      const data = await querySubgraph(POINTSHOOK_SUBGRAPH_ENDPOINT, `
        query GetPointsBalances($lastId: ID!) {
          pointsBalances(first: 1000, where: { id_gt: $lastId }, orderBy: id, orderDirection: asc) {
            id
            owner
          }
        }
      `, { lastId: lastPointsId });

      const pointsBalances = data.pointsBalances;
      if (!pointsBalances || pointsBalances.length === 0) {
        hasMorePoints = false;
      } else {
        pointsCount += pointsBalances.length;
        for (const pb of pointsBalances) {
          const owner = pb.owner.toLowerCase();
          pointsUsers.add(owner);
          uniqueUsers.add(owner);
        }
        lastPointsId = pointsBalances[pointsBalances.length - 1].id;
        if (pointsBalances.length < 1000) {
          hasMorePoints = false;
        }
      }
    }
    console.log(`Fetched ${pointsCount} pointsBalances. Found ${pointsUsers.size} unique points addresses.`);
  } catch (e) {
    console.warn("PointsHook subgraph might not be accessible or active yet:", e.message);
  }

  console.log("\n=================== SUMMARY ===================");
  console.log(`Total Swapping Users: ${swapUsers.size}`);
  console.log(`Total Liquidity Providers: ${liquidityUsers.size}`);
  console.log(`Total Position Owners: ${positionUsers.size}`);
  console.log(`Total Points Holders: ${pointsUsers.size}`);
  console.log(`-----------------------------------------------`);
  console.log(`GRAND TOTAL UNIQUE USERS: ${uniqueUsers.size}`);
  console.log("===============================================");
//   console.log("Unique addresses list:");
//   console.log(Array.from(uniqueUsers).join("\n"));
}

main().catch(console.error);

