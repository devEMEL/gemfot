import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  RefreshCw,
  Loader2,
  AlertTriangle,
  Search,
  Flame,
  Sparkles,
  BarChart3,
  Copy,
  Check,
} from 'lucide-react';

import { useLaunches, type EnrichedLaunch } from '@/hooks/useLaunches';
import { useVolume } from '@/hooks/useVolume';
import { CONTRACTS } from '@/config/networks';
import { countdown, fmtNative, progressPct, timeAgo } from '@/lib/format';

type Filter = 'all' | 'live' | 'trading';
type Sort = 'new' | 'raised' | 'progress';

function CopyTicker({ symbol }: { symbol: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        navigator.clipboard.writeText(symbol);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
      className="inline-flex items-center gap-1 text-[13px] font-medium text-black/40 hover:text-[#f60aa8] transition-colors"
    >
      ${symbol}
      {copied ? <Check size={11} className="text-[#f60aa8]" /> : <Copy size={11} />}
    </button>
  );
}

function LaunchBlock({ launch, index }: { launch: EnrichedLaunch; index: number }) {
  const pct = progressPct(launch.initialTokenFairLaunch, launch.remainingSupply);

  return (
    <Link
      to={`/token/${launch.memecoin}`}
      className="group flex items-center gap-4 bg-white rounded-2xl border border-black/[0.06] shadow-[0_2px_12px_rgba(15,17,21,0.06)] hover:shadow-[0_6px_20px_rgba(15,17,21,0.08)] transition-all duration-200 overflow-hidden animate-card-in p-3 sm:p-3.5"
      style={{ animationDelay: `${Math.min(index, 10) * 40}ms` }}
    >
      <div className="relative w-[72px] h-[72px] sm:w-[84px] sm:h-[84px] rounded-xl shrink-0 bg-[#f4f5f7] overflow-hidden">
        {launch.imageUrl ? (
          <img
            src={launch.imageUrl}
            alt={launch.name}
            className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#fce7f3] to-[#fdf2f8]">
            <span className="text-[22px] font-extrabold text-[#f60aa8]">
              {launch.symbol.slice(0, 2)}
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex items-center gap-2 flex-wrap">
            <h3 className="text-[15px] sm:text-[16px] font-extrabold tracking-tight text-black truncate">
              {launch.name}
            </h3>
            <CopyTicker symbol={launch.symbol} />
            <span className="text-[11px] font-medium text-black/30">
              {timeAgo(Number(launch.createdAtTimestamp))}
            </span>
          </div>
          {launch.isLive ? (
            <span className="chip chip-live shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#f60aa8] animate-blink" />
              {countdown(Number(launch.fairLaunchEndsAt))}
            </span>
          ) : (
            <span className="chip shrink-0">Trading</span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-black/35">
                Filled
              </span>
              <span className="text-[12px] font-extrabold text-[#f60aa8] tabular-nums">
                {pct.toFixed(1)}%
              </span>
            </div>
            <div className={`meter h-1.5 ${launch.isLive ? 'meter-live' : ''}`}>
              <span style={{ width: `${Math.min(Math.max(pct, 1), 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:gap-6 text-[13px]">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-black/35">Raised</span>
            <span className="font-extrabold text-black tabular-nums">{fmtNative(launch.revenue)}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-black/35">Target</span>
            <span className="font-extrabold text-black tabular-nums">{fmtNative(launch.targetMarketCap)}</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-black/35">Buys</span>
            <span className="font-extrabold text-black tabular-nums">{launch.buyCount}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function Explore() {
  const { launches, loading, error, refetch } = useLaunches();
  const { volume24h, volumeAllTime, trades24h } = useVolume();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('new');
  const [searchParams, setSearchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';

  const setQ = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set('q', value);
    else next.delete('q');
    setSearchParams(next, { replace: true });
  };
  const stats = useMemo(() => {
    const totalRaised = launches.reduce((acc, l) => acc + BigInt(l.revenue || '0'), 0n);
    const live = launches.filter((l) => l.isLive).length;
    return { totalRaised, live };
  }, [launches]);

  const visible = useMemo(() => {
    let list = launches;
    if (filter === 'live') list = list.filter((l) => l.isLive);
    if (filter === 'trading') list = list.filter((l) => !l.isLive);
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter(
        (l) =>
          l.name.toLowerCase().includes(needle) ||
          l.symbol.toLowerCase().includes(needle) ||
          l.memecoin.toLowerCase().includes(needle)
      );
    }
    const sorted = [...list];
    if (sort === 'new')
      sorted.sort((a, b) => Number(b.createdAtTimestamp) - Number(a.createdAtTimestamp));
    if (sort === 'raised')
      sorted.sort((a, b) => (BigInt(b.revenue || 0) > BigInt(a.revenue || 0) ? 1 : -1));
    if (sort === 'progress')
      sorted.sort(
        (a, b) =>
          progressPct(b.initialTokenFairLaunch, b.remainingSupply) -
          progressPct(a.initialTokenFairLaunch, a.remainingSupply)
      );
    return sorted;
  }, [launches, filter, sort, q]);

  const sortTabs: { key: Sort; label: string; icon: typeof Flame }[] = [
    { key: 'raised', label: 'Most raised', icon: Flame },
    { key: 'new', label: 'Newest', icon: Sparkles },
    { key: 'progress', label: 'Closest to fill', icon: BarChart3 },
  ];

  return (
    <div className="pt-[64px] min-h-screen">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Stats strip */}
        <div className="mb-8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="bg-white rounded-[20px] px-4 py-4 md:px-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(15,17,21,0.06)]">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.1em] text-black/35">
              Total raised
            </p>
            <p className="text-[18px] md:text-[22px] font-extrabold text-black tabular-nums mt-1.5 truncate">
              ${fmtNative(stats.totalRaised.toString())}
            </p>
            <p className="text-[11px] font-medium text-black/30 mt-1 hidden sm:block">
              {CONTRACTS.nativeTokenSymbol}
            </p>
          </div>
          <div className="bg-white rounded-[20px] px-4 py-4 md:px-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(15,17,21,0.06)]">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.1em] text-black/35">
              24hr volume
            </p>
            <p className="text-[18px] md:text-[22px] font-extrabold text-black tabular-nums mt-1.5 truncate">
              ${fmtNative(volume24h)}
            </p>
            <p className="text-[11px] font-medium text-black/30 mt-1 hidden sm:block">
              {trades24h} trade{trades24h === 1 ? '' : 's'}
            </p>
          </div>
          <div className="bg-white rounded-[20px] px-4 py-4 md:px-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(15,17,21,0.06)]">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.1em] text-black/35">
              Volume · all time
            </p>
            <p className="text-[18px] md:text-[22px] font-extrabold text-black tabular-nums mt-1.5 truncate">
              ${fmtNative(volumeAllTime)}
            </p>
            <p className="text-[11px] font-medium text-black/30 mt-1 hidden sm:block">Since genesis</p>
          </div>
          <div className="bg-white rounded-[20px] px-4 py-4 md:px-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(15,17,21,0.06)]">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.1em] text-[#f60aa8]/70">
              Live now
            </p>
            <p className="text-[18px] md:text-[22px] font-extrabold text-[#f60aa8] tabular-nums mt-1.5">
              {stats.live}
            </p>
            <p className="text-[11px] font-medium text-[#f60aa8]/50 mt-1 hidden sm:block">
              Curves still open
            </p>
          </div>
          <div className="bg-white rounded-[20px] px-4 py-4 md:px-5 border border-black/[0.06] shadow-[0_2px_12px_rgba(15,17,21,0.06)] col-span-2 sm:col-span-1">
            <p className="text-[10px] md:text-[11px] font-bold uppercase tracking-[0.1em] text-black/35">
              Launches
            </p>
            <p className="text-[18px] md:text-[22px] font-extrabold text-black tabular-nums mt-1.5">
              {launches.length}
            </p>
            <p className="text-[11px] font-medium text-black/30 mt-1 hidden sm:block">
              Tokens deployed
            </p>
          </div>
        </div>

        {/* Filter bar */}
        <div
          id="launches"
          className="flex flex-col lg:flex-row lg:items-center gap-3 mb-6 scroll-mt-24"
        >
          <div className="flex items-center gap-1.5 flex-wrap">
            {sortTabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setSort(key)}
                className={`inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full text-[13px] font-bold transition-all cursor-pointer ${
                  sort === key
                    ? 'bg-[#f60aa8] text-white shadow-[0_4px_14px_rgba(246,10,168,0.25)]'
                    : 'bg-white text-black/50 hover:text-black border border-black/[0.06]'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}

            <div className="seg h-9 ml-1">
              {(
                [
                  ['all', 'All'],
                  ['live', 'Live'],
                  ['trading', 'Trading'],
                ] as [Filter, string][]
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setFilter(key)}
                  data-active={filter === key}
                  className="h-full px-3.5"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 lg:ml-auto">
            <div className="relative flex-1 lg:w-[240px]">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/30 pointer-events-none"
              />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search name, ticker, address"
                className="input-field w-full h-9 pl-9 pr-3 text-[13px] !rounded-full"
              />
            </div>
            <button onClick={refetch} className="btn btn-soft h-9 w-9 !px-0" title="Refresh">
              <RefreshCw size={14} />
            </button>
            <span className="hidden sm:inline text-[12px] font-semibold text-black/30 tabular-nums">
              {visible.length}/{launches.length}
            </span>
          </div>
        </div>

        {loading && launches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 size={22} className="animate-spin text-[#f60aa8]" />
            <p className="text-[13px] font-semibold text-black/40">Loading launches…</p>
          </div>
        )}

        {error && launches.length === 0 && !loading && (
          <div className="bg-white rounded-[24px] p-10 shadow-[0_2px_12px_rgba(15,17,21,0.06)] flex flex-col items-center gap-4 text-center max-w-md mx-auto">
            <AlertTriangle size={22} className="text-red-500" />
            <p className="text-[16px] font-bold text-black">Couldn't reach the subgraph</p>
            <p className="text-[13px] text-black/45 break-words">{error}</p>
            <button onClick={refetch} className="btn btn-primary h-11 px-6 mt-1">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="bg-white rounded-[24px] p-16 shadow-[0_2px_12px_rgba(15,17,21,0.06)] flex flex-col items-center gap-4 text-center">
            <p className="text-[18px] font-extrabold tracking-tight text-black">
              {launches.length === 0 ? 'No launches yet' : 'Nothing matches that filter'}
            </p>
            <p className="text-black/50 text-[14px] max-w-[40ch]">
              {launches.length === 0
                ? 'Be the first to put a token on the curve.'
                : 'Try a different search term or filter.'}
            </p>
            <Link to="/launch" className="btn btn-primary h-12 px-8 mt-1">
              Launch a token
            </Link>
          </div>
        )}

        {visible.length > 0 && (
          <div className="flex flex-col gap-2.5 pb-12">
            {visible.map((l, i) => (
              <LaunchBlock key={l.id} launch={l} index={i} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
