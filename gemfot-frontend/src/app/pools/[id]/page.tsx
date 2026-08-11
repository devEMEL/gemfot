import { Link, useParams } from 'react-router-dom';
import { ArrowUp, ExternalLink, RefreshCw, Copy, Check, Cpu, Sparkles } from 'lucide-react';
import { useState, useEffect, useRef, useMemo } from 'react';
import { request } from 'graphql-request';
import { GET_POOL_BY_ID, GET_POOL_SWAPS, SUBGRAPH_ENDPOINT } from '../../../lib/queries';
import { TOKENS } from '../../../config/tokens';
import { HOOKS_DETAILS } from '../../../config/hooksDetail';
import { formatPrice, getDisplayPrice } from '@/utils';
import { createChart, ColorType, CandlestickSeries } from 'lightweight-charts';

const getPriceFromSqrt = (sqrtPriceStr: string, token0: any, token1: any) => {
  if (!token0 || !token1 || !sqrtPriceStr) return 0;
  const sqrtPrice = Number(sqrtPriceStr);
  const decimals0 = Number(token0.decimals);
  const decimals1 = Number(token1.decimals);
  
  const t0Price = Math.pow(sqrtPrice / Math.pow(2, 96), 2) * Math.pow(10, decimals0 - decimals1);
  
  const getPriority = (symbol: string) => {
    const sym = symbol.toUpperCase();
    if (sym === 'USDC') return 100;
    if (sym === 'EURC') return 90;
    if (sym === 'MUSDC') return 80;
    if (sym === 'USDT' || sym === 'DAI') return 70;
    if (sym === 'ETH' || sym === 'WETH') return 50;
    return 0;
  };
  
  const p0 = getPriority(token0.symbol);
  const p1 = getPriority(token1.symbol);
  
  if (p0 > p1) {
    return t0Price > 0 ? 1 / t0Price : 0;
  } else {
    return t0Price;
  }
};

