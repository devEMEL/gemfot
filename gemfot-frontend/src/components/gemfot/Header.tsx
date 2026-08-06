import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppKit } from '@reown/appkit/react';
import { useAccount, useDisconnect } from 'wagmi';
import { Menu, X, LogOut, Copy, Check, ChevronDown } from 'lucide-react';
import { Logo } from './Logo';
import { activeNetwork } from '@/config/networks';

const NAV_LINKS = [
  { label: 'Explore', href: '/' },
  { label: 'Launch', href: '/launch' },
  { label: 'Portfolio', href: '/portfolio' },
];

function Avatar({ address, size = 22 }: { address: string; size?: number }) {
  const seed = parseInt(address.slice(2, 10) || '0', 16);
  const hue = 70 + (seed % 60);
  return (
    <span
      className="shrink-0 border border-ink/20"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue} 70% 62%), hsl(${(hue + 45) % 360} 65% 42%))`,
      }}
    />
  );
}

export default function Header() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { pathname } = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  const [copied, setCopied] = useState(false);

  const short = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : '';

  const copy = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 bg-cream/92 backdrop-blur-md border-b border-ink/12">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          <div className="h-[58px] flex items-center justify-between gap-6">
            {/* ------------------------------------------------- left --- */}
            <div className="flex items-center gap-7 min-w-0">
              <Logo />

              <nav className="hidden md:flex items-center gap-6">
                {NAV_LINKS.map((link) => {
                  const active = isActive(link.href);
                  return (
                    <Link
                      key={link.href}
                      to={link.href}
                      className={`relative text-[13px] font-semibold tracking-tight transition-colors py-[19px] ${
                        active ? 'text-ink' : 'text-ink-mute hover:text-ink'
                      }`}
                    >
                      {link.label}
                      {active && (
                        <span className="absolute left-0 right-0 -bottom-px h-[2px] bg-ink" />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* ------------------------------------------------ right --- */}
            <div className="flex items-center gap-2.5">
              <div className="hidden lg:flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
                <span className="w-1.5 h-1.5 bg-gem-600 animate-blink" />
                {activeNetwork.label}
              </div>

              <div className="hidden md:block relative">
                {!isConnected ? (
                  <button onClick={() => open()} className="btn btn-ink h-9 px-4 text-[13px]">
                    Connect wallet
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setDropdown((v) => !v)}
                      className="btn btn-soft h-9 pl-2 pr-3 gap-2 text-[13px]"
                    >
                      <Avatar address={address!} />
                      <span className="mono text-[12px]">{short}</span>
                      <ChevronDown
                        size={13}
                        className={`transition-transform ${dropdown ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {dropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setDropdown(false)} />
                        <div className="absolute right-0 top-full mt-1.5 w-64 z-50 card shadow-[4px_4px_0_0_#0d0f0c]">
                          <div className="p-3.5 border-b border-ink/12 flex items-center gap-3">
                            <Avatar address={address!} size={32} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="mono text-[12px]">{short}</span>
                                <button
                                  onClick={copy}
                                  className="text-ink-mute hover:text-ink transition-colors cursor-pointer"
                                >
                                  {copied ? <Check size={12} /> : <Copy size={12} />}
                                </button>
                              </div>
                              <span className="eyebrow">{activeNetwork.label}</span>
                            </div>
                          </div>
                          <Link
                            to="/portfolio"
                            onClick={() => setDropdown(false)}
                            className="w-full flex items-center px-3.5 py-2.5 text-[13px] font-medium text-ink-soft hover:bg-ink/[0.04] hover:text-ink transition-colors"
                          >
                            My portfolio
                          </Link>
                          <button
                            onClick={() => {
                              disconnect();
                              setDropdown(false);
                            }}
                            className="w-full flex items-center gap-2 px-3.5 py-2.5 text-[13px] font-medium text-ink-soft hover:text-danger hover:bg-danger/[0.06] transition-colors cursor-pointer border-t border-ink/8"
                          >
                            <LogOut size={13} />
                            Disconnect
                          </button>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              {/* Mobile trigger — hidden on md and larger screens */}
              <button
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Menu"
                className="flex md:!hidden btn btn-soft w-9 h-9 !px-0"
              >
                {mobileOpen ? <X size={17} /> : <Menu size={17} />}

              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------ mobile menu --- */}
      <div
        className={`fixed inset-0 z-40 md:hidden bg-cream transition-opacity duration-200 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-col h-full pt-[58px]">
          <nav className="flex flex-col border-t border-ink/12">
            {NAV_LINKS.map((link, i) => (
              <Link
                key={link.href}
                to={link.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-baseline gap-4 px-6 py-6 border-b border-ink/12 transition-colors ${
                  isActive(link.href) ? 'bg-white text-ink' : 'text-ink-soft hover:bg-white'
                }`}
              >
                <span className="mono text-[10px] text-ink-mute">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="text-[26px] font-extrabold tracking-[-0.03em]">{link.label}</span>
              </Link>
            ))}
          </nav>

          <div className="mt-auto p-6 space-y-3">
            <div className="flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.16em] text-ink-mute">
              <span className="w-1.5 h-1.5 bg-gem-600" />
              {activeNetwork.label}
            </div>
            {!isConnected ? (
              <button
                onClick={() => {
                  open();
                  setMobileOpen(false);
                }}
                className="btn btn-primary w-full h-13 py-4 text-[14px]"
              >
                Connect wallet
              </button>
            ) : (
              <button
                onClick={() => {
                  disconnect();
                  setMobileOpen(false);
                }}
                className="btn btn-soft w-full py-4 text-[13px]"
              >
                <LogOut size={14} />
                Disconnect {short}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
