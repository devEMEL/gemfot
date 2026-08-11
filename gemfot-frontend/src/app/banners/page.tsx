"use client";

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, Share2, Copy, Check, Shield, Layers, HelpCircle, AlertCircle, Compass, Users, BarChart3 } from 'lucide-react';

export default function BannersPage() {
  const [copiedLink, setCopiedLink] = useState(false);
  const [activeTab, setActiveTab] = useState<'hero' | 'horizontal' | 'card'>('hero');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.origin + '/campaigns/0');
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const campaignLink = '/campaigns/0';

  // Embed codes for the different banner formats
  const embedCodes = {
    hero: `<iframe src="${window.location.origin}/banners?embed=hero" width="800" height="400" frameborder="0"></iframe>`,
    horizontal: `<iframe src="${window.location.origin}/banners?embed=horizontal" width="728" height="90" frameborder="0"></iframe>`,
    card: `<iframe src="${window.location.origin}/banners?embed=card" width="360" height="480" frameborder="0"></iframe>`,
  };

  return (
    <div className="pb-40 relative z-10 w-full min-h-screen">
      {/* Background radial glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 -z-10 w-full max-w-6xl h-full pointer-events-none">
        <div className="absolute top-10 right-1/4 w-[500px] h-[500px] bg-primary/5 blur-[140px] rounded-full opacity-35" />
        <div className="absolute bottom-1/3 left-1/4 w-[400px] h-[400px] bg-blue-500/5 blur-[120px] rounded-full opacity-25" />
      </div>
    

      {/* Header */}
      <header className="mb-12">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Compass size={16} className="text-primary" />
          </div>
          <h1 className="text-3xl tracking-tighter text-white">Campaign Banners</h1>
        </div>
        <p className="text-white/40 text-sm max-w-lg leading-relaxed">
          Partnership assets for the mlSwap x ArcLens campaign. Select a banner format to review or copy embed code.
        </p>
      </header>

      {/* Stat Section */}
      <div className="mb-12 p-6 bg-neutral-950/60 border border-white/[0.06] rounded-2xl">
        <div className="flex items-center gap-3 mb-5">
          <BarChart3 size={20} className="text-primary" />
          <h2 className="text-xl font-semibold text-white">mlSwap Community Stats</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Stats Cards */}
          <div className="space-y-3">
            {[
              { name: 'Swappers', value: '174' },
              { name: 'Swaps', value: '10,667' },
              { name: 'Liquidity Providers', value: '45' },
              { name: 'Position Owners', value: '42' },
            ].map((stat) => (
              <div
                key={stat.name}
                className="flex items-center justify-between p-3 bg-black/30 border border-white/[0.04] rounded-xl"
              >
                <div className="flex items-center gap-3">
                  <Users size={16} className="text-primary" />
                  <span className="text-sm text-white/70">{stat.name}</span>
                </div>
                <span className="text-lg font-bold text-primary">
                  {stat.value}
                </span>
              </div>
            ))}
          </div>

          {/* Circular Pie Chart - Corrected Implementation */}
          <div className="space-y-4">
            <div className="relative w-48 h-48 mx-auto">
              <svg viewBox="0 0 36 36" className="w-full h-full">
                {[
                  { name: 'Swappers', value: 174, color: '#FFD700' },
                  { name: 'Swaps', value: 10667, color: '#FFA500' },
                  { name: 'Liquidity Providers', value: 45, color: '#FFB74D' },
                  { name: 'Position Owners', value: 42, color: '#FFCC80' },
                ].map((stat, index, arr) => {
                  const total = arr.reduce((sum, s) => sum + s.value, 0);
                  const percentage = (stat.value / total) * 100;
                  // Each segment is a circle starting at -90 degrees (top)
                  // stroke-dasharray creates the arc length
                  // stroke-dashoffset shifts where drawing begins
                  const offset = arr.slice(0, index).reduce((sum, s) => sum + (s.value / total) * 100, 0);
                  
                  return (
                    <g key={stat.name}>
                      <circle
                        cx="18"
                        cy="18"
                        r="14"
                        fill="transparent"
                        stroke={stat.color}
                        strokeWidth="4"
                        strokeDasharray={`${percentage} ${100 - percentage}`}
                        strokeDashoffset={100 - offset}
                        transform="rotate(-90 18 18)"
                      />
                    </g>
                  );
                })}
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[10px] text-white/30 uppercase tracking-wider">mlSwap</span>
                <span className="text-[10px] text-white/30 uppercase tracking-wider">User Segments</span>
              </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: 'Swappers', value: 174, color: '#FFD700' },
                { name: 'Swaps', value: 10667, color: '#FFA500' },
                { name: 'Liquidity Providers', value: 45, color: '#FFB74D' },
                { name: 'Position Owners', value: 42, color: '#FFCC80' },
              ].map((stat) => {
                const total = 174 + 10667 + 45 + 42;
                const percentage = ((stat.value / total) * 100).toFixed(1);
                return (
                  <div
                    key={stat.name}
                    className="flex items-center gap-2"
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: stat.color }}
                    />
                    <span className="text-[10px] text-white/50">{stat.name}:</span>
                    <span className="num text-[10px] font-bold text-white">
                      {stat.value.toLocaleString()} ({percentage}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Format Selector Tabs */}
      <div className="flex items-center gap-2 p-1 bg-white/[0.02] border border-white/[0.06] rounded-xl mb-8 w-fit">
        {[
          { id: 'hero', label: 'Feature Hero Banner' },
          { id: 'horizontal', label: 'Wide Leaderboard' },
          { id: 'card', label: 'Marketing Card' },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all cursor-pointer ${
              activeTab === tab.id
                ? 'bg-primary text-black shadow-lg font-bold'
                : 'text-white/40 hover:text-white/80 hover:bg-white/[0.03]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Banner Preview Area */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-start">
        
        {/* Banner Render */}
        <div className="w-full flex flex-col gap-4">
          <div className="p-2 bg-black/40 border border-white/[0.04] rounded-2xl">
            <div className="bg-neutral-950 border border-white/[0.06] rounded-xl overflow-hidden flex items-center justify-center p-8 min-h-[360px]">
              
              {/* ── FORMAT 1: HERO FEATURE BANNER ── */}
              {activeTab === 'hero' && (
                <div className="relative w-full max-w-3xl rounded-2xl border border-white/[0.08] bg-gradient-to-br from-neutral-900 via-black to-neutral-900/60 p-8 md:p-10 overflow-hidden shadow-2xl">
                  {/* Glowing core */}
                  <div className="absolute -top-12 -right-12 w-64 h-64 bg-primary/10 rounded-full blur-[80px]" />
                  <div className="absolute -bottom-16 -left-16 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px]" />
                  
                  {/* Grid Lines Overlay */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

                  <div className="relative z-10 flex flex-col items-center justify-center text-center gap-6">
                    
                    {/* Branding / Image overlap (now on top) */}
                    <div className="flex items-center justify-center shrink-0">
                      <div className="relative flex items-center justify-center w-36 h-24">
                        
                        {/* Connecting Aura Beam */}
                        <div className="absolute w-20 h-1 bg-gradient-to-r from-yellow-400 to-blue-500 blur-[2px] opacity-75 animate-pulse" />

                        {/* mlSwap Logo (Left) */}
                        <div className="absolute left-0 w-14 h-14 rounded-2xl bg-black border border-white/10 shadow-xl flex items-center justify-center p-2 hover:scale-105 hover:-rotate-6 transition-all duration-300">
                          <img src="/logo.svg" alt="mlSwap Logo" className="w-full h-full object-contain" />
                        </div>
                        
                        {/* ArcLens Logo (Right) */}
                        <div className="absolute right-0 w-14 h-14 rounded-2xl bg-neutral-900 border border-white/10 shadow-xl flex items-center justify-center overflow-hidden hover:scale-105 hover:rotate-6 transition-all duration-300">
                          <img src="/arclens.jpg" alt="ArcLens Logo" className="w-full h-full object-cover" />
                        </div>

                        {/* Center Ring badge */}
                        <div className="absolute w-8 h-8 rounded-full bg-black/80 border border-white/20 flex items-center justify-center shadow-lg">
                          <Shield size={11} className="text-primary animate-pulse" />
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="space-y-4 max-w-md">
                      {/* <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                        <Sparkles size={11} className="text-primary animate-pulse" />
                        <span className="text-[9px] uppercase tracking-[0.2em] font-extrabold text-primary">Limited Time Campaign</span>
                      </div> */}
                      
                      <div className="space-y-1">
                        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
                          mlSwap <span className="text-primary/70 font-light text-xl">×</span> ArcLens
                        </h2>
                        <h3 className="text-lg font-semibold text-white/80">
                          PointsHook Campaign: Arc Trial
                        </h3>
                      </div>
                      
                      <p className="text-white/60 text-xs leading-relaxed text-[20px]">
                        Swap & Accumulate Points 
                      </p>

                      {/* <div className="flex items-center gap-4 pt-2">
                        <Link
                          to={campaignLink}
                          className="px-5 py-2.5 rounded-full bg-primary hover:brightness-110 text-black text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-lg shadow-primary/10 active:scale-95"
                        >
                          Join Trial
                          <ArrowRight size={13} strokeWidth={2.5} />
                        </Link>
                        
                        <button
                          onClick={handleCopyLink}
                          className="px-4 py-2.5 rounded-full border border-white/10 hover:border-white/20 text-white/60 hover:text-white text-xs font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 bg-white/[0.02]"
                        >
                          {copiedLink ? <Check size={13} className="text-emerald-400" /> : <Share2 size={13} />}
                          Share
                        </button>
                      </div> */}
                    </div>

                  </div>
                </div>
              )}

              {/* ── FORMAT 2: WIDE LEADERBOARD BANNER ── */}
              {activeTab === 'horizontal' && (
                <div className="relative w-full max-w-4xl h-24 rounded-xl border border-white/[0.06] bg-neutral-950 p-4 overflow-hidden flex items-center justify-between shadow-lg">
                  {/* Neon Line accents */}
                  <div className="absolute top-0 left-0 w-24 h-[1px] bg-primary/40" />
                  <div className="absolute bottom-0 right-0 w-24 h-[1px] bg-blue-500/40" />

                  <div className="flex items-center gap-4 relative z-10">
                    <div className="flex -space-x-4 shrink-0">
                      <div className="w-10 h-10 rounded-xl bg-black border border-white/10 flex items-center justify-center p-1.5 shadow-md">
                        <img src="/logo.svg" alt="mlswap" className="w-full h-full object-contain" />
                      </div>
                      <div className="w-10 h-10 rounded-xl bg-neutral-900 border border-white/10 overflow-hidden shadow-md">
                        <img src="/arclens.jpg" alt="arclens" className="w-full h-full object-cover" />
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
                        mlSwap × ArcLens <span className="text-[10px] bg-primary/10 border border-primary/20 text-primary px-1.5 py-0.5 rounded font-mono font-normal">TRIAL</span>
                      </h4>
                      <p className="text-[11px] text-white/40">Swap and unlock multi-layer points hooks instantly.</p>
                    </div>
                  </div>

                  <Link
                    to={campaignLink}
                    className="relative z-10 px-4 py-2 rounded-lg bg-primary hover:brightness-105 text-black text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 active:scale-95 shrink-0"
                  >
                    Enter Campaign
                    <ArrowRight size={10} strokeWidth={2.5} />
                  </Link>
                </div>
              )}

              {/* ── FORMAT 3: MARKETING CARD BANNER ── */}
              {activeTab === 'card' && (
                <div className="relative w-[280px] rounded-2xl border border-white/[0.08] bg-gradient-to-b from-neutral-900 to-black p-6 overflow-hidden flex flex-col justify-between min-h-[380px] shadow-2xl">
                  {/* Top background circle */}
                  <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/5 rounded-full blur-2xl" />

                  <div className="space-y-5">
                    {/* Logotypes row */}
                    <div className="flex items-center justify-between">
                      <img src="/logo.svg" alt="mlswap" className="h-6 object-contain" />
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10">
                        <img src="/arclens.jpg" alt="arclens" className="w-full h-full object-cover" />
                      </div>
                    </div>

                    {/* Middle info */}
                    <div className="space-y-2">
                      <span className="text-[8px] uppercase tracking-widest text-primary font-bold bg-primary/15 px-2 py-0.5 rounded border border-primary/10">
                        PointsHook Campaign
                      </span>
                      <h3 className="text-base font-bold text-white tracking-tight">
                        ArcLens: Arc Trial
                      </h3>
                      <p className="text-white/40 text-[11px] leading-relaxed">
                        Calculate on-chain yields, earn 1% swap volume points, and complete missions to claim special ERC1155 tokens.
                      </p>
                    </div>

                    {/* Stats summary */}
                    <div className="p-3.5 bg-white/[0.02] border border-white/[0.04] rounded-xl space-y-2">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-white/35">Hook Address</span>
                        <span className="font-mono text-white/50">0xd523…48040</span>
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-white/35">Eligible Pools</span>
                        <span className="text-white/50 font-semibold">3 Pools Active</span>
                      </div>
                    </div>
                  </div>

                  <Link
                    to={campaignLink}
                    className="w-full py-2.5 rounded-xl bg-primary hover:brightness-105 text-black text-[10px] font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 active:scale-95 mt-4"
                  >
                    Start Swapping
                    <ArrowRight size={11} strokeWidth={2.5} />
                  </Link>
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Right Column: Code & Details info */}
        <div className="flex flex-col gap-6">
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.01] p-5 space-y-5">
            <h3 className="text-white font-semibold text-sm">Integration Details</h3>
            
            <div className="space-y-3.5 text-xs">
              <div className="flex items-start gap-2.5 text-white/45">
                <Shield size={14} className="text-primary mt-0.5 shrink-0" />
                <p>Private promotional assets designed for marketing integrations.</p>
              </div>
              <div className="flex items-start gap-2.5 text-white/45">
                <Layers size={14} className="text-primary mt-0.5 shrink-0" />
                <p>Fully responsive structure compatible with standard web cards and iframes.</p>
              </div>
            </div>

            {/* Copy Embed Block */}
            <div className="space-y-2 pt-4 border-t border-white/[0.05]">
              <span className="text-[10px] uppercase tracking-widest text-white/35 font-bold">Copy Embed Code</span>
              <div className="relative">
                <textarea
                  readOnly
                  value={embedCodes[activeTab]}
                  rows={4}
                  className="w-full p-3 bg-black/40 border border-white/[0.05] rounded-lg font-mono text-[10px] text-white/50 resize-none outline-none focus:border-primary/40 transition-colors"
                />
                <button
                  onClick={() => handleCopyCode(activeTab, embedCodes[activeTab])}
                  className="absolute bottom-3 right-3 p-1.5 rounded bg-white/[0.02] border border-white/[0.06] hover:bg-white/10 text-white/40 hover:text-white transition-all cursor-pointer"
                  title="Copy Embed Code"
                >
                  {copiedCode === activeTab ? (
                    <Check size={12} className="text-emerald-400" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </div>
            </div>

            {/* Hidden navigation warning */}
            <div className="p-3 bg-yellow-500/[0.03] border border-yellow-500/10 rounded-xl flex gap-2">
              <AlertCircle size={14} className="text-yellow-400/80 shrink-0 mt-0.5" />
              <p className="text-[10px] text-yellow-400/80 leading-relaxed uppercase tracking-wider">
                Note: This route is unlisted and excluded from public navigation menus to keep access exclusive.
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
