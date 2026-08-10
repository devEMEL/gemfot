import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { activeNetwork } from '@/config/networks';

const COLUMNS: { title: string; links: { label: string; to?: string; href?: string }[] }[] = [
  {
    title: 'Protocol',
    links: [
      { label: 'Explore launches', to: '/' },
      { label: 'Launch a token', to: '/launch' },
      { label: 'Portfolio', to: '/portfolio' },
      { label: 'Faucet', href: 'https://app.mlswapx.xyz/faucet' },
      {
        label: 'Contracts',
        href: `${activeNetwork.explorerUrl}/address/${activeNetwork.contracts.gemfotManager}`,
      },
    ],
  },
  {
    title: 'Community',
    links: [
      { label: 'X / Twitter', href: 'https://x.com' },
      { label: 'Discord', href: 'https://discord.gg' },
      { label: 'GitHub', href: 'https://github.com/devEMEL/gemfot' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-yellow-400/10">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6">
        <div className="grid md:grid-cols-[1.6fr_1fr_1fr] gap-10 md:gap-0 py-12 md:divide-x md:divide-yellow-400/10">
          <div className="flex flex-col items-start gap-4 md:pr-12">
            <Logo />
            <p className="text-white/70 text-[14px] leading-relaxed max-w-[42ch]">
              Fair-launch memecoins on Arc. Bonding-curve price discovery, a protective bid wall and
              creator fee streams — all powered by Uniswap v4 hooks.
            </p>
            <div className="flex items-center gap-1.5 mono text-[10px] uppercase tracking-[0.16em] text-white/40 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              {activeNetwork.label}
            </div>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-3 md:pl-12">
              <h4 className="eyebrow text-white/40">{col.title}</h4>
              {col.links.map((l) =>
                l.to ? (
                  <Link
                    key={l.label}
                    to={l.to}
                    className="text-white/70 hover:text-yellow-300 transition-colors text-[14px] w-fit link-underline"
                  >
                    {l.label}
                  </Link>
                ) : (
                  <a
                    key={l.label}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white/70 hover:text-yellow-300 transition-colors text-[14px] w-fit link-underline"
                  >
                    {l.label}
                  </a>
                )
              )}
            </div>
          ))}
        </div>

        <div className="border-t border-yellow-400/10 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
          <p className="mono text-[10px] uppercase tracking-[0.14em] text-white/40">
            © {new Date().getFullYear()} GemFot
          </p>
          <p className="mono text-[10px] uppercase tracking-[0.14em] text-white/40">
            Testnet build — tokens have no real value
          </p>
        </div>
      </div>
    </footer>
  );
}
