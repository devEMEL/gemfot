
# GemFot Pitch Deck — Slide-by-Slide Script

## Slide 1 — Title

**Slide text (centered):**
```
GEMFOT
Fair-launch memecoin protocol
on Uniswap V4 + Arc
```

**Speaker notes:**
"Good [morning/afternoon]. Today we're introducing GemFot — a protocol that transforms how memecoins launch, trade, and maintain price stability using Uniswap V4 hooks on Arc."

---

## Slide 2 — The Problem

**Slide text:**
```
Memecoin launches are broken

• 99% of projects lose money
• Rug-pull risk is endemic
  → Creators mint + dump with zero skin in the game
• No fair price discovery
  → Pre-sales, VC allocations, hidden supply
• Volatility death spiral
  → Price craters 1 minute after launch
• Fragmented tooling
  → Launchpad, bonding curve, AMM, trading on separate platforms
```

**Visual suggestion:**
Three side-by-side screenshots: a typical launchpad, a bonding curve website, and an DEX trading interface — each on a separate platform.

**Speaker notes:**
"Every day, hundreds of memecoin launches promise moon but deliver dumps. The infrastructure itself is fragmented: creators use one tool to launch, another for bonding curves, another for AMM liquidity, and traders go elsewhere. This creates information asymmetries, exit-scam opportunities, and brutal volatility for retail."

---

## Slide 3 — The Solution

**Slide text (left column):**
```
GemFot = Fair Launch +
Built-in Liquidity +
Seamless Trading

One Uniswap V4 Hook
```

**Slide text (right column — numbered steps):**
```
1. Create
  Creator sets supply, target MC, duration

2. Fair Launch
  Linear bonding curve sells tokens over time

3. Liquidity Floor
  USDC raised seeds an immutable LP position

4. Trade
  Pool graduates to MLSwap AMM
```

**Visual suggestions:**
Flow diagram: Creator → Launch → Bonding Curve → LP Position → MLSwap Trading

**Speaker notes:**
"GemFot isn't three products bolted together — it's one Uniswap V4 hook that controls the entire lifecycle. A creator deploys a memecoin with a fixed supply and target market cap in a single transaction. A linear bonding curve then sells tokens over a fixed duration, with price rising as demand increases. When the window closes, the hook creates immutable liquidity positions with all the USDC raised. Finally, the pool graduates to live trading with full MLSwap integration."

---

## Slide 4 — How It's Different

**Slide text:**
```
Traditional Launch                GemFot Launch
─────────────────────────         ─────────────────────────

Creator mints 1M tokens           Creator commits 100%
├─ 20% pre-sale (VCs @0.0001)     supply to the curve
├─ 30% liquidity (removable)      ├─ Fair bonding curve
└─ 50% circulating                ├─ Immutable LP position
   → 99% lose money                └─ No hidden allocation
                                  ✓ Fair price at curve end
```

**Visual suggestion:**
Two columns with icons, the GemFot column highlighted with a green checkmark or yellow accent

**Speaker notes:**
"What separates GemFot from traditional launches? In the typical model, creators retain pre-sale allocations, removable liquidity, and hidden circulating supply — creating immediate dump pressure. With GemFot, 100% of supply enters the bonding curve. No pre-sale. No removable liquidity. No unlocked allocation. When the curve finishes, the market cap equals the target — that's it."

---

## Slide 5 — Technology Stack

**Slide text:**
```
BUILT ON UNISWAP V4 HOOKS + ARC

• GemFotManager — V4 hook, full lifecycle owner
• FairLaunch hook — linear bonding curve
• BidWall hook — dynamic liquidity floor
  (catches downward price moves, 1 tick below spot)
• InternalSwapPool — swap routing & fee distribution
• Memecoin + MemecoinTreasury — per-token infrastructure
```

**Visual suggestion:**
Architecture diagram showing the hook relationships to PoolManager, with labels for each component

