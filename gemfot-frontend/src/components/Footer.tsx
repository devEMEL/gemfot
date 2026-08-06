import { Link } from 'react-router-dom';
import { Logo } from './Logo';

export default function Footer() {
  return (
    <footer className="py-16 border-t border-white/5 bg-black/20 backdrop-blur-md relative z-10 font-raleway">
      <div className="max-w-6xl mx-auto px-6 md:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
          {/* Logo & Description */}
          <div className="col-span-1 md:col-span-2 flex flex-col items-start gap-4">
            <div className="flex items-center gap-2">
              <Logo />
            </div>
            <p className="text-white/40 text-[13px] leading-relaxed max-w-sm">
              {/* A premium next-generation decentralized exchange built for speed, reliability, and visual clarity. */}
              Uniswap v4 dex on Arc
            </p>
          </div>

          {/* Links Section */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-2">
              <a 
                href="https://x.com/mlswapx" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-white/60 hover:text-white transition-colors tracking-wider text-[13px]"
              >
                X (Twitter)
              </a>
              <a 
                href="https://discord.gg/WvBuZyWgYE" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-white/60 hover:text-white transition-colors tracking-wider text-[13px]"
              >
                Discord
              </a>
            </div>
          </div>

          {/* Legal Section */}
          {/* <div className="flex flex-col gap-3">
            <h4 className="text-[12px] uppercase tracking-[0.2em] text-white/30 font-medium">Legal</h4>
            <div className="flex flex-col gap-2">
              <a 
                href="#" 
                className="text-white/60 hover:text-primary transition-colors uppercase tracking-wider font-mono text-[13px]"
              >
                Terms and Conditions
              </a>
              <a 
                href="#" 
                className="text-white/60 hover:text-primary transition-colors uppercase tracking-wider font-mono text-[13px]"
              >
                Privacy Policy
              </a>
            </div>
          </div> */}
        </div>

        {/* Bottom Section */}
        <div className="pt-8 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-white/20 text-[13px]">
            &copy; 2026 MlSwap. All rights reserved.
          </p>
          <div className="text-white/10 text-[11px]">
           
          </div>
        </div>
      </div>
    </footer>
  );
}
