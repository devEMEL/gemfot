import { Link } from 'react-router-dom';
import { ethers } from 'ethers';
import { Trophy, Zap, ArrowRight, Circle, Layers } from 'lucide-react';
import { campaigns, type HookCampaign, type PoolKey } from '../../config/hooksDetail';
import { TOKENS } from '../../config/tokens';

function computePoolId(pk: PoolKey): string {
  const enc = ethers.AbiCoder.defaultAbiCoder().encode(
    ['address', 'address', 'uint24', 'int24', 'address'],
    [pk.currency0, pk.currency1, pk.fee, pk.tickSpacing, pk.hooks]
  );
  return ethers.keccak256(enc);
}

const NATIVE = '0x0000000000000000000000000000000000000000';

function getToken(address: string) {
  if (address.toLowerCase() === NATIVE.toLowerCase()) {
    return { symbol: 'ETH', logo: '/assets/eth.png' };
  }
  return TOKENS.find(t => t.address.toLowerCase() === address.toLowerCase()) ?? null;
}

function PoolPill({ pk }: { pk: PoolKey }) {
  const t0 = getToken(pk.currency0);
  const t1 = getToken(pk.currency1);
  return (
    <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.07] rounded-full px-2.5 py-1">
      <div className="flex -space-x-1.5">
        {[t0, t1].map((tk, i) => (
          <div key={i} className="w-4 h-4 rounded-full border border-black bg-black overflow-hidden">
            {tk?.logo
              ? <img src={tk.logo} alt={tk.symbol} className="w-full h-full object-contain" />
              : <div className="w-full h-full bg-white/20" />}
          </div>
        ))}
      </div>
      <span className="text-[11px] text-white/60 font-medium">
        {t0?.symbol ?? '??'}/{t1?.symbol ?? '??'}
      </span>
      <span className="text-[10px] text-white/25">·</span>
      <span className="text-[10px] text-white/35">{(pk.fee / 10000).toFixed(2)}%</span>
    </div>
  );
}

