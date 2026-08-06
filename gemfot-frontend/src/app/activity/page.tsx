import { useState, useEffect } from 'react';
import { ExternalLink, Users, Loader2, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { request } from 'graphql-request';
import { 
  GET_GLOBAL_DATA, 
  GET_SWAPS, 
  GET_GLOBAL_TRANSACTIONS, 
  GET_GLOBAL_MODIFY_LIQUIDITIES, 
  SUBGRAPH_ENDPOINT,
  POINTSHOOK_SUBGRAPH_ENDPOINT
} from '../../lib/queries';


const GET_ALL_SWAPS = `
  query GetSwaps($lastTimestamp: BigInt!) {
    swaps(first: 1000, where: { timestamp_gt: $lastTimestamp }, orderBy: timestamp, orderDirection: asc) {
      timestamp
      sender
      origin
    }
  }
`;

const GET_ALL_MODIFY_LIQUIDITIES = `
  query GetModifyLiquidities($lastTimestamp: BigInt!) {
    modifyLiquidities(first: 1000, where: { timestamp_gt: $lastTimestamp }, orderBy: timestamp, orderDirection: asc) {
      timestamp
      sender
      origin
    }
  }
`;

const GET_ALL_POSITIONS = `
  query GetPositions($lastTimestamp: BigInt!) {
    positions(first: 1000, where: { createdAtTimestamp_gt: $lastTimestamp }, orderBy: createdAtTimestamp, orderDirection: asc) {
      createdAtTimestamp
      owner
      origin
    }
  }
`;

const GET_ALL_POINTS_BALANCES = `
  query GetPointsBalances($lastId: ID!) {
    pointsBalances(first: 1000, where: { id_gt: $lastId }, orderBy: id, orderDirection: asc) {
      id
      owner
    }
  }
`;

interface ActivityItem {
  id: string;
  hash: string;
  timestamp: number;
  type: string;
  usd: number | string;
  token0Amount?: string;
  token1Amount?: string;
  isToken0Negative?: boolean;
  isToken1Negative?: boolean;
}

const formatLargeCurrency = (val: string | number | undefined) => {
  if (val === undefined || val === null || isNaN(Number(val))) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact" }).format(Number(val));
};

const formatCurrency = (val: string | number | undefined) => {
  if (val === undefined || val === null || isNaN(Number(val))) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(val));
};

const formatNumber = (val: string | number | undefined) => {
  if (val === undefined || val === null || isNaN(Number(val))) return '0';
  return new Intl.NumberFormat('en-US').format(Number(val));
};

