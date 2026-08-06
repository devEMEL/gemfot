import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Copy, Check, Info, Plug, Lock, Unlock } from 'lucide-react';
import TokenSelector, { Token } from '@/components/TokenSelector';
import { TOKENS } from '@/config/tokens';
import { usePool } from '@/hooks/pool/usePool';
import Toast from '@/components/Toast';
import { zeroAddress } from 'viem';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';


export default function CreatePoolPage() {
  const { isConnected } = useAccount();
  const { open } = useAppKit();

  const [feeTier, setFeeTier] = useState(0.3);
  const [tickSpacing, setTickSpacing] = useState(60);
  const [priceRatioA, setPriceRatioA] = useState('1');
  const [priceRatioB, setPriceRatioB] = useState('1');
  const [isCustomRatio, setIsCustomRatio] = useState(false);
  const [customPriceA, setCustomPriceA] = useState('1');
  const [customPriceB, setCustomPriceB] = useState('1');

  const [copiedA, setCopiedA] = useState(false);
  const [copiedB, setCopiedB] = useState(false);
  const [tokenA, setTokenA] = useState<Token>(TOKENS[2]);
  const [tokenB, setTokenB] = useState<Token>(TOKENS[3]);

  const { initializePool, isConfirming, toast, dismissToast } = usePool()


  const [hooks, setHooks] = useState<`0x${string}`>(zeroAddress);


  const copyToken = (address: string, isA: boolean) => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    if (isA) {
      setCopiedA(true);
      setTimeout(() => setCopiedA(false), 2000);
    } else {
      setCopiedB(true);
      setTimeout(() => setCopiedB(false), 2000);
    }
  };

  const feeTiers = [
    { label: 0.01, sub: 'STABLE', spacing: 1 },
    { label: 0.05, sub: 'BEST', spacing: 10 },
    { label: 0.3, sub: 'DEFI', spacing: 60 },
    { label: 1.00, sub: 'EXOTIC', spacing: 200 },
  ];

  const [copied0, setCopied0] = useState(false);
  const [copied1, setCopied1] = useState(false);

  const copyToClipboard = (text: string, isToken0: boolean) => {
    navigator.clipboard.writeText(text);
    if (isToken0) {
      setCopied0(true);
      setTimeout(() => setCopied0(false), 2000);
    } else {
      setCopied1(true);
      setTimeout(() => setCopied1(false), 2000);
    }
  };

  const isTokenA0 = (tokenA.address || '').toLowerCase() < (tokenB.address || '').toLowerCase();
  const t0 = isTokenA0 ? tokenA : tokenB;
  const t1 = isTokenA0 ? tokenB : tokenA;


  return (
    <div className="pb-40 max-w-4xl mx-auto relative w-full">
      <div className="w-full max-w-[560px]">      

          {/* Toast Demo Layer */}
          
          {toast.show && (

            <div className="fixed top-15 right-8 z-[100] flex flex-col gap-4 pointer-events-none">
              <Toast
                  type={toast.type}
                  title={toast.title}
                  message={toast.message}
                  txHash={toast.txHash}
                  onClose={dismissToast}
                />
            </div>
          )}
      </div>
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-primary/5 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-40 left-0 w-[250px] h-[250px] bg-primary/5 blur-[100px] rounded-full pointer-events-none"></div>

      <Link to="/pools" className="flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-8 group w-fit">
        <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
        <span className="text-[12px]  uppercase tracking-widest">Back to Pools</span>
      </Link>


      {/* Header */}
      <div className="flex flex-col gap-2 mb-12">
        <h1 className="text-2xl md:text-3xl  text-white tracking-tighter leading-none">Create Pool</h1>
        {/* <p className="text-[12px]  uppercase tracking-[0.2em] text-white/30">Initialize a new liquidity pair and set protocol parameters.</p> */}
      </div>

      <div className="glass-morphism bg-white/[0.01] border border-white/5 p-10 relative overflow-hidden space-y-10">

        {/* Select Pair Section */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <label className="text-[12px] uppercase tracking-[0.2em]  text-white/20">Step 1: Select Pair</label>
            <Info size={12} className="text-white/10" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Token A */}
            <div className="bg-white/[0.02] border border-white/5 p-6 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-[11px]  uppercase tracking-widest text-white/20">First Asset</span>
              </div>
              <div className="flex justify-between items-center">
                <TokenSelector
                  selectedToken={tokenA}
                  onSelect={setTokenA}
                  tokens={TOKENS}
                  excludeToken={tokenB}
                  className="w-full"
                />
              </div>
            </div>

            {/* Token B */}
            <div className="bg-white/[0.02] border border-white/5 p-6 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-[11px]  uppercase tracking-widest text-white/20">Second Asset</span>
              </div>
              <div className="flex justify-between items-center">
                <TokenSelector
                  selectedToken={tokenB}
                  onSelect={setTokenB}
                  tokens={TOKENS}
                  excludeToken={tokenA}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Token Order Summary - Protocol Readout */}
          <div className="bg-black/40 border border-white/5 p-6 font-mono relative group">
            <div className="space-y-3">
              <div className="flex items-start gap-4 group/t0">
                <span className="text-primary text-[12px]  w-6">[0]</span>
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-[12px]  uppercase">{t0.symbol}</span>
                      <span className="text-white/20 text-[11px] uppercase tracking-widest ">Token0</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(t0.address || '', true)}
                      className={`transition-colors p-1 cursor-pointer ${copied0 ? 'text-primary' : 'text-white/10 hover:text-primary'}`}
                      title="Copy Address"
                    >
                      {copied0 ? <Check size={10} /> : <Copy size={10} />}
                    </button>
                  </div>
                  <span className="text-white/40 text-[11px] tracking-widest break-all select-all leading-relaxed uppercase">
                    {t0.address}
                  </span>
                </div>
              </div>

              <div className="flex items-start gap-4 pt-4 border-t border-white/[0.03] group/t1">
                <span className="text-white/20 text-[12px]  w-6">[1]</span>
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-[12px]  uppercase">{t1.symbol}</span>
                      <span className="text-white/20 text-[11px] uppercase tracking-widest ">Token1</span>
                    </div>
                    <button
                      onClick={() => copyToClipboard(t1.address || '', false)}
                      className={`transition-colors p-1 ${copied1 ? 'text-primary' : 'text-white/10 hover:text-primary'}`}
                      title="Copy Address"
                    >
                      {copied1 ? <Check size={10} /> : <Copy size={10} />}
                    </button>
                  </div>
                  <span className="text-white/40 text-[11px] tracking-widest break-all select-all leading-relaxed uppercase">
                    {t1.address}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Fee Tier Section */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <label className="text-[12px] uppercase tracking-[0.2em]  text-white/20">Step 2: Select Fee Tier</label>
            <Info size={12} className="text-white/10" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {feeTiers.map((tier) => (
              <button
                key={tier.label}
                onClick={() => {setFeeTier(tier.label);setTickSpacing(tier.spacing)}}
                className={`flex flex-col text-left transition-all relative overflow-hidden group border-t-2 cursor-pointer ${feeTier === tier.label
                  ? 'bg-white/[0.04] border-primary shadow-[inset_0_0_20px_rgba(255,210,23,0.05)]'
                  : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.02] hover:border-white/10'
                  }`}
              >
                <div className="p-6 pb-2">
                  <span className={`text-3xl  tracking-tighter block leading-none ${feeTier === tier.label ? 'text-primary' : 'text-white'}`}>
                    {tier.label}%
                  </span>
                </div>

                <div className="mt-auto border-t border-white/[0.03] p-4 bg-white/[0.01] flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className={`text-[11px]  tracking-widest uppercase ${feeTier === tier.label ? 'text-white' : 'text-white/20'}`}>
                      {/* {tier.sub} */}
                    </span>
                    {feeTier === tier.label && (
                      <Check size={8} className="text-primary" />
                    )}
                  </div>
                  <span className={`text-[11px] font-mono tracking-widest uppercase ${feeTier === tier.label ? 'text-primary' : 'text-white/10'}`}>
                    Tick Spacing: {tier.spacing}
                  </span>
                </div>

                {feeTier === tier.label && (
                  <div className="absolute top-0 right-0 w-2 h-2 bg-primary"></div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Starting Price Ratio Section */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <label className="text-[12px] uppercase tracking-[0.2em]  text-white/20">Step 3: Initial Price</label>
            <Info size={12} className="text-white/10" />
          </div>
          <div className="flex flex-wrap gap-2">
            {['1:1', '2:1', '1:2', 'CUSTOM'].map((opt) => {
              const isCustomOpt = opt === 'CUSTOM';
              const [a, b] = isCustomOpt ? [customPriceA, customPriceB] : opt.split(':');
              const isActive = isCustomOpt
                ? isCustomRatio
                : !isCustomRatio && priceRatioA === a && priceRatioB === b;
              return (
                <button
                  key={opt}
                  onClick={() => {
                    if (isCustomOpt) {
                      setIsCustomRatio(true);
                      setPriceRatioA(customPriceA);
                      setPriceRatioB(customPriceB);
                    } else {
                      setIsCustomRatio(false);
                      setPriceRatioA(a);
                      setPriceRatioB(b);
                    }
                  }}
                  className={`px-6 py-3 text-[11px] uppercase tracking-widest transition-all border cursor-pointer ${
                    isActive
                      ? 'bg-primary/20 border-primary text-white'
                      : 'bg-white/[0.02] border-white/5 text-white/40 hover:text-white/60 hover:bg-white/[0.04]'
                  }`}
                >
                  {opt}
                </button>
              );
            })}
          </div>

          {isCustomRatio && (
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 bg-white/[0.02] border border-white/5 p-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="space-y-2">
                <p className="text-[11px] tracking-widest text-white/20 text-center">{t0.symbol}</p>
                <input
                  className="w-full bg-transparent border-b border-white/10 py-2 text-center focus:outline-none focus:border-primary transition-all text-2xl text-white uppercase"
                  type="text"
                  value={customPriceA}
                  onChange={(e) => {
                    setCustomPriceA(e.target.value);
                    setPriceRatioA(e.target.value);
                  }}
                />
              </div>
              <span className="text-primary text-2xl mt-4">:</span>
              <div className="space-y-2">
                <p className="text-[11px] tracking-widest text-white/20 text-center">{t1.symbol}</p>
                <input
                  className="w-full bg-transparent border-b border-white/10 py-2 text-center focus:outline-none focus:border-primary transition-all text-2xl text-white uppercase"
                  type="text"
                  value={customPriceB}
                  onChange={(e) => {
                    setCustomPriceB(e.target.value);
                    setPriceRatioB(e.target.value);
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Hook Details Section */}
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <label className="text-[12px] uppercase tracking-[0.2em]  text-white/20">Step 4: Extension Hooks</label>
            <Info size={12} className="text-white/10" />
          </div>

          <div className="bg-white/[0.02] border border-white/5 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-white/[0.04] border border-white/5 flex items-center justify-center text-primary">
                <Plug size={14} />
              </div>
              <div>
                <h4 className="text-[12px] uppercase tracking-widest text-white">Pool Hook Contract</h4>
                <p className="text-[10px] text-white/40">Specify a hook contract address to run custom logic on pool actions.</p>
              </div>
            </div>

            <div className="relative">
              <input
                className="w-full bg-black/40 border border-white/5 px-4 py-3 rounded-none font-mono text-[12px] tracking-widest text-white uppercase placeholder:text-white/20 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all"
                type="text"
                placeholder={zeroAddress}
                value={hooks === zeroAddress ? '' : hooks}
                onChange={(e) => {
                  const val = e.target.value.trim();
                  if (val === '') {
                    setHooks(zeroAddress);
                  } else {
                    setHooks(val as `0x${string}`);
                  }
                }}
              />
              {hooks !== zeroAddress && (
                <button
                  type="button"
                  onClick={() => setHooks(zeroAddress)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] uppercase tracking-widest text-white/40 hover:text-primary transition-colors cursor-pointer"
                >
                  Reset
                </button>
              )}
            </div>
            
            {hooks !== zeroAddress && !/^0x[a-fA-F0-9]{40}$/.test(hooks) && (
              <p className="text-red-500/80 text-[10px] uppercase tracking-widest font-mono">
                Invalid Ethereum address format
              </p>
            )}
          </div>
        </div>


        {/* Primary Action Button */}
        <div className="pt-4">
          {!isConnected ? (
            <button
              onClick={() => open()}
              className="w-full bg-primary text-black py-4 px-6 rounded-full text-[14px] uppercase tracking-[0.2em] font-bold transition-all gold-glow hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer"
            >
              Connect Wallet
            </button>
          ) : (
            <button 
              disabled={isConfirming}
              className={`w-full bg-primary text-black py-4 px-6 rounded-full text-[10px] uppercase tracking-[0.2em] font-bold transition-all gold-glow hover:brightness-110 active:scale-[0.98] flex items-center justify-center gap-3 cursor-pointer ${isConfirming ? 'opacity-50 cursor-not-allowed' : ''}`}
              onClick={() => initializePool({
                tokenA: t0,
                tokenB: t1,
                fee: feeTier * 10000,
                tickSpacing,
                hooks,
                priceRatioA,
                priceRatioB
              })}
            >
              {isConfirming ? 'Confirming...' : 'Initialize Pool'}
            </button>
          )}

        </div>
      </div>
    </div>
  );
}
