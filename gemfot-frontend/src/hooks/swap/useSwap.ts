import { useState } from 'react';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { encodePacked, encodeAbiParameters, parseUnits, encodeFunctionData, maxUint256, formatEther, formatUnits } from 'viem';
import { useApproval } from '../shared/useApproval';
import { UNIVERSALROUTER_ADDRESS, ACTIONS } from '../../lib/constants';
import type { ToastType } from '../../components/Toast';
import type { TokenConfig } from '@/config/tokens';

const UNIVERSAL_ROUTER_ABI = [
  {
    type: 'function',
    name: 'execute',
    inputs: [
      { name: 'commands', type: 'bytes', internalType: 'bytes' },
      { name: 'inputs', type: 'bytes[]', internalType: 'bytes[]' },
      { name: 'deadline', type: 'uint256', internalType: 'uint256' }
    ],
    outputs: [],
    stateMutability: 'payable'
  }
] as const;

interface ToastState {
  show: boolean;
  type: ToastType;
  title: string;
  message: string;
  txHash?: string;
}

export interface SwapParams {
  fromToken: TokenConfig;
  toToken: TokenConfig;
  poolFee: number;          // basis points, e.g. 3000
  tickSpacing: number;
  hooksAddress: string;
  amountIn: string;          // input amount string
  amountOut: string;         // output amount string
  slippagePct: number;       // slippage percentage, e.g. 0.5
  isExactInput: boolean;     // true if exact input, false if exact output
}

