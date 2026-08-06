"use client";

import { useState, useEffect, useMemo } from 'react';
import { ArrowDown, Copy, Check, Loader2, Cpu, Sparkles } from 'lucide-react';
import TokenSelector, { Token } from '@/components/TokenSelector';
import Toast from '@/components/Toast';
import SwapConfirmationModal from '@/components/SwapConfirmationModal';
import { TOKENS } from '@/config/tokens';
import { HOOKS_DETAILS } from '@/config/hooksDetail';
import { useAccount, useGasPrice } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { useTokenBalance } from '@/hooks/shared/useTokenBalance';
import { fetchSubgraph, GET_POOLS, SUBGRAPH_ENDPOINT } from '@/lib/queries';
import { useSwapQuote } from '@/hooks/swap/useSwapQuote';
import { useSwap } from '@/hooks/swap/useSwap';
import { ethers } from 'ethers';
import { useSearchParams } from 'react-router-dom';

interface SubgraphPool {
  id: string;
  token0: { id: string; symbol: string; name: string; decimals: string; derivedUSDC: string };
  token1: { id: string; symbol: string; name: string; decimals: string; derivedUSDC: string };
  feeTier: string;
  tickSpacing: string;
  hooks: string;
  liquidity: string;
  sqrtPrice: string;
  totalValueLockedUSD: string;
}

