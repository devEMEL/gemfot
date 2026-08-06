import { useState } from 'react';
import { WagmiProvider, http } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createAppKit } from '@reown/appkit/react';
import { WagmiAdapter } from '@reown/appkit-adapter-wagmi';
import { arcTestnet, SUPPORTED_CHAINS, activeNetwork } from '@/config/networks';

const projectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID ||
  import.meta.env.VITE_REOWN_PROJECT_ID ||
  '';

export const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: SUPPORTED_CHAINS as any,
  ssr: false,
  transports: {
    [arcTestnet.id]: http(activeNetwork.rpcUrls[0]),
  },
});

export const config = wagmiAdapter.wagmiConfig;

createAppKit({
  adapters: [wagmiAdapter],
  networks: SUPPORTED_CHAINS as any,
  projectId,
  metadata: {
    name: 'GemFot',
    description: 'Fair-launch memecoins on Arc',
    url: 'https://gemfot.xyz',
    icons: ['https://avatars.githubusercontent.com/u/179229932'],
  },
  themeMode: 'dark',
  themeVariables: {
    '--w3m-accent': '#22c55e',
  },
});

export default function GemFotProviders({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  if (!projectId) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="card rounded-2xl p-8 max-w-md text-center">
          <h2 className="text-xl text-red-400 mb-2">Missing WalletConnect Project ID</h2>
          <p className="text-white/50 text-sm">
            Add <code className="text-[#4ade80]">VITE_WALLETCONNECT_PROJECT_ID</code> to your
            <code className="text-[#4ade80]"> .env</code> and restart the dev server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
