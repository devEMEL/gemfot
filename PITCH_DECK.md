# GemFot — Pitch Deck

## 1 — Problem

Memecoin launches today are a minefield:

- **Rug-pull risk** — creators can mint + dump with zero skin in the game
- **No fair price discovery** — pre-markets, seed rounds, and VC allocations create inequality
- **Volatility death spiral** — no liquidity floor means the price craters 1 minute after launch
- **Fragmented tooling** — launch, bonding curve, AMM, and trading live on different platforms

## 2 — Solution

**GemFot = Fair launch + Built-in floor + Seamless trading, as one Uniswap V4 hook.**

| Step | What happens | User impact |
|---|---|---|
| 1. Create | Creator sets supply, target MC, duration | Anyone can launch in 1 tx |
| 2. Fair launch | Linear bonding curve sells tokens over time | Fair, transparent pricing |
| 3. **Liquidity floor** | USDC raised seeds an immutable LP position | Price support from day one |
| 4. Trade | Pool graduates to MLSwap AMM | Swap with real liquidity |

## 3 — The GemFot difference

```
Traditional launch
  Creator mints 1M tokens
  ├─ 20% pre-sale  (VCs at 0.0001)
  ├─ 30% liquidity (locked, but removable)
  └─ 50% circulating (price dumps immediately)
  → 99% lose money

GemFot launch
  Creator commits 100% supply to the curve
  ├─ Bonding curve sells fairly, price rises with demand
  ├─ All USDC raised seeds an immutable liquidity position
  └─ No unlocked supply, no hidden allocation
  → Fair price at the end of the curve
```

## 4 — Technology

### Built on Uniswap V4 Hooks + Arc

- **GemFotManager** — V4 hook that owns the full token lifecycle
- **FairLaunch** — linear bonding curve with `targetMC` convergence
- **Arc Testnet** — purpose-built for experimental DeFi, no gas wars

### Fair launch mechanics

```
Buy formula (per swap):
  tokensOut = curve.calculateBuy(nativeIn, sold, remainingSupply, targetMC)

Price impact:
  price(sold) = p0 + k * (sold / initialSupply)

When sold = initialSupply:
  marketCap = targetMC  ✓
```

### Post-launch liquidity

- When the fair-launch window closes, `FairLaunch.closePosition()` mints two immutable V4 positions:
  - A **USDC position** near the current spot tick (funded with all USDC raised in the curve)
  - A **memecoin position** with any unsold tokens (capped supply → price floor)
- This becomes the pool's permanent liquidity base
- The separate **BidWall** then actively catches downward price moves by placing single-sided USDC bids 1 tick below spot

## 5 — Market opportunity

| Segment | TAM | GemFot address |
|---|---|---|
| Memecoin trading | $2.3 B daily volume | Fair-launch entry point |
| Token launchers | 50 k+ tokens/month on Solana/Eth | One-tx launch on Arc |
| Liquidity infrastructure | $1.2 B in AMM fees (last 30d) | BidWall captures floor fees |

**Why now:**
- Uniswap V4 hooks are production-ready
- Arc L1 brings sub-cent gas + high throughput for memecoin velocity
- Traders are hunting for the "next fair thing" — GemFot removes exit-scam risk

## 6 — Business model

| Revenue stream | How | % to protocol |
|---|---|---|
| **Launch fee** | USDC paid at pool creation | 0.5 ETH × gas token price |
| **Swap fees** | 0.05% on every trade (LP positions + BidWall) | 20% share of swap fee revenue |
| **Creator fees** | Creators take % of swap | — (paid to creator, not protocol) |



**Projected monthly revenue (conservative):**

| Month | Pools launched | Volume | Protocol fees |
|---|---|---|---|
| M1 | 50 | $5 M | $5 k |
| M3 | 200 | $20 M | $20 k |
| M6 | 500 | $60 M | $60 k |

## 7 — Go-to-market

### Phase 1 — Launch (current)
- Deploy contracts on Arc Testnet ✓
- Ship frontend (Explore, Launch, Trade) ✓
- Index with The Graph subgraph ✓
- **Target:** 20 creator onboarding calls, seed 50 pools

### Phase 2 — Incentives (Q4 2024)
- GEMFOT governance token airdrop to early creators
- Volume-based trading rebates on MLSwap
- **Target:** $1 M volume, 200 pools

### Phase 3 — Scaling (Q1 2025)
- Mainnet Arc + Base
- Creator LP token NFTs (governance power)
- **Target:** Top-3 memecoin launchpad by volume

## 8 — Team

| Name | Role | Background |
|---|---|---|
| *Ajaebionu Dominic* | Founder and solo Dev | 3 years smart contracts development, hands-on experience building custom Uniswap v4 Hooks |





**One-liner:** *GemFot turns every memecoin launch into a fair game with built-in price support — no rugs, no dumps, no exit scams.*