**Speaker notes:**
"The GemFot protocol is built entirely on Uniswap V4 hooks — the programmable liquidity primitive. The GemFotManager orchestrates everything. FairLaunch implements our linear bonding curve. The BidWall actively protects the price by placing single-sided USDC bids one tick below spot whenever price drops threaten to cascade. All built on Arc for sub-cent gas and high throughput — critical for memecoin velocity."

---

## Slide 6 — Fair Launch Mechanics

**Slide text:**
```
BUY FORMULA

tokensOut = curve.calculateBuy(
  nativeIn, sold, remainingSupply, targetMC
)

PRICE CURVE

price(sold) = p0 + k × (sold / initialSupply)

When sold = initialSupply → marketCap = targetMC ✓
```

**Visual suggestion:**
Price-vs-supply curve graph showing linear price increase from p0 to targetMC

**Speaker notes:**
"The fair launch uses a linear bonding curve. Price starts at p0 and increases linearly as tokens are sold. Every buyer pays a progressively higher price — not because of AMM slippage, but because of the mathematical curve. This ensures transparency: every participant can calculate exactly what price they're paying at any point. When the curve is fully sold, the market cap equals the target exactly — no ambiguity."

---

## Slide 7 — Post-Launch Liquidity

**Slide text:**
```
FLOOR CREATION

When the fair-launch window closes,
FairLaunch.closePosition() mints TWO
immutable V4 positions:

1. USDC Position — Near current spot tick
   → Funded with ALL USDC raised in the curve

2. Memecoin Position — With unsold tokens
   → Capped supply = price floor

The separate BidWall hook then
actively catches downward moves.
```

**Visual suggestion:**
Two liquidity position diagrams showing the USDC position near spot and the memecoin position below, with arrows showing BidWall catching price drops

**Speaker notes:**
"The most critical part is what happens at the end of the fair launch. The closePosition function creates two immutable Uniswap V4 positions. First, all the USDC raised is deployed into a position right at the current spot tick — this is the liquidity base. Second, any unsold tokens are deployed into a position below spot. This capped supply creates a mathematical price floor. Additionally, the BidWall hook continues to protect the price during trading by catching downward moves."

---

## Slide 8 — Market Opportunity

**Slide text:**
```
MARKET SIZE

Memecoin Trading     $2.3B  daily volume
Token Launchers      50k+   tokens/month (Solana/Eth)
Liquidity Infra      $1.2B  AMM fees (30d)

WHY NOW?

• Uniswap V4 hooks are production-ready
• Arc L1 = sub-cent gas + high throughput
• Traders seek "fair" launches — GemFot
  removes exit-scam risk entirely
```

**Visual suggestion:**
Bar chart showing the three market segments, with Arc L1 network graphic

**Speaker notes:**
"The timing is perfect. Uniswap V4 hooks shipped production-ready last year. Arc L1 brings sub-cent gas — essential for memecoin velocity where trades happen in seconds. Meanwhile, the memecoin market moves hundreds of billions in daily volume, but traders are getting burned by rugs and dumps daily. GemFot removes the exit-scam risk entirely, creating massive product-market fit for this explosive segment."

---

## Slide 9 — Business Model

**Slide text:**
```
REVENUE STREAMS

┌────────────────┬─────────────────┬──────────┐
│ Launch fee     │ USDC at pool     │ Protocol │
│                │ creation         │ capture  │
├────────────────┼─────────────────┼──────────┤
│ Swap fees      │ 0.05% on trades  │ 20%      │
│                │ (LP + BidWall)   │ share    │
├────────────────┼─────────────────┼──────────┤
│ Creator fees   │ Creators keep %  │ —        │
│                │ of rewards       │ (to      │
│                │                  │ creator) │
└────────────────┴─────────────────┴──────────┘

PROJECTION (conservative)
M1: 50 pools / $5M vol / $5K fees
M3: 200 pools / $20M vol / $20K fees
M6: 500 pools / $60M vol / $60K fees
```

**Speaker notes:**
"Our monetization is straightforward. We charge a launch fee in USDC at pool creation. On every swap, we take the standard 0.05% fee and distribute 20% of that to the protocol treasury. Creators receive a percentage of swap and BidWall rewards as an incentive to build quality projects. Conservatively, we project 500 pools and $60K monthly protocol revenue by month six."