export default function PoolDetailsPage() {
  const { id } = useParams();
  const [pool, setPool] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [swaps, setSwaps] = useState<any[]>([]);
  const [swapsPage, setSwapsPage] = useState(0);
  const [swapsLoading, setSwapsLoading] = useState(false);

  const [chartSwaps, setChartSwaps] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [copiedHookAddress, setCopiedHookAddress] = useState(false);

  const handleCopyPoolId = () => {
    if (!id) return;
    navigator.clipboard.writeText(id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const handleCopyHookAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedHookAddress(true);
    setTimeout(() => setCopiedHookAddress(false), 1500);
  };

  useEffect(() => {
    setSwapsPage(0);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const fetchPool = async () => {
      try {
        setLoading(true);
        const data: any = await request(SUBGRAPH_ENDPOINT, GET_POOL_BY_ID, { id: id.toLowerCase() });
        setPool(data.pool);
      } catch (error) {
        console.error('Error fetching pool details:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPool();
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const fetchSwaps = async () => {
      try {
        setSwapsLoading(true);
        const data: any = await request(SUBGRAPH_ENDPOINT, GET_POOL_SWAPS, {
          poolId: id.toLowerCase(),
          first: 11,
          skip: swapsPage * 10
        });
        setSwaps(data.swaps || []);
      } catch (error) {
        console.error('Error fetching swaps:', error);
      } finally {
        setSwapsLoading(false);
      }
    };
    fetchSwaps();
  }, [id, swapsPage]);

  useEffect(() => {
    if (!id) return;
    const fetchChartData = async () => {
      try {
        setChartLoading(true);
        const data: any = await request(SUBGRAPH_ENDPOINT, GET_POOL_SWAPS, {
          poolId: id.toLowerCase(),
          first: 100,
          skip: 0
        });
        setChartSwaps(data.swaps || []);
      } catch (error) {
        console.error('Error fetching chart swaps:', error);
      } finally {
        setChartLoading(false);
      }
    };
    fetchChartData();
  }, [id]);

  const reversedSwaps = [...chartSwaps].reverse();
  const pointsData = reversedSwaps.map((swap: any, idx: number) => {
    const price = getPriceFromSqrt(swap.sqrtPriceX96, pool?.token0, pool?.token1);
    const date = new Date(Number(swap.timestamp) * 1000);
    return {
      price,
      timestamp: Number(swap.timestamp),
      date,
      index: idx
    };
  });

  const currentPriceVal = pool ? getPriceFromSqrt(pool.sqrtPrice || '0', pool.token0, pool.token1) : 0;
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current || chartSwaps.length === 0 || !pool) return;

    const container = chartContainerRef.current;
    
    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: 'rgba(255, 255, 255, 0.4)',
        fontFamily: 'Outfit, sans-serif',
      },
      grid: {
        vertLines: { color: 'rgba(255, 255, 255, 0.02)' },
        horzLines: { color: 'rgba(255, 255, 255, 0.02)' },
      },
      rightPriceScale: {
        borderVisible: false,
        textColor: 'rgba(255, 255, 255, 0.4)',
      },
      timeScale: {
        borderVisible: false,
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        vertLine: {
          color: 'rgba(255,255,255,0.15)',
          width: 1,
          style: 3,
          labelVisible: false,
        },
        horzLine: {
          color: 'rgba(255,255,255,0.15)',
          width: 1,
          style: 3,
          labelVisible: false,
        },
      },
      handleScale: false,
      handleScroll: false,
      width: container.clientWidth || 500,
      height: container.clientHeight || 160,
    });

    const candlestickSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      priceFormat: {
        type: 'price',
        precision: 6,
        minMove: 0.000001,
      },
    });

    const chartData: { time: number; open: number; high: number; low: number; close: number }[] = [];
    let lastTime = 0;
    pointsData.forEach((pt, idx) => {
      let currentTime = pt.timestamp;
      if (currentTime <= lastTime) {
        currentTime = lastTime + 1;
      }
      
      const prevPrice = idx > 0 ? pointsData[idx - 1].price : pt.price;
      
      chartData.push({
        time: currentTime,
        open: prevPrice,
        high: Math.max(prevPrice, pt.price),
        low: Math.min(prevPrice, pt.price),
        close: pt.price,
      });
      lastTime = currentTime;
    });

    candlestickSeries.setData(chartData as any);
    chart.timeScale().fitContent();

    chart.subscribeCrosshairMove((param) => {
      if (!param.time) {
        setHoveredPoint(null);
      } else {
        const timeVal = Number(param.time);
        const pt = chartData.find((d) => d.time === timeVal);
        if (pt) {
          setHoveredPoint({
            price: pt.close,
            date: new Date(pt.time * 1000),
          });
        } else {
          setHoveredPoint(null);
        }
      }
    });

    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length === 0 || !entries[0].contentRect) return;
      const { width, height } = entries[0].contentRect;
      chart.applyOptions({ width, height });
      chart.timeScale().fitContent();
    });
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
    };
  }, [chartSwaps, pool]);

  const token0Address = pool?.token0?.id || "0x0000000000000000000000000000000000000000";
  const token1Address = pool?.token1?.id || "0x0000000000000000000000000000000000000000";

  const matchedHook = useMemo(() => {
    if (!pool?.hooks) return null;
    return HOOKS_DETAILS.find(
      h => h.address.toLowerCase() === pool.hooks.toLowerCase()
    ) || null;
  }, [pool]);

  const getCurrencyParam = (address: string) => {
    return (address === "0" || address === "0x0000000000000000000000000000000000000000") ? "NATIVE" : address;
  };

  const img0 = TOKENS.find(t => t.address.toLowerCase() === token0Address.toLowerCase())?.logo || '';
  const img1 = TOKENS.find(t => t.address.toLowerCase() === token1Address.toLowerCase())?.logo || '';

  const formatCurrency = (val: string | number | undefined) => {
    if (val === undefined || val === null || isNaN(Number(val))) return '$0.00';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: "compact" }).format(Number(val));
  };

  const currentDayStart = Math.floor(Date.now() / 1000 / 86400) * 86400;
  const sevenDaysAgo = currentDayStart - 86400 * 7;

  const latestDay = pool?.poolDayData?.[0];
  const isRecent24h = latestDay && Number(latestDay.date) >= currentDayStart - 86400;
  
  const vol24h = isRecent24h ? Number(latestDay.volumeUSD) : 0;
  const fees24h = isRecent24h ? Number(latestDay.feesUSD) : 0;

  const vol7d = pool?.poolDayData?.reduce((acc: number, day: any) => {
    return Number(day.date) >= sevenDaysAgo ? acc + Number(day.volumeUSD) : acc;
  }, 0) || 0;
  const fees7d = pool?.poolDayData?.reduce((acc: number, day: any) => {
    return Number(day.date) >= sevenDaysAgo ? acc + Number(day.feesUSD) : acc;
  }, 0) || 0;

  const feePercent = pool?.feeTier ? (Number(pool.feeTier) / 10000).toFixed(2) + '%' : '0.00%';

  const addLiquidityPath = `/positions/create/currency0=${getCurrencyParam(token0Address)}&currency1=${getCurrencyParam(token1Address)}&fee=${pool?.feeTier || ''}&tickSpacing=${pool?.tickSpacing || ''}&hooks=${pool?.hooks || '0x0000000000000000000000000000000000000000'}&poolId=${id}`;



  return (
    <div className="pb-40 relative z-10 flex flex-col items-center w-full">
      {/* Abstract Background Mesh specific to details */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 -z-10 w-full max-w-6xl h-full opacity-10 pointer-events-none flex justify-center">
        <div className="absolute top-0 right-1/4 w-[500px] h-[500px] bg-primary/20 blur-[150px] rounded-full"></div>
        <div className="absolute bottom-1/4 left-1/4 w-[400px] h-[400px] bg-primary/10 blur-[120px] rounded-full"></div>
      </div>

      <main className="w-full">
        {/* Header Section */}
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6 relative z-10">
          <div className="flex items-center gap-6">
            <div className="flex -space-x-4">
              <div className="w-16 h-16 rounded-full border-4 border-black overflow-hidden bg-black flex items-center justify-center relative z-[2]">
                {loading ? (
                  <div className="w-full h-full bg-white/5 animate-pulse" />
                ) : img0 ? (
                  <img className="w-full h-full object-contain" alt={pool?.token0?.symbol || 'token0'} src={img0} />
                ) : (
                  <div className="w-full h-full bg-white/10" />
                )}
              </div>
              <div className="w-16 h-16 rounded-full border-4 border-black overflow-hidden bg-black flex items-center justify-center relative z-[1]">
                {loading ? (
                  <div className="w-full h-full bg-white/5 animate-pulse" />
                ) : img1 ? (
                  <img className="w-full h-full object-contain" alt={pool?.token1?.symbol || 'token1'} src={img1} />
                ) : (
                  <div className="w-full h-full bg-white/10" />
                )}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-3">
                {loading ? (
                  <div className="h-9 w-48 bg-white/5 rounded animate-pulse" />
                ) : (
                  <>
                    <h1 className="text-3xl tracking-tighter text-white">
                      {pool?.token0?.symbol} / {pool?.token1?.symbol}
                    </h1>
                    <span className="bg-white/10 px-3 py-1 text-[12px] text-white/60">{feePercent} Fee</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-4 mt-2">
                {loading ? (
                  <div className="h-8 w-24 bg-white/5 rounded animate-pulse" />
                ) : (
                  <span className="text-3xl tracking-tighter text-white/60">
                     <span>{getDisplayPrice(pool)}</span>
                  </span>
                )}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[11px] text-white/20">Pool ID:</span>
                <span className="text-[12px] font-mono text-white/40">
                  {id ? `${id.slice(0, 10)}...${id.slice(-8)}` : 'UNKNOWN'}
                </span>
                {id && (
                  <button
                    onClick={handleCopyPoolId}
                    className="p-1 rounded hover:bg-white/10 transition-colors cursor-pointer text-white/40 hover:text-white flex items-center justify-center"
                    title="Copy Pool ID"
                  >
                    {copied ? (
                      <Check size={12} className="text-emerald-400" />
                    ) : (
                      <Copy size={12} />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-4 w-full md:w-auto">
            <Link 
              to={`/?from=${token0Address}&to=${token1Address}`}
              className="flex-1 md:flex-none border border-white/10 text-white px-8 py-3.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold flex items-center justify-center hover:bg-white/5 transition-all active:scale-[0.98]"
            >
              Swap
            </Link>
            <Link
              to={addLiquidityPath}
              className="flex-1 md:flex-none bg-primary text-black px-8 py-3.5 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold transition-all gold-glow hover:brightness-110 active:scale-[0.98] flex items-center justify-center text-center"
            >
              Add Liquidity
            </Link>
          </div>
        </header>

        {/* Metric Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-12">
          {[
            { label: '24h Volume', val: formatCurrency(vol24h) },
            { label: '7d Volume', val: formatCurrency(vol7d) },
            { label: 'All Time Volume', val: formatCurrency(pool?.volumeUSD) },
            { label: '24h Fees', val: formatCurrency(fees24h) },
            { label: '7d Fees', val: formatCurrency(fees7d) },
            { label: 'All Time Fees', val: formatCurrency(pool?.feesUSD) }
          ].map((m, i) => (
            <div
              key={i}
              className="relative rounded-2xl p-4 flex flex-col gap-3 overflow-hidden bg-white/[0.03] border border-white/[0.07] hover:border-white/15 transition-all duration-300 hover:scale-[1.02]"
            >
              <p className="text-[10px] tracking-[0.18em] text-white/30 leading-tight">{m.label}</p>
              {loading ? (
                <div className="h-7 w-20 bg-white/5 rounded-lg animate-pulse" />
              ) : (
                <p className="text-xl font-semibold tracking-tight leading-none text-white">{m.val}</p>
              )}
            </div>
          ))}
        </div>

        {/* Bento Grid for Analytics */}
        <div className="grid grid-cols-12 gap-6 mb-12">
          {/* Price Chart Module (The Monolith) */}
          <div className="col-span-12 lg:col-span-8 glass-morphism bg-white/[0.01] border border-white/5 p-6 relative overflow-hidden flex flex-col justify-between min-h-[300px]">
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-4">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] text-white/30">Price History</span>
                  {chartLoading && <RefreshCw size={12} className="text-white/30 animate-spin" />}
                </div>
                <div className="flex bg-black/40 border border-white/5 p-1 rounded-lg">
                  {/* <span className="text-[11px] text-primary px-2 py-0.5">Last 100 Swaps</span> */}
                </div>
              </div>

              {/* Display Hovered or Current Price */}
              <div className="mb-2">
                <p className="text-3xl tracking-tighter text-white">
                  {hoveredPoint ? (
                    `$${hoveredPoint.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                  ) : currentPriceVal ? (
                    `$${currentPriceVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
                  ) : (
                    '...'
                  )}
                </p>
                <p className="text-[12px] text-white/40 font-mono mt-1">
                  {hoveredPoint ? (
                    hoveredPoint.date.toLocaleString()
                  ) : (
                    ''
                  )}
                </p>
              </div>
            </div>

            {/* Chart Container */}
            <div className="relative flex-1 min-h-[160px] flex items-end">
              {chartLoading && chartSwaps.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-white/20 text-[12px] flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin text-primary" />
                    Loading Chart...
                  </div>
                </div>
              ) : chartSwaps.length === 0 ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-white/20 text-[12px]">
                    No swap history available
                  </div>
                </div>
              ) : (
                <div ref={chartContainerRef} className="w-full h-full" />
              )}
            </div>
          </div>

          {/* Stats Column */}
          <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
            {/* TVL Card */}
            <div className="glass-morphism bg-white/[0.01] border border-white/5 p-8 flex flex-col justify-center">
              <p className="text-[12px] text-white/30 mb-2">Total Value Locked</p>
              {loading ? (
                <div className="h-9 w-32 bg-white/5 rounded animate-pulse mt-1" />
              ) : (
                <p className="text-3xl tracking-tighter text-white inline-block">
                  {formatCurrency(pool?.totalValueLockedUSD)}
                </p>
              )}

              {/* Commented out the APR Section as requested */}
              {/*
              <div className="mt-6 pt-6 border-t border-white/5">
                <p className="text-[12px] text-white/30 mb-1">Total APR</p>
                <p className="text-3xl text-primary tracking-tight">24.8%</p>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full animate-pulse shadow-[0_0_10px_rgba(184,134,11,0.5)]"></span>
                <span className="text-[12px] text-white/40">Top 1% of Pools</span>
              </div>
              */}
            </div>

            {/* Pool Balances */}
            <div className="glass-morphism bg-white/[0.01] border border-white/5 p-6 border-l-[3px] border-l-primary">
              <p className="text-[12px] text-white/30 mb-4">Pool Balances</p>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border border-white/10 bg-black flex items-center justify-center overflow-hidden">
                      {img0 ? (
                        <img className="w-full h-full object-contain" alt={pool?.token0?.symbol || 'token0'} src={img0} />
                      ) : (
                        <div className="w-full h-full bg-white/10" />
                      )}
                    </div>
                    <span className="text-xs text-white">
                      {loading ? '...' : pool?.token0?.symbol}
                    </span>
                  </div>
                  <span className="text-sm font-mono text-white tracking-tight">
                    {loading ? '...' : Number(pool?.totalValueLockedToken0 || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full border border-white/10 bg-black flex items-center justify-center overflow-hidden">
                      {img1 ? (
                        <img className="w-full h-full object-contain" alt={pool?.token1?.symbol || 'token1'} src={img1} />
                      ) : (
                        <div className="w-full h-full bg-white/10" />
                      )}
                    </div>
                    <span className="text-xs text-white">
                      {loading ? '...' : pool?.token1?.symbol}
                    </span>
                  </div>
                  <span className="text-sm font-mono text-white tracking-tight">
                    {loading ? '...' : Number(pool?.totalValueLockedToken1 || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Active Hook Details Section */}
        {matchedHook && (
          <div className="glass-morphism border border-white/[0.08] bg-gradient-to-b from-white/[0.02] to-white/[0.01] rounded-2xl p-6 mb-12 relative overflow-hidden shadow-2xl animate-in fade-in duration-300">
            {/* Background Glow */}
            <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary/10 rounded-full blur-[60px] pointer-events-none"></div>

            <div className="flex items-center justify-between mb-4 border-b border-white/5 pb-3 relative z-10">
              <div className="flex items-center gap-2">
                <Cpu size={14} className="text-primary animate-pulse" />
                <span className="text-[10px] tracking-[0.2em] text-white/40 uppercase font-bold">
                  Active Hook Module
                </span>
              </div>
              <div className="bg-primary/10 border border-primary/20 text-primary px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-widest font-semibold font-mono z-10 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                Active
              </div>
            </div>

            <div className="relative z-10 space-y-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-primary shrink-0" />
                  <h4 className="text-lg font-bold text-white font-outfit">{matchedHook.name}</h4>
                </div>
                
                {/* Copyable Address */}
                <div className="flex items-center gap-2 bg-black/40 border border-white/[0.05] rounded-xl px-3 py-1.5 mt-2.5 max-w-md group hover:border-white/10 transition-colors">
                  <span className="text-[10px] font-outfit text-white/50 break-all select-all leading-normal uppercase">
                    {matchedHook.address}
                  </span>
                  <button
                    onClick={() => handleCopyHookAddress(matchedHook.address)}
                    className="shrink-0 p-1.5 rounded-md hover:bg-white/5 transition-colors cursor-pointer text-white/40 hover:text-white"
                    title="Copy Hook Address"
                  >
                    {copiedHookAddress ? (
                      <Check size={11} className="text-green-400" />
                    ) : (
                      <Copy size={11} className="opacity-60 group-hover:opacity-100 transition-opacity" />
                    )}
                  </button>
                </div>
              </div>

              <div className="bg-black/30 border border-white/[0.04] p-5 rounded-xl">
                <p className="text-xs text-white/60 leading-relaxed whitespace-pre-wrap font-outfit">{matchedHook.description}</p>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4 max-w-md">
                <div className="bg-white/[0.02] border border-white/[0.04] p-3 rounded-lg flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-widest text-white/30 font-semibold">Reward Type</span>
                  <span className="text-xs font-outfit font-semibold text-white/80">{matchedHook.rewardType}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Recent Swaps Table - Redesigned to match Profile Activity */}
        <section className="bg-white/[0.01] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
          <div className="p-8 flex justify-between items-center border-b border-white/5 bg-white/[0.02]">
            <h3 className="text-[20px] text-white">Recent Swaps</h3>
          </div>

          <div className="hidden md:grid grid-cols-[1fr_1.5fr_1fr_1.2fr_1.2fr_1fr] gap-4 px-8 py-6 text-[12px] tracking-[0.2em] text-white/30 border-b border-white/5 bg-white/[0.02]">
            <div>Time</div>
            <div>Type</div>
            <div>USD</div>
            <div>Token0 Amount</div>
            <div>Token1 Amount</div>
            <div className="text-right">Txn Hash</div>
          </div>

          <div className="divide-y divide-white/5">
            {loading || swapsLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr_1.2fr_1.2fr_1fr] gap-4 px-8 py-7 items-center border-b border-white/5 animate-pulse">
                  <div className="h-4 bg-white/5 rounded w-16" />
                  <div className="h-4 bg-white/5 rounded w-32" />
                  <div className="h-4 bg-white/5 rounded w-16" />
                  <div className="h-4 bg-white/5 rounded w-20" />
                  <div className="h-4 bg-white/5 rounded w-20" />
                  <div className="h-4 bg-white/5 rounded w-24 md:ml-auto" />
                </div>
              ))
            ) : swaps && swaps.length > 0 ? (
              swaps.slice(0, 10).map((row: any) => {
                const formattedTime = new Date(Number(row.timestamp) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                const typeText = `Swap ${Number(row.amount0) < 0 ? `${pool.token0.symbol} for ${pool.token1.symbol}` : `${pool.token1.symbol} for ${pool.token0.symbol}`}`;

                return (
                  <div key={row.id} className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr_1.2fr_1.2fr_1fr] gap-4 px-8 py-7 items-center hover:bg-white/[0.03] transition-all group cursor-pointer">
                    <div className="flex md:block justify-between items-center text-[12px] tracking-tight text-white/50">
                      <span className="md:hidden text-[11px] text-white/20">Time</span>
                      {formattedTime}
                    </div>

                    <div className="flex md:block justify-between items-center">
                      <span className="md:hidden text-[11px] text-white/20">Type</span>
                      <p className="text-xs text-white group-hover:text-primary transition-colors">{typeText}</p>
                    </div>

                    <div className="flex md:block justify-between items-center">
                      <span className="md:hidden text-[11px] text-white/20">USD</span>
                      <p className="text-xs text-white">{formatCurrency(row.amountUSD)}</p>
                    </div>

                    <div className="flex md:block justify-between items-center">
                      <span className="md:hidden text-[11px] text-white/20">Token0</span>
                      <p className={`text-[13px] tracking-tight ${Number(row.amount0) < 0 ? 'text-white/60' : 'text-primary'}`}>
                        {Number(row.amount0) < 0 ? '' : '+'}{Number(row.amount0).toFixed(4)} {pool.token0.symbol}
                      </p>
                    </div>

                    <div className="flex md:block justify-between items-center">
                      <span className="md:hidden text-[11px] text-white/20">Token1</span>
                      <p className={`text-[13px] tracking-tight ${Number(row.amount1) < 0 ? 'text-white/60' : 'text-primary'}`}>
                        {Number(row.amount1) < 0 ? '' : '+'}{Number(row.amount1).toFixed(4)} {pool.token1.symbol}
                      </p>
                    </div>

                    <div className="flex md:block justify-between items-center md:text-right">
                      <span className="md:hidden text-[11px] text-white/20">Txn Hash</span>
                      <a
                        href={`https://testnet.arcscan.app/tx/${row.transaction.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[12px] font-mono text-white/30 hover:text-primary transition-colors flex items-center justify-end gap-1.5 group/hash"
                      >
                        {row.transaction.id.slice(0, 6)}...{row.transaction.id.slice(-4)}
                        <ExternalLink size={10} className="text-primary/60 shrink-0" />
                      </a>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center text-white/20 text-xs opacity-50">
                No recent swaps found
              </div>
            )}
          </div>

          <div className="p-6 bg-white/[0.01] border-t border-white/5 flex items-center justify-between px-8">
            <span className="text-[12px] text-white/30">
              Page {swapsPage + 1}
            </span>
            <div className="flex gap-4">
              <button
                disabled={swapsPage === 0 || swapsLoading}
                onClick={() => setSwapsPage(prev => Math.max(0, prev - 1))}
                className="border border-white/10 text-white px-6 py-2.5 rounded-full text-[12px] tracking-[0.2em] hover:bg-white/5 transition-all disabled:opacity-30 disabled:pointer-events-none disabled:hover:bg-transparent active:scale-95 cursor-pointer"
              >
                Prev
              </button>
              <button
                disabled={swaps.length <= 10 || swapsLoading}
                onClick={() => setSwapsPage(prev => prev + 1)}
                className="border border-white/10 text-white px-6 py-2.5 rounded-full text-[12px] tracking-[0.2em] hover:bg-white/5 transition-all disabled:opacity-30 disabled:pointer-events-none disabled:hover:bg-transparent active:scale-95 cursor-pointer"
              >
                Next
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
