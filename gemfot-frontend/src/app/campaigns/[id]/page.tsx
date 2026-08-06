import { useLocation, useParams, Link } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { ethers, formatUnits } from 'ethers';
import {
  Trophy, Zap, ChevronLeft,
  Crown, Circle, RefreshCw, Medal, User,
} from 'lucide-react';
import { useConnection } from 'wagmi';
import { campaigns, type HookCampaign, type PoolKey } from '../../../config/hooksDetail';
import { TOKENS } from '../../../config/tokens';
import {
  GET_POINTS_LEADERBOARD,
  fetchPointsHookSubgraph,
} from '../../../lib/queries';

// ── helpers ───────────────────────────────────────────────────────────────────

const NATIVE = '0x0000000000000000000000000000000000000000';

function getToken(address: string) {
  if (address.toLowerCase() === NATIVE.toLowerCase())
    return { symbol: 'ETH', logo: '/assets/eth.png' };
  return TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase()) ?? null;
}

function computePoolId(pk: PoolKey): string {
  const enc = ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'address', 'uint24', 'int24', 'address'],
    [pk.currency0, pk.currency1, pk.fee, pk.tickSpacing, pk.hooks]
  );
  return ethers.keccak256(enc);
}

function formatPoints(raw: string | bigint): string {
  const val = typeof raw === 'string' ? BigInt(raw) : raw;
  return Number(formatUnits(val, 15)).toFixed(3);
}

