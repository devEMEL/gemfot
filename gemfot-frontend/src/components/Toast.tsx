import React from 'react';
import { X, Check, Loader2, AlertTriangle, ExternalLink } from 'lucide-react';

export type ToastType = 'pending' | 'success' | 'error';

interface ToastProps {
  type: ToastType;
  title: string;
  message: string;
  onClose: () => void;
  txHash?: string;
}

const Toast: React.FC<ToastProps> = ({ type, title, message, onClose, txHash }) => {
  const styles = {
    pending: {
      border: 'border-l-accent-gold',
      icon: <Loader2 size={24} className="text-primary animate-spin" />,
      glow: 'shadow-[0_0_15px_rgba(255,215,0,0.15)]',
      borderMain: 'border-white/10'
    },
    success: {
      border: 'border-l-green-500/50',
      icon: (
        <div className="bg-green-500/10 p-1">
          <Check size={20} className="text-green-500 " />
        </div>
      ),
      glow: 'shadow-[0_0_15px_rgba(34,197,94,0.15)]',
      borderMain: 'border-white/10'
    },
    error: {
      border: 'border-l-red-500/50',
      icon: (
        <div className="bg-red-500/10 p-1">
          <AlertTriangle size={20} className="text-red-500 " />
        </div>
      ),
      glow: 'shadow-[0_0_15px_rgba(239,68,68,0.15)]',
      borderMain: 'border-white/10'
    }
  };

  const current = styles[type];

  return (
    <div className={`pointer-events-auto flex w-full max-w-sm flex-col overflow-hidden rounded-none bg-[#121212]/85 backdrop-blur-xl border border-white/5 border-l-4 ${current.border} ${current.glow} animate-in slide-in-from-right duration-300`}>
      <div className="p-4">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 pt-1">
            {current.icon}
          </div>
          <div className="flex flex-1 flex-col gap-1">
            <p className="text-sm  text-slate-100 uppercase tracking-tight">{title}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{message}</p>
            
            {type === 'pending' && (
              <div className="mt-2 h-0.5 w-full bg-slate-900 overflow-hidden">
                <div className="h-full bg-accent-gold w-2/3 shadow-[0_0_8px_rgba(255,215,0,0.8)]"></div>
              </div>
            )}

            {type === 'success' && (
              <a 
                href={`https://testnet.arcscan.app/tx/${txHash}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="mt-2 flex items-center gap-1 text-[12px]  uppercase tracking-widest text-white hover:brightness-125 transition-all w-fit"
              >
                View on Explorer
                <ExternalLink size={12} />
              </a>
            )}

          </div>
          <button 
            onClick={onClose}
            className="flex-shrink-0 text-slate-600 hover:text-slate-300 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toast;
