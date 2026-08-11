import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAccount, useReadContract } from 'wagmi';
import { formatUnits, parseUnits } from 'viem';
import {
  ArrowLeft,
  Check,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  MessageCircle,
  Twitter,
} from 'lucide-react';
import { useLaunch } from '@/hooks/useLaunch';
import { useSwap } from '@/hooks/useSwap';
import { CONTRACTS, explorerAddress, explorerTx } from '@/config/networks';
import { countdown, fmtNative, fmtToken, progressPct, shortAddress, timeAgo } from '@/lib/format';
import { quoteFairLaunchBuy } from '@/lib/fairLaunchQuote';
import Erc20Abi from '@/abi/ERC20.json';

function StatPill({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-2xl px-4 py-3.5 shadow-[0_1px_4px_rgba(15,17,21,0.04)] border border-black/[0.06] min-w-0">
      <p className="text-[11px] font-semibold text-black/40 truncate">{label}</p>
      <p className="text-[18px] font-extrabold text-black tabular-nums leading-tight mt-1 truncate">
        {value}
      </p>
      {hint && <p className="text-[10px] font-medium text-black/30 mt-0.5 truncate">{hint}</p>}
    </div>
  );
}

export default function TokenDetail() {
  const { address: tokenAddress } = useParams<{ address: string }>();
  const { launch, loading, error, refetch } = useLaunch(tokenAddress);
  const { address: account, isConnected } = useAccount();

  const side = 'buy' as const;
  const [amount, setAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [, forceTick] = useState(0);

  const { swap, step, error: swapError, txHash, isBusy } = useSwap(tokenAddress);

  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const { data: nativeBalance } = useReadContract({
    address: CONTRACTS.nativeToken,
    abi: (Erc20Abi as any).abi || Erc20Abi,
    functionName: 'balanceOf',
    args: account ? [account] : undefined,
    query: { enabled: !!account, refetchInterval: 12_000 },
  });

  const { data: tokenBalance } = useReadContract({
    address: tokenAddress as `0x${string}`,
    abi: (Erc20Abi as any).abi || Erc20Abi,
    functionName: 'balanceOf',
    args: account ? [account] : undefined,
    query: { enabled: !!account && !!tokenAddress, refetchInterval: 12_000 },
  });

  const pct = useMemo(
    () => progressPct(launch?.initialTokenFairLaunch, launch?.remainingSupply),
    [launch]
  );

  const balance = side === 'buy' ? (nativeBalance as bigint) : (tokenBalance as bigint);
  const balanceDecimals = side === 'buy' ? CONTRACTS.nativeTokenDecimals : 18;
  const balanceLabel = balance ? formatUnits(balance, balanceDecimals) : '0';

  const volume = useMemo(() => {
    if (!launch) return { day: 0n, all: 0n };
    const since = Math.floor(Date.now() / 1000) - 86_400;
    return launch.buys.reduce(
      (acc, b) => ({
        day: Number(b.timestamp) >= since ? acc.day + BigInt(b.nativeIn || 0) : acc.day,
        all: acc.all + BigInt(b.nativeIn || 0),
      }),
      { day: 0n, all: 0n }
    );
  }, [launch]);

  const copyAddress = () => {
    if (!tokenAddress) return;
    navigator.clipboard.writeText(tokenAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const onSwap = async () => {
    const hash = await swap(amount, side);
    if (hash) {
      setAmount('');
      setTimeout(() => refetch(), 2500);
    }
  };

  if (loading && !launch) {
    return (
      <div className="pt-[64px] min-h-screen flex flex-col items-center justify-center gap-3 py-40">
        <Loader2 size={22} className="animate-spin text-[#f60aa8]" />
        <p className="text-[13px] font-semibold text-black/40">Loading token…</p>
      </div>
    );
  }

  if (!launch) {
    return (
      <div className="pt-[64px] min-h-screen">
        <div className="max-w-md mx-auto px-4 py-24">
          <div className="bg-white rounded-[28px] p-12 text-center shadow-[0_2px_12px_rgba(15,17,21,0.06)] flex flex-col items-center gap-4">
            <p className="text-[18px] font-extrabold text-black">Token not found</p>
            <p className="text-black/50 text-[14px]">{error ?? 'This launch does not exist yet.'}</p>
            <Link to="/" className="btn btn-primary h-11 px-7 mt-1">
              Back to explore
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const links = launch.links ?? {};

  return (
    <div className="pt-[64px] min-h-screen">
      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6 md:py-8">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-black/40 hover:text-[#f60aa8] transition-colors mb-5"
        >
          <ArrowLeft size={14} />
          All launches
        </Link>

        {/* Token header */}
        <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-[0_2px_12px_rgba(15,17,21,0.06)] border border-black/[0.06] mb-5">
          <div className="flex items-start gap-4 md:gap-5">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-[20px] overflow-hidden bg-[#f4f5f7] shrink-0 shadow-md flex items-center justify-center">
              {launch.imageUrl ? (
                <img
                  src={launch.imageUrl}
                  alt={launch.symbol}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-[#f60aa8] font-extrabold text-2xl">
                  {launch.symbol.slice(0, 3).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5 mb-2">
                <h1 className="text-[26px] md:text-[32px] font-extrabold tracking-tight text-black leading-none">
                  {launch.name}
                </h1>
                <span className="text-[15px] font-bold text-black/35">${launch.symbol}</span>
                {launch.isLive ? (
                  <span className="chip chip-live">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f60aa8] animate-blink" />
                    {countdown(Number(launch.fairLaunchEndsAt))}
                  </span>
                ) : (
                  <span className="chip chip-ink">Trading live</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={copyAddress}
                  className="chip hover:border-[#f60aa8]/30 transition-colors cursor-pointer"
                >
                  {copied ? (
                    <Check size={11} className="text-[#f60aa8]" />
                  ) : (
                    <Copy size={11} />
                  )}
                  {shortAddress(launch.memecoin, 6)}
                </button>
                <a
                  href={explorerAddress(launch.memecoin)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chip hover:border-[#f60aa8]/30 transition-colors"
                >
                  <ExternalLink size={11} />
                  Explorer
                </a>
                <span className="chip">
                  by {shortAddress(String((launch as any).creator ?? ''), 4)}
                </span>
                <span className="chip">{timeAgo(Number(launch.createdAtTimestamp))}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-5">
          <StatPill label="Volume · 24h" value={`$${fmtNative(volume.day.toString())}`} hint={CONTRACTS.nativeTokenSymbol} />
          <StatPill label="Volume · all time" value={`$${fmtNative(volume.all.toString())}`} hint={CONTRACTS.nativeTokenSymbol} />
          <StatPill label="Raised" value={`$${fmtNative(launch.revenue)}`} hint={CONTRACTS.nativeTokenSymbol} />
          <StatPill label="Target MC" value={`$${fmtNative(launch.targetMarketCap)}`} hint={CONTRACTS.nativeTokenSymbol} />
          <StatPill label="Buys" value={String(launch.buyCount)} hint="Fair launch trades" />
          <StatPill
            label="Remaining"
            value={fmtToken(launch.remainingSupply)}
            hint={`of ${fmtToken(launch.initialTokenFairLaunch)}`}
          />
        </div>

        <div className="grid lg:grid-cols-[1.55fr_1fr] gap-5 items-start">
          {/* Left column */}
          <div className="space-y-5">
            <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-[0_2px_12px_rgba(15,17,21,0.06)] border border-black/[0.06]">
              <div className="flex items-baseline justify-between mb-3">
                <span className="text-[13px] font-bold text-black/50">Curve filled</span>
                <span className="text-[15px] font-extrabold text-[#f60aa8] tabular-nums">
                  {pct.toFixed(2)}%
                </span>
              </div>
              <div className={`meter ${launch.isLive ? 'meter-live' : ''}`}>
                <span style={{ width: `${Math.min(Math.max(pct, 1), 100)}%` }} />
              </div>

              {launch.description && (
                <p className="text-black/60 text-[14px] leading-relaxed mt-5 pt-5 border-t border-black/[0.06]">
                  {launch.description}
                </p>
              )}

              {(links.website || links.twitter || links.telegram) && (
                <div className="flex flex-wrap items-center gap-2 mt-4">
                  {links.website && (
                    <a
                      href={links.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-soft h-9 px-4 text-[12px]"
                    >
                      <Globe size={13} />
                      Website
                    </a>
                  )}
                  {links.twitter && (
                    <a
                      href={links.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-soft h-9 px-4 text-[12px]"
                    >
                      <Twitter size={13} />
                      Twitter
                    </a>
                  )}
                  {links.telegram && (
                    <a
                      href={links.telegram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-soft h-9 px-4 text-[12px]"
                    >
                      <MessageCircle size={13} />
                      Telegram
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Trade tape */}
            <div className="bg-white rounded-[28px] overflow-hidden shadow-[0_2px_12px_rgba(15,17,21,0.06)] border border-black/[0.06]">
              <div className="px-5 md:px-6 py-4 border-b border-black/[0.06] flex items-center justify-between">
                <h2 className="text-[15px] font-extrabold text-black">Trade tape</h2>
                <span className="text-[11px] font-bold text-black/30 uppercase tracking-[0.1em]">
                  {launch.buys.length} trades
                </span>
              </div>

              {launch.buys.length === 0 ? (
                <p className="px-6 py-14 text-center text-black/40 text-[14px]">
                  No buys yet — be the first.
                </p>
              ) : (
                <>
                  <div className="hidden sm:grid grid-cols-[1fr_1.2fr_1fr_auto] gap-4 px-5 md:px-6 py-2.5 bg-[#f4f5f7]/80">
                    {['Buyer', 'Received', 'Paid', 'Time'].map((h) => (
                      <span key={h} className="text-[10px] font-bold uppercase tracking-[0.1em] text-black/30">
                        {h}
                      </span>
                    ))}
                  </div>
                  <div className="divide-y divide-black/[0.05]">
                    {launch.buys.map((b) => (
                      <a
                        key={b.id}
                        href={explorerTx(b.transactionHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="grid sm:grid-cols-[1fr_1.2fr_1fr_auto] gap-1 sm:gap-4 px-5 md:px-6 py-3 hover:bg-[#fdf2f8]/60 transition-colors items-baseline"
                      >
                        <span className="text-[13px] font-medium text-black/50">
                          {shortAddress(b.buyer, 4)}
                        </span>
                        <span className="text-[13px] font-bold text-black tabular-nums">
                          {fmtToken(b.tokensOut)}{' '}
                          <span className="text-black/35 font-medium">{launch.symbol}</span>
                        </span>
                        <span className="text-[13px] font-bold text-[#f60aa8] tabular-nums">
                          {fmtNative(b.nativeIn)}{' '}
                          <span className="text-black/35 font-medium">{CONTRACTS.nativeTokenSymbol}</span>
                        </span>
                        <span className="text-[11px] font-medium text-black/30 sm:text-right">
                          {timeAgo(Number(b.timestamp))}
                        </span>
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: buy widget + details */}
          <div className="lg:sticky lg:top-[80px] space-y-5">
            <div className="bg-white rounded-[28px] overflow-hidden shadow-[0_2px_12px_rgba(15,17,21,0.06)] border border-black/[0.06]">
              {launch.isLive ? (
                <div className="p-5 md:p-6">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[12px] font-bold text-black/45">
                      You pay · {side === 'buy' ? CONTRACTS.nativeTokenSymbol : launch.symbol}
                    </span>
                    <button
                      onClick={() => setAmount(balanceLabel)}
                      className="text-[12px] font-semibold text-black/35 hover:text-[#f60aa8] cursor-pointer"
                    >
                      BAL{' '}
                      {Number(balanceLabel).toLocaleString(undefined, { maximumFractionDigits: 4 })}
                    </button>
                  </div>

                  <input
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="0.00"
                    inputMode="decimal"
                    className="input-field num w-full h-14 px-4 text-[24px] font-extrabold mb-3"
                  />

                  {side === 'buy' && amount && Number(amount) > 0 && launch && (
                    <div className="mb-4 px-4 py-3 bg-[rgba(246,10,168,0.08)] rounded-2xl flex items-center justify-between">
                      <span className="text-[11px] font-semibold text-black/40">Estimated receive</span>
                      <span className="text-[14px] font-extrabold text-[#f60aa8] tabular-nums">
                        ≈{' '}
                        {fmtToken(
                          (() => {
                            const nativeIn = parseUnits(amount, CONTRACTS.nativeTokenDecimals);
                            const quote = quoteFairLaunchBuy(
                              {
                                targetMarketCap: launch.targetMarketCap,
                                initialTokenFairLaunch: launch.initialTokenFairLaunch,
                                multiple: launch.multiple,
                                remainingSupply: launch.remainingSupply,
                              },
                              nativeIn
                            );
                            return quote.tokensOut.toString();
                          })()
                        )}{' '}
                        {launch.symbol}
                      </span>
                    </div>
                  )}

                  <div className="seg w-full h-9 mb-4">
                    {['25', '50', '75', '100'].map((p) => (
                      <button
                        key={p}
                        onClick={() => {
                          const v = (Number(balanceLabel) * Number(p)) / 100;
                          setAmount(v ? String(v) : '');
                        }}
                        className="flex-1 text-[12px]"
                      >
                        {p}%
                      </button>
                    ))}
                  </div>

                  <button
                    onClick={onSwap}
                    disabled={!isConnected || isBusy || !amount}
                    className="btn btn-primary w-full h-13 py-3.5 text-[15px]"
                  >
                    {isBusy ? (
                      <>
                        <Loader2 size={15} className="animate-spin" />
                        {step === 'approving'
                          ? 'Approving…'
                          : step === 'signing'
                            ? 'Confirm in wallet…'
                            : 'Confirming…'}
                      </>
                    ) : (
                      <>Buy {launch.symbol}</>
                    )}
                  </button>

                  {!isConnected && (
                    <p className="text-[12px] font-medium text-black/35 text-center mt-3">
                      Connect a wallet to buy
                    </p>
                  )}

                  {swapError && (
                    <p className="mt-3 text-[12px] text-red-500 break-words leading-relaxed">
                      {swapError}
                    </p>
                  )}

                  {step === 'done' && txHash && (
                    <a
                      href={explorerTx(txHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 flex items-center justify-center gap-2 text-[12px] font-bold text-[#f60aa8] hover:text-[#d00890]"
                    >
                      <Check size={12} />
                      Trade confirmed — view tx
                    </a>
                  )}
                </div>
              ) : (
                <div className="p-8 flex flex-col items-center text-center">
                  <span className="chip chip-ink mb-4">Trading live</span>
                  <p className="text-black/55 text-[14px] max-w-[40ch] mb-6">
                    This token has graduated from the fair launch curve and is now trading on MLSwap.
                  </p>
                  <a
                    href={`https://app.mlswapx.xyz/pools/${launch.poolId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary h-12 px-7 text-[14px] inline-flex items-center gap-2"
                  >
                    Trade on MLSwap
                    <ExternalLink size={15} />
                  </a>
                </div>
              )}
            </div>

            <div className="bg-white rounded-[28px] p-5 md:p-6 shadow-[0_2px_12px_rgba(15,17,21,0.06)] border border-black/[0.06]">
              <h3 className="text-[15px] font-extrabold text-black mb-4">Parameters</h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: 'Fair launch supply',
                    value: fmtToken(launch.initialTokenFairLaunch),
                  },
                  {
                    label: 'Duration',
                    value: `${(Number(launch.fairLaunchDuration) / 3600).toFixed(1)}h`,
                  },
                  {
                    label: 'Creator fee',
                    value: `${Number(launch.creatorFeeAllocation) / 100}%`,
                  },
                  {
                    label: 'Multiple',
                    value: `${launch.multiple}×`,
                  },
                  {
                    label: 'Starts',
                    value:
                      launch.fairLaunchStartsAt && Number(launch.fairLaunchStartsAt) > 0
                        ? new Date(Number(launch.fairLaunchStartsAt) * 1000).toLocaleDateString(
                            undefined,
                            { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                          )
                        : 'Immediate',
                  },
                  {
                    label: 'Ends',
                    value:
                      launch.fairLaunchEndsAt && Number(launch.fairLaunchEndsAt) > 0
                        ? new Date(Number(launch.fairLaunchEndsAt) * 1000).toLocaleDateString(
                            undefined,
                            { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
                          )
                        : '—',
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl bg-[#f7f7f8] px-3.5 py-3 min-w-0"
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-black/35 truncate">
                      {item.label}
                    </p>
                    <p className="text-[14px] font-extrabold text-black mt-1 truncate tabular-nums">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 px-1">
                <span className="text-[12px] font-medium text-black/40">Status</span>
                <span
                  className={`chip ${
                    launch.isLive ? 'chip-live' : launch.fairLaunchClosed ? '' : 'chip-ink'
                  }`}
                >
                  {launch.fairLaunchClosed ? 'Closed' : launch.isLive ? 'Live' : 'Ended'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
