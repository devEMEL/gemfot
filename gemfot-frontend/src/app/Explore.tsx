import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Loader2, AlertTriangle, Search } from 'lucide-react';

import { useLaunches, type EnrichedLaunch } from '@/hooks/useLaunches';
import { useVolume } from '@/hooks/useVolume';
import { CONTRACTS } from '@/config/networks';
import { countdown, fmtNative, progressPct, timeAgo } from '@/lib/format';

type Filter = 'all' | 'live' | 'trading';
type Sort = 'new' | 'raised' | 'progress';

/* ------------------------------------------------------------------ bits -- */

function TokenAvatar({ launch, size = 44 }: { launch: EnrichedLaunch; size?: number }) {
  return (
    <div
      className="overflow-hidden border border-white/[0.08] shrink-0 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {launch.imageUrl ? (
        <img
          src={launch.imageUrl}
          alt={launch.symbol}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <span className="mono text-yellow-300 font-semibold text-[13px]">
          {launch.symbol.slice(0, 3).toUpperCase()}
        </span>
      )}
    </div>
  );
}

/** A stat cell in the top ledger strip. Square, hairline-ruled, mono numerals. */
function StatCell({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
}) {
  return (
    <div className="bg-black px-4 py-3.5 md:px-5 md:py-4 flex flex-col justify-between min-w-0">
      <span className="eyebrow">{label}</span>
      <div className="mt-2.5 flex items-baseline gap-1.5 min-w-0">
        <span className="num text-[21px] md:text-[25px] font-semibold leading-none truncate text-yellow-300">
          {value}
        </span>
        {unit && <span className="mono text-[11px] text-white/40 shrink-0">{unit}</span>}
      </div>
      {sub && <span className="mono text-[10px] text-white/30 mt-1.5 truncate">{sub}</span>}
    </div>
  );
}

