// "use client";

// import { useState } from 'react';
// import { useAccount, useSwitchChain } from 'wagmi';
// import { createPublicClient, http } from 'viem';
// import { arcTestnet } from 'viem/chains';
// import { uploadLogo, addToken } from '@/lib/tokenActions';

// export default function AddToken() {
//   const { isConnected, chainId: currentChainId } = useAccount();
//   const { switchChainAsync } = useSwitchChain();
  

//   const [address, setAddress] = useState('');
//   const [chainId] = useState('5042002');
//   const [file, setFile] = useState<File | null>(null);
//   const [previewUrl, setPreviewUrl] = useState<string | null>(null);
//   const [loading, setLoading] = useState(false);
//   const [message, setMessage] = useState({ text: '', type: '' });

//   const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
//     if (e.target.files && e.target.files[0]) {
//       const selectedFile = e.target.files[0];
//       setFile(selectedFile);
//       setPreviewUrl(URL.createObjectURL(selectedFile));
//     }
//   };

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault();

//     const targetChainId = parseInt(chainId, 10);
//     console.log({
//       currentChainId,
//       targetChainId, 
//     })
//     if (!address || !chainId || !file) {
//       setMessage({ text: 'Please fill in all fields and select a logo.', type: 'error' });
//       return;
//     }

//     if (!isConnected) {
//       setMessage({ text: 'Please connect your wallet first.', type: 'error' });
//       return;
//     }

//     try {
//       setLoading(true);

//       // 1. Wagmi strict network check - forcefully prompt a switch if on the wrong network
//       if (currentChainId !== targetChainId) {
//         setMessage({ text: 'Switching to the correct network...', type: 'info' });
//         try {
//           await switchChainAsync({ chainId: targetChainId });
//         } catch (switchError) {
//           throw new Error("You must switch your wallet to the correct network to add a token.");
//         }
//       }

//       // 2. Fetch token details directly via Public RPC without waiting for the wallet provider!
//       setMessage({ text: 'Fetching token details from blockchain...', type: 'info' });
      
//       const publicClient = createPublicClient({ 
//         chain: targetChainId === arcTestnet.id ? arcTestnet : arcTestnet, // Defaulting to arcTestnet RPC
//         transport: http() 
//       });

//       let fetchedName = '';
//       let fetchedSymbol = '';
//       try {
//         const abi = [
//           { name: 'name', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
//           { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] }
//         ] as const;

//         fetchedName = await publicClient.readContract({
//           address: address as `0x${string}`,
//           abi,
//           functionName: 'name'
//         });
        
//         fetchedSymbol = await publicClient.readContract({
//           address: address as `0x${string}`,
//           abi,
//           functionName: 'symbol'
//         });
//       } catch (err) {
//         throw new Error("Could not fetch token details. Ensure you are on the correct network and the address is an ERC20 token.");
//       }

//       const logoUrl = await uploadLogo(file);

//       // 3. Add the token to Supabase
//       setMessage({ text: 'Saving token to database...', type: 'info' });
      
//       await addToken({
//         address,
//         chainId,
//         name: fetchedName,
//         symbol: fetchedSymbol,
//         logo: logoUrl,
//       });

//       setMessage({ text: `Token ${fetchedSymbol} successfully added!`, type: 'success' });
//       setAddress('');
//       setFile(null);
//       setPreviewUrl(null);
//       // Optional: Redirect or refresh
//     } catch (error: any) {
//       console.error(error);
//       setMessage({ text: error.message, type: 'error' });
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="flex-grow flex flex-col items-center justify-center pb-40 relative overflow-hidden w-full">
//       {/* Background Decor */}
//       <div className="absolute top-1/4 -right-20 w-96 h-96 bg-primary/5 rounded-full blur-[120px] pointer-events-none animate-pulse"></div>
//       <div className="absolute bottom-1/4 -left-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px] pointer-events-none animate-pulse" style={{ animationDelay: '1s' }}></div>
      
//       {/* Add Token Form Card (The Monolith style) */}
//       <div className="w-full max-w-[550px] glass-morphism rounded-lg p-3 relative z-10 shadow-2xl overflow-hidden mt-8">
//         <div className="bg-white/[0.03] border border-white/[0.05] rounded-lg p-8 md:p-10">
//           {/* Form Header */}
//           <div className="mb-10 text-center">
            
