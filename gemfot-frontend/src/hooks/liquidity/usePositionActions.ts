import { useState } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { encodePacked, encodeAbiParameters } from 'viem';
import { POSITION_MANAGER_ADDRESS, ACTIONS } from '../../lib/constants';
import PositionManagerABI from '../../abi/PositionManager.json';
import type { ToastType } from '../../components/Toast';

interface ToastState {
  show: boolean;
  type: ToastType;
  title: string;
  message: string;
  txHash?: string;
}

export interface PoolKey {
  currency0: `0x${string}`;
  currency1: `0x${string}`;
  fee: number;
  tickSpacing: number;
  hooks: `0x${string}`;
}

export function usePositionActions() {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [toast, setToast] = useState<ToastState>({
    show: false,
    type: 'pending',
    title: '',
    message: '',
    txHash: undefined,
  });

  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [isPending, setIsPending] = useState(false);

  function showToast(
    type: ToastType,
    title: string,
    message: string,
    txHash?: string
  ) {
    setToast({ show: true, type, title, message, txHash });
  }

  function dismissToast() {
    setToast(prev => ({ ...prev, show: false }));
  }

  const collectFees = async (tokenId: string, poolKey: PoolKey) => {
    if (!userAddress || !publicClient) {
      showToast('error', 'Wallet/Client Not Connected', 'Please connect your wallet.');
      return;
    }

    try {
      setIsPending(true);
      showToast('pending', 'Preparing Transaction', 'Encoding collect fee actions...');

      const actions = encodePacked(
        ['uint8', 'uint8'],
        [ACTIONS.DECREASE_LIQUIDITY, ACTIONS.TAKE_PAIR]
      );

      const param0 = encodeAbiParameters(
        [
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint128' },
          { type: 'uint128' },
          { type: 'bytes' }
        ],
        [BigInt(tokenId), 0n, 0n, 0n, '0x']
      );

      const param1 = encodeAbiParameters(
        [{ type: 'address' }, { type: 'address' }, { type: 'address' }],
        [poolKey.currency0, poolKey.currency1, userAddress]
      );

      const unlockData = encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'bytes[]' }],
        [actions, [param0, param1]]
      );

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

      showToast('pending', 'Confirming Collect Fees', 'Confirm transaction in your wallet...');

      try {
        await publicClient.simulateContract({
          address: POSITION_MANAGER_ADDRESS as `0x${string}`,
          abi: PositionManagerABI.abi,
          functionName: 'modifyLiquidities',
          args: [unlockData, deadline],
          account: userAddress,
        });
      } catch (simErr) {
        console.warn('Simulation failed:', simErr);
      }

      const hash = await writeContractAsync({
        address: POSITION_MANAGER_ADDRESS as `0x${string}`,
        abi: PositionManagerABI.abi,
        functionName: 'modifyLiquidities',
        args: [unlockData, deadline],
      });

      setTxHash(hash);
      showToast('pending', 'Transaction Submitted', 'Collecting fees...', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'reverted') {
        throw new Error('Transaction reverted on-chain');
      }

      showToast('success', 'Fees Collected!', 'Successfully claimed your accrued LP fees.', hash);
      return receipt;
    } catch (e: any) {
      console.error('Collect fees error:', e);
      showToast('error', 'Failed to Collect Fees', e?.shortMessage ?? e?.message ?? 'Transaction failed');
    } finally {
      setIsPending(false);
    }
  };

  const decreaseLiquidity = async (
    tokenId: string,
    poolKey: PoolKey,
    liquidityToRemove: bigint,
    amount0Min: bigint,
    amount1Min: bigint
  ) => {
    if (!userAddress || !publicClient) {
      showToast('error', 'Wallet/Client Not Connected', 'Please connect your wallet.');
      return;
    }

    try {
      setIsPending(true);
      showToast('pending', 'Preparing Transaction', 'Encoding decrease liquidity actions...');

      const actions = encodePacked(
        ['uint8', 'uint8'],
        [ACTIONS.DECREASE_LIQUIDITY, ACTIONS.TAKE_PAIR]
      );

      const param0 = encodeAbiParameters(
        [
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint128' },
          { type: 'uint128' },
          { type: 'bytes' }
        ],
        [BigInt(tokenId), liquidityToRemove, amount0Min, amount1Min, '0x']
      );

      const param1 = encodeAbiParameters(
        [{ type: 'address' }, { type: 'address' }, { type: 'address' }],
        [poolKey.currency0, poolKey.currency1, userAddress]
      );

      const unlockData = encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'bytes[]' }],
        [actions, [param0, param1]]
      );

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

      showToast('pending', 'Confirming Decrease Liquidity', 'Confirm transaction in your wallet...');

      try {
        await publicClient.simulateContract({
          address: POSITION_MANAGER_ADDRESS as `0x${string}`,
          abi: PositionManagerABI.abi,
          functionName: 'modifyLiquidities',
          args: [unlockData, deadline],
          account: userAddress,
        });
      } catch (simErr) {
        console.warn('Simulation failed:', simErr);
      }

      const hash = await writeContractAsync({
        address: POSITION_MANAGER_ADDRESS as `0x${string}`,
        abi: PositionManagerABI.abi,
        functionName: 'modifyLiquidities',
        args: [unlockData, deadline],
      });

      setTxHash(hash);
      showToast('pending', 'Transaction Submitted', 'Removing liquidity...', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'reverted') {
        throw new Error('Transaction reverted on-chain');
      }

      showToast('success', 'Liquidity Removed!', 'Successfully removed liquidity from your position.', hash);
      return receipt;
    } catch (e: any) {
      console.error('Decrease liquidity error:', e);
      showToast('error', 'Failed to Remove Liquidity', e?.shortMessage ?? e?.message ?? 'Transaction failed');
    } finally {
      setIsPending(false);
    }
  };

  const burnPosition = async (
    tokenId: string,
    poolKey: PoolKey,
    amount0Min: bigint,
    amount1Min: bigint
  ) => {
    if (!userAddress || !publicClient) {
      showToast('error', 'Wallet/Client Not Connected', 'Please connect your wallet.');
      return;
    }

    try {
      setIsPending(true);
      showToast('pending', 'Preparing Transaction', 'Encoding burn position actions...');

      const actions = encodePacked(
        ['uint8', 'uint8'],
        [ACTIONS.BURN_POSITION, ACTIONS.TAKE_PAIR]
      );

      const param0 = encodeAbiParameters(
        [
          { type: 'uint256' },
          { type: 'uint128' },
          { type: 'uint128' },
          { type: 'bytes' }
        ],
        [BigInt(tokenId), amount0Min, amount1Min, '0x']
      );

      const param1 = encodeAbiParameters(
        [{ type: 'address' }, { type: 'address' }, { type: 'address' }],
        [poolKey.currency0, poolKey.currency1, userAddress]
      );

      const unlockData = encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'bytes[]' }],
        [actions, [param0, param1]]
      );

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

      showToast('pending', 'Confirming Burn Position', 'Confirm transaction in your wallet...');

      try {
        await publicClient.simulateContract({
          address: POSITION_MANAGER_ADDRESS as `0x${string}`,
          abi: PositionManagerABI.abi,
          functionName: 'modifyLiquidities',
          args: [unlockData, deadline],
          account: userAddress,
        });
      } catch (simErr) {
        console.warn('Simulation failed:', simErr);
      }

      const hash = await writeContractAsync({
        address: POSITION_MANAGER_ADDRESS as `0x${string}`,
        abi: PositionManagerABI.abi,
        functionName: 'modifyLiquidities',
        args: [unlockData, deadline],
      });

      setTxHash(hash);
      showToast('pending', 'Transaction Submitted', 'Burning position...', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'reverted') {
        throw new Error('Transaction reverted on-chain');
      }

      showToast('success', 'Position Burned!', 'Successfully terminated and burned your position.', hash);
      return receipt;
    } catch (e: any) {
      console.error('Burn position error:', e);
      showToast('error', 'Failed to Burn Position', e?.shortMessage ?? e?.message ?? 'Transaction failed');
    } finally {
      setIsPending(false);
    }
  };

  const increaseLiquidity = async (
    tokenId: string,
    poolKey: PoolKey,
    liquidityToAdd: bigint,
    amount0Max: bigint,
    amount1Max: bigint
  ) => {
    if (!userAddress || !publicClient) {
      showToast('error', 'Wallet/Client Not Connected', 'Please connect your wallet.');
      return;
    }

    try {
      setIsPending(true);
      showToast('pending', 'Preparing Transaction', 'Encoding increase liquidity actions...');

      const actions = encodePacked(
        ['uint8', 'uint8', 'uint8'],
        [ACTIONS.INCREASE_LIQUIDITY, ACTIONS.SETTLE_PAIR, ACTIONS.SWEEP]
      );

      const param0 = encodeAbiParameters(
        [
          { type: 'uint256' },
          { type: 'uint256' },
          { type: 'uint128' },
          { type: 'uint128' },
          { type: 'bytes' }
        ],
        [BigInt(tokenId), liquidityToAdd, amount0Max, amount1Max, '0x']
      );

      const param1 = encodeAbiParameters(
        [{ type: 'address' }, { type: 'address' }],
        [poolKey.currency0, poolKey.currency1]
      );

      const param2 = encodeAbiParameters(
        [{ type: 'address' }, { type: 'address' }],
        ['0x0000000000000000000000000000000000000000', userAddress]
      );

      const unlockData = encodeAbiParameters(
        [{ type: 'bytes' }, { type: 'bytes[]' }],
        [actions, [param0, param1, param2]]
      );

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);

      // Value to pass if any currency is native
      let value = 0n;
      if (poolKey.currency0 === '0x0000000000000000000000000000000000000000') {
        value = amount0Max;
      } else if (poolKey.currency1 === '0x0000000000000000000000000000000000000000') {
        value = amount1Max;
      }

      showToast('pending', 'Confirming Increase Liquidity', 'Confirm transaction in your wallet...');

      try {
        await publicClient.simulateContract({
          address: POSITION_MANAGER_ADDRESS as `0x${string}`,
          abi: PositionManagerABI.abi,
          functionName: 'modifyLiquidities',
          args: [unlockData, deadline],
          value,
          account: userAddress,
        });
      } catch (simErr) {
        console.warn('Simulation failed:', simErr);
      }

      const hash = await writeContractAsync({
        address: POSITION_MANAGER_ADDRESS as `0x${string}`,
        abi: PositionManagerABI.abi,
        functionName: 'modifyLiquidities',
        args: [unlockData, deadline],
        value,
      });

      setTxHash(hash);
      showToast('pending', 'Transaction Submitted', 'Adding liquidity...', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status === 'reverted') {
        throw new Error('Transaction reverted on-chain');
      }

      showToast('success', 'Liquidity Added!', 'Successfully added liquidity to your position.', hash);
      return receipt;
    } catch (e: any) {
      console.error('Increase liquidity error:', e);
      showToast('error', 'Failed to Add Liquidity', e?.shortMessage ?? e?.message ?? 'Transaction failed');
    } finally {
      setIsPending(false);
    }
  };

  return {
    collectFees,
    decreaseLiquidity,
    burnPosition,
    increaseLiquidity,
    isPending,
    txHash,
    toast,
    dismissToast,
    showToast,
  };
}
