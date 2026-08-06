import { Link, useNavigate } from 'react-router-dom';
import { Search, Plus } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { request } from 'graphql-request';
import { GET_POOLS, GET_GLOBAL_DATA, SUBGRAPH_ENDPOINT } from '../../lib/queries';
import { TOKENS } from '../../config/tokens';
import { HOOKS_DETAILS } from '../../config/hooksDetail';
import { redis } from '../../lib/redis';

const formatLargeCurrency = (val: string | number | undefined) => {
  if (val === undefined || val === null || isNaN(Number(val))) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact" }).format(Number(val));
};

const formatNumber = (val: string | number | undefined) => {
  if (val === undefined || val === null || isNaN(Number(val))) return '0';
  return new Intl.NumberFormat('en-US').format(Number(val));
};

const PoolRowSkeleton = () => (
  <div className="grid grid-cols-1 md:grid-cols-[2fr_0.7fr_1fr_1fr_1fr_auto] p-6 items-center border-b border-white/[0.05] animate-pulse">
    {/* Pool */}
    <div className="flex items-center gap-6">
      <div className="flex -space-x-4">
        <div className="w-12 h-12 rounded-full border-[3px] border-black bg-white/5 relative z-[2]" />
        <div className="w-12 h-12 rounded-full border-[3px] border-black bg-white/5 relative z-[1]" />
      </div>
      <div className="h-5 w-24 bg-white/5 rounded" />
    </div>
    {/* Fee Tier */}
    <div className="flex md:block justify-between items-center mt-6 md:mt-0">
      <span className="md:hidden text-[12px] text-white/10 uppercase">Fee Tier</span>
      <div className="h-7 w-14 bg-white/5 rounded float-right" />
    </div>
    {/* Liquidity */}
    <div className="flex md:block justify-between items-center mt-2 md:mt-0">
      <span className="md:hidden text-[12px] text-white/10 uppercase">Liquidity</span>
      <div className="h-5 w-20 bg-white/5 rounded md:ml-auto" />
    </div>
    {/* 1D Vol */}
    <div className="flex md:block justify-between items-center mt-2 md:mt-0">
      <span className="md:hidden text-[12px] text-white/10 uppercase">1D Vol</span>
      <div className="h-5 w-20 bg-white/5 rounded md:ml-auto" />
    </div>
    {/* 1D Fees */}
    <div className="flex md:block justify-between items-center mt-2 md:mt-0">
      <span className="md:hidden text-[14px] text-white/10 uppercase">1D Fees</span>
      <div className="h-5 w-20 bg-white/5 rounded md:ml-auto" />
    </div>
    {/* Action */}
    <div className="flex md:block justify-end items-center mt-2 md:mt-0 ml-4">
      <div className="h-8 w-24 bg-white/5 rounded md:ml-auto" />
    </div>
  </div>
);

