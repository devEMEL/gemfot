"use client";

import { useState, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useReadContracts, useWriteContract, usePublicClient } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { Coins, Clock, Wallet, Loader2, ArrowRight, Check, Copy, Sparkles, ExternalLink, Activity, Database } from 'lucide-react';
import { formatUnits } from 'viem';
import { TOKENS } from '@/config/tokens';
import { FAUCET_ADDRESS } from '@/lib/constants';
import FAUCET_ABI from '@/abi/MultiTokenFaucet.json';
import ERC20_ABI from '@/abi/ERC20.json';
import Toast from '@/components/Toast';

export default function FaucetPage() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [isClaiming, setIsClaiming] = useState(false);
  const [copied, setCopied] = useState(false);

  // Toast notifications
  const [toast, setToast] = useState<{
    show: boolean;
    type: 'pending' | 'success' | 'error';
    title: string;
    message: string;
    txHash?: string;
  }>({ show: false, type: 'pending', title: '', message: '' });

  const showToast = (type: 'pending' | 'success' | 'error', title: string, message: string, txHash?: string) => {
    setToast({ show: true, type, title, message, txHash });
  };

  const dismissToast = () => {
    setToast(prev => ({ ...prev, show: false }));
  };

  // 1. Fetch available tokens list from Faucet Contract
  const { data: tokenAddressesData, isLoading: tokensLoading, refetch: refetchTokens } = useReadContract({
    address: FAUCET_ADDRESS as `0x${string}`,
    abi: FAUCET_ABI.abi,
    functionName: 'getTokens',
  });

  const tokenAddresses = useMemo(() => {
    return (tokenAddressesData as `0x${string}`[]) || [];
  }, [tokenAddressesData]);

  // 2. Fetch the claim amounts configured for each token
  const { data: amountsData } = useReadContracts({
    // @ts-ignore
    contracts: tokenAddresses.map(addr => ({
      address: FAUCET_ADDRESS as `0x${string}`,
      abi: FAUCET_ABI.abi,
      functionName: 'amounts',
      args: [addr],
    })),
    query: { enabled: tokenAddresses.length > 0 }
  });

  // 3. Fetch current user balances for each token
  const { data: balancesData, refetch: refetchBalances } = useReadContracts({
    // @ts-ignore
    contracts: tokenAddresses.map(addr => ({
      address: addr as `0x${string}`,
      abi: ERC20_ABI.abi,
      functionName: 'balanceOf',
      args: address ? [address as `0x${string}`] : undefined,
    })),
    query: { enabled: tokenAddresses.length > 0 && !!address }
  });

  // 4. Fetch faucet contract balances for each token
  const { data: faucetBalancesData, refetch: refetchFaucetBalances } = useReadContracts({
    // @ts-ignore
    contracts: tokenAddresses.map(addr => ({
      address: addr as `0x${string}`,
      abi: ERC20_ABI.abi,
      functionName: 'balanceOf',
      args: [FAUCET_ADDRESS as `0x${string}`],
    })),
    query: { enabled: tokenAddresses.length > 0 }
  });

  // 5. Fetch time until next claim
  const { data: timeRemainingData, refetch: refetchTimeRemaining } = useReadContract({
    address: FAUCET_ADDRESS as `0x${string}`,
    abi: FAUCET_ABI.abi,
    functionName: 'timeUntilNextClaim',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address }
  });

  // Countdown timer logic
  const [secondsLeft, setSecondsLeft] = useState<number>(0);

  useEffect(() => {
    if (timeRemainingData !== undefined) {
      setSecondsLeft(Number(timeRemainingData));
    }
  }, [timeRemainingData]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          refetchTimeRemaining();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [secondsLeft, refetchTimeRemaining]);

  // Map token details
  const claimableTokens = useMemo(() => {
    return tokenAddresses.map((addr, idx) => {
      const matchedToken = TOKENS.find(t => t.address.toLowerCase() === addr.toLowerCase());
      const decimals = matchedToken?.decimals ?? 18;

      const claimAmountRaw = amountsData?.[idx]?.result as bigint | undefined;
      const claimAmount = claimAmountRaw ? formatUnits(claimAmountRaw, decimals) : '500';

      const balanceRaw = balancesData?.[idx]?.result as bigint | undefined;
      const balance = balanceRaw ? Number(formatUnits(balanceRaw, decimals)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';

      const faucetBalanceRaw = faucetBalancesData?.[idx]?.result as bigint | undefined;
      const faucetBalance = faucetBalanceRaw ? Number(formatUnits(faucetBalanceRaw, decimals)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0.00';

      return {
        address: addr,
        name: matchedToken?.name ?? 'Unknown Token',
        symbol: matchedToken?.symbol ?? '???',
        logo: matchedToken?.logo ?? '',
        claimAmount,
        balance,
        faucetBalance
      };
    });
  }, [tokenAddresses, amountsData, balancesData, faucetBalancesData]);

  // Refresh data on mount or address change
  useEffect(() => {
    refetchFaucetBalances();
    if (address) {
      refetchTimeRemaining();
      refetchBalances();
    }
  }, [address, refetchBalances, refetchTimeRemaining, refetchFaucetBalances]);

  const handleCopyFaucetAddress = () => {
    navigator.clipboard.writeText(FAUCET_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClaim = async () => {
    if (!address || !publicClient) return;
    setIsClaiming(true);
    showToast('pending', 'Claiming Tokens', 'Please approve the transaction in your wallet...');

    try {
      const hash = await writeContractAsync({
        address: FAUCET_ADDRESS as `0x${string}`,
        abi: FAUCET_ABI.abi,
        functionName: 'claim',
      });

      showToast('pending', 'Transaction Submitted', 'Waiting for confirmation on-chain...', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'reverted') {
        throw new Error('Transaction reverted on-chain.');
      }

      showToast('success', 'Claim Successful!', 'Tokens have been minted to your wallet.', hash);

      // Refresh cooldown and balances
      refetchTimeRemaining();
      refetchBalances();
      refetchFaucetBalances();
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Claim Failed', err?.shortMessage ?? err?.message ?? 'An error occurred during claiming.');
    } finally {
      setIsClaiming(false);
    }
  };

  const formatCountdown = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return [
      hrs.toString().padStart(2, '0'),
      mins.toString().padStart(2, '0'),
      secs.toString().padStart(2, '0')
    ].join(':');
  };

  const isCooldownActive = secondsLeft > 0;

  return (
    <div className="pb-40 relative z-10 w-full min-h-screen flex flex-col items-center">
      {/* Immersive background glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 -z-10 w-full max-w-6xl h-full pointer-events-none">
        <div className="absolute top-10 left-1/4 w-[500px] h-[500px] bg-primary/5 blur-[150px] rounded-full opacity-40" />
        <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-purple-500/5 blur-[130px] rounded-full opacity-30" />
      </div>

      {/* Toast Alert */}
      {toast.show && (
        <div className="fixed bottom-6 right-6 z-[99999]">
          <Toast
            type={toast.type}
            title={toast.title}
            message={toast.message}
            txHash={toast.txHash}
            onClose={dismissToast}
          />
        </div>
      )}

      {/* Header section */}
      <header className="text-center max-w-2xl mx-auto mb-12 mt-4">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-4">
          Mint Test Assets
        </h1>
        <p className="text-white/45 text-sm md:text-base leading-relaxed max-w-lg mx-auto">
          Need tokens to start swapping or testing? Claim a bundle of 500 of each token instantly to start trading.
        </p>
      </header>

      {/* Main Grid: Card & Info side-by-side on desktop */}
      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-8 items-start px-4">
        
        {/* Left Column: Asset Breakdown & Custom Card */}
        <div className="flex flex-col gap-6">
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.01] backdrop-blur-md p-6">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-white/[0.06]">
              <div className="flex items-center gap-2">
                <Coins size={18} className="text-primary" />
                <h3 className="text-white font-semibold text-base tracking-tight">Claimable Bundle</h3>
              </div>
              <span className="text-[10px] uppercase tracking-widest text-white/30 font-semibold bg-white/[0.03] px-2.5 py-1 rounded-full border border-white/5">
                {claimableTokens.length} Tokens configured
              </span>
            </div>

            {tokensLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-24 bg-white/[0.02] border border-white/[0.05] rounded-xl animate-pulse" />
                ))}
              </div>
            ) : claimableTokens.length === 0 ? (
              <div className="p-16 text-center text-white/20 text-xs uppercase tracking-widest border border-white/5 rounded-xl">
                No claimable tokens found.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {claimableTokens.map((token) => {
                  const isFaucetEmpty = token.faucetBalance === '0.00' || token.faucetBalance === '0';
                  return (
                    <div
                      key={token.address}
                      className="group relative flex flex-col justify-between p-5 bg-white/[0.02] hover:bg-white/[0.04] border border-white/[0.04] hover:border-white/[0.12] rounded-2xl transition-all duration-300 overflow-hidden"
                    >
                      {/* Top gold line decoration on hover */}
                      <div className="absolute top-0 left-0 w-full h-[2px] bg-primary opacity-0 group-hover:opacity-60 transition-opacity" />

                      <div className="flex items-start justify-between gap-3 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                            {token.logo ? (
                              <img src={token.logo} alt={token.symbol} className="w-full h-full object-contain" />
                            ) : (
                              <Coins size={20} className="text-white/35" />
                            )}
                          </div>
                          <div>
                            <h4 className="text-sm font-semibold text-white tracking-tight">{token.name}</h4>
                            <span className="text-[10px] font-mono text-white/30 uppercase tracking-wider">{token.symbol}</span>
                          </div>
                        </div>
                        <span className="text-xs bg-primary/10 border border-primary/20 text-primary font-mono font-medium px-2 py-0.5 rounded-md">
                          +{token.claimAmount}
                        </span>
                      </div>

                      {/* Stock & Wallet balances */}
                      <div className="space-y-2 pt-3 border-t border-white/[0.03]">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-white/25 flex items-center gap-1">
                            <Database size={10} /> Stock
                          </span>
                          <span className={`font-mono ${isFaucetEmpty ? 'text-red-400 font-semibold' : 'text-white/55'}`}>
                            {isFaucetEmpty ? 'Empty' : token.faucetBalance}
                          </span>
                        </div>
                        {isConnected && (
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-white/25 flex items-center gap-1">
                              <Wallet size={10} /> Wallet
                            </span>
                            <span className="font-mono text-white/65">{token.balance}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Warning banner */}
            {!tokensLoading && claimableTokens.length > 0 && claimableTokens.every(t => t.faucetBalance === '0.00' || t.faucetBalance === '0') && (
              <div className="mt-6 px-4 py-3.5 bg-red-500/[0.03] border border-red-500/10 rounded-xl flex items-start gap-3">
                <span className="w-2 h-2 rounded-full bg-red-500 mt-1 shrink-0 animate-pulse" />
                <p className="text-[11px] text-red-400/90 leading-relaxed uppercase tracking-wider font-medium">
                  Warning: The faucet contract is currently depleted. Claims will fail until it is replenished.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Interactive Claim / Lock Status Panel */}
        <div className="flex flex-col gap-6">
          
          {/* STEP 1: GAS FAUCET (ATTENTION GRABBING) */}
          <div className="rounded-2xl border-2 border-primary bg-primary/[0.04] p-6 flex flex-col gap-4 shadow-xl relative overflow-hidden group">
            {/* Background glowing aura */}
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex items-center justify-between pb-3 border-b border-primary/20">
              <span className="text-[10px] uppercase tracking-[0.15em] text-primary font-extrabold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                Step 1: Get Gas USDC
              </span>
              <span className="text-[9px] uppercase tracking-widest font-bold text-white/55 bg-white/[0.08] px-2 py-0.5 rounded-full border border-white/10">
                Gas Required
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="text-white font-bold text-sm tracking-tight">Need gas to pay for transactions?</h4>
              <p className="text-[11.5px] text-white/60 leading-relaxed">
                Arc Testnet uses <strong className="text-white">USDC</strong> as the native gas token. You must request testnet USDC from Circle first in order to mint assets.
              </p>
            </div>

            <a
              href="https://faucet.circle.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-xl bg-primary hover:brightness-110 active:scale-[0.98] text-black text-xs font-bold transition-all gold-glow text-center flex items-center justify-center gap-1.5"
            >
              Request USDC Gas on Circle ↗
            </a>
          </div>

          {/* Claim Action Box */}
          <div className="rounded-2xl border border-white/[0.07] bg-white/[0.02] backdrop-blur-md p-6 flex flex-col gap-5 shadow-xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.05]">
              <span className="text-[10px] uppercase tracking-widest text-white/35 font-bold">Step 2: Claim Test Assets</span>
              <span className="flex items-center gap-1 text-[9px] uppercase tracking-widest font-semibold text-emerald-400">
                <Activity size={10} className="animate-pulse" /> Ready
              </span>
            </div>

            {/* Contract Info / Copy Block */}
            <div className="flex flex-col gap-2 p-4 rounded-xl bg-black/40 border border-white/[0.04]">
              <div className="flex items-center justify-between">
                <span className="text-[9px] uppercase tracking-widest text-white/35 font-semibold">Contract Address</span>
                <a
                  href={`https://testnet.arcscan.app/address/${FAUCET_ADDRESS}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[9px] text-primary hover:underline flex items-center gap-1 transition-all"
                >
                  Scan ↗
                </a>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] text-white/60">
                  {FAUCET_ADDRESS.slice(0, 10)}…{FAUCET_ADDRESS.slice(-8)}
                </span>
                <button
                  onClick={handleCopyFaucetAddress}
                  className="p-1.5 rounded bg-white/[0.03] border border-white/[0.06] hover:bg-white/15 text-white/40 hover:text-white transition-all cursor-pointer"
                  title="Copy contract address"
                >
                  {copied ? (
                    <Check size={12} className="text-emerald-400" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </div>
            </div>

            {/* Quick stats mini row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl flex flex-col gap-1">
                <span className="text-[9px] uppercase tracking-widest text-white/20">Cooldown</span>
                <span className="text-xs font-semibold text-white/70">12 Hours</span>
              </div>
              <div className="p-3 bg-white/[0.01] border border-white/[0.04] rounded-xl flex flex-col gap-1">
                <span className="text-[9px] uppercase tracking-widest text-white/20">Token Limit</span>
                <span className="text-xs font-semibold text-white/70">500 / claim</span>
              </div>
            </div>

            {/* Interactive button interface */}
            <div className="mt-2">
              {!isConnected ? (
                <button
                  onClick={() => open()}
                  className="w-full py-3.5 px-6 rounded-full bg-primary hover:brightness-110 active:scale-[0.98] text-black text-[10px] uppercase tracking-[0.2em] font-bold transition-all gold-glow cursor-pointer flex items-center justify-center gap-2"
                >
                  <Wallet size={13} />
                  Connect Wallet
                </button>
              ) : isCooldownActive ? (
                <div className="w-full flex flex-col items-center gap-3 bg-black/30 border border-white/[0.04] rounded-2xl p-5">
                  <div className="flex items-center gap-2 text-white/35">
                    <Clock size={15} className="text-primary animate-pulse" />
                    <span className="text-[10px] uppercase tracking-widest font-bold">Cooldown Lock</span>
                  </div>
                  <div className="text-3xl font-mono tracking-[0.1em] text-white font-bold bg-white/[0.02] border border-white/[0.04] px-4 py-2.5 rounded-xl shadow-inner select-all">
                    {formatCountdown(secondsLeft)}
                  </div>
                  <p className="text-[10px] text-white/25 text-center leading-relaxed max-w-[200px]">
                    You can request tokens again when the cooldown block opens.
                  </p>
                  <button
                    disabled
                    className="w-full py-3 px-6 mt-2 rounded-full bg-white/5 border border-white/10 text-white/20 text-[10px] uppercase tracking-[0.2em] font-bold cursor-not-allowed"
                  >
                    Locked
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleClaim}
                  disabled={isClaiming || tokensLoading}
                  className="w-full py-3.5 px-6 rounded-full bg-primary hover:brightness-110 active:scale-[0.98] text-black text-[10px] uppercase tracking-[0.2em] font-bold transition-all gold-glow disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
                >
                  {isClaiming ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      Minting assets...
                    </>
                  ) : (
                    <>
                      Claim Assets
                      <ArrowRight size={13} strokeWidth={2.5} />
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
