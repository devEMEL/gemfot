# GemFot

**Fair-launch memecoin protocol on Arc (Uniswap V4).**

GemFot is a Uniswap V4 hook that takes a memecoin from idea to token launch to live trading — all in one on-chain flow. It pairs a **bonding-curve fair launch** with a built-in **BidWall** (plunge protection) so creators launch fairly and holders get price stability on day one.

## Core concept

1. A creator deploys a memecoin with a fixed supply and a target market cap.
2. A **linear bonding curve** sells a portion of the supply over a fixed duration — every buyer pays a linearly-increasing price. When the curve sells out, the market cap equals the target.
3. USDC raised is swept into an **immutable Uniswap V4 liquidity position** near the final curve tick, providing a liquidity floor.
4. After the fair-launch window closes, the FairLaunch mints two immutable positions: one with the USDC raised + one with unsold tokens. The pool then trades normally on Uniswap V4. **Trading redirects to MLSwap.**

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Creator    │      Launches     │   → │ GemFotManager│
│  (wallet)   │                   │     │ (V4 Hook)    │
└─────────────┘                   │     └──────┬───────┘
                                  │            │
       ┌──────────────────────────┴────────────┴───────────┐
       │                                                     │
       ▼                                                     ▼
┌──────────────┐                                        ┌──────────┐
│ FairLaunch   │  bonding-curve sale → raise USDC      │ BidWall  │
│       │                                        │ (floor)  │
└──────────────┘                                        └──────────┘
       │                                                     │
       └───► Pool ends ─── Liquidity seeds Uniswap V4 ──────┘
                                           │
                                           ▼
                                  ┌──────────────────┐
                                  │ MLSwap (trading) │
                                  └──────────────────┘
```

| Contract | File | Purpose |
|---|---|---|
| `GemFotManager.sol` | `src/contracts/` | V4 hook entry point; creates pool, routes swaps, dispatches to FairLaunch & BidWall |
| `FairLaunch.sol` | `src/contracts/hooks/` | Linear bonding curve: single-sided token sale, price ramps with demand |
| `BidWall.sol` | `src/contracts/bidwall/` | Ongoing plunge-protection hook: catches downward price moves by placing single-sided USDC bids 1 tick below spot |
| `Memecoin.sol` | `src/contracts/interfaces/` | ERC20 token created per launch |
| `MemecoinTreasury.sol` | `src/contracts/treasury/` | Treasury per token; collects fees, holds premine |

### Contract addresses (Arc Testnet 0x13371)

| Contract | Address |
|---|---|
| GemFotManager | `0xBE8a58E61b4C86d2Bb154A3abBa8168aa851EfDc` |
| Launch | `0xeE7b3100DF6d1842B9987D8a947083B4f90f8524` |
| FairLaunch | `0xe0FAb59e4F3FD3c862e3636B508e18acfb779486` |
| BidWall | `0xE375E568Ca670FfAf069De4c2E95f7716B42b814` |
| Native token (USDC) | `0x36bEE8F2DF69Cf3AFAb5c5ccA973fEb6441cAb11` |
| PoolManager | `0xC8d4D8fd9121D92ba790A70a60c07143A2C0Cd98` |

## Fair launch pricing

The buy price rises linearly as supply depletes:

```
price(x) = p0 + (targetMC / initialSupply) * (sold / initialSupply)
```

- `p0` — initial price (set via `IInitialPrice`)
- `targetMC` — target market cap
- `initialSupply` — tokens allocated to the fair launch curve
- `sold` — tokens already purchased

When fully sold: `market_cap = targetMC`.

## Frontend

```
gemfot-frontend/
├─ src/
│  ├─ app/
│  │  ├─ Explore.tsx       # all live / upcoming launches
│  │  ├─ LaunchToken.tsx   # create-token wizard
│  │  ├─ Portfolio.tsx     # your launches + holdings
│  │  └─ TokenDetail.tsx   # live token / trading panel
│  ├─ components/gemfot/   # Header, Footer, Logo
│  ├─ hooks/               # wagmi hooks for launches & swaps
│  └─ lib/                 # formatting + bonding-curve math
└─ index.css              # black bg + yellow gradient palette
```

Run locally:

```bash
cd gemfot-frontend
npm install
npm run dev
```

## Subgraph

Indexed on The Graph Studio:

```
https://api.studio.thegraph.com/query/1749160/gemfot-subgraph/version/latest
```

Entities: `Protocol`, `Creator`, `Launch`, `Swap`, `FairLaunchBuy`.

## Launch parameters

| Param | Description |
|---|---|
| `name / symbol` | Token metadata |
| `initialTokenFairLaunch` | Tokens on the bonding curve |
| `fairLaunchDuration` | Seconds the curve stays open |
| `premineAmount` | Creator buys early at `p0` |
| `creatorFeeAllocation` | % of BidWall fees the creator keeps (0–100) |
| `launchAt` | Optional delayed launch timestamp |
| `totalSupply` | Full ERC20 supply |
| `usdcMarketCap` | Target market cap at curve completion |
| `multiple` | Multiplier on final price spike (e.g. `7` → 7× last price) |

## License

MIT — see `LICENSE` in the contract repo.
