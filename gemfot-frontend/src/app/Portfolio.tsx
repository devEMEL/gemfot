import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useReadContract } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { formatUnits } from 'viem';
import { Loader2 } from 'lucide-react';
import { useLaunches, type EnrichedLaunch } from '@/hooks/useLaunches';
import { CONTRACTS, explorerAddress } from '@/config/networks';
import { compact, fmtNative, progressPct, timeAgo } from '@/lib/format';
import Erc20Abi from '@/abi/ERC20.json';

function Thumb({ launch, size = 36 }: { launch: EnrichedLaunch; size?: number }) {
  return (
    <div
      className="overflow-hidden bg-gem-100 border border-ink/12 shrink-0 flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      {launch.imageUrl ? (
        <img src={launch.imageUrl} alt={launch.symbol} className="w-full h-full object-cover" />
      ) : (
        <span className="mono text-gem-800 text-[11px] font-semibold">
          {launch.symbol.slice(0, 3).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function HoldingRow({ launch, account }: { launch: EnrichedLaunch; account: `0x${string}` }) {
  const { data: balance } = useReadContract({
    address: launch.memecoin as `0x${string}`,
    abi: Erc20Abi as any,
    functionName: 'balanceOf',
    args: [account],
    query: { refetchInterval: 20_000 },
  });

  const raw = (balance as bigint) ?? 0n;
  if (raw === 0n) return null;

  return (
    <Link
      to={`/token/${launch.memecoin}`}
      className="flex items-center gap-3 px-5 py-3 hover:bg-gem-50 transition-colors"
    >
      <Thumb launch={launch} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold tracking-tight truncate">{launch.name}</p>
        <p className="mono text-[10px] text-ink-mute mt-0.5">{launch.symbol}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="num text-[14px] font-semibold">{compact(Number(formatUnits(raw, 18)))}</p>
        <p className="mono text-[10px] text-ink-mute mt-0.5">{launch.symbol}</p>
      </div>
    </Link>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white px-4 py-3.5 md:px-5 md:py-4 flex flex-col justify-between min-w-0">
      <span className="eyebrow">{label}</span>
      <p className="num text-[22px] font-semibold leading-none mt-2.5 truncate">{value}</p>
      {hint && <p className="mono text-[10px] text-ink-mute mt-1.5 truncate">{hint}</p>}
    </div>
  );
}

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { launches, loading } = useLaunches({ first: 100 });

  const myLaunches = useMemo(() => {
    if (!address) return [];
    return launches.filter(
      (l) =>
        String((l as any).creator?.id ?? (l as any).creator ?? '').toLowerCase() ===
        address.toLowerCase()
    );
  }, [launches, address]);

  const createdRaised = useMemo(
    () => myLaunches.reduce((acc, l) => acc + BigInt(l.revenue || '0'), 0n),
    [myLaunches]
  );

  const { data: usdcBalance } = useReadContract({
    address: CONTRACTS.nativeToken,
    abi: Erc20Abi as any,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-40 pb-24">
        <div className="card hatch p-14 text-center flex flex-col items-center gap-3">
          <span className="eyebrow">Wallet required</span>
          <p className="display text-[26px]">Connect your wallet</p>
          <p className="text-ink-soft text-[14px] max-w-[38ch]">
            See the tokens you hold and the launches you created.
          </p>
          <button onClick={() => open()} className="btn btn-primary h-11 px-6 mt-2">
            Connect wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[58px]">
      {/* --------------------------------------------------- title bar -- */}
      <div className="border-b border-ink/12 bg-white">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8">
          <span className="eyebrow">Account</span>
          <h1 className="display text-[34px] md:text-[46px] mt-3">Portfolio</h1>
          <a
            href={explorerAddress(address!)}
            target="_blank"
            rel="noopener noreferrer"
            className="mono text-[11px] text-ink-mute hover:text-ink transition-colors break-all mt-2 inline-block"
          >
            {address}
          </a>
        </div>
      </div>

      {/* ------------------------------------------------- stat ledger -- */}
      <div className="border-b border-ink/12 bg-ink/[0.04]">
        <div className="max-w-[1200px] mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-ink/12 border-x border-ink/12">
            <Stat
              label={`${CONTRACTS.nativeTokenSymbol} balance`}
              value={fmtNative((usdcBalance as bigint) ?? 0n)}
              hint="Spendable"
            />
            <Stat
              label="Raised by you"
              value={fmtNative(createdRaised.toString())}
              hint={CONTRACTS.nativeTokenSymbol}
            />
            <Stat label="Launches created" value={String(myLaunches.length)} hint="As creator" />
            <Stat label="Tracked launches" value={String(launches.length)} hint="Protocol wide" />
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-8 grid lg:grid-cols-2 gap-5 items-start">
        {/* ------------------------------------------------- holdings -- */}
        <div className="card">
          <div className="px-5 py-3 border-b border-ink/12 flex items-center justify-between">
            <h2 className="text-[14px] font-bold tracking-tight">Your holdings</h2>
            <span className="eyebrow">ERC-20</span>
          </div>
          {loading ? (
            <div className="py-16 flex justify-center">
              <Loader2 size={20} className="animate-spin text-ink-mute" />
            </div>
          ) : (
            <div className="divide-y divide-ink/8">
              {launches.map((l) => (
                <HoldingRow key={l.id} launch={l} account={address!} />
              ))}
              {launches.length === 0 && (
                <p className="px-5 py-14 text-center text-ink-mute text-[14px]">
                  No GemFot tokens found in this wallet yet.
                </p>
              )}
            </div>
          )}
        </div>

        {/* ---------------------------------------------- my launches -- */}
        <div className="card">
          <div className="px-5 py-3 border-b border-ink/12 flex items-center justify-between">
            <h2 className="text-[14px] font-bold tracking-tight">Launches you created</h2>
            <span className="eyebrow">{String(myLaunches.length).padStart(2, '0')}</span>
          </div>

          {myLaunches.length === 0 ? (
            <div className="px-5 py-14 flex flex-col items-center gap-3 text-center">
              <p className="text-ink-soft text-[14px]">You haven't launched a token yet.</p>
              <Link to="/launch" className="btn btn-primary h-10 px-5">
                Launch a token
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-ink/8">
              {myLaunches.map((l) => (
                <Link
                  key={l.id}
                  to={`/token/${l.memecoin}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gem-50 transition-colors"
                >
                  <Thumb launch={l} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold tracking-tight truncate">{l.name}</p>
                    <p className="mono text-[10px] text-ink-mute mt-0.5">
                      {l.symbol} · {timeAgo(Number(l.createdAtTimestamp))}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="num text-[14px] font-semibold">
                      {fmtNative(l.revenue)}{' '}
                      <span className="text-ink-mute text-[11px]">
                        {CONTRACTS.nativeTokenSymbol}
                      </span>
                    </p>
                    <p className="mono text-[10px] text-gem-700 mt-0.5">
                      {progressPct(l.initialTokenFairLaunch, l.remainingSupply).toFixed(1)}% filled
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
