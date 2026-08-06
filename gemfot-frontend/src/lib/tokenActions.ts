// import { supabase } from '@/lib/supabase';

// export async function uploadLogo(file: File) {
//   // 1. Generate a unique file name
//   const fileExt = file.name.split('.').pop() || 'png';
//   const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

//   // 2. Convert to ArrayBuffer
//   const bytes = await file.arrayBuffer();

//   // 3. Upload to 'logos' bucket
//   const { error: uploadError } = await supabase
//     .storage
//     .from('logos')
//     .upload(fileName, bytes, {
//       contentType: file.type || 'image/png',
//       upsert: false,
//     });

//   if (uploadError) {
//     throw new Error(uploadError.message);
//   }

//   // 4. Get public URL
//   const { data: publicUrlData } = supabase
//     .storage
//     .from('logos')
//     .getPublicUrl(fileName);

//   return publicUrlData.publicUrl;
// }

// export async function addToken(token: {
//   address: string;
//   chainId: string;
//   name: string;
//   symbol: string;
//   logo: string;
// }) {
//   const { data, error } = await supabase
//     .from('tokens')
//     .insert([
//       { 
//         address: token.address.toLowerCase(),
//         chainId: token.chainId,
//         name: token.name,
//         symbol: token.symbol,
//         logo: token.logo 
//       }
//     ])
//     .select();

//   if (error) {
//     throw new Error(error.message);
//   }

//   return data?.[0] || null;
// }

// export async function getTokens() {
//   const { data, error } = await supabase
//     .from('tokens')
//     .select('*')
//     .order('created_at', { ascending: false });

//   if (error) {
//     throw new Error(error.message);
//   }

//   return data || [];
// }