function LaunchRow({ launch }: { launch: EnrichedLaunch }) {
  const pct = progressPct(launch.initialTokenFairLaunch, launch.remainingSupply);

  return (
    <Link
      to={`/token/${launch.memecoin}`}
      className="group bg-gradient-to-b from-white/[0.03] to-transparent border border-white/[0.06] p-4 flex flex-col gap-3.5 transition-all hover:border-yellow-400/30 hover:shadow-[4px_4px_0_0_rgba(255,210,23,0.2)] hover:-translate-x-0.5 hover:-translate-y-0.5 rounded-xl"
    >
      <div className="flex items-start gap-3">
        <TokenAvatar launch={launch} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-[15px] font-bold tracking-tight truncate text-white">{launch.name}</h3>
            <span className="mono text-[11px] text-white/40 shrink-0">{launch.symbol}</span>
          </div>
          <p className="mono text-[10px] text-white/30 mt-1">
            {timeAgo(Number(launch.createdAtTimestamp))}
          </p>
        </div>

        {launch.isLive ? (
          <span className="chip chip-live shrink-0">
            <span className="w-1 h-1 rounded-full bg-yellow-300 animate-blink" />
            {countdown(Number(launch.fairLaunchEndsAt))}
          </span>
        ) : (
          <span className="chip shrink-0">Trading</span>
        )}
      </div>

      {launch.description && (
        <p className="text-[13px] text-white/60 leading-snug line-clamp-2">{launch.description}</p>
      )}

      <div className="mt-auto">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="eyebrow">Curve filled</span>
          <span className="num text-[12px] font-semibold text-yellow-300">{pct.toFixed(1)}%</span>
        </div>
        <div className={`meter ${launch.isLive ? 'meter-live' : ''}`}>
          <span style={{ width: `${Math.min(Math.max(pct, 1), 100)}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 border-t border-white/[0.06] pt-3 -mx-4 px-4 gap-3">
        <div>
          <p className="eyebrow">Raised</p>
          <p className="num text-[14px] font-semibold text-white/90 mt-1">{fmtNative(launch.revenue)}</p>
        </div>
        <div className="border-l border-white/[0.06] pl-3">
          <p className="eyebrow">Target MC</p>
          <p className="num text-[14px] font-semibold text-white/90 mt-1">{fmtNative(launch.targetMarketCap)}</p>
        </div>
        <div className="border-l border-white/[0.06] pl-3">
          <p className="eyebrow">Buys</p>
          <p className="num text-[14px] font-semibold text-white/90 mt-1">{launch.buyCount}</p>
        </div>
      </div>
    </Link>
  );
}

/* ------------------------------------------------------------------ page -- */

export default function Explore() {
  const { launches, loading, error, refetch } = useLaunches();
  const { volume24h, volumeAllTime, trades24h } = useVolume();
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('new');
  const [q, setQ] = useState('');

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

  const ticker = launches.slice(0, 12);

  return (
    <div className="pt-[58px] min-h-screen bg-black text-white">
      {/* Ticker strip */}
      {ticker.length > 0 && (
        <div className="border-b border-white/[0.06] bg-black/60 overflow-hidden">
          <div className="flex whitespace-nowrap animate-marquee">
            {[...ticker, ...ticker].map((l, i) => (
              <span
                key={`${l.id}-${i}`}
                className="mono text-[11px] px-5 py-2 flex items-center gap-2 border-r border-white/5"
              >
                <span className="text-yellow-300">{l.symbol}</span>
                <span className="text-white/40">
                  {fmtNative(l.revenue)} {CONTRACTS.nativeTokenSymbol}
                </span>
                <span className="text-white/20">
                  {progressPct(l.initialTokenFairLaunch, l.remainingSupply).toFixed(0)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Stats ledger */}
      <section className="border-b border-white/[0.06] bg-black/40">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-white/[0.03] border-x border-white/[0.06]">
            <StatCell
              label="Volume · 24h"
              value={fmtNative(volume24h)}
              unit={CONTRACTS.nativeTokenSymbol}
              sub={`${trades24h} trade${trades24h === 1 ? '' : 's'}`}
            />
            <StatCell
              label="Volume · all time"
              value={fmtNative(volumeAllTime)}
              unit={CONTRACTS.nativeTokenSymbol}
              sub="Since genesis"
            />
            <StatCell
              label="Total raised"
              value={fmtNative(stats.totalRaised.toString())}
              unit={CONTRACTS.nativeTokenSymbol}
              sub="Across all curves"
            />
            <StatCell label="Live now" value={String(stats.live)} sub="Curves still open" />
            <StatCell
              label="Launches"
              value={String(launches.length)}
              sub="Tokens deployed"
            />
          </div>
        </div>
      </section>

      {/* Toolbar */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 pb-16">
        <div
          id="launches"
          className="flex flex-col lg:flex-row lg:items-center gap-3 py-6 border-b border-white/[0.06] scroll-mt-20"
        >
          <div className="mr-auto flex items-baseline gap-3">
            <h2 className="text-[20px] font-extrabold tracking-[-0.03em] text-white">Launches</h2>
            <span className="mono text-[11px] text-white/30">
              {String(visible.length).padStart(2, '0')} / {String(launches.length).padStart(2, '0')}
            </span>
          </div>

          <div className="relative flex-1 lg:max-w-[260px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 pointer-events-none"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, ticker, address"
              className="input-field w-full h-10 pl-9 pr-3 text-[13px]"
            />
          </div>

          <div className="seg h-10">
            {(
              [
                ['all', 'All'],
                ['live', 'Live'],
                ['trading', 'Trading'],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button key={key} onClick={() => setFilter(key)} data-active={filter === key}>
                {label}
              </button>
            ))}
          </div>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="input-field h-10 px-3 text-[13px] font-medium cursor-pointer"
          >
            <option value="new">Newest</option>
            <option value="raised">Most raised</option>
            <option value="progress">Closest to filling</option>
          </select>

          <button onClick={refetch} className="btn btn-soft h-10 w-10 !px-0" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

        {/* Loading */}
        {loading && launches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-28 gap-3">
            <Loader2 size={22} className="animate-spin text-white/20" />
            <p className="mono text-[11px] text-white/30 uppercase tracking-[0.16em]">
              Loading launches
            </p>
          </div>
        )}

        {error && launches.length === 0 && !loading && (
          <div className="border border-red-500/20 bg-red-500/[0.04] rounded-xl p-8 mt-8 flex flex-col items-center gap-3 text-center max-w-md mx-auto">
            <AlertTriangle size={22} className="text-red-400" />
            <p className="text-[16px] font-bold text-white">Couldn't reach the subgraph</p>
            <p className="mono text-[11px] text-white/50 break-words">{error}</p>
            <button onClick={refetch} className="btn btn-primary h-10 px-5 mt-2 yellow-gradient">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="border border-white/[0.06] bg-black/40 rounded-xl p-16 mt-8 flex flex-col items-center gap-4 text-center">
            <p className="text-[18px] font-extrabold tracking-tight text-white">
              {launches.length === 0 ? 'No launches yet' : 'Nothing matches that filter'}
            </p>
            <p className="text-white/60 text-[14px] max-w-[40ch]">
              {launches.length === 0
                ? 'Be the first to put a token on the curve.'
                : 'Try a different search term or filter.'}
            </p>
            <Link to="/launch" className="btn btn-primary h-11 px-6 mt-1 yellow-gradient">
              Launch a token
            </Link>
          </div>
        )}

        {visible.length > 0 && (
          <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 pt-6">
            {visible.map((l) => (
              <LaunchRow key={l.id} launch={l} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
