import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from './Logo';
import { useAppKit } from '@reown/appkit/react';
import { useConnection, useDisconnect } from 'wagmi';
import { Menu, X, Wallet, LogOut, ArrowRight, Copy, Check, ChevronDown, Settings } from 'lucide-react';
import { useTokenBalance } from '@/hooks/shared/useTokenBalance';
import { TOKENS } from '@/config/tokens';

// Deterministic random number generator based on seed string
function createRand(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  return function() {
    h ^= h << 13;
    h ^= h >> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };
}

function createColor(rand: () => number) {
  const h = Math.floor(rand() * 360);
  const s = Math.floor(rand() * 60) + 40;
  const l = Math.floor(rand() * 50) + 30;
  return `hsl(${h}, ${s}%, ${l}%)`;
}

interface BlockieProps {
  address: string;
  size?: number;
  className?: string;
}

function Blockie({ address, size = 20, className }: BlockieProps) {
  const { grid, colors } = useMemo(() => {
    const seed = address.toLowerCase();
    const rand = createRand(seed);
    
    const bgColor = createColor(rand);
    const primaryColor = createColor(rand);
    const spotColor = createColor(rand);
    
    const grid: number[] = [];
    const width = 8;
    const height = 8;
    
    for (let y = 0; y < height; y++) {
      const row: number[] = [];
      for (let x = 0; x < 4; x++) {
        // 0 = bg, 1 = primary, 2 = spot
        const val = Math.floor(rand() * 2.3);
        row.push(val);
      }
      // Mirror the row
      const mirrored = [...row, ...row.slice().reverse()];
      grid.push(...mirrored);
    }
    
    return {
      grid,
      colors: [bgColor, primaryColor, spotColor],
    };
  }, [address]);

  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 8 8" 
      className={`shrink-0 ${className || 'rounded-md'}`}
      style={{ imageRendering: 'pixelated' }}
    >
      {grid.map((val, idx) => {
        const x = idx % 8;
        const y = Math.floor(idx / 8);
        return (
          <rect
            key={idx}
            x={x}
            y={y}
            width={1}
            height={1}
            fill={colors[val]}
          />
        );
      })}
    </svg>
  );
}