export default function CampaignsPage() {
  return (
    <div className="pb-40 relative z-10 w-full">
      {/* Background blobs */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 -z-10 w-full max-w-6xl h-full pointer-events-none">
        <div className="absolute top-20 right-1/4 w-[400px] h-[400px] bg-primary/10 blur-[130px] rounded-full opacity-40" />
        <div className="absolute bottom-1/3 left-1/3 w-[300px] h-[300px] bg-purple-500/8 blur-[100px] rounded-full opacity-30" />
      </div>

      {/* Header */}
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Trophy size={16} className="text-primary" />
          </div>
          <h1 className="text-3xl tracking-tighter text-white">Campaigns</h1>
        </div>
        <p className="text-white/40 text-sm max-w-lg leading-relaxed">
          Earn on-chain rewards by swapping in incentivised pools. Points are minted as
          ERC-1155 tokens directly to your wallet.
        </p>
      </header>

      {campaigns.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-white/20">
          <Trophy size={36} className="mb-4 opacity-30" />
          <p className="text-sm uppercase tracking-widest">No campaigns yet</p>
        </div>
      ) : campaigns.length === 1 ? (
        (() => {
          const c = campaigns[0];
          return (
            <Link
              to="/campaigns/0"
              state={{ campaign: c, idx: 0 }}
              className="group relative block rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.14] transition-all duration-300 overflow-hidden"
            >
              {/* Top accent */}
              <div className={`h-[3px] w-full ${c.active ? 'bg-gradient-to-r from-primary/80 via-primary to-primary/40' : 'bg-white/10'}`} />

              <div className="p-6 md:p-8 flex flex-col md:grid md:grid-cols-[1fr_360px] gap-8">
                {/* Left Side: Info & Description */}
                <div className="flex flex-col gap-6">
                  {/* Name + Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                        <Zap size={20} className="text-primary" />
                      </div>
                      <div>
                        <h2 className="text-white font-bold text-lg tracking-tight">{c.name}</h2>
                        <p className="text-white/30 text-[11px] tracking-wide uppercase mt-0.5">{c.rewardType}</p>
                      </div>
                    </div>
                    <span className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold border ${
                      c.active
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                        : 'bg-white/[0.04] border-white/10 text-white/30'
                    }`}>
                      <Circle size={6} className={c.active ? 'fill-emerald-400 text-emerald-400' : 'fill-white/30 text-white/30'} />
                      {c.active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Description */}
                  <div className="space-y-3 text-white/50 text-[13.5px] leading-relaxed max-w-2xl">
                    {c.description.split('\n\n').map((para, pIdx) => (
                      <p key={pIdx}>{para}</p>
                    ))}
                  </div>

                  {/* CTA */}
                  <div className="mt-auto pt-6 border-t border-white/[0.05] flex items-center justify-between">
                    <span className="text-[12px] text-white/35">View leaderboards, rules & recent rewards</span>
                    <div className="flex items-center gap-2 text-primary font-medium text-xs">
                      <span>Enter Campaign</span>
                      <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-all">
                        <ArrowRight size={13} className="text-primary" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Pools list & Hook details */}
                <div className="flex flex-col gap-5 justify-between bg-black/20 border border-white/[0.04] rounded-xl p-5">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <Layers size={13} className="text-white/20" />
                      <span className="text-[10px] uppercase tracking-widest text-white/20 font-bold">
                        Incentivised Pools ({c.poolKeys.length})
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 max-h-[180px] overflow-y-auto pr-1">
                      {c.poolKeys.map((pk, pi) => (
                        <div key={pi} className="flex">
                          <PoolPill pk={pk} />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-3 pt-4 border-t border-white/[0.05]">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-white/20 uppercase tracking-widest text-[9px] font-bold">Contract</span>
                      <span className="font-mono text-white/40">
                        {c.address.slice(0, 12)}…{c.address.slice(-8)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })()
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {campaigns.map((c: HookCampaign, idx: number) => (
            <Link
              key={idx}
              to={`/campaigns/${idx}`}
              state={{ campaign: c, idx }}
              className="group relative rounded-2xl border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/[0.14] transition-all duration-300 overflow-hidden flex flex-col"
            >
              {/* Top accent */}
              <div className={`h-[3px] w-full ${c.active ? 'bg-gradient-to-r from-primary/80 via-primary to-primary/40' : 'bg-white/10'}`} />

              <div className="p-6 flex flex-col gap-5 flex-1">
                {/* Name + status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                      <Zap size={16} className="text-primary" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-[15px] tracking-tight">{c.name}</p>
                      <p className="text-white/30 text-[11px] tracking-wide uppercase">{c.rewardType}</p>
                    </div>
                  </div>
                  <span className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold border ${
                    c.active
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
                      : 'bg-white/[0.04] border-white/10 text-white/30'
                  }`}>
                    <Circle size={6} className={c.active ? 'fill-emerald-400 text-emerald-400' : 'fill-white/30 text-white/30'} />
                    {c.active ? 'Active' : 'Inactive'}
                  </span>
                </div>

                {/* Description */}
                <p className="text-white/45 text-[13px] leading-relaxed line-clamp-2">
                  {c.description.split('\n')[0]}
                </p>

                {/* Pool pills */}
                <div className="bg-black/30 border border-white/[0.05] rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Layers size={12} className="text-white/25" />
                    <p className="text-[10px] uppercase tracking-widest text-white/25 font-semibold">
                      {c.poolKeys.length} Incentivised Pool{c.poolKeys.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {c.poolKeys.map((pk, pi) => (
                      <PoolPill key={pi} pk={pk} />
                    ))}
                  </div>
                </div>

                {/* Hook address */}
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-white/25 uppercase tracking-widest text-[10px]">Hook</span>
                  <span className="font-mono text-white/35">
                    {c.address.slice(0, 10)}…{c.address.slice(-6)}
                  </span>
                </div>

                {/* CTA */}
                <div className="mt-auto flex items-center justify-between pt-2 border-t border-white/[0.05]">
                  <span className="text-[12px] text-white/30">View leaderboards & rewards</span>
                  <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/20 transition-all">
                    <ArrowRight size={13} className="text-primary" />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