export function useSwap() {
  const { address: userAddress } = useAccount();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { checkAllowance, approveTokenWithPermit2 } = useApproval();

  const [toast, setToast] = useState<ToastState>({
    show: false,
    type: 'pending',
    title: '',
    message: '',
    txHash: undefined,
  });

  const [isApproving, setIsApproving] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [txnGas, setTxnGas] = useState<string | undefined>();
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();

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

  const executeSwap = async (params: SwapParams) => {
    if (!userAddress) {
      showToast('error', 'Wallet Not Connected', 'Please connect your wallet to execute the swap.');
      return;
    }

    if (!publicClient) {
      showToast('error', 'Public Client Not Found', 'Unable to initialize public client.');
      return;
    }

    try {
      setIsSwapping(true);

      const rawAmountIn = parseUnits(params.amountIn, params.fromToken.decimals);
      const rawAmountOut = parseUnits(params.amountOut, params.toToken.decimals);


      // 1. Calculate limits based on slippage
      const slippageBps = BigInt(Math.round(params.slippagePct * 100)); // e.g. 50 bps for 0.5%

      // Exact Input:  amountIn is exact, amountOutMinimum = rawAmountOut * (1 - slippage)
      // Exact Output: amountOutMinimum is exact rawAmountOut, amountIn = rawAmountIn * (1 + slippage)
      const amountIn = params.isExactInput
        ? rawAmountIn
        : (rawAmountIn * (10000n + slippageBps)) / 10000n;  // amountInMaximum
      const amountOutMinimum = params.isExactInput
        ? (rawAmountOut * (10000n - slippageBps)) / 10000n
        : rawAmountOut;  // exact desired output

      console.log('Swap Parameters:', {
        fromToken: params.fromToken.symbol,
        toToken: params.toToken.symbol,
        amountIn: params.amountIn,
        amountOut: params.amountOut,
        isExactInput: params.isExactInput,
        amountInLimit: amountIn.toString(),
        amountOutLimit: amountOutMinimum.toString(),
      });
      console.log({
        slippagePct: params.slippagePct,
        slippageBps: slippageBps.toString()
      });

      // 2. Check and Approve Allowance (if fromToken is not native)
      const isNative = params.fromToken.address === '0x0000000000000000000000000000000000000000';
      if (!isNative) {
        setIsApproving(true);
        showToast('pending', 'Checking Allowance', 'Checking token approval for Universal Router...');

        const { p2ToSpenderAmount, p2ToSpenderExpiration } = await checkAllowance(
          params.fromToken.address,
          userAddress,
          UNIVERSALROUTER_ADDRESS as `0x${string}`
        );
        console.log({ p2ToSpenderAmount, p2ToSpenderExpiration })

        const now = Math.floor(Date.now() / 1000);
        const isExpired = p2ToSpenderExpiration <= now;

        const needsApproval = isExpired || p2ToSpenderAmount < rawAmountIn;

        if (needsApproval) {
          showToast('pending', 'Approving Token', `Approving Permit2 & Universal Router for ${params.fromToken.symbol}...`);
          await approveTokenWithPermit2(
            params.fromToken.address,
            maxUint256,
            UNIVERSALROUTER_ADDRESS as `0x${string}`
          );
        }
        setIsApproving(false);
      }

      showToast('pending', 'Preparing Swap', 'Constructing transaction details...');

      // 3. Build Universal Router execute payload
      // Sort currencies to match PoolKey sorting
      const zeroForOne = params.fromToken.address.toLowerCase() < params.toToken.address.toLowerCase();
      const [currency0, currency1] = zeroForOne
        ? [params.fromToken.address, params.toToken.address]
        : [params.toToken.address, params.fromToken.address];

      const poolKey = {
        currency0: currency0 as `0x${string}`,
        currency1: currency1 as `0x${string}`,
        fee: Number(params.poolFee),
        tickSpacing: Number(params.tickSpacing),
        hooks: params.hooksAddress as `0x${string}`,
      };

      console.log({ poolKey });

      // V4_SWAP command is 0x10
      const commands = '0x10'; // V4_SWAP
      // const commands = encodePacked(['uint8'], [0x10]);

      // Build V4Router actions
      // Exact Input Single: Action 0x06, settle all 0x0c, take all 0x0f
      // Exact Output Single: Action 0x08, settle all 0x0c, take all 0x0f
      const actionType = params.isExactInput ? ACTIONS.SWAP_EXACT_IN_SINGLE : ACTIONS.SWAP_EXACT_OUT_SINGLE;
      const actions = encodePacked(
        ['uint8', 'uint8', 'uint8'],
        [actionType, ACTIONS.SETTLE_ALL, ACTIONS.TAKE_ALL]
      );
      console.log({ actions });

      // Build parameter array
      const paramsArray: `0x${string}`[] = [];
      // ExactInput struct:  [poolKey, zeroForOne, amountIn(exact),  amountOutMinimum(limit), ...]
      // ExactOutput struct: [poolKey, zeroForOne, amountOut(exact), amountInMaximum(limit),  ...]
      // The exact amount always goes in slot 3, the limit goes in slot 4 — but they swap between modes.
      const structSlot3 = params.isExactInput ? amountIn : amountOutMinimum; // exact side
      const structSlot4 = params.isExactInput ? amountOutMinimum : amountIn; // limit side
      const hookData = encodeAbiParameters(
        [{ type: 'address' }],
        [userAddress]
      ) 

      paramsArray[0] = encodeAbiParameters(
        [
          {
            type: 'tuple',
            components: [
              {
                name: 'poolKey',
                type: 'tuple',
                components: [
                  { name: 'currency0', type: 'address' },
                  { name: 'currency1', type: 'address' },
                  { name: 'fee', type: 'uint24' },
                  { name: 'tickSpacing', type: 'int24' },
                  { name: 'hooks', type: 'address' }
                ]
              },
              { name: 'zeroForOne', type: 'bool' },
              { name: 'amount1', type: 'uint128' }, // amountIn (exact input) OR amountOut (exact output)
              { name: 'amount2', type: 'uint128' }, // amountOutMinimum (exact input) OR amountInMaximum (exact output)
              { name: 'minHopPriceX36', type: 'uint128' },
              { name: 'hookData', type: 'bytes' }
            ]
          }
        ],
        [
          {
            poolKey,
            zeroForOne,
            amount1: structSlot3,
            amount2: structSlot4,
            minHopPriceX36: 0n,
            hookData
          }
        ]
      );

      // SETTLE_ALL - input token (sorted currency0)
      paramsArray[1] = encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }],
        [params.fromToken.address as `0x${string}`, amountIn]
      );

      // TAKE_ALL - output token (sorted currency1)  
      paramsArray[2] = encodeAbiParameters(
        [{ type: 'address' }, { type: 'uint256' }],
        [params.toToken.address as `0x${string}`, amountOutMinimum]
      );


      console.log({ params })

      const v4Input = encodeAbiParameters(
        [
          { name: 'actions', type: 'bytes' },
          { name: 'params', type: 'bytes[]' }
        ],
        [actions, paramsArray]
      );

      const inputs = [v4Input];

      console.log({ inputs });

      const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20); // 20 minute deadline

      // If fromToken is native ETH, we pass it as value
      const value = isNative ? amountIn : 0n;

      showToast('pending', 'Confirming Transaction', 'Confirm the swap transaction in your wallet...');

      ////////////////////////////////////////////
      try {
        const result = await publicClient.call({
          account: userAddress,
          to: UNIVERSALROUTER_ADDRESS as `0x${string}`,
          data: encodeFunctionData({
            abi: UNIVERSAL_ROUTER_ABI,
            functionName: 'execute',
            args: [commands, inputs, deadline],
          }),
          value,
        });
        console.log('call result:', result);
      } catch (callError: any) {
        console.log('call error data:', callError?.cause?.data);
        console.log('call error details:', JSON.stringify(callError, null, 2));
      }


      // 4. Simulate contract execution to ensure safety
      
      const { request, result } = await publicClient.simulateContract({
        address: UNIVERSALROUTER_ADDRESS as `0x${string}`,
        abi: UNIVERSAL_ROUTER_ABI,
        functionName: 'execute',
        args: [commands, inputs, deadline],
        value,
        account: userAddress,
      });
      
      // Gas estimate
      const txnGas_ = await publicClient.estimateContractGas({
        address: UNIVERSALROUTER_ADDRESS as `0x${string}`,
        abi: UNIVERSAL_ROUTER_ABI,
        functionName: "execute",
        args: [commands, inputs, deadline],
        value,
        account: userAddress,
      });

      const gasPrice = await publicClient.getGasPrice();
      // arc uses 6 decimals
      console.log("Estimated fee...:", formatEther(txnGas_ * gasPrice));
      setTxnGas(Number(formatEther(txnGas_ * gasPrice)).toFixed(4));

      // 5. Submit transaction
      const hash = await writeContractAsync(request);

      // const hash = await writeContractAsync({
      //   address: UNIVERSALROUTER_ADDRESS as `0x${string}`,
      //   abi: UNIVERSAL_ROUTER_ABI,
      //   functionName: 'execute',
      //   args: [commands, inputs, deadline],
      //   value,
      // });

      setTxHash(hash);
      showToast('pending', 'Transaction Submitted', 'Waiting for confirmation...', hash);

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      console.log('Swap transaction receipt:', receipt);
      console.log("Actual gas used:", receipt.gasUsed);
      

      if (receipt.status === 'reverted') {
        throw new Error('Transaction reverted on-chain');
      }

      showToast('success', 'Swap Successful!', `Successfully swapped ${params.amountIn} ${params.fromToken.symbol} for ${params.amountOut} ${params.toToken.symbol}!`, hash);
    } catch (err: any) {
      console.error('Failed to execute swap:', err);
      showToast('error', 'Transaction Failed', err?.shortMessage ?? err?.message ?? 'Failed to execute swap.');
    } finally {
      setIsSwapping(false);
      setIsApproving(false);
    }
  };

  return {
    executeSwap,
    toast,
    dismissToast,
    isApproving,
    isSwapping,
    isConfirming: isSwapping || isApproving,
    txHash,
    txnGas,
    clearTxnGas: () => setTxnGas(undefined)
  };
}