export default function Navbar() {
  const { open } = useAppKit();

  const { address, isConnected } = useConnection();
  const { formattedBalance } = useTokenBalance({ token: TOKENS[0], address });

  const { disconnect } = useDisconnect();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [walletDropdown, setWalletDropdown] = useState(false);
  const { pathname } = useLocation();
  const [copied, setCopied] = useState(false);

  const wallet = address;
  const shortAddress = wallet ? `${wallet.substring(0, 6)}...${wallet.substring(wallet.length - 4)}` : '';

  const handleCopy = () => {
    if (wallet) {
      navigator.clipboard.writeText(wallet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const navLinks = [
    { label: 'Swap', href: '/' },
    { label: 'Pools', href: '/pools' },
    { label: 'Campaigns', href: '/campaigns' },
    { label: 'Activity', href: '/activity' },
    { label: 'Profile', href: '/profile' },
    { label: 'Faucet', href: '/faucet' },
  ];

  return (
    <>
      <header className="fixed top-0 w-full z-50 bg-[#0a0a0a]/90 border-b border-white/[0.06] backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-20 flex items-center justify-between">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-6">
            <Logo />
            
            {/* Separator */}
            <div className="hidden md:block w-px h-5 bg-white/[0.08]" />
            
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link 
                    key={link.href}
                    to={link.href} 
                    className={`px-3 py-1.5 text-[16px] font-medium rounded-md transition-all duration-200 ${
                      isActive 
                        ? 'text-primary' 
                        : 'text-white/40 hover:text-white/80'
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right: Network + Wallet */}
          <div className="flex items-center gap-2">
            {/* Network Badge — always visible on desktop */}
            <div className="hidden lg:flex items-center gap-2 px-4 h-10 rounded-lg bg-[#161721] border border-[#232532] text-[#9fa3b2]">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
              <span className="text-[14px] font-mono tracking-tight">Arc Testnet</span>
            </div>

            {/* Desktop Wallet Area */}
            <div className="hidden md:flex items-center gap-2">
              {!isConnected ? (
                <button 
                  onClick={() => open()}
                  className="bg-[#161721] border border-[#232532] hover:bg-[#1a1c27] hover:border-[#2f3246] text-[#9fa3b2] px-6 py-2.5 rounded-lg text-[13px] font-semibold tracking-wide transition-all active:scale-95 cursor-pointer h-10 flex items-center justify-center"
                >
                  Connect Wallet
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <button
                      onClick={() => setWalletDropdown(!walletDropdown)}
                      className="flex items-center gap-2.5 px-3.5 py-2 rounded-lg bg-[#161721] border border-[#232532] hover:bg-[#1a1c27] hover:border-[#2f3246] transition-all cursor-pointer h-10"
                    >
                      <Blockie address={address || ''} size={20} />
                      <span className="text-[14px] text-[#9fa3b2] font-mono tracking-tight">{shortAddress}</span>
                      <ChevronDown size={14} className={`text-[#9fa3b2] transition-transform duration-200 ${walletDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Wallet Dropdown */}
                    {walletDropdown && (
                      <>
                        {/* Backdrop to close dropdown */}
                        <div className="fixed inset-0 z-40" onClick={() => setWalletDropdown(false)} />
                        
                        <div className="absolute right-0 top-full mt-2 w-64 bg-[#111111] border border-white/[0.08] rounded-lg shadow-2xl shadow-black/50 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                          {/* Wallet Info */}
                          <div className="p-4 border-b border-white/[0.06]">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-[11px] uppercase tracking-widest text-white/30">Connected</span>
                              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                            </div>
                            <div className="flex items-center gap-3">
                              <Blockie address={address || ''} size={32} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[14px] font-mono text-white/80 tracking-tight">{shortAddress}</span>
                                  <button 
                                    onClick={handleCopy} 
                                    className="text-white/20 hover:text-primary transition-colors cursor-pointer"
                                    title="Copy Address"
                                  >
                                    {copied ? <Check size={11} className="text-emerald-400" /> : <Copy size={11} />}
                                  </button>
                                </div>
                                <span className="text-[12px] text-white/30 tracking-wide">Arc Testnet</span>
                              </div>
                            </div>
                          </div>

                          {/* Balance */}
                          <div className="px-4 py-3 border-b border-white/[0.06]">
                            <span className="text-[11px] uppercase tracking-widest text-white/30">Balance</span>
                            <p className="text-[16px] text-[#9fa3b2] font-mono mt-1">{formattedBalance} <span className="text-white/30">USDC</span></p>
                          </div>

                          {/* Disconnect */}
                          <div className="p-2">
                            <button 
                              onClick={() => { disconnect(); setWalletDropdown(false); }}
                              className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-white/45 hover:text-red-400 hover:bg-red-500/[0.06] transition-all cursor-pointer"
                            >
                              <LogOut size={13} />
                              <span className="text-[10px] uppercase tracking-wider">Disconnect</span>
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Settings Button */}
                  {/* <button className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#161721] border border-[#232532] hover:bg-[#1a1c27] hover:border-[#2f3246] text-[#9fa3b2] transition-all cursor-pointer">
                    <Settings size={18} />
                  </button> */}

                </div>
              )}
            </div>

            {/* Hamburger Toggle */}
            <button 
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden w-9 h-9 flex items-center justify-center rounded-md bg-white/[0.04] border border-white/[0.08] text-white/60 hover:text-white hover:bg-white/[0.08] transition-all cursor-pointer"
            >
              {isMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      <div className={`fixed inset-0 z-40 md:hidden bg-[#0a0a0a]/98 backdrop-blur-2xl transition-all duration-400 ${isMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex flex-col h-full pt-16 px-6 md:px-8 pb-12 overflow-y-auto">
          {/* Mobile Nav Links */}
          <nav className="flex flex-col gap-1 mt-4">
            {navLinks.map((link) => (
              <Link 
                key={link.href}
                to={link.href}
                onClick={() => setIsMenuOpen(false)}
                className={`flex items-center justify-between px-4 py-4 rounded-lg transition-all duration-200 ${
                  pathname === link.href 
                    ? 'bg-white/[0.05] text-white' 
                    : 'text-white/40 hover:text-white hover:bg-white/[0.03]'
                }`}
              >
                <span className="text-[17px] font-medium">{link.label}</span>
                <ArrowRight size={16} className={`transition-all duration-200 ${pathname === link.href ? 'text-primary opacity-100' : 'opacity-0'}`} />
              </Link>
            ))}
          </nav>

          {/* Mobile Authentication Area */}
          <div className="mt-auto pt-8 border-t border-white/[0.06]">
            {!isConnected ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3 px-4 py-3 bg-white/[0.03] border border-white/[0.06] rounded-lg">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.4)]" />
                  <div>
                    <p className="text-[12px] uppercase tracking-widest text-white/30">Network</p>
                    <p className="text-[14px] text-white/70">Arc Testnet</p>
                  </div>
                </div>
                <button 
                  onClick={() => { open(); setIsMenuOpen(false); }}
                  className="w-full bg-primary text-black py-4 rounded-lg text-[10px] font-semibold uppercase tracking-[0.2em] transition-all hover:brightness-110 active:scale-[0.98] cursor-pointer"
                >
                  Connect Wallet
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white/[0.04] border border-white/[0.08] p-5 rounded-lg space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] uppercase tracking-widest text-white/30">Connected Wallet</span>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  </div>
                  <div className="flex items-center gap-3">
                    <Blockie address={address || ''} size={40} className="rounded-lg" />
                    <div className="flex-1 flex items-center justify-between">
                      <div>
                        <p className="font-mono text-[15px] text-white/80 tracking-tight">{shortAddress}</p>
                        <p className="text-[12px] text-white/30 tracking-wide">Arc Testnet</p>
                      </div>
                      <button 
                        onClick={handleCopy} 
                        className="w-8 h-8 flex items-center justify-center rounded-md text-white/20 hover:text-primary hover:bg-white/[0.05] transition-all cursor-pointer"
                        title="Copy Address"
                      >
                        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-white/[0.06]">
                    <span className="text-[11px] uppercase tracking-widest text-white/30">Balance</span>
                    <p className="text-[16px] text-white/80 font-mono mt-0.5">{formattedBalance} <span className="text-white/30">USDC</span></p>
                  </div>
                </div>
                
                <button 
                  onClick={() => { disconnect(); setIsMenuOpen(false); }}
                  className="w-full bg-white/[0.03] border border-white/[0.06] text-white/40 py-4 rounded-lg text-[10px] uppercase tracking-[0.2em] flex items-center justify-center gap-2 hover:text-red-400 hover:border-red-500/20 transition-all cursor-pointer"
                >
                  <LogOut size={14} />
                  Disconnect
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