function timeAgo(ts: string | number): string {
  const diff = Math.floor(Date.now() / 1000) - Number(ts);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function shortAddr(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

// ── Tab label ─────────────────────────────────────────────────────────────────

function PoolTabLabel({ pk }: { pk: PoolKey }) {
  const t0 = getToken(pk.currency0);
  const t1 = getToken(pk.currency1);
  return (
    <div className="flex items-center gap-2">
      <div className="flex -space-x-1.5">
        {[t0, t1].map((tk, i) => (
          <div key={i} className="w-5 h-5 rounded-full border border-black bg-black overflow-hidden">
            {tk?.logo
              ? <img src={tk.logo} alt={tk?.symbol} className="w-full h-full object-contain" />
              : <div className="w-full h-full bg-white/20" />}
          </div>
        ))}
      </div>
      <span className="font-medium text-sm">
        {t0?.symbol ?? '??'}/{t1?.symbol ?? '??'}
      </span>
      <span className="text-[10px] text-white/30">{(pk.fee / 10000).toFixed(2)}%</span>
    </div>
  );
}

// ── Leaderboard panel ─────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

function LeaderboardPanel({
  pk,
  connectedAddress,
}: {
  pk: PoolKey;
  connectedAddress?: string;
}) {
  const poolId = useMemo(() => computePoolId(pk), [pk]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setRows([]);
    
    let decimalTokenId = '0';
    try {
      decimalTokenId = BigInt(poolId).toString();
    } catch (e) {
      console.error('Failed to parse poolId as BigInt:', poolId, e);
    }

    fetchPointsHookSubgraph<any>(GET_POINTS_LEADERBOARD, {
      tokenId: decimalTokenId,
      first: PAGE_SIZE + 1,
      skip: page * PAGE_SIZE,
    })
      .then(data => {
        if (cancelled) return;
        const fetched: any[] = data?.pointsBalances ?? [];
        console.log("Fetched points: ", fetched.length);
        setHasMore(fetched.length > PAGE_SIZE);
        setRows(fetched.slice(0, PAGE_SIZE));
      })
      .catch(console.error)
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [poolId, page]);

  const userEntry = useMemo(() => {
    if (!connectedAddress) return null;
    return rows.find(r => r.owner.toLowerCase() === connectedAddress.toLowerCase()) ?? null;
  }, [rows, connectedAddress]);

  const userRank = useMemo(() => {
    if (!connectedAddress) return null;
    const idx = rows.findIndex(r => r.owner.toLowerCase() === connectedAddress.toLowerCase());
    return idx >= 0 ? page * PAGE_SIZE + idx + 1 : null;
  }, [rows, connectedAddress, page]);

  return (
    <div className="flex flex-col gap-4">
      {/* Pool ID sub-line */}
      <p className="text-[11px] font-mono text-white/20">
        Pool&nbsp;ID:&nbsp;{poolId.slice(0, 14)}…{poolId.slice(-8)}
        <Link
          to={`/pools/${poolId}`}
          className="ml-3 text-white/30 hover:text-primary transition-colors underline underline-offset-2"
        >
          View pool ↗
        </Link>
      </p>

      {/* User banner */}
      {connectedAddress && userEntry && (
        <div className="rounded-xl bg-primary/5 border border-primary/20 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-white/70">
            <User size={14} className="text-primary" />
            Your position
          </div>
          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[10px] text-white/30 uppercase tracking-widest">Rank</p>
              <p className="text-primary font-bold">#{userRank ?? '—'}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/30 uppercase tracking-widest">Points</p>
              <p className="text-white font-mono font-semibold">{formatPoints(userEntry.balance)}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] text-white/30 uppercase tracking-widest">Since</p>
              <p className="text-white/50 text-xs">
                {userEntry.transfers?.[0] ? timeAgo(userEntry.transfers[0].timestamp) : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.07] overflow-hidden bg-white/[0.01]">
        {/* Header */}
        <div className="hidden md:grid grid-cols-[44px_1fr_1fr_1fr_140px] gap-4 px-6 py-3 text-[10px] uppercase tracking-widest text-white/20 border-b border-white/[0.06] bg-white/[0.02]">
          <div>#</div>
          <div>Address</div>
          <div className="text-right">Points</div>
          <div className="text-right">Since</div>
          <div className="text-right">Token ID</div>
        </div>

        <div className="divide-y divide-white/[0.04]">
          {loading ? (
            Array(5).fill(0).map((_, i) => (
              <div key={i} className="grid grid-cols-[44px_1fr_1fr_1fr_140px] gap-4 px-6 py-4 animate-pulse">
                <div className="h-4 w-5 bg-white/5 rounded" />
                <div className="h-4 w-36 bg-white/5 rounded" />
                <div className="h-4 w-24 bg-white/5 rounded ml-auto" />
                <div className="h-4 w-20 bg-white/5 rounded ml-auto" />
                <div className="h-4 w-20 bg-white/5 rounded ml-auto" />
              </div>
            ))
          ) : rows.length === 0 ? (
            <div className="py-16 text-center text-white/20 text-xs uppercase tracking-widest">
              No participants yet
            </div>
          ) : (
            rows.map((row, i) => {
              const rank = page * PAGE_SIZE + i + 1;
              const isUser = !!connectedAddress && row.owner.toLowerCase() === connectedAddress.toLowerCase();
              const rankIcon =
                rank === 1 ? <Crown size={14} className="text-yellow-400" /> :
                rank === 2 ? <Medal size={14} className="text-slate-300" /> :
                rank === 3 ? <Medal size={14} className="text-amber-600" /> :
                <span className="text-white/25 font-mono text-xs">{rank}</span>;

              return (
                <div
                  key={row.id}
                  className={`grid grid-cols-1 md:grid-cols-[44px_1fr_1fr_1fr_140px] gap-3 px-6 py-4 items-center transition-all
                    ${isUser ? 'bg-primary/[0.04] border-l-2 border-primary' : 'hover:bg-white/[0.02]'}`}
                >
                  <div className="hidden md:flex items-center justify-center">{rankIcon}</div>

                  <div className="flex items-center gap-2">
                    {isUser && (
                      <span className="text-[9px] uppercase tracking-widest bg-primary/15 text-primary px-2 py-0.5 rounded-full font-bold">You</span>
                    )}
                    <span className="font-mono text-sm text-white/55">{shortAddr(row.owner)}</span>
                  </div>

                  <div className="flex md:block justify-between items-center">
                    <span className="md:hidden text-[10px] text-white/20 uppercase">Points</span>
                    <span className="text-sm font-mono text-white font-semibold md:text-right md:block">
                      {formatPoints(row.balance)}
                    </span>
                  </div>

                  <div className="flex md:block justify-between items-center">
                    <span className="md:hidden text-[10px] text-white/20 uppercase">Since</span>
                    <span className="text-sm text-white/40 md:text-right md:block">
                      {row.transfers?.[0] ? timeAgo(row.transfers[0].timestamp) : '—'}
                    </span>
                  </div>

                  <div className="flex md:block justify-between items-center">
                    <span className="md:hidden text-[10px] text-white/20 uppercase">Token ID</span>
                    <span className="text-xs font-mono text-white/20 md:text-right md:block">
                      {row.tokenId.length > 12 ? `${row.tokenId.slice(0, 12)}…` : row.tokenId}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-white/[0.05] flex items-center justify-between bg-white/[0.01]">
          <span className="text-xs text-white/25">Page {page + 1}</span>
          <div className="flex gap-3">
            <button
              disabled={page === 0 || loading}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              className="border border-white/10 text-white px-5 py-1.5 rounded-full text-xs hover:bg-white/5 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              Prev
            </button>
            <button
              disabled={!hasMore || loading}
              onClick={() => setPage(p => p + 1)}
              className="border border-white/10 text-white px-5 py-1.5 rounded-full text-xs hover:bg-white/5 transition-all disabled:opacity-30 disabled:pointer-events-none cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { address: connectedAddress } = useConnection();
  const [activeTab, setActiveTab] = useState(0);

  const campaign: HookCampaign | null = useMemo(() => {
    const st = location.state as any;
    if (st?.campaign) return st.campaign as HookCampaign;
    const idx = parseInt(id ?? '', 10);
    if (isNaN(idx)) return null;
    return campaigns[idx] ?? null;
  }, [id, location.state]);

  if (!campaign) {
    return (
      <div className="flex items-center justify-center py-40 text-white/30 text-sm">
        Campaign not found.
      </div>
    );
  }

  return (
    <div className="pb-40 relative z-10 w-full">
      {/* Background blob */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 -z-10 w-full max-w-6xl h-full pointer-events-none">
        <div className="absolute top-20 right-1/4 w-[500px] h-[500px] bg-primary/8 blur-[140px] rounded-full opacity-25" />
      </div>

      {/* Back */}
      <Link to="/campaigns" className="inline-flex items-center gap-2 text-white/40 hover:text-white/80 text-sm mb-8 transition-colors group">
        <ChevronLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
        All Campaigns
      </Link>

      {/* ── Header ── */}
      <header className="mb-10">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Zap size={22} className="text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl tracking-tighter text-white">{campaign.name}</h1>
              <span className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold border ${
                campaign.active
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                  : 'bg-white/[0.04] border-white/10 text-white/30'
              }`}>
                <Circle size={6} className={campaign.active ? 'fill-emerald-400 text-emerald-400' : 'fill-white/30 text-white/30'} />
                {campaign.active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-white/40 text-sm mt-1">{campaign.description.split('\n')[0]}</p>
          </div>
        </div>

        {/* Meta cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { label: 'Reward Type', value: campaign.rewardType },
            { label: 'Hook Address', value: shortAddr(campaign.address), mono: true },
            { label: 'Pools', value: `${campaign.poolKeys.length} incentivised` },
          ].map((m, i) => (
            <div key={i} className="rounded-xl bg-white/[0.03] border border-white/[0.07] p-4 flex flex-col gap-1">
              <span className="text-[10px] uppercase tracking-widest text-white/25">{m.label}</span>
              <span className={`text-sm font-semibold ${m.mono ? 'font-mono text-white/55' : 'text-white/80'}`}>
                {m.value}
              </span>
            </div>
          ))}
        </div>
      </header>

      {/* ── Leaderboard tabs ── */}
      <section>
        <div className="flex items-center gap-2 mb-5">
          <Trophy size={16} className="text-primary" />
          <h2 className="text-white font-semibold text-lg tracking-tight">Leaderboard</h2>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 p-1 bg-white/[0.03] border border-white/[0.07] rounded-xl mb-6 w-fit flex-wrap">
          {campaign.poolKeys.map((pk, i) => {
            const t0 = getToken(pk.currency0);
            const t1 = getToken(pk.currency1);
            const isActive = activeTab === i;
            return (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer ${
                  isActive
                    ? 'bg-primary text-black shadow-sm'
                    : 'text-white/40 hover:text-white/80 hover:bg-white/[0.04]'
                }`}
              >
                {/* Token pair avatars */}
                <div className="flex -space-x-1.5">
                  {[t0, t1].map((tk, j) => (
                    <div key={j} className="w-5 h-5 rounded-full border border-black bg-black overflow-hidden">
                      {tk?.logo
                        ? <img src={tk.logo} alt={tk?.symbol} className="w-full h-full object-contain" />
                        : <div className="w-full h-full bg-white/20" />}
                    </div>
                  ))}
                </div>
                <span>{t0?.symbol ?? '??'}/{t1?.symbol ?? '??'}</span>
                <span className={`text-[10px] ${isActive ? 'text-black/50' : 'text-white/25'}`}>
                  {(pk.fee / 10000).toFixed(2)}%
                </span>
              </button>
            );
          })}
        </div>

        {/* Active panel */}
        {campaign.poolKeys[activeTab] && (
          <LeaderboardPanel
            key={activeTab}
            pk={campaign.poolKeys[activeTab]}
            connectedAddress={connectedAddress}
          />
        )}
      </section>
    </div>
  );
}
