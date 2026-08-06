import React, { useState, useEffect } from 'react';
import { X, ArrowDown, HelpCircle, Loader2, CheckCircle2 } from 'lucide-react';
import type { Token } from './TokenSelector';
import { parseUnits } from 'viem';
import { useApproval } from '@/hooks/shared/useApproval';
import { UNIVERSALROUTER_ADDRESS } from '@/lib/constants';

interface SwapConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  fromToken: Token;
  toToken: Token;
  amountIn: string;
  amountOut: string;
  gasFeeUsd: string;
  slippagePct: number;
  rateText: string;
  onConfirm: () => Promise<void>;
  isSwapping: boolean;
  userAddress?: `0x${string}`;
}

export default function SwapConfirmationModal({
  isOpen,
  onClose,
  fromToken,
  toToken,
  amountIn,
  amountOut,
  gasFeeUsd,
  slippagePct,
  rateText,
  onConfirm,
  isSwapping,
  userAddress,
}: SwapConfirmationModalProps) {
  const { checkAllowance, approveTokenWithPermit2 } = useApproval();
  const [needsApproval, setNeedsApproval] = useState(false);
  const [checkingAllowance, setCheckingAllowance] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  const isNative = fromToken.address === '0x0000000000000000000000000000000000000000';

  useEffect(() => {
    const checkTokenAllowance = async () => {
      if (!userAddress || isNative || !isOpen || !amountIn) return;
      try {
        setCheckingAllowance(true);
        const rawAmountIn = parseUnits(amountIn, fromToken.decimals);
        const { p2ToSpenderAmount, p2ToSpenderExpiration } = await checkAllowance(
          fromToken.address,
          userAddress,
          UNIVERSALROUTER_ADDRESS as `0x${string}`
        );
        const now = Math.floor(Date.now() / 1000);
        const isExpired = p2ToSpenderExpiration <= now;
        setNeedsApproval(p2ToSpenderAmount < rawAmountIn || isExpired);
      } catch (e) {
        console.error('Allowance check failed:', e);
      } finally {
        setCheckingAllowance(false);
      }
    };

    checkTokenAllowance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, fromToken, amountIn, userAddress]);

  const handleApprove = async () => {
    if (!userAddress) return;
    try {
      setIsApproving(true);
      const rawAmountIn = parseUnits(amountIn, fromToken.decimals);
      await approveTokenWithPermit2(
        fromToken.address,
        rawAmountIn,
        UNIVERSALROUTER_ADDRESS as `0x${string}`
      );
      setNeedsApproval(false);
    } catch (e) {
      console.error('Approval failed:', e);
    } finally {
      setIsApproving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-md transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal Content */}
      <div className="relative w-full max-w-[560px] rounded-2xl border border-white/10 bg-[#0d0d0d]/90 p-6 shadow-2xl backdrop-blur-2xl animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xs uppercase tracking-[0.2em] text-white/60 cursor-pointer">Confirm Swap</h3>
          <button 
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Swap Route Visualizer */}
        <div className="space-y-3 mb-6">
          {/* Pay Block */}
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex items-center justify-between">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[12px] tracking-widest text-white/30">Send</span>
              <span className="text-xl font-medium text-white truncate">{amountIn}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
              {fromToken.logo && (
                <img src={fromToken.logo} alt={fromToken.symbol} className="w-5 h-5 rounded-full" />
              )}
              <span className="text-xs text-white">{fromToken.symbol}</span>
            </div>
          </div>

          {/* Arrow */}
          <div className="flex justify-center -my-5 relative z-10">
            <div className="w-8 h-8 bg-black border border-white/10 rounded-full flex items-center justify-center text-primary shadow-lg">
              <ArrowDown size={14} strokeWidth={2.5} />
            </div>
          </div>

          {/* Receive Block */}
          <div className="bg-white/[0.02] border border-white/5 p-4 rounded-xl flex items-center justify-between">
            <div className="flex flex-col gap-1 min-w-0">
              <span className="text-[12px] tracking-widest text-white/30">Receive</span>
              <span className="text-xl font-medium text-white truncate">{amountOut}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5">
              {toToken.logo && (
                <img src={toToken.logo} alt={toToken.symbol} className="w-5 h-5 rounded-full" />
              )}
              <span className="text-xs text-white">{toToken.symbol}</span>
            </div>
          </div>
        </div>

        {/* Details Table */}
        <div className="bg-white/[0.01] border border-white/5 rounded-xl p-4 space-y-3 mb-6 text-[12px] tracking-widest text-white/40">
          {rateText && (
            <div className="flex justify-between">
              <span>Rate</span>
              <span className="text-white font-mono tracking-normal">{rateText}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Slippage Tolerance</span>
            <span className="text-white">{slippagePct}%</span>
          </div>
          <div className="flex justify-between">
            <span>Estimated Gas Fee</span>
            <span className="text-white">{gasFeeUsd}</span>
          </div>
        </div>

        {/* Step-by-Step Approval & Swap Flow */}
        <div className="space-y-4">
          {!isNative && needsApproval && (
            <div className="space-y-3">
              {/* Step 1: Approve */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-primary/20 bg-primary/[0.02]">
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/30 text-[12px] text-primary">
                    1
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[11px] tracking-widest text-white/80">Approve {fromToken.symbol}</span>
                    <span className="text-[11px] text-white/40">Allow Universal Router to swap your tokens</span>
                  </div>
                </div>
                {checkingAllowance ? (
                  <Loader2 size={16} className="text-white/40 animate-spin" />
                ) : (
                  <button
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="px-4 py-2 bg-primary text-black rounded-full text-[12px] font-bold uppercase tracking-wider transition-all hover:brightness-110 disabled:opacity-50 cursor-pointer"
                  >
                    {isApproving ? <Loader2 size={12} className="animate-spin" /> : 'Approve'}
                  </button>
                )}
              </div>

              {/* Step 2: Swap (Disabled until approved) */}
              <div className="flex items-center justify-between p-3 rounded-lg border opacity-40">
                <div className="flex items-center gap-3">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px]">
                    
                  </div>
                  <div className="flex flex-col text-[10px]">
                    <span className="text-[10px]">Swap {fromToken.symbol} to {toToken.symbol}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Button */}
          {(!isNative && needsApproval) ? (
            <button
              disabled
              className="w-full py-4 px-6 bg-white/5 border border-white/10 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold text-white/30 cursor-not-allowed cursor-pointer"
            >
              Please Approve First
            </button>
          ) : (
            <button
              onClick={onConfirm}
              disabled={isSwapping}
              className="w-full py-4 px-6 bg-primary text-black rounded-full text-[10px] tracking-[0.2em] font-bold gold-glow transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isSwapping ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Swapping...
                </>
              ) : (
                `Swap ${fromToken.symbol} to ${toToken.symbol}`
              )}
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