export default function SwapPage() {
  const { address, isConnected } = useAccount();
  const { data: gasPrice } = useGasPrice();
  const { open } = useAppKit();

  const [slippage, setSlippage] = useState('0.5');
  const [isAutoSlippage, setIsAutoSlippage] = useState(true);
  const [searchParams] = useSearchParams();
  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const [fromToken, setFromToken] = useState<Token>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const from = params.get('from');
      if (from) {
        const found = TOKENS.find(t => t.address.toLowerCase() === from.toLowerCase());
        if (found) return found;
      }
    }
    return TOKENS[3];
  });

  const [toToken, setToToken] = useState<Token>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const to = params.get('to');
      if (to) {
        const found = TOKENS.find(t => t.address.toLowerCase() === to.toLowerCase());
        if (found) return found;
      }
    }
    return TOKENS[4];
  });

  // Synchronize tokens if search params update dynamically
  useEffect(() => {
    if (fromParam) {
      const found = TOKENS.find(t => t.address.toLowerCase() === fromParam.toLowerCase());
      if (found) setFromToken(found);
    }
    if (toParam) {
      const found = TOKENS.find(t => t.address.toLowerCase() === toParam.toLowerCase());
      if (found) setToToken(found);
    }
  }, [fromParam, toParam]);

  // Pool lookup state
  const [allPools, setAllPools] = useState<SubgraphPool[]>([]);
  const [poolsLoading, setPoolsLoading] = useState(true);
  const [selectedPoolId, setSelectedPoolId] = useState<string | null>(null);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isExactInput, setIsExactInput] = useState(true);

  const { formattedBalance: fromBalance } = useTokenBalance({ token: fromToken, address });
  const { formattedBalance: toBalance } = useTokenBalance({ token: toToken, address });

  // Fetch all pools once on mount
  useEffect(() => {
    const fetchPools = async () => {
      try {
        setPoolsLoading(true);
        const res = await fetchSubgraph<{ pools: SubgraphPool[] }>(GET_POOLS);
        setAllPools(res.pools || []);
      } catch (e) {
        console.error('Failed to fetch pools:', e);
      } finally {
        setPoolsLoading(false);
      }
    };
    fetchPools();
  }, []);

  // Compute pool ID from pool key
  const computePoolId = (pool: SubgraphPool) => {
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ["address", "address", "uint24", "int24", "address"],
      [
        pool.token0.id,
        pool.token1.id,
        parseInt(pool.feeTier),
        parseInt(pool.tickSpacing),
        pool.hooks,
      ]
    );
    return ethers.keccak256(encoded);
  };

  // Filter pools to those containing both selected tokens
  const matchingPools = useMemo(() => {
    if (!fromToken || !toToken) return [];
    const fromAddr = fromToken.address.toLowerCase();
    const toAddr = toToken.address.toLowerCase();

    return allPools
      .filter((pool) => {
        const t0 = pool.token0.id.toLowerCase();
        const t1 = pool.token1.id.toLowerCase();
        return (
          (t0 === fromAddr && t1 === toAddr) ||
          (t0 === toAddr && t1 === fromAddr)
        );
      })
      .map((pool) => ({
        ...pool,
        computedId: computePoolId(pool),
      }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromToken, toToken, allPools]);

  // Auto-select first matching pool (or clear selection)
  useEffect(() => {
    if (matchingPools.length > 0) {
      // Keep current selection if still valid
      const stillValid = matchingPools.some((p) => p.computedId === selectedPoolId);
      if (!stillValid) {
        setSelectedPoolId(matchingPools[0].computedId);
      }
    } else {
      setSelectedPoolId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchingPools]);

  const selectedPool = useMemo(() => {
    return matchingPools.find(p => p.computedId === selectedPoolId) || null;
  }, [matchingPools, selectedPoolId]);

  const matchedHook = useMemo(() => {
    if (!selectedPool) return null;
    return HOOKS_DETAILS.find(
      h => h.address.toLowerCase() === (selectedPool.hooks || '').toLowerCase()
    ) || null;
  }, [selectedPool]);

  // Swap Quote Hook integration
  const {
    inputAmount,
    outputAmount,
    gas,
    isLoading: quoteLoading,
    error: quoteError,
    onInputChange,
    onOutputChange,
    setInputAmount,
    setOutputAmount,
  } = useSwapQuote({
    token0: fromToken,
    token1: toToken,
    poolFee: selectedPool ? parseInt(selectedPool.feeTier) : 3000,
    tickSpacing: selectedPool ? parseInt(selectedPool.tickSpacing) : 60,
    hooksAddress: selectedPool ? selectedPool.hooks : '0x0000000000000000000000000000000000000000',
    sqrtPriceX96: selectedPool ? selectedPool.sqrtPrice : '0',
  });

  // Swap transaction hook
  const {
    executeSwap,
    toast: swapToast,
    dismissToast: dismissSwapToast,
    isSwapping,
    txnGas,
    clearTxnGas
  } = useSwap();

  // Load initial quote of '1' once selected pool is resolved
  useEffect(() => {
    if (selectedPoolId && !inputAmount) {
      onInputChange('1');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPoolId]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedHookAddress, setCopiedHookAddress] = useState(false);

  const truncateId = (id: string) => `${id.slice(0, 10)}…${id.slice(-6)}`;

  const handleCopyPoolId = (e: React.MouseEvent, fullId: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(fullId);
    setCopiedId(fullId);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleCopyHookAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedHookAddress(true);
    setTimeout(() => setCopiedHookAddress(false), 1500);
  };

  const handleSwapClick = () => {
    if (!inputAmount || Number(inputAmount) <= 0) return;
    if (!outputAmount || Number(outputAmount) <= 0 || quoteError) return;
    setShowConfirmModal(true);
  };

  const handleFlipTokens = () => {
    const prevFrom = fromToken;
    const prevTo = toToken;
    const prevInput = inputAmount;
    const prevOutput = outputAmount;
    setFromToken(prevTo);
    setToToken(prevFrom);
    // Swap amounts and keep direction: exact input stays exact input
    setInputAmount(prevOutput);
    setOutputAmount(prevInput);
    setIsExactInput(true);
  };

  const handleConfirmSwap = async () => {
    if (!selectedPool) return;

    const parsedSlippage = parseFloat(slippage);
    const finalSlippage = parsedSlippage > 0 ? parsedSlippage : 0.5;
    await executeSwap({
      fromToken,
      toToken,
      poolFee: parseInt(selectedPool.feeTier),
      tickSpacing: parseInt(selectedPool.tickSpacing),
      hooksAddress: selectedPool.hooks,
      amountIn: inputAmount,
      amountOut: outputAmount,
      slippagePct: finalSlippage,
      isExactInput,
    });
    setShowConfirmModal(false);
    clearTxnGas();


  };

  const formatGasFee = (gasBigint: bigint | null) => {
    if (!gasBigint) return '$0.00';
    const currentGasPrice = gasPrice ?? 20000000000n; // default to 20 gwei in wei

    const totalWei = gasBigint * currentGasPrice;
    const nativeAmount = Number(totalWei) / 1e18;
    console.log("current gasfee:", nativeAmount.toFixed(4))
    // Native token is USDC on Arc Testnet, so 1 Native Token = $1.00 USD
    return `$${nativeAmount.toFixed(4)}`;
  };

  const rateText = useMemo(() => {
    if (!inputAmount || !outputAmount || Number(inputAmount) === 0) return '';
    const rate = Number(outputAmount) / Number(inputAmount);
    return `1 ${fromToken.symbol} = ${rate.toFixed(4)} ${toToken.symbol}`;
  }, [inputAmount, outputAmount, fromToken, toToken]);

  const reverseRateText = useMemo(() => {
    if (!inputAmount || !outputAmount || Number(outputAmount) === 0) return '';
    const rate = Number(inputAmount) / Number(outputAmount);
    return `1 ${toToken.symbol} = ${rate.toFixed(4)} ${fromToken.symbol}`;
  }, [inputAmount, outputAmount, fromToken, toToken]);



  return (
    <div className="flex-grow flex items-center justify-center pb-40 relative w-full">
      {/* Background Glows */}
      <div className="fixed top-1/4 -left-20 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="fixed bottom-1/4 -right-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full flex flex-col lg:flex-row lg:items-start lg:justify-center gap-8">

        {/* Hook Details — right side, large screens only */}
        {matchedHook && (
          <div className="hidden lg:flex flex-col flex-1 min-w-0 max-w-lg order-2 animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="glass-morphism border border-white/[0.08] bg-gradient-to-b from-white/[0.02] to-white/[0.01] rounded-2xl p-8 flex flex-col gap-6 relative overflow-hidden shadow-2xl" style={{ minHeight: '480px' }}>
              {/* Background Glow */}
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-primary/10 rounded-full blur-[60px] pointer-events-none"></div>
              
              {/* Header */}
              <div className="flex items-center justify-between border-b border-white/5 pb-4 z-10">
                <div className="flex items-center gap-2">
                  <Cpu size={14} className="text-primary animate-pulse" />
                  <span className="text-[10px] tracking-[0.2em] text-white/40 uppercase font-bold">
                    Contract Hook Module
                  </span>
                </div>
                <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 text-primary px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-widest font-semibold font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                  Active
                </div>
              </div>

              <div className="flex-grow flex flex-col gap-6 z-10">
                {/* Hook Name & Address */}
                <div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles size={18} className="text-primary shrink-0" />
                    <h3 className="text-2xl font-bold tracking-tight text-white font-outfit">
                      {matchedHook.name}
                    </h3>
                  </div>
                  
                  {/* Copyable Address Section */}
                  <div className="flex items-center gap-2 bg-black/40 border border-white/[0.05] rounded-xl px-3 py-2 mt-3 group hover:border-white/10 transition-colors">
                    <span className="text-[10px] font-outfit text-white/50 break-all select-all leading-normal uppercase">
                      {matchedHook.address}
                    </span>
                    <button
                      onClick={() => handleCopyHookAddress(matchedHook.address)}
                      className="shrink-0 p-1.5 rounded-md hover:bg-white/5 transition-colors cursor-pointer text-white/40 hover:text-white"
                      title="Copy Hook Address"
                    >
                      {copiedHookAddress ? (
                        <Check size={12} className="text-green-400" />
                      ) : (
                        <Copy size={12} className="opacity-60 group-hover:opacity-100 transition-opacity" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Hook Description */}
                <div className="bg-white/[0.02] border border-white/[0.05] p-6 rounded-2xl flex-grow flex flex-col justify-between gap-6 relative">
                  <p className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap font-outfit">
                    {matchedHook.description}
                  </p>
                  
                  {/* Hook stats / properties summary */}
                  <div className="grid grid-cols-2 gap-3 mt-auto">
                    <div className="bg-black/30 border border-white/[0.04] p-3.5 rounded-xl flex flex-col gap-1.5">
                      <span className="text-[9px] uppercase tracking-widest text-white/30 font-semibold">Reward Type</span>
                      <span className="text-xs font-outfit font-bold text-white/90 flex items-center gap-1.5">
                        {matchedHook.rewardType}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Swap panel */}
        <div className={`w-full max-w-[560px] mx-auto shrink-0 order-1 ${matchedHook ? 'lg:mx-0' : ''}`}>

        {/* Pool Selector */}
        <div className="mb-2">
          {poolsLoading ? (
            <div className="flex items-center gap-2 px-1">
              <div className="h-4 w-4 border-2 border-primary/40 border-t-primary rounded-full animate-spin"></div>
              <span className="text-[11px] uppercase tracking-widest text-white/20">Loading pools…</span>
            </div>
          ) : matchingPools.length === 0 ? (
            <div className="px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/[0.04]">
              <span className="text-[12px] uppercase tracking-widest text-red-400/80">No pool found</span>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {matchingPools.map((pool) => {
                const isSelected = selectedPoolId === pool.computedId;
                const feePercent = (parseInt(pool.feeTier) / 10000).toFixed(2);
                return (
                  <button
                    key={pool.computedId}
                    onClick={() => setSelectedPoolId(pool.computedId)}
                    className={`w-full flex items-center justify-between px-3 py-4 rounded-lg border text-[11px] uppercase tracking-widest transition-all duration-200 ${
                      isSelected
                        ? 'border border-white/5 bg-white/[0.03] text-white'
                        : 'border-white/10 bg-white/[0.02] text-white/40 hover:border-white/20 hover:text-white/60'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="font-mono truncate">{truncateId(pool.computedId)}</span>
                      <button
                        onClick={(e) => handleCopyPoolId(e, pool.computedId)}
                        className="shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors cursor-pointer"
                        title="Copy Pool ID"
                      >
                        {copiedId === pool.computedId ? (
                          <Check size={10} className="text-green-400" />
                        ) : (
                          <Copy size={10} className="opacity-40 hover:opacity-80" />
                        )}
                      </button>
                    </div>
                    <span className="ml-2 shrink-0 opacity-60">{feePercent}% fee</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="glass-morphism p-4 rounded-2xl border border-white/5 bg-white/[0.01] shadow-2xl relative">
          <div className="space-y-3">
            {/* From Token */}
            <div className="bg-white/[0.03] p-5 rounded-none border border-white/5 hover:border-white/10 transition-all text-left">
              <div className="flex justify-between items-center mb-3">
                <span className="text-[12px] text-white/20 tracking-widest">Send</span>
                <span className="text-[12px]  text-white/40">Balance: {fromBalance} {fromToken.symbol}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-full min-w-0">
                  <input 
                    type="text" 
                    value={inputAmount}
                    onChange={(e) => {
                      setIsExactInput(true);
                      onInputChange(e.target.value);
                    }}
                    className={`bg-transparent border-none p-0 text-3xl focus:ring-0 focus:outline-none w-full placeholder:text-white/10 ${
                      isExactInput ? 'text-white font-medium' : 'text-white/40'
                    }`}
                    placeholder="0.00"
                  />
                  {quoteLoading && !isExactInput && (
                    <Loader2 size={18} className="animate-spin text-white/40 shrink-0" />
                  )}
                </div>
                <TokenSelector 
                  selectedToken={fromToken}
                  onSelect={setFromToken}
                  tokens={TOKENS}
                  excludeToken={toToken}
                  className="shrink-0"
                />
              </div>
            </div>

            {/* Interchange Arrow */}
            <div className="flex justify-center -my-8 relative z-10">
              <button
                onClick={handleFlipTokens}
                className="w-10 h-10 bg-black border border-white/10 rounded-full flex items-center justify-center text-primary shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer"
              >
                <ArrowDown size={18} strokeWidth={3} />
              </button>
            </div>

            {/* To Token */}
            <div className="bg-white/[0.03] p-5 rounded-none border border-white/5 hover:border-white/10 transition-all text-left">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[12px] text-white/20 tracking-widest">Receive</span>
                <span className="text-[12px]  text-white/40">Balance: {toBalance} {toToken.symbol}</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 w-full min-w-0">
                  <input 
                    type="text" 
                    value={outputAmount}
                    onChange={(e) => {
                      setIsExactInput(false);
                      onOutputChange(e.target.value);
                    }}
                    className={`bg-transparent border-none p-0 text-3xl focus:ring-0 focus:outline-none w-full placeholder:text-white/10 ${
                      !isExactInput ? 'text-white font-medium' : 'text-white/40'
                    }`}
                    placeholder="0.00"
                  />
                  {quoteLoading && isExactInput && (
                    <Loader2 size={18} className="animate-spin text-white/40 shrink-0" />
                  )}
                </div>
                <TokenSelector 
                  selectedToken={toToken}
                  onSelect={setToToken}
                  tokens={TOKENS}
                  excludeToken={fromToken}
                  className="shrink-0"
                />
              </div>
            </div>
          </div>

          {quoteError && (
            <div className="mt-4 px-4 py-2.5 bg-red-500/[0.04] border border-red-500/10 text-red-400 text-[12px] uppercase tracking-widest text-center rounded-xl font-mono">
              {quoteError}
            </div>
          )}

          {/* Swap Button */}
          {!isConnected ? (
            <button 
              onClick={() => open()}
              className="w-full mt-4 py-3 px-6 rounded-full bg-primary text-black text-[10px] uppercase tracking-[0.2em] font-bold transition-all gold-glow hover:brightness-110 active:scale-[0.98] cursor-pointer"
            >
              Connect Wallet
            </button>
          ) : (
            <button 
              onClick={handleSwapClick}
              disabled={quoteLoading || !!quoteError || !inputAmount || Number(inputAmount) <= 0 || !outputAmount || Number(outputAmount) <= 0}
              className="w-full mt-4 py-3 px-6 rounded-full bg-primary text-black text-[10px] uppercase tracking-[0.2em] font-bold transition-all gold-glow hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              SWAP
            </button>
          )}
        </div>

        {/* Swap Details Box */}
        {(rateText || isConnected) && (
          <div className="mt-4 rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">

            {/* Rate rows — both directions */}
            {rateText && (
              <>
                <div className="flex justify-between items-center px-5 py-3 border-b border-white/[0.05]">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">Rate</span>
                  <span className="text-[12px] font-outfit text-white/60">{rateText}</span>
                </div>
                <div className="flex justify-between items-center px-5 py-3 border-b border-white/[0.05]">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-white/30"></span>
                  <span className="text-[12px] font-outfit text-white/40">{reverseRateText}</span>
                </div>
              </>
            )}

            {/* Slippage row */}
            <div className="flex justify-between items-center px-5 py-3.5 border-b border-white/[0.05]">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">Slippage</span>
              <div className="flex items-center gap-2">
                {/* Preset pills */}
                <div className="flex items-center gap-1 bg-black/30 border border-white/[0.06] rounded-full p-0.5">
                  {['0.1', '0.5', '1.0'].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => { setSlippage(preset); setIsAutoSlippage(preset === '0.5'); }}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all cursor-pointer ${
                        slippage === preset && isAutoSlippage === (preset === '0.5')
                          ? 'bg-primary text-black'
                          : 'text-white/30 hover:text-white'
                      }`}
                    >
                      {preset}%
                    </button>
                  ))}
                </div>
                {/* Custom input */}
                <div className={`flex items-center bg-black/40 border rounded-full px-3 py-1 transition-all ${!isAutoSlippage && !['0.1','0.5','1.0'].includes(slippage) ? 'border-primary/50' : 'border-white/[0.06]'}`}>
                  <input
                    type="text"
                    value={slippage}
                    onChange={(e) => { setSlippage(e.target.value); setIsAutoSlippage(false); }}
                    className="bg-transparent border-none p-0 text-[11px] text-white focus:ring-0 focus:outline-none w-7 text-right"
                  />
                  <span className="text-[11px] ml-0.5 text-white/30">%</span>
                </div>
              </div>
            </div>

            {/* Gas row */}
            {/* <div className="flex justify-between items-center px-5 py-3.5">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/30">Est. Gas</span>
              <span className={`text-[12px] font-mono ${quoteLoading ? 'text-white/20 animate-pulse' : 'text-white/60'}`}>
                {quoteLoading ? 'Calculating…' : formatGasFee(gas)}
              </span>
            </div> */}

          </div>
        )}

        {/* Swap Confirmation Modal */}
        <SwapConfirmationModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          fromToken={fromToken}
          toToken={toToken}
          amountIn={inputAmount}
          amountOut={outputAmount}
          gasFeeUsd={txnGas || "-"}
          slippagePct={parseFloat(slippage) > 0 ? parseFloat(slippage) : 0.5}
          rateText={rateText}
          onConfirm={handleConfirmSwap}
          isSwapping={isSwapping}
          userAddress={address}
        />

        {/* Toast Notification Layer */}
        {swapToast.show && (
          <div className="fixed top-15 right-8 z-[100] flex flex-col gap-4 pointer-events-none">
            <Toast 
              type={swapToast.type}
              title={swapToast.title}
              message={swapToast.message}
              txHash={swapToast.txHash}
              onClose={dismissSwapToast}
            />
          </div>
        )}
        </div>

      </div>
    </div>
  );
}