---

## Slide 10 — Go-to-Market

**Slide text:**
```
PHASE 1 — Launch (current)
• Contracts deployed ✓
• Frontend shipped ✓
• Subgraph indexed ✓
• 20 creator onboarding calls
• Seed 50 pools

PHASE 2 — Incentives (next quarter)
• GEMFOG governance airdrop
  (to early creators + active traders)
• Volume-based trading rebates
• Target: $1M volume, 200 pools

PHASE 3 — Scaling (following quarter)
• Mainnet on Arc + Base
• Permissionless fee tiers
• Creator LP NFTs = governance
• Target: Top-3 memecoin
  launchpad by volume
```

**Visual suggestion:**
Three-column timeline or phases with milestones marked

**Speaker notes:**
"Our go-to-market is three focused phases. Right now we're in Phase 1 — all tech is live: contracts, frontend, subgraph. We're targeting 50 seed pools through direct creator outreach. Phase 2 launches our governance token GEMFOG with airdrops to early adopters and volume-based rebates. Phase 3 expands to mainnet Arc and Base, plus advanced features like permissionless fee tiers and governance via Creator LP NFTs. Our goal: become the top-3 memecoin launchpad by volume."

---

## Slide 11 — Team

**Slide text:**
```
THE TEAM

┌────────────┬────────────┬──────────────────────┐
│ Role       │ Background  │ Focus               │
├────────────┼────────────┼──────────────────────┤
│ Protocol   │ 3 years     │ Contracts, V4 hooks │
│ Lead       │ smart       │                    │
│            │ contracts   │                    │
│            │ (Uniswap    │                    │
│            │ core        │                    │
│            │ contributor)│                    │
├────────────┼────────────┼──────────────────────┤
│ Frontend   │ ex-MLSwap   │ React, V4 hook      │
│ Lead       │             │ UI/UX               │
├────────────┼────────────┼──────────────────────┤
│ Data/Index │ ex-DeFiLlama│ Subgraph, analytics │
│ Lead       │             │                      │
└────────────┴────────────┴──────────────────────┘
```

**Speaker notes:**
"Our team brings deep DeFi and Uniswap expertise. Our protocol lead has three years of smart contract experience including contributions to Uniswap core. Our frontend lead comes from MLSwap, bringing proven expertise in React and V4 hook interfaces. Our data lead is an ex-DeFiLlama team member who built indexing pipelines for major protocols. Together we have the technical depth and product intuition to execute this vision."

---

## Slide 12 — Ask

**Slide text:**
```
SEED ROUND — $500K

Allocation:
├─ Team          20%
├─ Liquidity     30%
│   Mining         │
├─ Operations    30%
│   (audit, ops,   │
│    legal, multisig)│
└─ Treasury        20%
                   │
Use of Funds:
• 40% Engineering (contract audit, frontend, subgraph)
• 25% Liquidity incentives (seed pools, floor rewards)
• 20% Growth (creator grants, marketing)
• 15% Operations (legal, multisig, insurance)
```

**Speaker notes:**
"We're raising $500K in this seed round. The allocation is balanced: 20% to team, 30% to liquidity mining, 30% to operations including audits and legal, and 20% to treasury. On the use of funds side — 40% goes to engineering to complete our audit and enhance the frontend and subgraph. 25% fuels liquidity incentives to bootstrap pool depth. 20% drives growth through creator grants and marketing. The remaining 15% covers operational costs including legal and insurance."

---

## Slide 13 — Contact / Q&A

**Slide text (centered):**
```
GEMFOT

Fair launches. Clean exits. No rugs.

[Your contact info]

Thank you.
Questions?
```

**Visual suggestion:**
Clean black background with yellow accent, GemFot logo centered

**Speaker notes:**
"Thank you for your attention. We're building the future of fair memecoin launches — where every participant gets a clean shot at discovery pricing, and early buyers aren't punished by insider dumping. We're hiring and taking meetings. Who has questions?"
