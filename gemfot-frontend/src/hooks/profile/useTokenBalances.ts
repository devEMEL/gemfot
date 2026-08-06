import { useAccount, usePublicClient } from 'wagmi';
import { useEffect, useState } from 'react';
import { TOKENS, type TokenConfig } from '@/config/tokens';
import { formatUnits } from 'viem';
import { fetchSubgraph, GET_TOKEN_PRICES_BY_IDS } from '@/lib/queries';

const ERC20_BALANCE_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

export interface TokenBalance {
  token: TokenConfig;
  raw: bigint;
  formatted: string;        // human-readable amount, e.g. "1,234.56"
  usdPrice: number | null;  // null if no pool / not in subgraph
  usdValue: number | null;  // null if price unavailable
}

interface SubgraphTokenPrice {
  id: string;      // lowercased address
  symbol: string;
  derivedUSDC: string;
}

function formatTokenAmount(raw: bigint, decimals: number): string {
  if (raw === 0n) return '0';
  const float = parseFloat(formatUnits(raw, decimals));
  if (float === 0) return '0';
  if (float < 0.0001) return '<0.0001';
  if (float < 1) return float.toFixed(4);
  if (float < 1000) return float.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return float.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

export function useTokenBalances() {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();

  const [balances, setBalances] = useState<TokenBalance[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalUsdValue, setTotalUsdValue] = useState<number>(0);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const refetch = () => setRefreshTrigger((prev) => prev + 1);

  useEffect(() => {
    if (!userAddress || !publicClient) {
      setBalances([]);
      setTotalUsdValue(0);
      return;
    }

    let cancelled = false;

    const fetchAll = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch on-chain balances for all tokens in parallel
        const rawBalances = await Promise.all(
          TOKENS.map(async (token) => {
            try {
              const raw = await publicClient.readContract({
                address: token.address,
                abi: ERC20_BALANCE_ABI,
                functionName: 'balanceOf',
                args: [userAddress],
              });
              return { token, raw };
            } catch {
              return { token, raw: 0n };
            }
          })
        );

        // 2. Fetch derivedUSDC prices from subgraph in one batch request
        //    Subgraph token IDs are lowercased addresses
        const tokenIds = TOKENS.map((t) => t.address.toLowerCase());
        let priceMap = new Map<string, number>();

        try {
          const priceData = await fetchSubgraph<{ tokens: SubgraphTokenPrice[] }>(
            GET_TOKEN_PRICES_BY_IDS,
            { ids: tokenIds }
          );
          for (const t of priceData.tokens) {
            const price = parseFloat(t.derivedUSDC);
            if (!isNaN(price) && price > 0) {
              priceMap.set(t.id.toLowerCase(), price);
            }
          }
        } catch (e) {
          console.warn('Failed to fetch token prices from subgraph:', e);
        }

        if (cancelled) return;

        // Stablecoin fallback: tokens pegged to $1 don't need a pool / subgraph entry.
        // Their balance IS their USD value.
        const STABLECOIN_SYMBOLS = new Set(['USDC', 'mUSDC', 'USDT', 'DAI', 'EURC']);
        for (const token of TOKENS) {
          if (STABLECOIN_SYMBOLS.has(token.symbol) && !priceMap.has(token.address.toLowerCase())) {
            priceMap.set(token.address.toLowerCase(), 1.0);
          }
        }

        // 3. Combine balances + prices
        let total = 0;
        const combined: TokenBalance[] = rawBalances.map(({ token, raw }) => {
          const formatted = formatTokenAmount(raw, token.decimals);
          const usdPrice = priceMap.get(token.address.toLowerCase()) ?? null;
          let usdValue: number | null = null;

          if (usdPrice !== null && raw > 0n) {
            const floatBalance = parseFloat(formatUnits(raw, token.decimals));
            usdValue = floatBalance * usdPrice;
            total += usdValue;
          }

          return { token, raw, formatted, usdPrice, usdValue };
        });

        setBalances(combined);
        setTotalUsdValue(total);
      } catch (e) {
        console.error('useTokenBalances error:', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchAll();
    return () => { cancelled = true; };
  }, [userAddress, publicClient, refreshTrigger]);

  return { balances, isLoading, totalUsdValue, refetch };
}
