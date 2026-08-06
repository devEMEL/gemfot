

import { usePublicClient, useWriteContract, useAccount } from 'wagmi';
import ERC20_ABI from '../../abi/ERC20.json';
import PERMIT2_ABI from '../../abi/Permit2.json';
import { PERMIT2_ADDRESS } from '../../lib/constants';

const MAX_UINT256 = 2n ** 256n - 1n;
const MAX_UINT160 = 2n ** 160n - 1n;
const MAX_UINT48 = 2n ** 48n - 1n;

export function useApproval() {
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { address: userAddress } = useAccount();

  const checkAllowance = async (
    tokenAddress: `0x${string}`,
    ownerAddress: `0x${string}`,
    spenderAddress: `0x${string}`
  ) => {
    if (!publicClient) throw new Error("Public client not available");

    if (tokenAddress === '0x0000000000000000000000000000000000000000') {
      return {
        tokenToPermit2: MAX_UINT256,
        p2ToSpenderAmount: MAX_UINT160,
        p2ToSpenderExpiration: Number(MAX_UINT48),
        nonce: 0,
      };
    }

    const tokenToPermit2 = (await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI.abi,
      functionName: 'allowance',
      args: [ownerAddress, PERMIT2_ADDRESS as `0x${string}`],
    })) as bigint;

    const permit2Allowance = (await publicClient.readContract({
      address: PERMIT2_ADDRESS as `0x${string}`,
      abi: PERMIT2_ABI.abi,
      functionName: 'allowance',
      args: [ownerAddress, tokenAddress, spenderAddress],
    })) as [bigint, number, number];

    const [p2ToSpenderAmount, p2ToSpenderExpiration, nonce] = permit2Allowance;

    return {
      tokenToPermit2,
      p2ToSpenderAmount,
      p2ToSpenderExpiration,
      nonce,
    };
  };

  const approveTokenWithPermit2 = async (
    tokenAddress: `0x${string}`,
    amount: bigint,
    spenderAddress: `0x${string}`
  ) => {
    if (!publicClient) throw new Error("Public client not available");
    if (!userAddress) throw new Error("User address not available");
    if (tokenAddress === '0x0000000000000000000000000000000000000000') return;

    // 1. Check current ERC20 allowance
    const { tokenToPermit2 } = await checkAllowance(tokenAddress, userAddress, spenderAddress);

    let tx1;
    if (tokenToPermit2 < amount) {
      console.log(`Approving Permit2 for token ${tokenAddress} with MaxUint256...`);
      tx1 = await writeContractAsync({
        address: tokenAddress,
        abi: ERC20_ABI.abi,
        functionName: 'approve',
        args: [PERMIT2_ADDRESS as `0x${string}`, MAX_UINT256],
      });
      console.log("Approve Permit2 tx:", tx1);
      await publicClient.waitForTransactionReceipt({ hash: tx1 });
    } else {
      console.log("Sufficient ERC20 allowance exists for Permit2.");
    }

    // 2. Permit2 → PositionManager: cap at uint160 since that's what Permit2 stores
    const permit2Amount = amount > MAX_UINT160 ? MAX_UINT160 : amount;
    const expiration = Number(MAX_UINT48);
    console.log(`Allowing Spender ${spenderAddress} via Permit2 for token ${tokenAddress} amount ${permit2Amount}...`);
    const tx2 = await writeContractAsync({
      address: PERMIT2_ADDRESS as `0x${string}`,
      abi: PERMIT2_ABI.abi,
      functionName: 'approve',
      args: [tokenAddress, spenderAddress, permit2Amount, expiration],
    });
    console.log("Approve Spender via Permit2 tx:", tx2);
    await publicClient.waitForTransactionReceipt({ hash: tx2 });

    return { tx1, tx2 };
  };

  return {
    checkAllowance,
    approveTokenWithPermit2,
  };
}