const getRelativeTime = (timestamp: number) => {
  const now = Math.floor(Date.now() / 1000);
  const difference = now - timestamp;
  if (difference < 60) return 'Just now';
  const minutes = Math.floor(difference / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const mapSwap = (swap: any, txHash: string, timestamp: number): ActivityItem => {
  const isAmount0Negative = Number(swap.amount0) < 0;
  const isAmount1Negative = Number(swap.amount1) < 0;
  
  const token0Symbol = swap.token0?.symbol || 'Token0';
  const token1Symbol = swap.token1?.symbol || 'Token1';
  
  const typeText = `Swap ${isAmount0Negative ? `${token0Symbol} for ${token1Symbol}` : `${token1Symbol} for ${token0Symbol}`}`;
  const amount0Formatted = `${isAmount0Negative ? '' : '+'}${Number(swap.amount0).toFixed(4)} ${token0Symbol}`;
  const amount1Formatted = `${isAmount1Negative ? '' : '+'}${Number(swap.amount1).toFixed(4)} ${token1Symbol}`;
  
  return {
    id: swap.id,
    hash: txHash,
    timestamp: timestamp,
    type: typeText,
    usd: swap.amountUSD,
    token0Amount: amount0Formatted,
    token1Amount: amount1Formatted,
    isToken0Negative: isAmount0Negative,
    isToken1Negative: isAmount1Negative
  };
};

const mapModifyLiquidity = (ml: any, txHash: string, timestamp: number): ActivityItem => {
  const amount = Number(ml.amount);
  
  const token0Symbol = ml.token0?.symbol || 'Token0';
  const token1Symbol = ml.token1?.symbol || 'Token1';
  
  let typeText = '';
  let isAmt0Neg = false;
  let isAmt1Neg = false;
  
  if (amount === 0) {
    typeText = `Collected Fees (${token0Symbol}/${token1Symbol})`;
    isAmt0Neg = true;//
    isAmt1Neg = true;//
  } else if (amount > 0) {
    typeText = `Added Liquidity (${token0Symbol}/${token1Symbol})`;
    isAmt0Neg = false;//
    isAmt1Neg = false;//
  } else {
    typeText = `Removed Liquidity (${token0Symbol}/${token1Symbol})`;
    isAmt0Neg = true;//
    isAmt1Neg = true;//
  }
  
  const amt0Val = Math.abs(Number(ml.amount0));
  const amt1Val = Math.abs(Number(ml.amount1));
  
  const amount0Formatted = `${isAmt0Neg ? '-' : '+'}${amt0Val.toFixed(4)} ${token0Symbol}`;
  const amount1Formatted = `${isAmt1Neg ? '-' : '+'}${amt1Val.toFixed(4)} ${token1Symbol}`;
  
  return {
    id: ml.id,
    hash: txHash,
    timestamp: timestamp,
    type: typeText,
    // usd: ml.amountUSD || 0,
    usd: Math.abs(Number(ml.amountUSD || 0)),
    token0Amount: amount0Formatted,
    token1Amount: amount1Formatted,
    isToken0Negative: isAmt0Neg,
    isToken1Negative: isAmt1Neg
  };
};


export default function ActivityPage() {
  const [filterOpen, setFilterOpen] = useState(false);
  const [timeRange, setTimeRange] = useState('All time');
  const [filterType, setFilterType] = useState('All types');
  const [globalData, setGlobalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [swaps, setSwaps] = useState<ActivityItem[]>([]);
  const [swapsPage, setSwapsPage] = useState(0);
  const [swapsLoading, setSwapsLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(false);

  // Unique Users Stats States
  const [showUniqueUsers, setShowUniqueUsers] = useState(false);
  const [fetchingUsers, setFetchingUsers] = useState(false);
  const [userStats, setUserStats] = useState<{
    uniqueCount: number;
    swappersCount: number;
    lpCount: number;
    positionOwnersCount: number;
    pointsCount: number;
    addresses: string[];
  } | null>(null);
  const [addressSearch, setAddressSearch] = useState('');
  const [showAddressList, setShowAddressList] = useState(false);

  const handleFetchUniqueUsers = async () => {
    if (userStats) {
      setShowUniqueUsers(!showUniqueUsers);
      return;
    }

    try {
      setFetchingUsers(true);
      setShowUniqueUsers(true);

      const uniqueUsersSet = new Set<string>();
      const swapUsersSet = new Set<string>();
      const liquidityUsersSet = new Set<string>();
      const positionUsersSet = new Set<string>();
      const pointsUsersSet = new Set<string>();

      // 1. Fetch Swaps
      let lastSwapTimestamp = "0";
      let hasMoreSwaps = true;
      while (hasMoreSwaps) {
        const data: any = await request(SUBGRAPH_ENDPOINT, GET_ALL_SWAPS, { lastTimestamp: lastSwapTimestamp });
        const swapsList = data?.swaps || [];
        if (swapsList.length === 0) {
          hasMoreSwaps = false;
        } else {
          for (const swap of swapsList) {
            const sender = swap.sender.toLowerCase();
            const origin = swap.origin.toLowerCase();
            swapUsersSet.add(sender);
            swapUsersSet.add(origin);
            uniqueUsersSet.add(sender);
            uniqueUsersSet.add(origin);
          }
          lastSwapTimestamp = swapsList[swapsList.length - 1].timestamp;
          if (swapsList.length < 1000) {
            hasMoreSwaps = false;
          }
        }
      }

      // 2. Fetch Modify Liquidities
      let lastLiqTimestamp = "0";
      let hasMoreLiq = true;
      while (hasMoreLiq) {
        const data: any = await request(SUBGRAPH_ENDPOINT, GET_ALL_MODIFY_LIQUIDITIES, { lastTimestamp: lastLiqTimestamp });
        const mlList = data?.modifyLiquidities || [];
        if (mlList.length === 0) {
          hasMoreLiq = false;
        } else {
          for (const liq of mlList) {
            const sender = liq.sender ? liq.sender.toLowerCase() : "";
            const origin = liq.origin.toLowerCase();
            if (sender) {
              liquidityUsersSet.add(sender);
              uniqueUsersSet.add(sender);
            }
            liquidityUsersSet.add(origin);
            uniqueUsersSet.add(origin);
          }
          lastLiqTimestamp = mlList[mlList.length - 1].timestamp;
          if (mlList.length < 1000) {
            hasMoreLiq = false;
          }
        }
      }

      // 3. Fetch Positions
      let lastPosTimestamp = "0";
      let hasMorePos = true;
      while (hasMorePos) {
        const data: any = await request(SUBGRAPH_ENDPOINT, GET_ALL_POSITIONS, { lastTimestamp: lastPosTimestamp });
        const posList = data?.positions || [];
        if (posList.length === 0) {
          hasMorePos = false;
        } else {
          for (const pos of posList) {
            const owner = pos.owner.toLowerCase();
            const origin = pos.origin.toLowerCase();
            positionUsersSet.add(owner);
            positionUsersSet.add(origin);
            uniqueUsersSet.add(owner);
            uniqueUsersSet.add(origin);
          }
          lastPosTimestamp = posList[posList.length - 1].createdAtTimestamp;
          if (posList.length < 1000) {
            hasMorePos = false;
          }
        }
      }

      // 4. Fetch Points (PointsHook Subgraph)
      try {
        let lastPointsId = "";
        let hasMorePoints = true;
        while (hasMorePoints) {
          const data: any = await request(POINTSHOOK_SUBGRAPH_ENDPOINT, GET_ALL_POINTS_BALANCES, { lastId: lastPointsId });
          const pbList = data?.pointsBalances || [];
          if (pbList.length === 0) {
            hasMorePoints = false;
          } else {
            for (const pb of pbList) {
              const owner = pb.owner.toLowerCase();
              pointsUsersSet.add(owner);
              uniqueUsersSet.add(owner);
            }
            lastPointsId = pbList[pbList.length - 1].id;
            if (pbList.length < 1000) {
              hasMorePoints = false;
            }
          }
        }
      } catch (e) {
        console.warn("PointsHook subgraph is not active or has failed to load", e);
      }

      setUserStats({
        uniqueCount: uniqueUsersSet.size,
        swappersCount: swapUsersSet.size,
        lpCount: liquidityUsersSet.size,
        positionOwnersCount: positionUsersSet.size,
        pointsCount: pointsUsersSet.size,
        addresses: Array.from(uniqueUsersSet),
      });
    } catch (error) {
      console.error("Error fetching unique users:", error);
    } finally {
      setFetchingUsers(false);
    }
  };

  useEffect(() => {
    const fetchGlobalData = async () => {
      try {
        setLoading(true);
        const data = await request(SUBGRAPH_ENDPOINT, GET_GLOBAL_DATA);
        setGlobalData(data);
      } catch (error) {
        console.error('Error fetching global data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchGlobalData();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setSwapsLoading(true);
        let mappedItems: ActivityItem[] = [];
        let hasNext = false;
        
        const limit = 11;
        const skip = swapsPage * 10;
        
        const now = Math.floor(Date.now() / 1000);
        let minTimestamp = 0;
        if (timeRange === '1h') {
          minTimestamp = now - 3600;
        } else if (timeRange === '24h') {
          minTimestamp = now - 86400;
        } else if (timeRange === '7d') {
          minTimestamp = now - 86400 * 7;
        } else if (timeRange === '30d') {
          minTimestamp = now - 86400 * 30;
        }
        
        if (filterType === 'All types') {
          const whereClause: any = {};
          if (minTimestamp > 0) {
            whereClause.timestamp_gte = minTimestamp.toString();
          }
          
          const data: any = await request(SUBGRAPH_ENDPOINT, GET_GLOBAL_TRANSACTIONS, {
            first: limit,
            skip: skip,
            where: whereClause
          });
          
          const txs = data.transactions || [];
          hasNext = txs.length > 10;
          const displayTxs = txs.slice(0, 10);
          
          displayTxs.forEach((tx: any) => {
            const txHash = tx.id;
            const timestamp = Number(tx.timestamp);
            
            if (tx.swaps && tx.swaps.length > 0) {
              tx.swaps.forEach((s: any) => {
                mappedItems.push(mapSwap(s, txHash, timestamp));
              });
            }
            if (tx.modifyLiquiditys && tx.modifyLiquiditys.length > 0) {
              tx.modifyLiquiditys.forEach((ml: any) => {
                if (ml.amount !== "0") {
                  mappedItems.push(mapModifyLiquidity(ml, txHash, timestamp));
                }
              });
            }
          });
          
          mappedItems.sort((a, b) => b.timestamp - a.timestamp);
          
        } else if (filterType === 'Swaps') {
          const whereClause: any = {};
          if (minTimestamp > 0) {
            whereClause.timestamp_gte = minTimestamp.toString();
          }
          
          const data: any = await request(SUBGRAPH_ENDPOINT, GET_SWAPS, {
            first: limit,
            skip: skip,
            where: whereClause
          });
          const swapsList = data.swaps || [];
          hasNext = swapsList.length > 10;
          console.log("Total swaps fetched: ", swapsList.length);
          const displaySwaps = swapsList.slice(0, 10);
          
          displaySwaps.forEach((s: any) => {
            mappedItems.push(mapSwap(s, s.transaction?.id || s.id, Number(s.timestamp)));
          });
          
        } else if (filterType === 'Added Liquidity') {
          const whereClause: any = { amount_gt: "0" };
          if (minTimestamp > 0) {
            whereClause.timestamp_gte = minTimestamp.toString();
          }
          
          const data: any = await request(SUBGRAPH_ENDPOINT, GET_GLOBAL_MODIFY_LIQUIDITIES, {
            first: limit,
            skip: skip,
            where: whereClause
          });
          const mlList = data.modifyLiquidities || [];
          hasNext = mlList.length > 10;
          const displayMls = mlList.slice(0, 10);
          
          displayMls.forEach((ml: any) => {
            mappedItems.push(mapModifyLiquidity(ml, ml.transaction?.id || ml.id, Number(ml.timestamp)));
          });
          
        } else if (filterType === 'Remove Liquidity') {
          const whereClause: any = { amount_lt: "0" };
          if (minTimestamp > 0) {
            whereClause.timestamp_gte = minTimestamp.toString();
          }
          
          const data: any = await request(SUBGRAPH_ENDPOINT, GET_GLOBAL_MODIFY_LIQUIDITIES, {
            first: limit,
            skip: skip,
            where: whereClause
          });
          const mlList = data.modifyLiquidities || [];
          hasNext = mlList.length > 10;
          const displayMls = mlList.slice(0, 10);
          
          displayMls.forEach((ml: any) => {
            mappedItems.push(mapModifyLiquidity(ml, ml.transaction?.id || ml.id, Number(ml.timestamp)));
          });
          
        } else {
          mappedItems = [];
          hasNext = false;
        }
        
        setSwaps(mappedItems);
        setHasNextPage(hasNext);
      } catch (error) {
        console.error('Error fetching activity items:', error);
      } finally {
        setSwapsLoading(false);
      }
    };
    
    fetchData();
  }, [swapsPage, filterType, timeRange]);

  // Reset pagination if filters are modified
  useEffect(() => {
    setSwapsPage(0);
  }, [filterType, timeRange]);

  const currentDayTimestamp = Math.floor(Date.now() / 1000 / 86400) * 86400;
  const hasGlobalTodayData = globalData?.uniswapDayDatas?.[0]?.date === currentDayTimestamp;
  const globalVol1d = hasGlobalTodayData ? globalData?.uniswapDayDatas?.[0]?.volumeUSD : 0;
  const globalFees1d = hasGlobalTodayData ? globalData?.uniswapDayDatas?.[0]?.feesUSD : 0;

  const totalTxCount = Number(globalData?.poolManagers?.[0]?.txCount || 0);

  const filteredSwaps = swaps;

  const hasPrevPage = swapsPage > 0;

  const statCards = [
    {
      label: 'Total TVL',
      value: loading ? null : formatLargeCurrency(globalData?.poolManagers?.[0]?.totalValueLockedUSD),
      accent: false,
    },
    {
      label: '1D Volume',
      value: loading ? null : formatLargeCurrency(globalVol1d),
      accent: false,
    },
    {
      label: 'All Time Volume',
      value: loading ? null : formatLargeCurrency(globalData?.poolManagers?.[0]?.totalVolumeUSD),
      accent: false,
    },
    {
      label: '1D Fees',
      value: loading ? null : formatLargeCurrency(globalFees1d),
      accent: false,
    },
    {
      label: 'All Time Fees',
      value: loading ? null : formatLargeCurrency(globalData?.poolManagers?.[0]?.totalFeesUSD),
      accent: false,
    },
    {
      label: 'Total Pools',
      value: loading ? null : formatNumber(globalData?.poolManagers?.[0]?.poolCount),
      accent: false,
    },
    {
      label: 'Total Txns',
      value: loading ? null : formatNumber(globalData?.poolManagers?.[0]?.txCount),
      accent: false,
    },
  ];

  return (
    <div className="pb-40 relative z-10 w-full">

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-12">
        {statCards.map((card) => (
          <div
            key={card.label}
            className={`relative rounded-2xl p-4 flex flex-col gap-3 overflow-hidden transition-all duration-300 group hover:scale-[1.02] ${
              card.accent
                ? 'bg-primary/10 border border-primary/30 shadow-[0_0_24px_rgba(234,179,8,0.08)]'
                : 'bg-white/[0.03] border border-white/[0.07] hover:border-white/15'
            }`}
          >
            {/* subtle top-right glow */}
            {card.accent && (
              <div className="absolute -top-4 -right-4 w-16 h-16 rounded-full bg-primary/20 blur-2xl pointer-events-none" />
            )}

            {/* Label */}
            <p className="text-[10px] tracking-[0.18em] text-white/30 leading-tight">
              {card.label}
            </p>

            {/* Value */}
            {loading ? (
              <div className="h-7 w-20 bg-white/5 rounded-lg animate-pulse" />
            ) : (
              <p className={`text-xl font-semibold tracking-tight leading-none ${card.accent ? 'text-primary' : 'text-white'}`}>
                {card.value}
              </p>
            )}
          </div>
        ))}
      </div>

     {/* Unique Users Section */}


      {/* Tabs & Actions */}
      <div className="flex justify-between items-center border-b border-white/10 mb-10">
        <div className="flex gap-10">
          <button className="pb-5 text-primary border-b-2 border-primary  uppercase tracking-widest text-xs flex items-center gap-3">
            Activity 
            <span className="bg-primary text-black text-[12px] px-2 py-0.5 rounded-full ">{totalTxCount || filteredSwaps.length}</span>
          </button>
        </div>
        {/* <button className="bg-primary text-black px-5 py-2 rounded-full  text-[12px] tracking-[0.1em] flex items-center gap-2 hover:opacity-90 active:scale-95 transition-all shadow-lg gold-glow mb-4 cursor-pointer">
          <span className="material-symbols-outlined text-sm ">download</span>
          EXPORT CSV
        </button> */}
      </div>

      {/* Filters Row */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10 bg-white/[0.02] p-6 rounded-2xl border border-white/5">
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex flex-col gap-2">
            <label className="text-[12px] text-white/40">Filter by type</label>
            <div className="relative">
              <button 
                onClick={() => setFilterOpen(!filterOpen)}
                className="flex items-center justify-between gap-10 bg-black border border-primary/50 px-6 py-3 rounded-full text-sm font-semibold transition-all min-w-[220px] text-white group cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-primary text-xl">filter_list</span>
                  {filterType}
                </div>
                <span className={`material-symbols-outlined text-white/40 group-hover:text-primary transition-all ${filterOpen ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
              
              {filterOpen && (
                <div className="absolute top-full left-0 mt-2 w-full bg-black border border-primary/30 rounded-xl shadow-2xl z-20 py-2 overflow-hidden backdrop-blur-xl">
                  {['All types', 'Swaps', 'Added Liquidity', 'Remove Liquidity'].map(type => (
                    <button 
                      key={type}
                      onClick={() => {
                        setFilterType(type);
                        setFilterOpen(false);
                      }}
                      className={`w-full text-left px-5 py-3 text-sm  transition-colors border-l-2 ${filterType === type ? 'text-primary bg-primary/10 border-primary' : 'text-white/70 hover:bg-white/5 hover:text-white border-transparent cursor-pointer'}`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 w-full md:w-auto">
          <label className="text-[12px] text-white/40">Time Range</label>
          <div className="flex bg-black/40 rounded-full p-1.5 border border-white/10">
            {['1h', '24h', '7d', '30d', 'All Time'].map(range => (
              <button 
                key={range}
                onClick={() => setTimeRange(range)}
                className={`flex-1 md:px-6 py-2 text-[12px] font-bold tracking-wider rounded-full transition-all whitespace-nowrap active:scale-95 ${timeRange === range ? 'bg-primary text-black shadow-lg' : 'text-white/40 hover:text-white cursor-pointer'}`}
              >
                {range}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Transaction List Table */}
      <div className="bg-white/[0.01] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
        <div className="hidden md:grid grid-cols-[1fr_1.5fr_1fr_1.2fr_1.2fr_1fr] gap-4 px-8 py-6 text-[12px] tracking-[0.2em] text-white/30 border-b border-white/5 bg-white/[0.02]">
          <div>Time</div>
          <div>Type</div>
          <div>USD</div>
          <div>Token0 Amount</div>
          <div>Token1 Amount</div>
          <div className="text-right">Txn Hash</div>
        </div>
        <div className="divide-y divide-white/5">
          {swapsLoading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr_1.2fr_1.2fr_1fr] gap-4 px-8 py-7 items-center border-b border-white/5 animate-pulse">
                <div className="h-4 bg-white/5 rounded w-16" />
                <div className="h-4 bg-white/5 rounded w-32" />
                <div className="h-4 bg-white/5 rounded w-16" />
                <div className="h-4 bg-white/5 rounded w-20" />
                <div className="h-4 bg-white/5 rounded w-20" />
                <div className="h-4 bg-white/5 rounded w-24 md:ml-auto" />
              </div>
            ))
          ) : filteredSwaps && filteredSwaps.length > 0 ? (
            filteredSwaps.map((row: any) => {
              const formattedTime = getRelativeTime(row.timestamp);

              return (
                <div key={row.id} className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr_1.2fr_1.2fr_1fr] gap-4 px-8 py-7 items-center hover:bg-white/[0.03] transition-all group cursor-pointer">
                  <div className="flex md:block justify-between items-center text-[12px] tracking-tight text-white/50">
                     <span className="md:hidden text-[11px] text-white/20">Time</span>
                     {formattedTime}
                  </div>

                  <div className="flex md:block justify-between items-center">
                    <span className="md:hidden text-[11px]  text-white/20">Type</span>
                    <p className=" text-xs text-white group-hover:text-primary transition-colors tracking-widest">{row.type}</p>
                  </div>

                  <div className="flex md:block justify-between items-center">
                    <span className="md:hidden text-[11px]  text-white/20">USD</span>
                    <p className=" text-xs text-white">
                      {row.usd === '-' ? '-' : formatCurrency(row.usd)}
                    </p>
                  </div>

                  <div className="flex md:block justify-between items-center">
                    <span className="md:hidden text-[11px]  text-white/20">Token0 Amount</span>
                    <p className={` text-[13px] tracking-tight ${row.isToken0Negative ? 'text-white/60' : 'text-primary/90'}`}>
                      {row.token0Amount}
                    </p>
                  </div>

                  <div className="flex md:block justify-between items-center">
                    <span className="md:hidden text-[11px]  text-white/20">Token1 Amount</span>
                    <p className={` text-[13px] tracking-tight ${row.isToken1Negative ? 'text-white/60' : 'text-primary/90'}`}>
                      {row.token1Amount || '-'}
                    </p>
                  </div>

                  <div className="flex md:block justify-between items-center md:text-right">
                    <span className="md:hidden text-[11px]  text-white/20">Txn Hash</span>
                    <a 
                      href={`https://testnet.arcscan.app/tx/${row.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[12px] font-mono text-white/30 hover:text-primary transition-colors flex items-center justify-end gap-1.5 group/hash"
                    >
                      {row.hash.slice(0, 6)}...{row.hash.slice(-4)}
                      <ExternalLink size={10} className="text-primary/60 shrink-0" />
                    </a>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center text-white/20 uppercase text-xs opacity-50">
              No transactions found
            </div>
          )}
        </div>
      </div>

      {/* Pagination */}
      <div className="mt-10 flex flex-col sm:flex-row justify-between items-center gap-6">
        <p className="text-xs text-white/30">
          Page {swapsPage + 1} <span className="mx-2 opacity-20">|</span> Showing {swapsPage * 10 + 1}-{swapsPage * 10 + filteredSwaps.length} transactions
        </p>
        <div className="flex gap-3">
          <button 
            disabled={!hasPrevPage || swapsLoading}
            onClick={() => setSwapsPage(prev => Math.max(0, prev - 1))}
            className="px-8 py-3.5 bg-white/5 border border-white/10 rounded-full text-[13px] font-bold text-white hover:bg-white/10 transition-all active:scale-[0.98] disabled:text-white/30 disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            Previous
          </button>
          <button 
            disabled={!hasNextPage || swapsLoading}
            onClick={() => setSwapsPage(prev => prev + 1)}
            className="px-8 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-[13px] font-bold text-primary transition-all active:scale-[0.98] shadow-lg disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
          >
            Next Page
          </button>
        </div>
      </div>
    </div>
  );
}





      {/* Unique Users Toggle Section */}
      // <div className="mb-12">
      //   <div 
      //     onClick={handleFetchUniqueUsers}
      //     className="flex items-center justify-between p-6 bg-white/[0.02] border border-white/[0.07] hover:border-white/15 rounded-3xl cursor-pointer transition-all duration-300 group shadow-lg"
      //   >
      //     <div className="flex items-center gap-4">
      //       <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
      //         <Users size={22} />
      //       </div>
      //       <div>
      //         <h3 className="text-white font-semibold text-base tracking-tight group-hover:text-primary transition-colors">
      //           Unique User Analytics
      //         </h3>
      //         <p className="text-white/45 text-xs">
      //           {fetchingUsers 
      //             ? "Scanning on-chain transactions..." 
      //             : userStats 
      //               ? `${userStats.uniqueCount} unique wallets have interacted with the protocol` 
      //               : "Click to load unique wallet statistics"}
      //         </p>
      //       </div>
      //     </div>

      //     <div className="flex items-center gap-3">
      //       {fetchingUsers && <Loader2 size={18} className="animate-spin text-primary" />}
      //       <span className="text-[10px] uppercase tracking-widest font-semibold text-white/35 group-hover:text-white transition-colors bg-white/[0.03] px-3.5 py-1.5 rounded-full border border-white/5">
      //         {showUniqueUsers ? "Collapse" : "Explore"}
      //       </span>
      //       {showUniqueUsers ? <ChevronUp size={16} className="text-white/40" /> : <ChevronDown size={16} className="text-white/40" />}
      //     </div>
      //   </div>

      //   {/* Unique Users Stats Dashboard */}
      //   {showUniqueUsers && (
      //     <div className="mt-4 p-6 bg-white/[0.01] border border-white/5 rounded-3xl backdrop-blur-md transition-all duration-300 animate-fadeIn space-y-6">
      //       {fetchingUsers ? (
      //         <div className="flex flex-col items-center justify-center py-16 gap-4">
      //           <Loader2 size={36} className="animate-spin text-primary" />
      //           <p className="text-xs uppercase tracking-widest text-white/40 animate-pulse">Querying Subgraphs...</p>
      //         </div>
      //       ) : userStats ? (
      //         <>
      //           {/* Stats Breakdown */}
      //           <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
      //             {/* Grand Total */}
      //             <div className="relative overflow-hidden rounded-2xl p-5 bg-primary/[0.04] border border-primary/20 flex flex-col gap-2">
      //               <div className="absolute top-0 right-0 w-16 h-16 bg-primary/10 rounded-full blur-xl pointer-events-none" />
      //               <span className="text-[9px] uppercase tracking-widest text-primary font-bold">Total Unique Users</span>
      //               <span className="text-3xl font-extrabold text-white tracking-tight">{userStats.uniqueCount}</span>
      //             </div>
      //             {/* Swappers */}
      //             <div className="rounded-2xl p-5 bg-white/[0.02] border border-white/[0.06] flex flex-col gap-2">
      //               <span className="text-[9px] uppercase tracking-widest text-white/40">Unique Swappers</span>
      //               <span className="text-2xl font-bold text-white tracking-tight">{userStats.swappersCount}</span>
      //             </div>
      //             {/* Liquidity Providers */}
      //             <div className="rounded-2xl p-5 bg-white/[0.02] border border-white/[0.06] flex flex-col gap-2">
      //               <span className="text-[9px] uppercase tracking-widest text-white/40">Liquidity Providers</span>
      //               <span className="text-2xl font-bold text-white tracking-tight">{userStats.lpCount}</span>
      //             </div>
      //             {/* Position Owners */}
      //             <div className="rounded-2xl p-5 bg-white/[0.02] border border-white/[0.06] flex flex-col gap-2">
      //               <span className="text-[9px] uppercase tracking-widest text-white/40">Position Owners</span>
      //               <span className="text-2xl font-bold text-white tracking-tight">{userStats.positionOwnersCount}</span>
      //             </div>
      //             {/* Points Holders */}
      //             <div className="rounded-2xl p-5 bg-white/[0.02] border border-white/[0.06] flex flex-col gap-2">
      //               <span className="text-[9px] uppercase tracking-widest text-white/40">Points Holders</span>
      //               <span className="text-2xl font-bold text-white tracking-tight">{userStats.pointsCount}</span>
      //             </div>
      //           </div>

      //           {/* Address List Toggle Button */}
      //           <div className="pt-2">
      //             <button 
      //               onClick={() => setShowAddressList(!showAddressList)}
      //               className="flex items-center gap-2 text-xs font-semibold text-primary hover:underline cursor-pointer bg-transparent border-none"
      //             >
      //               {showAddressList ? "Hide full address list" : "Show full address list"}
      //               {showAddressList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      //             </button>

      //             {showAddressList && (
      //               <div className="mt-4 space-y-4">
      //                 {/* Search Bar */}
      //                 <div className="relative max-w-md">
      //                   <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" />
      //                   <input
      //                     type="text"
      //                     placeholder="Search addresses..."
      //                     value={addressSearch}
      //                     onChange={(e) => setAddressSearch(e.target.value)}
      //                     className="w-full bg-black/40 border border-white/10 rounded-full py-2.5 pl-10 pr-4 text-xs text-white placeholder-white/35 focus:outline-none focus:border-primary/50 transition-colors"
      //                   />
      //                 </div>

      //                 {/* Address Grid */}
      //                 <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
      //                   {userStats.addresses
      //                     .filter(addr => addr.includes(addressSearch.toLowerCase()))
      //                     .map((address) => (
      //                       <div 
      //                         key={address} 
      //                         className="flex items-center justify-between p-3 bg-black/20 border border-white/[0.04] hover:border-white/10 rounded-xl transition-all text-xs font-mono text-white/60 hover:text-white"
      //                       >
      //                         <span>{address.slice(0, 10)}…{address.slice(-8)}</span>
      //                         <a 
      //                           href={`https://testnet.arcscan.app/address/${address}`} 
      //                           target="_blank" 
      //                           rel="noopener noreferrer" 
      //                           className="text-primary hover:underline flex items-center gap-0.5"
      //                         >
      //                           View <ExternalLink size={10} />
      //                         </a>
      //                       </div>
      //                     ))
      //                   }
      //                   {userStats.addresses.filter(addr => addr.includes(addressSearch.toLowerCase())).length === 0 && (
      //                     <div className="col-span-full text-center py-6 text-xs text-white/30">
      //                       No addresses match your search.
      //                     </div>
      //                   )}
      //                 </div>
      //               </div>
      //             )}
      //           </div>
      //         </>
      //       ) : null}
      //     </div>
      //   )}
      // </div>