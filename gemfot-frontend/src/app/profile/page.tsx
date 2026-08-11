import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount, usePublicClient, useWriteContract, useSendTransaction } from 'wagmi';
import { ExternalLink, Wallet, LayoutList, X, Send, ChevronDown, Check, Loader2 } from 'lucide-react';
import { isAddress, parseUnits, formatUnits } from 'viem';
import { TOKENS, type TokenConfig } from '@/config/tokens';
import { useTokenBalances } from '@/hooks/profile/useTokenBalances';
import { useUserPositions } from '@/hooks/profile/useUserPositions';
import Toast from '@/components/Toast';
import { request } from 'graphql-request';
import { SUBGRAPH_ENDPOINT, GET_USER_ACTIVITY } from '@/lib/queries';

interface ActivityItem {
  id: string;
  hash: string;
  timestamp: number;
  type: string;
  usd: number | string;
  token0Amount?: string;
  token1Amount?: string;
  isToken0Negative?: boolean;
  isToken1Negative?: boolean;
}

const formatCurrency = (val: string | number | undefined) => {
  if (val === undefined || val === null || isNaN(Number(val))) return '$0.00';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(val));
};

const getRelativeTime = (timestamp: number) => {
  const now = Math.floor(Date.now() / 1000);
  const difference = now - timestamp;
  if (difference < 60) return 'Just now';
  const minutes = Math.floor(difference / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const mapSwap = (swap: any, txHash: string, timestamp: number): ActivityItem => {
  const isAmount0Negative = Number(swap.amount0) < 0;
  const isAmount1Negative = Number(swap.amount1) < 0;
  
  const token0Symbol = swap.token0?.symbol || 'Token0';
  const token1Symbol = swap.token1?.symbol || 'Token1';
  
  const typeText = `Swap ${isAmount0Negative ? `${token0Symbol} for ${token1Symbol}` : `${token1Symbol} for ${token0Symbol}`}`;
  const amount0Formatted = `${isAmount0Negative ? '' : '+'}${Number(swap.amount0).toFixed(4)} ${token0Symbol}`;
  const amount1Formatted = `${isAmount1Negative ? '' : '+'}${Number(swap.amount1).toFixed(4)} ${token1Symbol}`;
  
  return {
    id: swap.id,
    hash: txHash,
    timestamp: timestamp,
    type: typeText,
    usd: swap.amountUSD,
    token0Amount: amount0Formatted,
    token1Amount: amount1Formatted,
    isToken0Negative: isAmount0Negative,
    isToken1Negative: isAmount1Negative
  };
};

const mapModifyLiquidity = (ml: any, txHash: string, timestamp: number): ActivityItem => {
  const amount = Number(ml.amount);
  
  const token0Symbol = ml.token0?.symbol || 'Token0';
  const token1Symbol = ml.token1?.symbol || 'Token1';
  
  let typeText = '';
  let isAmt0Neg = false;
  let isAmt1Neg = false;
  
  if (amount === 0) {
    typeText = `Collected Fees (${token0Symbol}/${token1Symbol})`;
    isAmt0Neg = false;
    isAmt1Neg = false;
  } else if (amount > 0) {
    typeText = `Added Liquidity (${token0Symbol}/${token1Symbol})`;
    isAmt0Neg = true;
    isAmt1Neg = true;
  } else {
    typeText = `Removed Liquidity (${token0Symbol}/${token1Symbol})`;
    isAmt0Neg = false;
    isAmt1Neg = false;
  }
  
  const amt0Val = Math.abs(Number(ml.amount0));
  const amt1Val = Math.abs(Number(ml.amount1));
  
  const amount0Formatted = `${isAmt0Neg ? '-' : '+'}${amt0Val.toFixed(4)} ${token0Symbol}`;
  const amount1Formatted = `${isAmt1Neg ? '-' : '+'}${amt1Val.toFixed(4)} ${token1Symbol}`;
  
  return {
    id: ml.id,
    hash: txHash,
    timestamp: timestamp,
    type: typeText,
    usd: ml.amountUSD || 0,
    token0Amount: amount0Formatted,
    token1Amount: amount1Formatted,
    isToken0Negative: isAmt0Neg,
    isToken1Negative: isAmt1Neg
  };
};



export default function ProfilePage() {
  const navigate = useNavigate();
  const { address: userAddress, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { sendTransactionAsync } = useSendTransaction();

  const [activeTab, setActiveTab] = useState<'tokens' | 'activity' | 'positions'>('tokens');

  // Hook values
  const { balances, isLoading: balancesLoading, totalUsdValue, refetch: refetchBalances } = useTokenBalances();
  const { positions: userPositions, isLoading: positionsLoading } = useUserPositions();

  // Dynamic user activity state
  const [profileSwaps, setProfileSwaps] = useState<ActivityItem[]>([]);
  const [profileSwapsLoading, setProfileSwapsLoading] = useState(false);
  const [profileSwapsPage, setProfileSwapsPage] = useState(0);

  useEffect(() => {
    if (!userAddress) {
      setProfileSwaps([]);
      return;
    }

    const fetchUserActivity = async () => {
      try {
        setProfileSwapsLoading(true);
        const data: any = await request(SUBGRAPH_ENDPOINT, GET_USER_ACTIVITY, {
          user: userAddress.toLowerCase(),
          userBytes: userAddress.toLowerCase(),
          first: 50
        });

        const mappedItems: ActivityItem[] = [];

        if (data.swaps) {
          data.swaps.forEach((s: any) => {
            mappedItems.push(mapSwap(s, s.transaction?.id || s.id, Number(s.timestamp)));
          });
        }
        if (data.modifyLiquidities) {
          data.modifyLiquidities.forEach((ml: any) => {
            if (Number(ml.amount) !== 0) {
              mappedItems.push(mapModifyLiquidity(ml, ml.transaction?.id || ml.id, Number(ml.timestamp)));
            }
          });
        }

        // Sort all by timestamp descending
        mappedItems.sort((a, b) => b.timestamp - a.timestamp);
        setProfileSwaps(mappedItems);
        setProfileSwapsPage(0);
      } catch (error) {
        console.error('Error fetching user activity:', error);
      } finally {
        setProfileSwapsLoading(false);
      }
    };

    fetchUserActivity();
  }, [userAddress]);

  const paginatedTransactions = profileSwaps.slice(profileSwapsPage * 10, (profileSwapsPage + 1) * 10);
  const totalPages = Math.ceil(profileSwaps.length / 10);
  const hasPrevProfilePage = profileSwapsPage > 0;
  const hasNextProfilePage = profileSwapsPage < totalPages - 1;

  // Send Modal States
  const [isSendModalOpen, setIsSendModalOpen] = useState(false);
  const [selectedTokenAddress, setSelectedTokenAddress] = useState<string>('0x0000000000000000000000000000000000000000'); // Default to ETH
  const [customTokenAddress, setCustomTokenAddress] = useState('');
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [ethBalance, setEthBalance] = useState<{ raw: bigint; formatted: string } | null>(null);

  // Custom token state
  const [customTokenDetails, setCustomTokenDetails] = useState<{
    address: `0x${string}`;
    name: string;
    symbol: string;
    decimals: number;
    logo: string;
    balanceRaw: bigint;
    balanceFormatted: string;
  } | null>(null);
  const [customTokenLoading, setCustomTokenLoading] = useState(false);
  const [customTokenError, setCustomTokenError] = useState<string | null>(null);

  // Toast State
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


  const selectableTokens = TOKENS;

  // Fetch ETH Balance
  useEffect(() => {
    if (!userAddress || !publicClient || !isSendModalOpen) return;
    
    let cancelled = false;
    const fetchEthBalance = async () => {
      try {
        const bal = await publicClient.getBalance({ address: userAddress });
        if (!cancelled) {
          setEthBalance({
            raw: bal,
            formatted: parseFloat(formatUnits(bal, 18)).toFixed(6)
          });
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchEthBalance();
    const interval = setInterval(fetchEthBalance, 10000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [userAddress, publicClient, isSendModalOpen]);

  // Fetch Custom Token details
  useEffect(() => {
    if (!customTokenAddress || !isAddress(customTokenAddress) || !publicClient || !userAddress) {
      setCustomTokenDetails(null);
      setCustomTokenError(null);
      return;
    }

    let cancelled = false;

    const fetchCustomToken = async () => {
      setCustomTokenLoading(true);
      setCustomTokenError(null);
      try {
        const [decimals, symbol, name, balance] = await Promise.all([
          publicClient.readContract({
            address: customTokenAddress as `0x${string}`,
            abi: [
              { type: 'function', name: 'decimals', inputs: [], outputs: [{ type: 'uint8' }], stateMutability: 'view' }
            ],
            functionName: 'decimals',
          }).catch(() => 18),
          publicClient.readContract({
            address: customTokenAddress as `0x${string}`,
            abi: [
              { type: 'function', name: 'symbol', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' }
            ],
            functionName: 'symbol',
          }).catch(() => 'UNKNOWN'),
          publicClient.readContract({
            address: customTokenAddress as `0x${string}`,
            abi: [
              { type: 'function', name: 'name', inputs: [], outputs: [{ type: 'string' }], stateMutability: 'view' }
            ],
            functionName: 'name',
          }).catch(() => 'Unknown Token'),
          publicClient.readContract({
            address: customTokenAddress as `0x${string}`,
            abi: [
              { type: 'function', name: 'balanceOf', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }], stateMutability: 'view' }
            ],
            functionName: 'balanceOf',
            args: [userAddress],
          }).catch(() => 0n),
        ]);

        if (cancelled) return;

        setCustomTokenDetails({
          address: customTokenAddress as `0x${string}`,
          name,
          symbol,
          decimals,
          logo: 'https://raw.githubusercontent.com/uniswap/assets/master/blockchains/ethereum/info/logo.png',
          balanceRaw: balance,
          balanceFormatted: formatUnits(balance, decimals),
        });
      } catch (err: any) {
        if (!cancelled) {
          setCustomTokenError('Failed to load token. Ensure it is a valid ERC20 contract.');
          setCustomTokenDetails(null);
        }
      } finally {
        if (!cancelled) setCustomTokenLoading(false);
      }
    };

    fetchCustomToken();
    return () => { cancelled = true; };
  }, [customTokenAddress, publicClient, userAddress]);

  const getSelectedTokenDetails = () => {
    if (selectedTokenAddress === 'custom') {
      if (customTokenDetails) {
        return {
          symbol: customTokenDetails.symbol,
          decimals: customTokenDetails.decimals,
          rawBalance: customTokenDetails.balanceRaw,
          formattedBalance: customTokenDetails.balanceFormatted,
          logo: customTokenDetails.logo,
          name: customTokenDetails.name,
        };
      }
      return {
        symbol: 'Custom',
        decimals: 18,
        rawBalance: 0n,
        formattedBalance: '0',
        logo: 'https://raw.githubusercontent.com/uniswap/assets/master/blockchains/ethereum/info/logo.png',
        name: 'Custom ERC20',
      };
    }


    const configToken = TOKENS.find(t => t.address === selectedTokenAddress);
    const balanceInfo = balances.find(b => b.token.address === selectedTokenAddress);
    const rawBal = balanceInfo?.raw ?? 0n;
    const decs = configToken?.decimals ?? 18;
    return {
      symbol: configToken?.symbol ?? 'Unknown',
      decimals: decs,
      rawBalance: rawBal,
      formattedBalance: formatUnits(rawBal, decs),
      logo: configToken?.logo ?? '',
      name: configToken?.name ?? '',
    };
  };

  const handleSend = async () => {
    if (!isConnected || !userAddress) {
      showToast('error', 'Wallet Not Connected', 'Please connect your wallet first.');
      return;
    }

    if (!recipient || !isAddress(recipient)) {
      showToast('error', 'Invalid Recipient', 'Please enter a valid recipient address.');
      return;
    }

    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      showToast('error', 'Invalid Amount', 'Please enter a valid amount.');
      return;
    }

    const tokenDetails = getSelectedTokenDetails();
    const parsedAmount = parseUnits(amount, tokenDetails.decimals);

    if (parsedAmount > tokenDetails.rawBalance) {
      showToast('error', 'Insufficient Balance', `You do not have enough ${tokenDetails.symbol} to cover this send.`);
      return;
    }

    setSendLoading(true);
    showToast('pending', 'Sending Transaction', `Sending ${amount} ${tokenDetails.symbol} to ${recipient.slice(0, 6)}...${recipient.slice(-4)}`);

    try {
      let txHash: `0x${string}`;

      if (selectedTokenAddress === '0x0000000000000000000000000000000000000000') {
        txHash = await sendTransactionAsync({
          to: recipient as `0x${string}`,
          value: parsedAmount,
        });
      } else {
        const tokenAddr = selectedTokenAddress === 'custom' ? customTokenAddress : selectedTokenAddress;
        txHash = await writeContractAsync({
          address: tokenAddr as `0x${string}`,
          abi: [
            {
              type: 'function',
              name: 'transfer',
              inputs: [
                { name: 'to', type: 'address' },
                { name: 'value', type: 'uint256' },
              ],
              outputs: [{ name: '', type: 'bool' }],
              stateMutability: 'nonpayable',
            },
          ],
          functionName: 'transfer',
          args: [recipient as `0x${string}`, parsedAmount],
        });
      }

      showToast('success', 'Send Success', `Successfully sent ${amount} ${tokenDetails.symbol}!`, txHash);
      setIsSendModalOpen(false);
      setAmount('');
      setRecipient('');
      setCustomTokenAddress('');
      
      // Refresh balances
      setTimeout(() => {
        refetchBalances();
      }, 3000);

    } catch (e: any) {
      console.error(e);
      showToast('error', 'Send Failed', e?.shortMessage ?? e?.message ?? 'Failed to send assets.');
    } finally {
      setSendLoading(false);
    }
  };

  const formatUsd = (value: number) =>
    value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

  const formatPrice = (p: number) =>
    p < 0.001 ? p.toExponential(4) : p.toLocaleString('en-US', { maximumFractionDigits: 6 });

  return (
    <div className="pb-40 w-full relative z-10">
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

      {/* Portfolio header */}
      <section className="w-full mb-10">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-8 lg:gap-12">
          <div className="shrink-0">
            <span className="text-primary tracking-[0.2em]  text-[12px] mb-3 block">
              My Portfolio
            </span>
            <h1 className="text-4xl md:text-5xl tracking-tighter text-white mb-3">
              {!isConnected
                ? <span className="text-white/20">Not connected</span>
                : totalUsdValue > 0
                  ? formatUsd(totalUsdValue)
                  : <span className="text-white/40 text-2xl font-mono">{userAddress?.slice(0, 6)}…{userAddress?.slice(-4)}</span>
              }
            </h1>
            {isConnected && (
              <div className="flex flex-wrap items-center gap-3 mt-4">
                <div className="flex items-center gap-2 text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-full w-fit border border-emerald-400/20">
                  <Wallet size={12} />
                  <span className="text-xs tracking-tight">Wallet connected</span>
                </div>
                <button
                  onClick={() => setIsSendModalOpen(true)}
                  className="flex items-center gap-2 text-primary hover:text-black hover:bg-primary bg-transparent border border-primary/30 hover:border-primary px-4 py-1 rounded-full text-xs transition-all cursor-pointer font-medium"
                >
                  <Send size={10} />
                  Send Assets
                </button>
              </div>
            )}
          </div>

          {/* Token balance bar — weighted by USD value */}
          {isConnected && (
            <div className="flex-1 w-full lg:max-w-md glass-morphism rounded-2xl border border-white/5 p-4 md:p-5 flex flex-col justify-center gap-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px]  tracking-[0.2em] text-white/30 shrink-0">Token Allocation</p>
                {totalUsdValue > 0 && (
                  <p className="text-[11px] text-white/40 font-mono">{formatUsd(totalUsdValue)} total</p>
                )}
              </div>
              <div className="flex h-1.5 w-full bg-white/5 rounded-full overflow-hidden shrink-0">
                {balancesLoading ? (
                  <div className="h-full w-full bg-white/10 animate-pulse rounded-full" />
                ) : totalUsdValue === 0 ? (
                  <div className="h-full w-full bg-white/5 rounded-full" />
                ) : (
                  (() => {
                    const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#F97316'];
                    return balances
                      .filter(b => (b.usdValue ?? 0) > 0)
                      .map((b, i) => {
                        const pct = ((b.usdValue ?? 0) / totalUsdValue) * 100;
                        return (
                          <div
                            key={b.token.symbol}
                            className="h-full transition-all duration-500 hover:brightness-125"
                            style={{ width: `${pct}%`, backgroundColor: colors[i % colors.length] }}
                            title={`${b.token.symbol}: ${formatUsd(b.usdValue ?? 0)} (${pct.toFixed(1)}%)`}
                          />
                        );
                      })
                  })()
                )}
              </div>
              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
                {(() => {
                  const colors = ['#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#06B6D4', '#F97316'];
                  return balances
                    .filter(b => (b.usdValue ?? 0) > 0)
                    .map((b, i) => (
                      <span key={b.token.symbol} className="flex items-center gap-1 text-[11px] text-white/40  ">
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: colors[i % colors.length] }} />
                        {b.token.symbol}
                        <span className="text-white/20">{((b.usdValue ?? 0) / totalUsdValue * 100).toFixed(0)}%</span>
                      </span>
                    ));
                })()}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Navigation Tabs */}
      <div className="w-full flex gap-1 p-1 bg-white/[0.03] rounded-full mb-8 shadow-inner border border-white/5 backdrop-blur-md">
        <button 
          onClick={() => setActiveTab('tokens')}
          className={`flex-1 py-3 rounded-full text-[12px] font-bold  tracking-[0.2em] transition-all cursor-pointer ${
            activeTab === 'tokens' 
              ? 'bg-white/10 text-white shadow-lg ring-1 ring-white/10' 
              : 'text-white/40 hover:text-white'
          }`}
        >
          Tokens
        </button>
        <button 
          onClick={() => setActiveTab('positions')}
          className={`flex-1 py-3 rounded-full text-[12px] font-bold  tracking-[0.2em] transition-all cursor-pointer ${
            activeTab === 'positions' 
              ? 'bg-white/10 text-white shadow-lg ring-1 ring-white/10' 
              : 'text-white/40 hover:text-white'
          }`}
        >
          Positions
        </button>
        <button 
          onClick={() => setActiveTab('activity')}
          className={`flex-1 py-3 rounded-full text-[12px] font-bold  tracking-[0.2em] transition-all cursor-pointer ${
            activeTab === 'activity' 
              ? 'bg-white/10 text-white shadow-lg ring-1 ring-white/10' 
              : 'text-white/40 hover:text-white'
          }`}
        >
          Activity
        </button>
      </div>

      {/* Content */}
      <div className="w-full">
        {activeTab === 'tokens' ? (
          <div className="space-y-3">
            {/* Header row */}
            <div className="hidden md:grid grid-cols-[2fr_1fr_1fr] gap-4 px-6 py-3 text-[11px]  tracking-[0.2em] text-white/20">
              <div>Token</div>
              <div className="text-right">Balance</div>
              <div className="text-right">Address</div>
            </div>

            {!isConnected ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-white/20">
                <Wallet size={32} strokeWidth={1.5} />
                <p className="text-[12px]  ">Connect your wallet to see balances</p>
              </div>
            ) : balancesLoading ? (
              Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-5 bg-white/[0.02] border border-white/5 rounded-lg animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-white/10" />
                    <div className="space-y-2">
                      <div className="h-3 w-20 bg-white/10 rounded" />
                      <div className="h-2 w-12 bg-white/5 rounded" />
                    </div>
                  </div>
                  <div className="h-4 w-24 bg-white/10 rounded" />
                </div>
              ))
            ) : (
              balances.map((item) => {
                const hasBalance = item.raw > 0n;
                return (
                  <div
                    key={item.token.address}
                    className={`group relative bg-white/[0.02] border border-white/[0.05] hover:bg-white/[0.04] p-5 rounded-lg transition-all duration-300 overflow-hidden ${
                      hasBalance ? 'hover:border-primary/20' : 'opacity-50'
                    }`}
                  >
                    {/* Left accent on tokens with balance */}
                    {hasBalance && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/60 rounded-r" />
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr] gap-4 items-center">
                      {/* Token info */}
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
                          <img
                            src={item.token.logo}
                            alt={item.token.symbol}
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm text-white tracking-tight">{item.token.name}</h3>
                            {item.usdPrice !== null && (
                              <span className="text-[11px] font-mono text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                                ${item.usdPrice < 0.01
                                  ? item.usdPrice.toFixed(6)
                                  : item.usdPrice.toLocaleString('en-US', { maximumFractionDigits: 4 })}
                              </span>
                            )}
                          </div>
                          <p className="text-white/40 text-[12px]  tracking-[0.15em] mt-0.5">{item.token.symbol}</p>
                        </div>
                      </div>

                      {/* Balance */}
                      <div className="text-left md:text-right">
                        {hasBalance ? (
                          <>
                            <p className="text-lg text-white tracking-tight font-mono">{item.formatted}</p>
                            <p className="text-white/30 text-[12px]   mt-0.5">{item.token.symbol}</p>
                          </>
                        ) : (
                          <p className="text-white/20 text-sm font-mono">—</p>
                        )}
                      </div>

                      {/* USD Value */}
                      <div className="text-left md:text-right">
                        {item.usdValue !== null ? (
                          <>
                            <p className="text-sm text-primary/80 font-mono tracking-tight">{formatUsd(item.usdValue)}</p>
                            <p className="text-white/20 text-[11px]   mt-0.5">value</p>
                          </>
                        ) : (
                          <p className="text-white/20 text-[11px]  ">no price</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        ) : activeTab === 'positions' ? (
          <div className="space-y-6">
            {/* Summary bar */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-[100px] h-[100px] bg-primary/5 blur-[50px] rounded-full pointer-events-none group-hover:bg-primary/10 transition-colors" />
                <p className="text-[11px]   text-white/30 mb-2 relative z-10">Active Positions</p>
                <p className="text-2xl text-white relative z-10 tracking-tight">
                  {positionsLoading ? <span className="animate-pulse">…</span> : userPositions.length}
                </p>
              </div>
              <div className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-[100px] h-[100px] bg-white/5 blur-[50px] rounded-full pointer-events-none group-hover:bg-white/10 transition-colors" />
                <p className="text-[11px]   text-white/30 mb-2 relative z-10">Unique Pools</p>
                <p className="text-2xl text-white relative z-10 tracking-tight">
                  {positionsLoading ? <span className="animate-pulse">…</span>
                    : new Set(userPositions.map(p => `${p.currency0}-${p.currency1}-${p.fee}`)).size}
                </p>
              </div>
            </div>

            {/* Position list */}
            {!isConnected ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-white/20">
                <Wallet size={32} strokeWidth={1.5} />
                <p className="text-[12px]  ">Connect your wallet to see positions</p>
              </div>
            ) : positionsLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="p-8 bg-white/[0.02] border border-white/5 rounded-2xl animate-pulse">
                    <div className="flex items-center gap-4">
                      <div className="flex -space-x-3">
                        <div className="w-12 h-12 rounded-full bg-white/10 border-2 border-black" />
                        <div className="w-12 h-12 rounded-full bg-white/5 border-2 border-black" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <div className="h-4 w-40 bg-white/10 rounded" />
                        <div className="h-3 w-56 bg-white/5 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : userPositions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-4 text-white/20">
                <LayoutList size={32} strokeWidth={1.5} />
                <p className="text-[12px]  ">No positions found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {userPositions.map((pos) => (
                  <div
                    key={pos.tokenId}
                    onClick={() => navigate(`/positions/${pos.tokenId}`)}
                    className="group bg-white/[0.01] border border-white/[0.05] hover:bg-white/[0.03] hover:border-primary/20 p-8 rounded-2xl transition-all duration-300 cursor-pointer relative overflow-hidden"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      {/* Left: token logos + pair info */}
                      <div className="flex items-center gap-6">
                        <div className="flex -space-x-3 shrink-0">
                          {[pos.token0, pos.token1].map((tok, i) => (
                            <div key={i} className="w-11 h-11 rounded-full border-2 border-black bg-white/5 overflow-hidden">
                              {tok.logo ? (
                                <img
                                  src={tok.logo}
                                  alt={tok.symbol}
                                  className="w-full h-full object-contain  group-hover:grayscale-0 transition-all duration-500"
                                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-[11px] text-white/40">{tok.symbol[0]}</div>
                              )}
                            </div>
                          ))}
                        </div>

                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-lg text-white tracking-tight">
                              {pos.token0.symbol} / {pos.token1.symbol}
                            </h3>
                            <span className="text-[11px] bg-primary/10 text-primary/80 border border-primary/20 px-2 py-0.5 rounded  ">
                              {pos.feePct}
                            </span>
                            <span className="text-[11px] text-white/30 font-mono bg-white/5 px-2 py-0.5 rounded">
                              #{pos.tokenId}
                            </span>
                          </div>
                          <p className="text-[12px] font-mono text-white/30  tracking-[0.1em] mt-2">
                            Range:&nbsp;
                            <span className="text-white/60">
                              {formatPrice(pos.priceLower)}&nbsp;—&nbsp;{formatPrice(pos.priceUpper)}
                            </span>
                            &nbsp;<span className="text-white/20">{pos.token1.symbol}/{pos.token0.symbol}</span>
                          </p>
                        </div>
                      </div>

                      {/* Right: ticks */}
                      <div className="text-left md:text-right shrink-0">
                        <p className="text-[11px] text-white/20   mb-1">Tick Range</p>
                        <p className="text-sm font-mono text-white/60">
                          {pos.tickLower} — {pos.tickUpper}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="w-full bg-white/[0.01] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
            <div className="hidden md:grid grid-cols-[1fr_1.5fr_1fr_1.2fr_1.2fr_1fr] gap-4 px-8 py-6 text-[12px]  tracking-[0.2em] text-white/30 border-b border-white/5 bg-white/[0.02]">
              <div>Time</div>
              <div>Type</div>
              <div>USD</div>
              <div>Token0 Amount</div>
              <div>Token1 Amount</div>
              <div className="text-right">Txn Hash</div>
            </div>
            <div className="divide-y divide-white/5">
              {!isConnected ? (
                <div className="p-12 text-center text-white/20  text-xs  opacity-50">
                  Connect your wallet to see activity
                </div>
              ) : profileSwapsLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr_1.2fr_1.2fr_1fr] gap-4 px-8 py-7 items-center border-b border-white/5 animate-pulse">
                    <div className="h-4 bg-white/5 rounded w-16" />
                    <div className="h-4 bg-white/5 rounded w-32" />
                    <div className="h-4 bg-white/5 rounded w-16" />
                    <div className="h-4 bg-white/5 rounded w-20" />
                    <div className="h-4 bg-white/5 rounded w-20" />
                    <div className="h-4 bg-white/5 rounded w-24 md:ml-auto" />
                  </div>
                ))
              ) : paginatedTransactions && paginatedTransactions.length > 0 ? (
                paginatedTransactions.map((tx) => {
                  const formattedTime = getRelativeTime(tx.timestamp);
                  return (
                    <div key={tx.id} className="grid grid-cols-1 md:grid-cols-[1fr_1.5fr_1fr_1.2fr_1.2fr_1fr] gap-4 px-8 py-7 items-center hover:bg-white/[0.03] transition-all group cursor-pointer">
                      <div className="flex md:block justify-between items-center text-[12px]  tracking-tight text-white/50">
                        <span className="md:hidden text-[11px] text-white/20  ">Time</span>
                        {formattedTime}
                      </div>

                      <div className="flex md:block justify-between items-center">
                        <span className="md:hidden text-[11px] text-white/20  ">Type</span>
                        <p className="text-xs text-white group-hover:text-primary transition-colors  ">{tx.type}</p>
                      </div>

                      <div className="flex md:block justify-between items-center">
                        <span className="md:hidden text-[11px] text-white/20  ">USD</span>
                        <p className="text-xs text-white">
                          {tx.usd === '-' ? '-' : formatCurrency(tx.usd)}
                        </p>
                      </div>

                      <div className="flex md:block justify-between items-center">
                        <span className="md:hidden text-[11px] text-white/20  ">Token0 Amount</span>
                        <p className={`text-[13px] tracking-tight ${tx.isToken0Negative ? 'text-white/60' : 'text-primary/90'}`}>{tx.token0Amount}</p>
                      </div>

                      <div className="flex md:block justify-between items-center">
                        <span className="md:hidden text-[11px] text-white/20  ">Token1 Amount</span>
                        <p className={`text-[13px] tracking-tight ${tx.isToken1Negative ? 'text-white/60' : 'text-primary/90'}`}>{tx.token1Amount || '-'}</p>
                      </div>

                      <div className="flex md:block justify-between items-center md:text-right">
                        <span className="md:hidden text-[11px] text-white/20  ">Txn Hash</span>
                        <a 
                          href={`https://testnet.arcscan.app/tx/${tx.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] font-mono text-white/30 hover:text-primary transition-colors  flex items-center justify-end gap-1.5 group/hash"
                        >
                          {tx.hash.slice(0, 6)}...{tx.hash.slice(-4)}
                          <ExternalLink size={10} className="text-primary/60 shrink-0" />
                        </a>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-12 text-center text-white/20  text-xs  opacity-50">
                  No transactions found
                </div>
              )}
            </div>
            
            <div className="p-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-6 bg-white/[0.01]">
              <p className="text-[12px] text-white/20  ">
                {profileSwaps.length > 0 ? (
                  `Showing ${profileSwapsPage * 10 + 1}-${Math.min((profileSwapsPage + 1) * 10, profileSwaps.length)} of ${profileSwaps.length} transactions`
                ) : (
                  'No transactions'
                )}
              </p>
              <div className="flex gap-3">
                <button 
                  disabled={!hasPrevProfilePage || profileSwapsLoading}
                  onClick={() => setProfileSwapsPage(prev => Math.max(0, prev - 1))}
                  className="px-6 py-2 bg-white/5 border border-white/10 rounded-full text-[11px]   text-white/30 disabled:opacity-30 disabled:pointer-events-none hover:bg-white/10 transition-all cursor-pointer"
                >
                  Prev
                </button>
                <button 
                  disabled={!hasNextProfilePage || profileSwapsLoading}
                  onClick={() => setProfileSwapsPage(prev => prev + 1)}
                  className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-full text-[11px]   text-primary disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Send Assets Modal */}
      {isSendModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center px-6">
          <div
            className="absolute inset-0 bg-black/85 backdrop-blur-md"
            onClick={() => setIsSendModalOpen(false)}
          ></div>

          <div className="relative w-full max-w-xl glass-morphism bg-[#0A0A0A] border border-primary/30 p-10 shadow-[0_0_50px_rgba(184,134,11,0.1)] animate-in zoom-in-95 duration-300 flex flex-col items-center rounded-3xl">
            <button
              onClick={() => setIsSendModalOpen(false)}
              className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <div className="flex flex-col items-center text-center mt-4 mb-6">
              <h2 className="text-xl text-white  tracking-tighter mb-1">Send Assets</h2>
              <p className="text-[11px] text-white/40 font-medium max-w-[280px]  tracking-[0.2em]">
                Transfer native ETH or any custom ERC20 token to another wallet instantly.
              </p>
            </div>

            <div className="w-full space-y-4">
              {/* Token Selector Dropdown */}
              <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                <label className="text-[11px]   text-white/30 block mb-2">Select Token</label>
                <div className="relative">
                  <select
                    value={selectedTokenAddress}
                    onChange={(e) => {
                      setSelectedTokenAddress(e.target.value);
                      setAmount(''); // clear amount to avoid wrong inputs
                    }}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs  tracking-wider outline-none cursor-pointer appearance-none pr-10"
                  >
                    {selectableTokens.map((tok) => (
                      <option key={tok.address} value={tok.address} className="bg-[#121212] text-white">
                        {tok.symbol} - {tok.name}
                      </option>
                    ))}
                    <option value="custom" className="bg-[#121212] text-white font-sans">
                      CUSTOM TOKEN CONTRACT ADDRESS...
                    </option>
                  </select>
                  <ChevronDown className="absolute right-3 top-3.5 text-white/40 pointer-events-none w-4 h-4" />
                </div>
              </div>

              {/* Custom Token Address Input (if selected) */}
              {selectedTokenAddress === 'custom' && (
                <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl animate-in slide-in-from-top-2 duration-200">
                  <label className="text-[11px]   text-white/30 block mb-2">Token Contract Address</label>
                  <input
                    type="text"
                    placeholder="0x..."
                    value={customTokenAddress}
                    onChange={(e) => setCustomTokenAddress(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-mono outline-none"
                  />
                  {customTokenLoading && (
                    <div className="flex items-center gap-2 mt-2 text-[12px] text-white/40">
                      <Loader2 size={12} className="animate-spin" />
                      Loading token contract details...
                    </div>
                  )}
                  {customTokenError && (
                    <div className="text-[12px] text-red-400 mt-2">
                      {customTokenError}
                    </div>
                  )}
                  {customTokenDetails && (
                    <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                      <div className="flex items-center gap-2">
                        <img src={customTokenDetails.logo} className="w-5 h-5 rounded-full" />
                        <div>
                          <p className="text-xs text-white ">{customTokenDetails.symbol}</p>
                          <p className="text-[11px] text-white/40 font-sans">{customTokenDetails.name}</p>
                        </div>
                      </div>
                      <div className="text-right text-[12px] font-mono text-white/60">
                        DECIMALS: {customTokenDetails.decimals}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Recipient Address */}
              <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                <label className="text-[11px]   text-white/30 block mb-2">Recipient Address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white text-xs font-mono outline-none"
                />
              </div>

              {/* Amount Input */}
              <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[11px]   text-white/30">Amount</label>
                  <span className="text-[11px]   text-white/40 font-mono">
                    Balance: {parseFloat(getSelectedTokenDetails().formattedBalance).toLocaleString(undefined, { maximumFractionDigits: 6 })} {getSelectedTokenDetails().symbol}
                  </span>
                </div>
                <div className="flex justify-between items-center gap-4">
                  <input
                    type="text"
                    placeholder="0.0"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="bg-transparent text-2xl text-white outline-none w-2/3  font-mono"
                  />
                  <button
                    onClick={() => setAmount(getSelectedTokenDetails().formattedBalance)}
                    className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-[11px]   rounded transition-all cursor-pointer font-mono shrink-0"
                  >
                    MAX
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 w-full mt-8">
              <button
                onClick={() => setIsSendModalOpen(false)}
                className="py-4 bg-white/5 border border-white/10 text-[11px]   text-white/60 hover:bg-white/10 transition-all cursor-pointer rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={sendLoading || (selectedTokenAddress === 'custom' && !customTokenDetails)}
                className="py-4 bg-primary text-black text-[11px]   shadow-[0_0_20px_rgba(184,134,11,0.3)] hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendLoading ? (
                  <>
                    <Loader2 size={12} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send size={12} />
                    Send Assets
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