//             <h1 className="text-3xl  tracking-tighter text-white leading-none mb-3 uppercase">Add Custom Token</h1>
//             <p className="text-white/30 text-[12px] uppercase  tracking-widest opacity-80">Arc Testnet</p>
//           </div>

//           <form onSubmit={handleSubmit} className="space-y-6">
//             {/* Chain Selection (Fixed) */}
//             <div className="space-y-2">
//               <label className="text-[11px]  uppercase tracking-widest text-white/20">Chain Configuration</label>
//               <div className="w-full bg-white/5 border border-white/5 p-4 flex items-center justify-between group cursor-not-allowed rounded-sm">
//                 <span className="text-white/60  text-[13px] uppercase tracking-wider font-mono">Arc Testnet (5042002)</span>
//                 <span className="material-symbols-outlined text-primary/40 text-sm">lock</span>
//               </div>
//             </div>

//             {/* Token Contract Address */}
//             <div className="space-y-2">
//               <label className="text-[11px]  uppercase tracking-widest text-white/20">Contract Address</label>
//               <div className="relative group">
//                 <input 
//                   className="w-full bg-black/40 border border-white/10 p-4 text-white placeholder:text-white/10 focus:outline-none focus:border-primary/50 transition-all font-mono text-xs rounded-sm" 
//                   placeholder="0x..." 
//                   type="text"
//                   value={address}
//                   onChange={(e) => setAddress(e.target.value)}
//                   required
//                 />
//                 <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
//                   <span className="material-symbols-outlined text-white/10 text-lg">search</span>
//                 </div>
//               </div>
//             </div>

//             {/* Logo Section */}
//             <div className="space-y-2">
//               <label className="text-[11px]  uppercase tracking-widest text-white/20">Visual Identity</label>
//               <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
//                 {/* Upload Box */}
//                 <label 
//                   className="border border-dashed border-white/10 p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-white/5 transition-all group overflow-hidden relative rounded-sm"
//                 >
//                   <input 
//                     type="file" 
//                     className="hidden" 
//                     accept="image/*"
//                     onChange={handleFileChange}
//                   />
//                   {previewUrl ? (
//                      <img src={previewUrl} className="absolute inset-0 w-full h-full object-contain p-2 opacity-40 group-hover:opacity-100 transition-opacity" alt="preview" />
//                   ) : (
//                     <>
//                       <span className="material-symbols-outlined text-white/20 mb-2 group-hover:text-primary transition-colors">cloud_upload</span>
//                       <span className="text-[11px]  uppercase tracking-widest text-white/30 group-hover:text-white/60">Upload Icon</span>
//                     </>
//                   )}
//                 </label>
                
//                 {/* Preview Box Detail */}
//                 <div className="bg-black/20 border border-white/5 p-4 flex flex-col justify-center items-center text-center rounded-sm">
//                   {file ? (
//                     <span className="text-[12px]  text-primary truncate max-w-full uppercase tracking-tighter">{file.name}</span>
//                   ) : (
//                     <span className="text-[12px]  text-white/10 uppercase tracking-widest">Awaiting File...</span>
//                   )}
//                 </div>
//               </div>
//             </div>

//             {/* Warning Alert */}
//             <div className="bg-amber-500/5 border-l border-amber-500/30 p-4 flex gap-4 rounded-sm">
//               <span className="material-symbols-outlined text-amber-500/50 text-lg">warning</span>
//               <p className="text-[11px] leading-relaxed text-amber-500/60  uppercase tracking-wide">
//                 Strict Verification Required. Import at own risk.
//               </p>
//             </div>

//             {/* Status Message */}
//             {message.text && (
//               <div className={`p-4 text-[12px]  uppercase tracking-widest border rounded-sm ${
//                 message.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-primary/10 border-primary/20 text-primary'
//               }`}>
//                 {message.text}
//               </div>
//             )}

//             {/* Primary Action */}
//             <div className="pt-2">
//               <button 
//                 disabled={loading}
//                 className={`w-full py-5 rounded-full bg-primary text-black  uppercase tracking-[0.3em] text-xs transition-all flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(184,134,11,0.15)] hover:shadow-primary/40 ${loading ? 'opacity-50 cursor-not-allowed' : 'hover:brightness-110 active:scale-[0.98]'}`}
//                 type="submit"
//               >
//                 {loading ? 'Processing...' : 'Add token to list'}
//               </button>
//             </div>
//           </form>
//         </div>
//       </div>
//     </div>
//   );
// }
