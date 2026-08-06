import { useReadContract } from 'wagmi';
import { formatUnits } from 'viem';
import { Token } from '@/components/TokenSelector';

const balanceOfAbi = [{ 
  name: 'balanceOf', 
  type: 'function', 
  stateMutability: 'view',
  inputs: [{ name: 'account', type: 'address' }],
  outputs: [{ name: '', type: 'uint256' }]
}] as const;

export function useTokenBalance({ token, address }: { token?: Token; address?: string }) {
  const { data: balanceData, isLoading, error } = useReadContract({
    address: token?.address as `0x${string}`,
    abi: balanceOfAbi,
    functionName: 'balanceOf',
    args: address ? [address as `0x${string}`] : undefined,
    query: { enabled: !!address && !!token?.address }
  });

  const formattedBalance = balanceData && token
    ? Number(formatUnits(balanceData as bigint, token.decimals)).toFixed(3) 
    : '0.000';

  return {
    balanceData,
    formattedBalance,
    isLoading,
    error
  };
}
