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
      className="overflow-hidden bg-gem-100 border border-ink/12 shrink-0 flex items-center justify-center"
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
        <span className="mono text-gem-800 font-semibold text-[13px]">
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
    <div className="bg-white px-4 py-3.5 md:px-5 md:py-4 flex flex-col justify-between min-w-0">
      <span className="eyebrow">{label}</span>
      <div className="mt-2.5 flex items-baseline gap-1.5 min-w-0">
        <span className="num text-[21px] md:text-[25px] font-semibold leading-none truncate">
          {value}
        </span>
        {unit && <span className="mono text-[11px] text-ink-mute shrink-0">{unit}</span>}
      </div>
      {sub && <span className="mono text-[10px] text-ink-mute mt-1.5 truncate">{sub}</span>}
    </div>
  );
}

function LaunchRow({ launch }: { launch: EnrichedLaunch }) {
  const pct = progressPct(launch.initialTokenFairLaunch, launch.remainingSupply);

  return (
    <Link
      to={`/token/${launch.memecoin}`}
      className="group bg-white border border-ink/12 p-4 flex flex-col gap-3.5 transition-all hover:border-ink hover:shadow-[4px_4px_0_0_#0d0f0c] hover:-translate-x-0.5 hover:-translate-y-0.5"
    >
      <div className="flex items-start gap-3">
        <TokenAvatar launch={launch} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-[15px] font-bold tracking-tight truncate">{launch.name}</h3>
            <span className="mono text-[11px] text-ink-mute shrink-0">{launch.symbol}</span>
          </div>
          <p className="mono text-[10px] text-ink-mute mt-1">
            {timeAgo(Number(launch.createdAtTimestamp))}
          </p>
        </div>

        {launch.isLive ? (
          <span className="chip chip-live shrink-0">
            <span className="w-1 h-1 bg-gem-700 animate-blink" />
            {countdown(Number(launch.fairLaunchEndsAt))}
          </span>
        ) : (
          <span className="chip shrink-0">Trading</span>
        )}
      </div>

      {launch.description && (
        <p className="text-[13px] text-ink-soft line-clamp-2 leading-snug">{launch.description}</p>
      )}

      <div className="mt-auto">
        <div className="flex items-baseline justify-between mb-1.5">
          <span className="eyebrow">Curve filled</span>
          <span className="num text-[12px] font-semibold">{pct.toFixed(1)}%</span>
        </div>
        <div className={`meter ${launch.isLive ? 'meter-live' : ''}`}>
          <span style={{ width: `${Math.min(Math.max(pct, 1), 100)}%` }} />
        </div>
      </div>

      <div className="grid grid-cols-3 border-t border-ink/12 pt-3 -mx-4 px-4 gap-3">
        <div>
          <p className="eyebrow">Raised</p>
          <p className="num text-[14px] font-semibold mt-1">{fmtNative(launch.revenue)}</p>
        </div>
        <div className="border-l border-ink/8 pl-3">
          <p className="eyebrow">Target MC</p>
          <p className="num text-[14px] font-semibold mt-1">{fmtNative(launch.targetMarketCap)}</p>
        </div>
        <div className="border-l border-ink/8 pl-3">
          <p className="eyebrow">Buys</p>
          <p className="num text-[14px] font-semibold mt-1">{launch.buyCount}</p>
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
    <div className="pt-[58px]">
      {/* ------------------------------------------------------- ticker -- */}
      {ticker.length > 0 && (
        <div className="border-b border-ink/12 bg-ink text-gem-50 overflow-hidden">
          <div className="flex whitespace-nowrap animate-marquee">
            {[...ticker, ...ticker].map((l, i) => (
              <span
                key={`${l.id}-${i}`}
                className="mono text-[11px] px-5 py-2 flex items-center gap-2 border-r border-white/10"
              >
                <span className="text-gem-300">{l.symbol}</span>
                <span className="text-gem-50/60">
                  {fmtNative(l.revenue)} {CONTRACTS.nativeTokenSymbol}
                </span>
                <span className="text-gem-50/35">
                  {progressPct(l.initialTokenFairLaunch, l.remainingSupply).toFixed(0)}%
                </span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------- hero -- */}
      {/* Hero temporarily disabled — uncomment to restore.
      <section className="border-b border-ink/12">

        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          <div className="grid lg:grid-cols-[1.35fr_1fr] gap-0 lg:divide-x lg:divide-ink/12">
            <div className="py-12 md:py-16 lg:pr-12">
              <span className="eyebrow">Fair launch protocol · Uniswap v4 on Arc</span>
              <h1 className="display text-[42px] md:text-[62px] mt-5 max-w-[13ch]">
                Memecoins that launch honestly.
              </h1>
              <p className="text-[15px] md:text-[16px] text-ink-soft mt-5 max-w-[52ch] leading-relaxed">
                Every token opens on a bonding curve — no pre-sale, no insider allocation. Fees
                stream back to creators, and a bid wall backstops the floor after the curve fills.
              </p>
              <div className="flex flex-wrap items-center gap-2.5 mt-8">
                <Link to="/launch" className="btn btn-primary h-11 px-6">
                  Launch a token
                </Link>
                <a href="#launches" className="btn btn-soft h-11 px-6">
                  Browse {launches.length} launches
                  <ArrowUpRight size={15} />
                </a>
              </div>
            </div>

            <div className="hidden lg:flex flex-col justify-center gap-0 divide-y divide-ink/12 py-4">
              {[
                ['01', 'Bonding curve', 'Price discovery from the first buy — no seeding required.'],
                ['02', 'Bid wall', 'Trading fees convert into a protective floor bid.'],
                ['03', 'Creator stream', 'A share of every swap fee routes to the creator forever.'],
              ].map(([n, title, body]) => (
                <div key={n} className="flex gap-5 py-5 pl-12">
                  <span className="mono text-[10px] text-ink-mute pt-1">{n}</span>
                  <div>
                    <p className="text-[14px] font-bold tracking-tight">{title}</p>
                    <p className="text-[13px] text-ink-soft mt-1 leading-snug max-w-[38ch]">
                      {body}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
      */}

      {/* -------------------------------------------------------- stats -- */}

      <section className="border-b border-ink/12 bg-ink/[0.04]">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-ink/12 border-x border-ink/12">
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

      {/* ------------------------------------------------------ toolbar -- */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 pb-16">
        <div
          id="launches"
          className="flex flex-col lg:flex-row lg:items-center gap-3 py-6 border-b border-ink/12 scroll-mt-20"
        >
          <div className="mr-auto flex items-baseline gap-3">
            <h2 className="text-[20px] font-extrabold tracking-[-0.03em]">Launches</h2>
            <span className="mono text-[11px] text-ink-mute">
              {String(visible.length).padStart(2, '0')} / {String(launches.length).padStart(2, '0')}
            </span>
          </div>

          <div className="relative flex-1 lg:max-w-[260px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute pointer-events-none"
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

        {/* --------------------------------------------------------- list -- */}
        {loading && launches.length === 0 && (
          <div className="flex flex-col items-center justify-center py-28 gap-3">
            <Loader2 size={22} className="animate-spin text-ink-mute" />
            <p className="mono text-[11px] text-ink-mute uppercase tracking-[0.16em]">
              Loading launches
            </p>
          </div>
        )}

        {error && launches.length === 0 && !loading && (
          <div className="card hatch p-12 mt-8 flex flex-col items-center gap-3 text-center">
            <AlertTriangle size={22} className="text-danger" />
            <p className="text-[16px] font-bold">Couldn't reach the subgraph</p>
            <p className="mono text-[11px] text-ink-mute max-w-sm break-words">{error}</p>
            <button onClick={refetch} className="btn btn-soft h-10 px-5 mt-2">
              Try again
            </button>
          </div>
        )}

        {!loading && !error && visible.length === 0 && (
          <div className="card hatch p-16 mt-8 flex flex-col items-center gap-4 text-center">
            <p className="text-[18px] font-extrabold tracking-tight">
              {launches.length === 0 ? 'No launches yet' : 'Nothing matches that filter'}
            </p>
            <p className="text-ink-soft text-[14px] max-w-[40ch]">
              {launches.length === 0
                ? 'Be the first to put a token on the curve.'
                : 'Try a different search term or filter.'}
            </p>
            <Link to="/launch" className="btn btn-primary h-11 px-6 mt-1">
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
