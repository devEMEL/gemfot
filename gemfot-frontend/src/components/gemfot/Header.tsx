import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAppKit } from '@reown/appkit/react';
import { useAccount, useDisconnect, useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { Menu, X, LogOut, Copy, Check, ChevronDown } from 'lucide-react';
import { Logo } from './Logo';
import { activeNetwork, CONTRACTS } from '@/config/networks';
import Erc20Abi from '@/abi/ERC20.json';

interface NavLinkItem {
  label: string;
  href: string;
  external?: boolean;
}

const NAV_LINKS: NavLinkItem[] = [
  { label: 'Explore', href: '/' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Faucet', href: 'https://app.mlswapx.xyz/faucet', external: true },
  { label: 'Launch', href: '/launch' },
];

function Avatar({ address, size = 28 }: { address: string; size?: number }) {
  const seed = parseInt(address.slice(2, 10) || '0', 16);
  const hue = (seed % 360);
  return (
    <span
      className="shrink-0 rounded-full"
      style={{
        width: size,
        height: size,
        background: `linear-gradient(135deg, hsl(${hue} 80% 60%), hsl(${(hue + 80) % 360} 70% 50%))`,
      }}
    />
  );
}

export default function Header() {
  const { open } = useAppKit();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { pathname } = useLocation();
  // Header search disabled — Explore page search is enough
  // const navigate = useNavigate();
  // const [searchParams] = useSearchParams();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [dropdown, setDropdown] = useState(false);
  const [copied, setCopied] = useState(false);
  // const [query, setQuery] = useState(() => searchParams.get('q') ?? '');

  // useEffect(() => {
  //   setQuery(searchParams.get('q') ?? '');
  // }, [searchParams]);

  // const onSearch = (value: string) => {
  //   setQuery(value);
  //   const params = new URLSearchParams();
  //   if (value.trim()) params.set('q', value.trim());
  //   const qs = params.toString();
  //   navigate(qs ? `/?${qs}` : '/', { replace: pathname === '/' });
  // };

  const { data: usdcBalance } = useReadContract({
    address: CONTRACTS.nativeToken,
    abi: (Erc20Abi as any).abi || Erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  const short = address ? `${address.slice(0, 4)}…${address.slice(-4)}` : '';
  const bal = usdcBalance
    ? Number(formatUnits(usdcBalance as bigint, CONTRACTS.nativeTokenDecimals)).toLocaleString(
        undefined,
        { maximumFractionDigits: 2 }
      )
    : '0.00';

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
      <header className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-xl border-b border-black/[0.06]">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          <div className="h-[64px] flex items-center justify-between gap-4">
            <div className="flex items-center gap-6 min-w-0">
              <Logo />

              <nav className="hidden md:flex items-center gap-1">
                {NAV_LINKS.map((link) => {
                  const active = !link.external && isActive(link.href);
                  if (link.external) {
                    return (
                      <a
                        key={link.href}
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2 text-[14px] font-semibold text-black/45 hover:text-black transition-colors rounded-full"
                      >
                        {link.label}
                      </a>
                    );
                  }
                  if (link.href === '/launch') {
                    return (
                      <Link
                        key={link.href}
                        to={link.href}
                        className="btn btn-primary h-9 px-4 text-[13px] ml-1"
                      >
                        {link.label}
                      </Link>
                    );
                  }
                  return (
                    <Link
                      key={link.href}
                      to={link.href}
                      className={`px-3.5 py-2 text-[14px] font-semibold rounded-full transition-colors ${
                        active
                          ? 'text-black bg-black/[0.05]'
                          : 'text-black/45 hover:text-black hover:bg-black/[0.03]'
                      }`}
                    >
                      {link.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            {/* Center search — desktop (disabled; Explore page search is enough)
            <div className="hidden lg:flex relative z-10 flex-1 max-w-md mx-4">
              <Search
                size={15}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-black/35 pointer-events-none"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onSearch(query);
                    document.getElementById('launches')?.scrollIntoView({ behavior: 'smooth' });
                  }
                }}
                placeholder="Search coins, CA, creators"
                className="w-full h-10 pl-9 pr-4 rounded-full bg-[#f4f5f7] text-[13px] font-medium text-black placeholder:text-black/40 border border-transparent focus:outline-none focus:bg-white focus:border-[#f60aa8]/35 focus:shadow-[0_0_0_3px_rgba(246,10,168,0.1)] transition-all"
              />
            </div>
            */}

            <div className="flex items-center gap-2.5">
              <div className="hidden lg:flex items-center gap-1.5 text-[12px] font-semibold text-black/35">
                <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
                {activeNetwork.label}
              </div>

              <div className="hidden md:block relative">
                {!isConnected ? (
                  <button
                    onClick={() => open()}
                    className="h-10 px-4 text-[13px] font-bold rounded-full bg-black text-white hover:bg-black/85 transition-colors cursor-pointer"
                  >
                    Connect
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => setDropdown((v) => !v)}
                      className="flex items-center gap-2 h-10 pl-1.5 pr-3 rounded-full bg-[#f4f5f7] hover:bg-[#eef0f3] transition-colors cursor-pointer border border-black/[0.06]"
                    >
                      <Avatar address={address!} />
                      <div className="flex flex-col items-start leading-none gap-0.5">
                        <span className="text-[12px] font-bold text-black">{short}</span>
                        <span className="text-[10px] font-semibold text-black/40">
                          ${bal}
                        </span>
                      </div>
                      <ChevronDown
                        size={13}
                        className={`text-black/30 transition-transform ${dropdown ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {dropdown && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setDropdown(false)} />
                        <div className="absolute right-0 top-full mt-2 w-64 z-50 bg-white rounded-2xl shadow-[0_12px_40px_rgba(15,17,21,0.12)] border border-black/[0.06] overflow-hidden">
                          <div className="p-3.5 border-b border-black/[0.06] flex items-center gap-3">
                            <Avatar address={address!} size={36} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-bold text-black">{short}</span>
                                <button
                                  onClick={copy}
                                  className="text-black/30 hover:text-[#f60aa8] transition-colors cursor-pointer"
                                >
                                  {copied ? <Check size={12} className="text-[#f60aa8]" /> : <Copy size={12} />}
                                </button>
                              </div>
                              <span className="text-[11px] text-black/40 font-medium">{activeNetwork.label}</span>
                            </div>
                          </div>
                          <Link
                            to="/portfolio"
                            onClick={() => setDropdown(false)}
                            className="w-full flex items-center px-3.5 py-3 text-[13px] font-semibold text-black/70 hover:bg-black/[0.03] hover:text-black transition-colors"
                          >
                            My portfolio
                          </Link>
                          <button
                            onClick={() => {
                              disconnect();
                              setDropdown(false);
                            }}
                            className="w-full flex items-center gap-2 px-3.5 py-3 text-[13px] font-semibold text-black/40 hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer border-t border-black/[0.06]"
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

              <button
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Menu"
                className="flex md:!hidden btn btn-soft w-10 h-10 !px-0"
              >
                {mobileOpen ? <X size={17} /> : <Menu size={17} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-40 md:hidden bg-white transition-opacity duration-200 ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <div className="flex flex-col h-full pt-[64px]">
          <nav className="flex flex-col px-4 gap-1 mt-4">
            {NAV_LINKS.map((link) => {
              if (link.external) {
                return (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setMobileOpen(false)}
                    className="px-4 py-3.5 text-[18px] font-bold text-black/50 hover:text-black rounded-2xl hover:bg-black/[0.03] transition-colors"
                  >
                    {link.label}
                  </a>
                );
              }
              return (
                <Link
                  key={link.href}
                  to={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`px-4 py-3.5 text-[18px] font-bold rounded-2xl transition-colors ${
                    isActive(link.href)
                      ? 'text-[#f60aa8] bg-[rgba(246,10,168,0.12)]'
                      : 'text-black/50 hover:text-black hover:bg-black/[0.03]'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto p-6 space-y-3">
            <div className="flex items-center gap-1.5 text-[12px] font-semibold text-black/35">
              <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e]" />
              {activeNetwork.label}
            </div>
            {!isConnected ? (
              <button
                onClick={() => {
                  open();
                  setMobileOpen(false);
                }}
                className="w-full h-12 text-[14px] font-bold rounded-full bg-black text-white hover:bg-black/85 transition-colors cursor-pointer"
              >
                Connect wallet
              </button>
            ) : (
              <button
                onClick={() => {
                  disconnect();
                  setMobileOpen(false);
                }}
                className="btn btn-soft w-full h-12 text-[13px]"
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