export default function PoolsPage() {
  const navigate = useNavigate();
  const [addressSearch, setAddressSearch] = useState('');
  const [pools, setPools] = useState<any[]>([]);
  const [globalData, setGlobalData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // const fetchData = async () => {
    //   try {
    //     setLoading(true);
        
    //     let cachedPools: any[] | null = null;
    //     try {
    //       cachedPools = await redis.get<any[]>("mlswap:pools");
    //       if (cachedPools && cachedPools.length > 0) {
    //         setPools(cachedPools);
    //         console.log("Instantly set pools from Cache:", cachedPools);
    //       }
    //     } catch (e) {
    //       console.error("Redis fetch failed", e);
    //     }

    //     // Always fetch from subgraph to keep data fresh (Stale-While-Revalidate pattern)
    //     const fetchPoolsPromise = request(SUBGRAPH_ENDPOINT, GET_POOLS).then(async (res: any) => {
    //       try { 
    //         await redis.set("mlswap:pools", res.pools); 
    //         console.log("Updated Redis cache with fresh pools");
    //       } catch(e) {}
    //       return res;
    //     });

    //     const [poolsRes, globalRes] = await Promise.all([
    //       fetchPoolsPromise,
    //       request(SUBGRAPH_ENDPOINT, GET_GLOBAL_DATA)
    //     ]) as [any, any];
        
    //     // Update state with fresh data from subgraph
    //     setPools(poolsRes.pools || []);
    //     console.log("Fetched and updated pools from Subgraph:", poolsRes.pools);
        
    //     setGlobalData(globalRes);
    //   } catch (error) {
    //     console.error('Error fetching data:', error);
    //   } finally {
    //     setLoading(false);
    //   }
    // };
    
    const fetchData = async () => {
  try {
    setLoading(true)

    const [cachedPools, poolsRes, globalRes] = await Promise.all([
      Promise.race([
        redis.get<any[]>("mlswap:pools"),
        new Promise((_, reject) => setTimeout(() => reject(), 2000))
      ]).catch(() => null),
      request(SUBGRAPH_ENDPOINT, GET_POOLS),
      request(SUBGRAPH_ENDPOINT, GET_GLOBAL_DATA)
    ]) as [any, any, any]

    // Show cache instantly if subgraph is slow (optional)
    if (cachedPools?.length) setPools(cachedPools)

    // Fresh subgraph data always wins
    setPools(poolsRes.pools || [])
    setGlobalData(globalRes)

    // Update cache in background
    redis.set("mlswap:pools", poolsRes.pools).catch(() => {})

  } catch (error) {
    console.error('Error fetching data:', error)
  } finally {
    setLoading(false)
  }
}
    fetchData();
  }, []);

  const computePoolId = (poolKey: { currency0: string; currency1: string; fee: number; tickSpacing: number; hooks: string }) => {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint24", "int24", "address"],
      [
        poolKey.currency0,
        poolKey.currency1,
        poolKey.fee,
        poolKey.tickSpacing,
        poolKey.hooks,
      ]
    );
    return ethers.keccak256(encoded);
  };

  const filteredPools = pools.filter(pool =>
    !addressSearch ||
    pool.token0.id.toLowerCase().includes(addressSearch.toLowerCase()) ||
    pool.token1.id.toLowerCase().includes(addressSearch.toLowerCase()) ||
    pool.token0.symbol.toLowerCase().includes(addressSearch.toLowerCase()) ||
    pool.token1.symbol.toLowerCase().includes(addressSearch.toLowerCase())
  );

  const currentDayTimestamp = Math.floor(Date.now() / 1000 / 86400) * 86400;
  const hasGlobalTodayData = globalData?.uniswapDayDatas?.[0]?.date === currentDayTimestamp;
  const globalVol1d = hasGlobalTodayData ? globalData?.uniswapDayDatas?.[0]?.volumeUSD : 0;
  const globalFees1d = hasGlobalTodayData ? globalData?.uniswapDayDatas?.[0]?.feesUSD : 0;


  return (
    <div className="pb-40 relative z-10 w-full">

      {/* Header */}
      {/* <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-12">
        <div className="space-y-4">
          <h1 className="text-3xl md:text-3xl  tracking-tighter text-white">
            Liquidity Pools
          </h1>
        </div>
      </header> */}

      {/* Analytics Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 mb-12">
        {[
          { label: 'Total TVL', value: formatLargeCurrency(globalData?.poolManagers?.[0]?.totalValueLockedUSD) },
          { label: '1D Volume', value: formatLargeCurrency(globalVol1d) },
          { label: 'All Time Volume', value: formatLargeCurrency(globalData?.poolManagers?.[0]?.totalVolumeUSD) },
          { label: '1D Fees', value: formatLargeCurrency(globalFees1d) },
          { label: 'All Time Fees', value: formatLargeCurrency(globalData?.poolManagers?.[0]?.totalFeesUSD) },
          { label: 'Total Pools', value: formatNumber(globalData?.poolManagers?.[0]?.poolCount) },
          { label: 'Total Txns', value: formatNumber(globalData?.poolManagers?.[0]?.txCount) },
        ].map((card) => (
          <div
            key={card.label}
            className="relative rounded-2xl p-4 flex flex-col gap-3 overflow-hidden bg-white/[0.03] border border-white/[0.07] hover:border-white/15 transition-all duration-300 hover:scale-[1.02]"
          >
            <p className="text-[10px] tracking-[0.18em] text-white/30 leading-tight">
              {card.label}
            </p>
            {loading ? (
              <div className="h-7 w-20 bg-white/5 rounded-lg animate-pulse" />
            ) : (
              <p className="text-xl font-semibold tracking-tight leading-none text-white">
                {card.value}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Search Filter & Actions */}
      <div className="mb-8 flex flex-col md:flex-row justify-between items-center gap-6">
        <div className="relative group w-full max-w-md">
          <input
            type="text"
            placeholder="Search by token address..."
            value={addressSearch}
            onChange={(e) => setAddressSearch(e.target.value)}
            className="w-full bg-white/[0.03] border border-white/10 rounded-full px-12 py-4 text-sm font-medium text-white focus:outline-none focus:border-primary/50 focus:bg-white/[0.05] transition-all"
          />
          <Search size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/20 group-focus-within:text-primary transition-colors" />
        </div>
        <div className="flex gap-4">
          <Link to="/pools/create" className="bg-primary text-black px-8 py-3.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold transition-all gold-glow hover:brightness-110 active:scale-[0.98] flex items-center gap-3">
            <Plus size={16} strokeWidth={3} />
            Create Pool
          </Link>
        </div>
      </div>


      {/* Pools Table */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden bg-white/[0.01]">

        {/* Table Header */}
        <div className="hidden md:grid grid-cols-[32px_2fr_1fr_1fr_1fr_140px] gap-4 px-6 py-4 border-b border-white/[0.06] bg-white/[0.02]">
          <div className="text-[10px] text-white/20 uppercase tracking-widest">#</div>
          <div className="text-[10px] text-white/20 uppercase tracking-widest">Pool</div>
          <div className="text-[10px] text-white/20 uppercase tracking-widest text-right">TVL</div>
          <div className="text-[10px] text-white/20 uppercase tracking-widest text-right">1D Vol</div>
          <div className="text-[10px] text-white/20 uppercase tracking-widest text-right">1D Fees</div>
          <div />
        </div>

        {/* Pool Rows */}
        {loading && pools.length === 0 ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="grid grid-cols-[32px_2fr_1fr_1fr_1fr_140px] gap-4 px-6 py-5 border-b border-white/[0.04] animate-pulse last:border-0">
              <div className="h-4 w-4 bg-white/5 rounded" />
              <div className="flex items-center gap-4">
                <div className="flex -space-x-3">
                  <div className="w-9 h-9 rounded-full bg-white/10 border-2 border-black" />
                  <div className="w-9 h-9 rounded-full bg-white/5 border-2 border-black" />
                </div>
                <div className="h-4 w-24 bg-white/10 rounded" />
              </div>
              <div className="h-4 w-16 bg-white/5 rounded ml-auto" />
              <div className="h-4 w-16 bg-white/5 rounded ml-auto" />
              <div className="h-4 w-16 bg-white/5 rounded ml-auto" />
              <div className="h-8 w-28 bg-white/5 rounded-full ml-auto" />
            </div>
          ))
        ) : (
          filteredPools.map((pool, index) => {
            const computedId = computePoolId({
              currency0: pool.token0.id,
              currency1: pool.token1.id,
              fee: parseInt(pool.feeTier),
              tickSpacing: parseInt(pool.tickSpacing),
              hooks: pool.hooks
            });

            const img0 = TOKENS.find(t => t.address.toLowerCase() === pool.token0.id.toLowerCase())?.logo || '';
            const img1 = TOKENS.find(t => t.address.toLowerCase() === pool.token1.id.toLowerCase())?.logo || '';
            const formatCurrency = (val: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(Number(val));

            const tvlFormatted = formatCurrency(pool.totalValueLockedUSD);
            const currentDayTimestamp = Math.floor(Date.now() / 1000 / 86400) * 86400;
            const hasTodayData = pool.poolDayData && pool.poolDayData.length > 0 && pool.poolDayData[0].date === currentDayTimestamp;
            const vol1d = hasTodayData ? formatCurrency(pool.poolDayData[0].volumeUSD) : '$0.00';
            const fee1d = hasTodayData ? formatCurrency(pool.poolDayData[0].feesUSD) : '$0.00';
            const feePercent = (parseInt(pool.feeTier) / 10000).toFixed(2) + '%';

            const getCurrencyParam = (address: string) =>
              (address === '0' || address === '0x0000000000000000000000000000000000000000') ? 'NATIVE' : address;

            const addLiquidityPath = `/positions/create/currency0=${getCurrencyParam(pool.token0.id)}&currency1=${getCurrencyParam(pool.token1.id)}&fee=${pool.feeTier || ''}&tickSpacing=${pool.tickSpacing || ''}&hooks=${pool.hooks || '0x0000000000000000000000000000000000000000'}&poolId=${computedId}&sqrtPrice=${pool.sqrtPrice || '0'}`;

            const matchedHook = HOOKS_DETAILS.find(
              h => h.address.toLowerCase() === (pool.hooks || '').toLowerCase()
            );

            return (
              <div
                key={pool.id}
                onClick={() => navigate(`/pools/${computedId}`)}
                className="group relative hidden md:grid grid-cols-[32px_2fr_1fr_1fr_1fr_140px] gap-4 px-6 py-4 items-center border-b border-white/[0.04] hover:bg-white/[0.03] transition-all duration-200 last:border-0 cursor-pointer"
              >
                {/* Rank */}
                <span className="text-[12px] text-white/20 font-mono">{index + 1}</span>

                {/* Pool identity */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex -space-x-3 shrink-0">
                    {[img0, img1].map((img, i) => (
                      <div key={i} className="w-9 h-9 rounded-full border-2 border-black bg-black overflow-hidden">
                        {img ? <img alt="token" className="w-full h-full object-contain" src={img} /> : <div className="w-full h-full bg-white/10" />}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-sm font-medium text-white tracking-tight truncate">
                      {pool.token0.symbol} / {pool.token1.symbol}
                    </span>
                    <span className="shrink-0 text-[10px] bg-white/[0.06] border border-white/10 text-white/40 px-2 py-0.5 rounded-full uppercase tracking-widest">
                      {feePercent}
                    </span>
                    {matchedHook && (
                      <span 
                        title={matchedHook.name}
                        className="shrink-0 text-[10px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold max-w-[180px] truncate"
                      >
                        {matchedHook.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* TVL */}
                <div className="text-right">
                  <span className="text-sm text-white font-mono tracking-tight">{tvlFormatted}</span>
                </div>

                {/* 1D Vol */}
                <div className="text-right">
                  <span className="text-sm text-white/70 font-mono tracking-tight">{vol1d}</span>
                </div>

                {/* 1D Fees */}
                <div className="text-right">
                  <span className="text-sm text-white/50 font-mono tracking-tight">{fee1d}</span>
                </div>

                {/* Action */}
                <div className="flex justify-end">
                  <button
                    onClick={(e) => { e.stopPropagation(); navigate(addLiquidityPath); }}
                    className="bg-primary text-black px-4 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all duration-200 gold-glow hover:brightness-110 active:scale-[0.98] cursor-pointer whitespace-nowrap"
                  >
                    + Liquidity
                  </button>
                </div>
              </div>
            );
          })
        )}

        {/* Mobile cards */}
        {!loading && filteredPools.map((pool, index) => {
          const computedId = computePoolId({
            currency0: pool.token0.id,
            currency1: pool.token1.id,
            fee: parseInt(pool.feeTier),
            tickSpacing: parseInt(pool.tickSpacing),
            hooks: pool.hooks
          });
          const img0 = TOKENS.find(t => t.address.toLowerCase() === pool.token0.id.toLowerCase())?.logo || '';
          const img1 = TOKENS.find(t => t.address.toLowerCase() === pool.token1.id.toLowerCase())?.logo || '';
          const formatCurrency = (val: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact' }).format(Number(val));
          const tvlFormatted = formatCurrency(pool.totalValueLockedUSD);
          const currentDayTimestamp = Math.floor(Date.now() / 1000 / 86400) * 86400;
          const hasTodayData = pool.poolDayData && pool.poolDayData.length > 0 && pool.poolDayData[0].date === currentDayTimestamp;
          const vol1d = hasTodayData ? formatCurrency(pool.poolDayData[0].volumeUSD) : '$0.00';
          const fee1d = hasTodayData ? formatCurrency(pool.poolDayData[0].feesUSD) : '$0.00';
          const feePercent = (parseInt(pool.feeTier) / 10000).toFixed(2) + '%';
          const getCurrencyParam = (address: string) =>
            (address === '0' || address === '0x0000000000000000000000000000000000000000') ? 'NATIVE' : address;
          const addLiquidityPath = `/positions/create/currency0=${getCurrencyParam(pool.token0.id)}&currency1=${getCurrencyParam(pool.token1.id)}&fee=${pool.feeTier || ''}&tickSpacing=${pool.tickSpacing || ''}&hooks=${pool.hooks || '0x0000000000000000000000000000000000000000'}&poolId=${computedId}&sqrtPrice=${pool.sqrtPrice || '0'}`;

          const matchedHook = HOOKS_DETAILS.find(
            h => h.address.toLowerCase() === (pool.hooks || '').toLowerCase()
          );

          return (
            <div
              key={`m-${pool.id}`}
              onClick={() => navigate(`/pools/${computedId}`)}
              className="md:hidden flex flex-col gap-4 px-5 py-5 border-b border-white/[0.04] hover:bg-white/[0.03] transition-all last:border-0 cursor-pointer"
            >
              {/* Top row: logos + name + fee */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex -space-x-3 shrink-0">
                    {[img0, img1].map((img, i) => (
                      <div key={i} className="w-9 h-9 rounded-full border-2 border-black bg-black overflow-hidden">
                        {img ? <img alt="token" className="w-full h-full object-contain" src={img} /> : <div className="w-full h-full bg-white/10" />}
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-white">{pool.token0.symbol} / {pool.token1.symbol}</span>
                    <span className="text-[10px] bg-white/[0.06] border border-white/10 text-white/40 px-2 py-0.5 rounded-full">{feePercent}</span>
                    {matchedHook && (
                      <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider font-semibold max-w-[120px] truncate">
                        {matchedHook.name}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[11px] text-white/20 font-mono">#{index + 1}</span>
              </div>
              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                {[['TVL', tvlFormatted], ['1D Vol', vol1d], ['1D Fees', fee1d]].map(([label, val]) => (
                  <div key={label} className="bg-white/[0.03] rounded-xl p-3">
                    <p className="text-[9px] uppercase tracking-widest text-white/25 mb-1">{label}</p>
                    <p className="text-sm font-mono text-white/80">{val}</p>
                  </div>
                ))}
              </div>
              {/* Action */}
              <button
                onClick={(e) => { e.stopPropagation(); navigate(addLiquidityPath); }}
                className="w-full bg-primary text-black py-2.5 rounded-full text-[10px] font-bold uppercase tracking-wider gold-glow hover:brightness-110 active:scale-[0.98] cursor-pointer"
              >
                + Add Liquidity
              </button>
            </div>
          );
        })}

        {!loading && filteredPools.length === 0 && (
          <div className="py-20 text-center text-white/20 uppercase text-xs tracking-widest">
            No pools found
          </div>
        )}
      </div>
    </div>
  );
}
