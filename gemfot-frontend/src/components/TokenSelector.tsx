import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Search, X } from 'lucide-react';
import { useAccount } from 'wagmi';

import { TokenConfig } from '@/config/tokens';
import { useTokenBalance } from '@/hooks/shared/useTokenBalance';

export interface Token extends TokenConfig {
  balance?: string;
}


interface TokenSelectorProps {
  selectedToken: Token | null;
  onSelect: (token: Token) => void;
  tokens: Token[];
  excludeToken?: Token | null;
  label?: string;
  className?: string;
  disabled?: boolean;
}

const TokenListItem = ({ token, isSelected, onClick }: { token: Token, isSelected: boolean, onClick: () => void }) => {
  const { address } = useAccount();
  const { formattedBalance } = useTokenBalance({ token, address });

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.03] transition-colors group cursor-pointer ${
        isSelected ? 'bg-primary/5' : ''
      }`}
    >
      <div className="flex items-center gap-4">
        <img src={token.logo} alt={token.symbol} className="w-8 h-8 border border-white/10" />
        <div className="text-left">
          <p className={`text-[15px] tracking-tight ${
            isSelected ? 'text-primary' : 'text-white'
          }`}>
            {token.symbol}
          </p>
          <p className="text-[11px] font-medium text-white/30 uppercase tracking-widest">{token.name}</p>
        </div>
      </div>
      
      <div className="flex flex-col items-end gap-1">
        <span className="text-[12px] font-mono text-white/60">{formattedBalance}</span>
        {isSelected && (
          <span className="text-[10px] uppercase tracking-widest text-primary ">Selected</span>
        )}
      </div>
    </button>
  );
};

const TokenSelector: React.FC<TokenSelectorProps> = ({
  selectedToken,
  onSelect,
  tokens,
  excludeToken = null,
  label = "Select Token",
  className = "",
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTokens = tokens.filter(token => {
    if (excludeToken && token.address === excludeToken.address) return false;
    return (
      token.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      token.address.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  return (
    <div className={`relative ${className}`}>
      {/* Selector Button */}
      <button
        onClick={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={`flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-2.5 rounded-full transition-all cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-white/10 group active:scale-95'
        }`}
      >
        {selectedToken ? (
          <>
            <img src={selectedToken.logo} alt={selectedToken.symbol} className="w-5 h-5 shrink-0 rounded-full" />
            <span className="text-sm  text-white tracking-tight">{selectedToken.symbol}</span>
          </>
        ) : (
          <span className="text-sm  text-white/40 uppercase tracking-tight">{label}</span>
        )}
        {!disabled && (
          <ChevronDown 
            size={14} 
            className={`text-white/20 group-hover:text-primary transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} 
          />
        )}
      </button>

      {/* Dropdown / Modal Portal */}
      {isOpen && createPortal(
        <div
          className="fixed inset-0 z-[10000] flex items-center justify-center px-6"
          /* Backdrop — clicking here closes */
          onClick={() => { setIsOpen(false); setSearchQuery(""); }}
        >
          <div
            className="relative w-full max-w-xl h-[90vh] glass-morphism bg-[#0A0A0A] border border-primary/30 p-10 shadow-[0_0_50px_rgba(255,210,23,0.1)] animate-in zoom-in-95 duration-300 flex flex-col items-center overflow-hidden text-center"
            /* Stop click from bubbling up to backdrop */
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => { setIsOpen(false); setSearchQuery(""); }}
              className="absolute top-6 right-6 text-white/20 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
            
            <div className="flex flex-col items-center text-center mt-6 w-full">
              <h2 className="text-xl  text-white tracking-tighter mb-4 ">Select a token</h2>

              <div className="w-full relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={16} />
                <input
                  autoFocus
                  type="text"
                  placeholder="SEARCH NAME OR ADDRESS"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white/[0.03] border border-white/10 pl-12 pr-6 py-4 text-[12px] rounded-full uppercase tracking-widest text-white outline-none focus:border-primary/40 transition-colors"
                />
              </div>
            </div>

            {/* Token List */}
            <div className="w-full flex-1 overflow-y-auto custom-scrollbar mt-6 px-1">
              {filteredTokens.length > 0 ? (
                <div className="space-y-1">
                  {filteredTokens.map((token) => (
                    <TokenListItem
                      key={token.address}
                      token={token}
                      isSelected={selectedToken?.address === token.address}
                      onClick={() => {
                        onSelect(token);
                        setIsOpen(false);
                        setSearchQuery("");
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center p-8 opacity-20">
                  <Search size={32} className="mb-4" />
                  <p className="text-[11px]  uppercase tracking-widest">No assets found</p>
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default TokenSelector;
