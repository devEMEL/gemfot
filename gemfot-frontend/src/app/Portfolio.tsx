import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAccount, useReadContract } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { formatUnits } from 'viem';
import { Loader2, Wallet } from 'lucide-react';
import { useLaunches, type EnrichedLaunch } from '@/hooks/useLaunches';
import { CONTRACTS, explorerAddress } from '@/config/networks';
import { compact, fmtNative, progressPct, timeAgo } from '@/lib/format';
import Erc20Abi from '@/abi/ERC20.json';

function Thumb({ launch, size = 44 }: { launch: EnrichedLaunch; size?: number }) {
  return (
    <div
      className="overflow-hidden rounded-full shrink-0 flex items-center justify-center bg-[#f4f5f7]"
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
        <span className="text-[#f60aa8] text-[12px] font-extrabold">
          {launch.symbol.slice(0, 3).toUpperCase()}
        </span>
      )}
    </div>
  );
}

function HoldingRow({ launch, account }: { launch: EnrichedLaunch; account: `0x${string}` }) {
  const { data: balance } = useReadContract({
    address: launch.memecoin as `0x${string}`,
    abi: (Erc20Abi as any).abi || Erc20Abi,
    functionName: 'balanceOf',
    args: [account],
    query: { refetchInterval: 20_000 },
  });

  const raw = (balance as bigint) ?? 0n;
  if (raw === 0n) return null;

  return (
    <Link
      to={`/token/${launch.memecoin}`}
      className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-[#fdf2f8]/70 transition-colors rounded-2xl"
    >
      <Thumb launch={launch} size={44} />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold tracking-tight truncate text-black">{launch.name}</p>
        <p className="text-[12px] font-medium text-black/35 mt-0.5">
          ${launch.symbol} · {timeAgo(Number(launch.createdAtTimestamp))}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-[14px] font-extrabold text-black tabular-nums">
          {compact(Number(formatUnits(raw, 18)))}
        </p>
        <p className="text-[11px] font-medium text-black/35 mt-0.5">{launch.symbol}</p>
      </div>
    </Link>
  );
}

export default function Portfolio() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { launches, loading } = useLaunches({ first: 100 });

  const myLaunches = useMemo(() => {
    if (!address) return [];
    return launches.filter(
      (l) => String(l.creator ?? '').toLowerCase() === address.toLowerCase()
    );
  }, [launches, address]);

  const createdRaised = useMemo(
    () => myLaunches.reduce((acc, l) => acc + BigInt(l.revenue || '0'), 0n),
    [myLaunches]
  );

  const { data: usdcBalance } = useReadContract({
    address: CONTRACTS.nativeToken,
    abi: (Erc20Abi as any).abi || Erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address, refetchInterval: 15_000 },
  });

  if (!isConnected) {
    return (
      <div className="pt-[64px] min-h-screen">
        <div className="max-w-md mx-auto px-4 py-24">
          <div className="bg-white rounded-[28px] p-12 text-center shadow-[0_2px_12px_rgba(15,17,21,0.06)] border border-black/[0.06] flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-[rgba(246,10,168,0.08)] flex items-center justify-center">
              <Wallet size={24} className="text-[#f60aa8]" />
            </div>
            <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-[#f60aa8]">
              Wallet required
            </p>
            <p className="text-[26px] font-extrabold tracking-tight text-black">Connect your wallet</p>
            <p className="text-black/50 text-[14px] max-w-[36ch] leading-relaxed">
              See the tokens you hold and the launches you created.
            </p>
            <button onClick={() => open()} className="btn btn-primary h-12 px-8 mt-1">
              Connect wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-[64px] min-h-screen">
      <div className="max-w-[1100px] mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Hero balance card */}
        <div className="bg-white rounded-[28px] p-6 md:p-8 shadow-[0_2px_12px_rgba(15,17,21,0.06)] border border-black/[0.06] mb-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-[0.12em] text-black/35">
                Portfolio
              </p>
              <p className="text-[36px] md:text-[44px] font-extrabold tracking-tight text-black mt-2 tabular-nums leading-none">
                ${fmtNative((usdcBalance as bigint) ?? 0n)}
              </p>
              <p className="text-[13px] font-medium text-black/40 mt-2">
                {CONTRACTS.nativeTokenSymbol} balance
              </p>
              <a
                href={explorerAddress(address!)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] font-medium text-black/30 hover:text-[#f60aa8] transition-colors break-all mt-3 inline-block"
              >
                {address}
              </a>
            </div>

            <div className="flex gap-3 flex-wrap">
              <div className="bg-[#f4f5f7] rounded-2xl px-4 py-3 min-w-[120px]">
                <p className="text-[11px] font-semibold text-black/40">Raised by you</p>
                <p className="text-[20px] font-extrabold text-black tabular-nums mt-1">
                  ${fmtNative(createdRaised.toString())}
                </p>
              </div>
              <div className="bg-[rgba(246,10,168,0.08)] rounded-2xl px-4 py-3 min-w-[120px]">
                <p className="text-[11px] font-semibold text-[#f60aa8]/70">Launches</p>
                <p className="text-[20px] font-extrabold text-[#f60aa8] tabular-nums mt-1">
                  {myLaunches.length}
                </p>
              </div>
              <div className="bg-[#f4f5f7] rounded-2xl px-4 py-3 min-w-[120px]">
                <p className="text-[11px] font-semibold text-black/40">Tracked</p>
                <p className="text-[20px] font-extrabold text-black tabular-nums mt-1">
                  {launches.length}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5 items-start">
          {/* Holdings */}
          <div className="bg-white rounded-[28px] overflow-hidden shadow-[0_2px_12px_rgba(15,17,21,0.06)] border border-black/[0.06]">
            <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold text-black">Your holdings</h2>
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-black/30">
                ERC-20
              </span>
            </div>
            {loading ? (
              <div className="py-16 flex justify-center">
                <Loader2 size={20} className="animate-spin text-[#f60aa8]" />
              </div>
            ) : (
              <div className="p-2">
                {launches.map((l) => (
                  <HoldingRow key={l.id} launch={l} account={address!} />
                ))}
                {launches.length === 0 && (
                  <p className="px-4 py-14 text-center text-black/40 text-[14px]">
                    No GemFot tokens found in this wallet yet.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* My launches */}
          <div className="bg-white rounded-[28px] overflow-hidden shadow-[0_2px_12px_rgba(15,17,21,0.06)] border border-black/[0.06]">
            <div className="px-5 py-4 border-b border-black/[0.06] flex items-center justify-between">
              <h2 className="text-[15px] font-extrabold text-black">Launches you created</h2>
              <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-black/30">
                {String(myLaunches.length).padStart(2, '0')}
              </span>
            </div>

            {myLaunches.length === 0 ? (
              <div className="px-5 py-14 flex flex-col items-center gap-4 text-center">
                <p className="text-black/50 text-[14px]">You haven't launched a token yet.</p>
                <Link to="/launch" className="btn btn-primary h-11 px-7">
                  Launch a token
                </Link>
              </div>
            ) : (
              <div className="p-2">
                {myLaunches.map((l) => (
                  <Link
                    key={l.id}
                    to={`/token/${l.memecoin}`}
                    className="flex items-center gap-3.5 px-4 py-3.5 hover:bg-[#fdf2f8]/70 transition-colors rounded-2xl"
                  >
                    <Thumb launch={l} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-extrabold tracking-tight truncate text-black">
                        {l.name}
                      </p>
                      <p className="text-[12px] font-medium text-black/35 mt-0.5">
                        ${l.symbol} · {timeAgo(Number(l.createdAtTimestamp))}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[14px] font-extrabold text-[#f60aa8] tabular-nums">
                        ${fmtNative(l.revenue)}
                      </p>
                      <p className="text-[11px] font-semibold text-[#22c55e] mt-0.5">
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
    </div>
  );
}
