export interface TokenConfig {
  address: `0x${string}`;
  name: string;
  symbol: string;
  decimals: number;
  logo: string;
}


export const TOKENS: TokenConfig[] = [
    {
    "address": "0x3600000000000000000000000000000000000000" as `0x${string}`,
    "name": "USDC",
    "symbol": "USDC",
    "decimals": 6,
    "logo": "/assets/0x3600000000000000000000000000000000000000/logo.png"
  },
  {
    "address": "0xF351A424955ba04e3d49dDa6E549a5983dB264B9" as `0x${string}`,
    "name": "UniCrypt",
    "symbol": "UNCX",
    "decimals": 18,
    "logo": "/assets/0xF351A424955ba04e3d49dDa6E549a5983dB264B9/logo.png"
  },
  {
    "address": "0x68b6Bdb4AC1d0EBafe5D00309225998997d7137d" as `0x${string}`,
    "name": "Flux",
    "symbol": "FLUX",
    "decimals": 18,
    "logo": "/assets/0x68b6Bdb4AC1d0EBafe5D00309225998997d7137d/logo.png"
  },
  {
    "address": "0x36bEE8F2DF69Cf3AFAb5c5ccA973fEb6441cAb11" as `0x${string}`,
    "name": "ML USDC",
    "symbol": "mUSDC",
    "decimals": 6,
    "logo": "/assets/0x36bEE8F2DF69Cf3AFAb5c5ccA973fEb6441cAb11/logo.png"
  },
  {
    "address": "0x988A89F9469D3B2D7BDbd4Af2b4B39D61701F3eC" as `0x${string}`,
    "name": "Honey",
    "symbol": "HNY",
    "decimals": 18,
    "logo": "/assets/0x988A89F9469D3B2D7BDbd4Af2b4B39D61701F3eC/logo.png"
  },
  {
    "address": "0xd7569Bd95be12b864aAba642721D03063352c896" as `0x${string}`,
    "name": "Zilliqa",
    "symbol": "ZIL",
    "decimals": 18,
    "logo": "/assets/0xd7569Bd95be12b864aAba642721D03063352c896/logo.png"
  },
  {
    "address": "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as `0x${string}`,
    "name": "EURC",
    "symbol": "EURC",
    "decimals": 6,
    "logo": "/assets/0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a/logo.png"
  },


  {
    "address": "0x8c277c071D42987Ef7712d135C4da1f46EA8Af8d",
    "name": "SoftDAO",
    "symbol": "SOFT",
    "decimals": 18,
    "logo": "/assets/0x8c277c071D42987Ef7712d135C4da1f46EA8Af8d/logo.png"
  },
  {
    "address": "0x10a2A353598E85Ea959B9176a6432a63C086A1Be",
    "name": "Reach",
    "symbol": "RCH",
    "decimals": 18,
    "logo": "/assets/0x10a2A353598E85Ea959B9176a6432a63C086A1Be/logo.jpeg"
  },
  {
    "address": "0x57700E377d85328322574FB8d92d4F017a2106E2",
    "name": "MONKE",
    "symbol": "MONKE",
    "decimals": 18,
    "logo": "/assets/0x57700E377d85328322574FB8d92d4F017a2106E2/logo.jpeg"
  }
];
