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

/** Square ledger cell — matches the Explore stat strip. */
function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-black px-4 py-3.5 flex flex-col justify-between min-w-0">
      <span className="eyebrow">{label}</span>
      <p className="num text-[20px] font-semibold text-yellow-300 leading-none mt-2.5 truncate">{value}</p>
      {hint && <p className="mono text-[10px] text-white/30 mt-1.5 truncate">{hint}</p>}
    </div>
  );
}

export default function TokenDetail() {
  const { address: tokenAddress } = useParams<{ address: string }>();
  const { launch, loading, error, refetch } = useLaunch(tokenAddress);
  const { address: account, isConnected } = useAccount();

  const [side, setSide] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [copied, setCopied] = useState(false);
  const [, forceTick] = useState(0);

  const { swap, step, error: swapError, txHash, isBusy, reset } = useSwap(tokenAddress);

  // re-render every second so the countdown stays live
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

  /** Volume this token has done in the trailing 24h, from its buy feed. */
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
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 pt-40 pb-24 flex flex-col items-center gap-3 bg-black min-h-screen">
        <Loader2 size={22} className="animate-spin text-white/20" />
        <p className="mono text-[11px] uppercase tracking-[0.16em] text-white/30">Loading token</p>
      </div>
    );
  }

  if (!launch) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-40 pb-24 bg-black min-h-screen">
        <div className="border border-yellow-400/20 bg-gradient-to-b from-yellow-500/5 to-transparent rounded-xl p-14 text-center flex flex-col items-center gap-3">
          <p className="text-[18px] font-extrabold tracking-tight text-white">Token not found</p>
          <p className="text-white/70 text-[14px]">
            {error ?? 'This launch does not exist yet.'}
          </p>
          <Link to="/" className="btn btn-primary h-11 px-6 mt-2 yellow-gradient">
            Back to explore
          </Link>
        </div>
      </div>
    );
  }

  const links = launch.links ?? {};

  return (
    <div className="pt-[58px] bg-black min-h-screen text-white">
      {/* --------------------------------------------------- title bar -- */}
      <div className="border-b border-yellow-400/10 bg-black/40">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.16em] text-white/30 hover:text-yellow-300 transition-colors pt-5"
          >
            <ArrowLeft size={12} />
            All launches
          </Link>

          <div className="flex items-start gap-4 md:gap-5 py-5">
            <div className="w-16 h-16 md:w-20 md:h-20 overflow-hidden border border-white/[0.08] shrink-0 flex items-center justify-center">
              {launch.imageUrl ? (
                <img
                  src={launch.imageUrl}
                  alt={launch.symbol}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="mono text-yellow-300 font-semibold text-lg">
                  {launch.symbol.slice(0, 3).toUpperCase()}
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5 mb-2">
                <h1 className="display text-[28px] md:text-[38px] text-white">{launch.name}</h1>
                <span className="mono text-[13px] text-white/40">{launch.symbol}</span>
                {launch.isLive ? (
                  <span className="chip chip-live">
                    <span className="w-1 h-1 rounded-full bg-yellow-300 animate-blink" />
                    Curve open · {countdown(Number(launch.fairLaunchEndsAt))}
                  </span>
                ) : (
                  <span className="chip chip-ink">Trading live</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={copyAddress}
                  className="chip hover:border-yellow-400/30 transition-colors cursor-pointer"
                >
                  {copied ? <Check size={11} className="text-yellow-300" /> : <Copy size={11} className="text-yellow-300" />}
                  {shortAddress(launch.memecoin, 6)}
                </button>
                <a
                  href={explorerAddress(launch.memecoin)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="chip hover:border-yellow-400/30 transition-colors"
                >
                  <ExternalLink size={11} className="text-yellow-300" />
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
      </div>

      {/* ------------------------------------------------- stat ledger -- */}
      <div className="border-b border-yellow-400/10 bg-black/40">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-px bg-yellow-400/5 border-x border-yellow-400/10">
            <Stat
              label="Volume · 24h"
              value={fmtNative(volume.day.toString())}
              hint={CONTRACTS.nativeTokenSymbol}
            />
            <Stat
              label="Volume · all time"
              value={fmtNative(volume.all.toString())}
              hint={CONTRACTS.nativeTokenSymbol}
            />
            <Stat
              label="Raised"
              value={fmtNative(launch.revenue)}
              hint={CONTRACTS.nativeTokenSymbol}
            />
            <Stat
              label="Target MC"
              value={fmtNative(launch.targetMarketCap)}
              hint={CONTRACTS.nativeTokenSymbol}
            />
            <Stat label="Buys" value={String(launch.buyCount)} hint="Fair launch trades" />
            <Stat
              label="Remaining"
              value={fmtToken(launch.remainingSupply)}
              hint={`of ${fmtToken(launch.initialTokenFairLaunch)}`}
            />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------- body -- */}
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 py-8">
        <div className="grid lg:grid-cols-[1.6fr_1fr] gap-6 items-start">
          {/* ---------------------------------------------------- left */}
          <div className="space-y-5">
            <div className="border border-white/[0.04] bg-gradient-to-b from-yellow-500/3 to-transparent rounded-xl p-5">
              <div className="flex items-baseline justify-between mb-2">
                <span className="eyebrow">Curve filled</span>
                <span className="num text-[13px] font-semibold text-yellow-300">{pct.toFixed(2)}%</span>
              </div>
              <div className={`meter ${launch.isLive ? 'meter-live' : ''}`}>
                <span style={{ width: `${Math.min(Math.max(pct, 1), 100)}%` }} />
              </div>

              {launch.description && (
                <p className="text-white/70 text-[14px] leading-relaxed mt-5 pt-5 border-t border-yellow-400/10">
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
                      className="btn btn-soft h-9 px-3.5 text-[13px]"
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
                      className="btn btn-soft h-9 px-3.5 text-[13px]"
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
                      className="btn btn-soft h-9 px-3.5 text-[13px]"
                    >
                      <MessageCircle size={13} />
                      Telegram
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* --------------------------------------------- trade tape */}
            <div className="border border-white/[0.04] bg-gradient-to-b from-yellow-500/3 to-transparent rounded-xl">
              <div className="px-5 py-3 border-b border-yellow-400/10 flex items-center justify-between">
                <h2 className="text-[14px] font-bold tracking-tight text-white">Trade tape</h2>
                <span className="mono text-[10px] text-white/30 uppercase tracking-[0.14em]">
                  {launch.buys.length} trades
                </span>
              </div>

              {launch.buys.length === 0 ? (
                <p className="px-5 py-14 text-center text-white/50 text-[14px]">
                  No buys yet — be the first.
                </p>
              ) : (
                <>
                  <div className="hidden sm:grid grid-cols-[1fr_1.2fr_1fr_auto] gap-4 px-5 py-2 border-b border-yellow-400/10 bg-yellow-500/5">
                    {['Buyer', 'Received', 'Paid', 'Time'].map((h) => (
                      <span key={h} className="eyebrow text-white/40">
                        {h}
                      </span>
                    ))}
                  </div>
                  <div className="divide-y divide-yellow-400/5">
                    {launch.buys.map((b) => (
                      <a
                        key={b.id}
                        href={explorerTx(b.transactionHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="grid sm:grid-cols-[1fr_1.2fr_1fr_auto] gap-1 sm:gap-4 px-5 py-2.5 hover:bg-yellow-500/5 transition-colors items-baseline"
                      >
                        <span className="mono text-[12px] text-white/60">{shortAddress(b.buyer, 4)}</span>
                        <span className="num text-[12px] text-white">
                          {fmtToken(b.tokensOut)}{' '}
                          <span className="text-white/40">{launch.symbol}</span>
                        </span>
                        <span className="num text-[12px] text-yellow-300">
                          {fmtNative(b.nativeIn)}{' '}
                          <span className="text-white/40">{CONTRACTS.nativeTokenSymbol}</span>
                        </span>
                        <span className="mono text-[10px] text-white/30 sm:text-right">
                          {timeAgo(Number(b.timestamp))}
                        </span>
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* --------------------------------------------------- right */}
          <div className="lg:sticky lg:top-[74px] space-y-5">
            <div className="border border-white/[0.04] bg-gradient-to-b from-yellow-500/3 to-transparent rounded-xl overflow-hidden">
              {launch.isLive ? (
                <>
                  {/* Buy-only trading during fair launch — sell disabled
                  <div className="grid grid-cols-2 border-b border-yellow-400/10">
                    {(['buy', 'sell'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => {
                          setSide(s);
                          setAmount('');
                          reset();
                        }}
                        className={`h-11 text-[13px] font-bold uppercase tracking-[0.1em] transition-colors cursor-pointer ${
                          side === s
                            ? s === 'buy'
                              ? 'bg-yellow-400 text-black'
                              : 'bg-black text-yellow-300'
                            : 'text-white/40 hover:text-white'
                        } ${s === 'sell' ? 'border-l border-yellow-400/10' : ''}`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                  */}
                  <div className="p-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="eyebrow">
                        You pay · {side === 'buy' ? CONTRACTS.nativeTokenSymbol : launch.symbol}
                      </span>
                      <button
                        onClick={() => setAmount(balanceLabel)}
                        className="mono text-[10px] text-white/40 hover:text-white cursor-pointer"
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
                      className="input-field num w-full h-14 px-4 text-[24px] font-semibold mb-2.5"
                    />

                    {side === 'buy' && amount && Number(amount) > 0 && launch && (
                      <div className="mb-3 px-3.5 py-2.5 bg-yellow-500/10 border border-yellow-400/20 rounded-lg flex items-center justify-between">
                        <span className="eyebrow text-[11px] text-white/40">Estimated receive</span>
                        <span className="num text-[14px] font-bold text-yellow-300">
                          ≈ {fmtToken(
                            (() => {
                              const nativeIn = parseUnits(
                                amount,
                                CONTRACTS.nativeTokenDecimals
                              );
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
                          )} {launch.symbol}
                        </span>
                      </div>
                    )}

                    <div className="seg w-full h-8 mb-4">
                      {['25', '50', '75', '100'].map((p) => (
                        <button
                          key={p}
                          onClick={() => {
                            const v = (Number(balanceLabel) * Number(p)) / 100;
                            setAmount(v ? String(v) : '');
                          }}
                          className="flex-1"
                        >
                          {p}%
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={onSwap}
                      disabled={!isConnected || isBusy || !amount}
                      className="btn w-full py-3.5 text-[14px] yellow-gradient"
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
                        <>
                          Buy {launch.symbol}
                        </>
                      )}
                    </button>

                    {!isConnected && (
                      <p className="mono text-[10px] uppercase tracking-[0.14em] text-white/40 text-center mt-3">
                        Connect a wallet to buy
                      </p>
                    )}

                    {swapError && (
                      <p className="mt-3 mono text-[11px] text-danger break-words leading-relaxed">
                        {swapError}
                      </p>
                    )}

                    {step === 'done' && txHash && (
                      <a
                        href={explorerTx(txHash)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 flex items-center justify-center gap-1.5 mono text-[11px] text-yellow-300 hover:text-yellow-200"
                      >
                        <Check size={12} className="text-yellow-300" />
                        Trade confirmed — view tx
                      </a>
                    )}
                  </div>
                </>
              ) : (
                <div className="p-6 flex flex-col items-center text-center">
                  <span className="chip chip-ink mb-4">Trading live</span>
                  <p className="text-white/70 text-[14px] max-w-[42ch] mb-4">
                    This token has graduated from the fair launch curve and is now trading on MLSwap.
                  </p>
                  <a
                    href={`https://app.mlswapx.xyz/pools/${BigInt(launch.poolId).toString()}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary h-12 px-6 text-[14px] yellow-gradient inline-flex items-center gap-2"
                  >
                    Trade on MLSwap
                    <ExternalLink size={15} />
                  </a>
                </div>
              )}
            </div>

            <div className="border border-white/[0.04] bg-gradient-to-b from-yellow-500/3 to-transparent rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-yellow-400/10">
                <h3 className="text-[14px] font-bold tracking-tight text-white">Launch details & parameters</h3>
              </div>
              <div className="divide-y divide-yellow-400/5">
                {[
                  ['Fair launch supply', fmtToken(launch.initialTokenFairLaunch)],
                  ['Duration', `${(Number(launch.fairLaunchDuration) / 3600).toFixed(2)} hours`],
                  [
                    'Deadline',
                    launch.fairLaunchEndsAt && Number(launch.fairLaunchEndsAt) > 0
                      ? new Date(Number(launch.fairLaunchEndsAt) * 1000).toLocaleString()
                      : 'N/A',
                  ],
                  [
                    'Starts at (flaunchesAt)',
                    launch.fairLaunchStartsAt && Number(launch.fairLaunchStartsAt) > 0
                      ? new Date(Number(launch.fairLaunchStartsAt) * 1000).toLocaleString()
                      : 'Immediate',
                  ],
                  ['Premine', fmtToken(launch.premineAmount)],
                  ['Creator fee', `${Number(launch.creatorFeeAllocation) / 100}%`],
                  ['Multiple', `${launch.multiple}×`],
                  ['Pool ID', shortAddress(launch.poolId, 6)],
                  ['Currency Flipped', launch.currencyFlipped ? 'Yes' : 'No'],
                  ['Status', launch.fairLaunchClosed ? 'Closed' : launch.isLive ? 'Live' : 'Ended'],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between px-5 py-2.5">
                    <span className="text-[13px] text-white/40">{k}</span>
                    <span className="num text-[13px] font-semibold text-white">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
