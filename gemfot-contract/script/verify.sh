#!/usr/bin/env bash
#
# GemFot protocol source verification script (arc_testnet / Blockscout).
#
# Usage:
#   1. Fill in the addresses in `.env` (it is sourced automatically), or export them before
#      running, every variable below uses `${VAR:-default}` so the environment always wins.
#   2. Run: ./script/verify.sh                      # verify everything that has an address
#      Or:  ./script/verify.sh GemFotManager Launch # verify only the named contracts
#
# Why the manual commands needed fixing:
#   * `--chain-id` alone is not enough, `--rpc-url` is added so forge can always fetch the
#     deployed bytecode and resolve the chain.
#   * `--compiler-version`, `--num-of-optimizations`, `--evm-version` and `--via-ir` must match
#     `foundry.toml` (solc 0.8.26, optimizer on, runs = 0, cancun, viaIR) or Blockscout reports a
#     bytecode mismatch.
#   * Constructor args must be ABI encoded for EVERY contract with a non-empty constructor. The
#     `Permit2` style command (no --constructor-args) is only valid for constructor-less contracts.
#   * The GemFotManager hook takes a nested struct, so it needs a tuple encoding, not `address`.
#
set -uo pipefail

cd "$(dirname "$0")/.."

# ---------------------------------------------------------------------------- #
#                                CONFIGURATION                                 #
# ---------------------------------------------------------------------------- #

# Load `.env` (if present). `set -a` exports everything it defines.
if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi

CHAIN_ID="${CHAIN_ID:-5042002}"
RPC_URL="${RPC_URL:-https://arc-testnet.drpc.org}"
VERIFIER="${VERIFIER:-blockscout}"
VERIFIER_URL="${VERIFIER_URL:-https://testnet.arcscan.app/api}"

# Must match [profile.default] in foundry.toml
COMPILER_VERSION="${COMPILER_VERSION:-0.8.26}"
OPTIMIZER_RUNS="${OPTIMIZER_RUNS:-0}"
EVM_VERSION="${EVM_VERSION:-cancun}"

# --- Constructor argument inputs (same values used at deploy time) ----------- #
# NOTE: NATIVE_TOKEN has no sane default, export it (USDC on arc_testnet) before running.
PROTOCOL_OWNER="${PROTOCOL_OWNER:-0x5Ac521f6814c2D09188A6838e7CDBfe7aEaC0cf9}"
NATIVE_TOKEN="${NATIVE_TOKEN:-}"
POOL_MANAGER="${POOL_MANAGER:-0xC8d4D8fd9121D92ba790A70a60c07143A2C0Cd98}"

SWAP_FEE="${SWAP_FEE:-100}"     # 1%
PROTOCOL_FEE="${PROTOCOL_FEE:-10_00}" # 10%
FEE_DISTRIBUTION_ACTIVE="${FEE_DISTRIBUTION_ACTIVE:-true}"

# ---------------------------------------------------------------------------- #
#                             DEPLOYED ADDRESSES                               #
# ---------------------------------------------------------------------------- #
# Copy these straight out of the deploy.sh summary block. Anything left blank is skipped.

INITIAL_PRICE="${INITIAL_PRICE:-}"                                        # USDCMarketCappedPrice
FEE_EXEMPTIONS="${FEE_EXEMPTIONS:-}"                                      # FeeExemptions
ACTION_MANAGER="${ACTION_MANAGER:-}"                                      # TreasuryActionManager
INDEXER="${INDEXER:-}"                                                    # IndexerSubscriber
FEE_ESCROW="${FEE_ESCROW:-}"                                              # FeeEscrow
FEE_ESCROW_REGISTRY="${FEE_ESCROW_REGISTRY:-}"                            # FeeEscrowRegistry
PROTOCOL_FEE_RECIPIENT="${PROTOCOL_FEE_RECIPIENT:-}"                      # ProtocolFeeRecipient
FAIR_LAUNCH="${FAIR_LAUNCH:-}"                                            # FairLaunch
BID_WALL="${BID_WALL:-}"                                                  # BidWall
MEMECOIN_IMPLEMENTATION="${MEMECOIN_IMPLEMENTATION:-}"                    # Memecoin (implementation)
MEMECOIN_TREASURY_IMPLEMENTATION="${MEMECOIN_TREASURY_IMPLEMENTATION:-}"  # MemecoinTreasury (impl)
GEMFOT_MANAGER="${GEMFOT_MANAGER:-}"                                      # GemFotManager (hook)
LAUNCH="${LAUNCH:-}"                                                      # Launch
NOTIFIER="${NOTIFIER:-}"                                                  # Notifier (from the hook)
PREVENT_NO_FAIR_LAUNCH="${PREVENT_NO_FAIR_LAUNCH:-}"                      # PreventNoFairLaunch
POOL_SWAP="${POOL_SWAP:-}"                                                # PoolSwap
BLANK_ACTION="${BLANK_ACTION:-}"                                          # BlankAction
BURN_TOKENS_ACTION="${BURN_TOKENS_ACTION:-}"                              # BurnTokensAction
BUY_BACK_ACTION="${BUY_BACK_ACTION:-}"                                    # BuyBackAction

# ---------------------------------------------------------------------------- #
#                                   HELPERS                                    #
# ---------------------------------------------------------------------------- #

VERIFY_FLAGS=(
    --chain-id "${CHAIN_ID}"
    --rpc-url "${RPC_URL}"
    --verifier "${VERIFIER}"
    --verifier-url "${VERIFIER_URL}"
    --compiler-version "${COMPILER_VERSION}"
    --num-of-optimizations "${OPTIMIZER_RUNS}"
    --evm-version "${EVM_VERSION}"
    --via-ir
    --watch
)

FILTER=("$@")
VERIFIED=()
FAILED=()
SKIPPED=()

should_run() {
    local name="$1"
    [[ ${#FILTER[@]} -eq 0 ]] && return 0
    local wanted
    for wanted in "${FILTER[@]}"; do
        [[ "${wanted}" == "${name}" ]] && return 0
    done
    return 1
}

# verify <Name> <address> <src/Path.sol:Contract> [ctorSignature] [ctorArg...]
#
# The constructor args are only ABI encoded once we know the contract is actually going to be
# verified, so unset addresses never trigger a `cast abi-encode` parser error.
verify() {
    local name="$1" address="$2" target="$3"
    shift 3
    local signature="${1:-}"
    [[ $# -gt 0 ]] && shift
    local args=("$@")

    should_run "${name}" || return 0

    if [[ -z "${address}" ]]; then
        echo "-- Skipping ${name}: no address set"
        SKIPPED+=("${name}")
        return 0
    fi

    local cmd=(forge verify-contract "${VERIFY_FLAGS[@]}")

    if [[ -n "${signature}" ]]; then
        local arg
        for arg in "${args[@]}"; do
            if [[ -z "${arg}" ]]; then
                echo "-- Skipping ${name}: a constructor argument is empty (check the config above)"
                SKIPPED+=("${name}")
                return 0
            fi
        done

        local encoded
        if ! encoded="$(cast abi-encode "${signature}" "${args[@]}")"; then
            echo "!! ${name}: failed to ABI encode the constructor arguments" >&2
            FAILED+=("${name}")
            return 0
        fi
        cmd+=(--constructor-args "${encoded}")
    fi

    cmd+=("${address}" "${target}")

    echo ""
    echo "==> Verifying ${name} at ${address}"

    if "${cmd[@]}"; then
        VERIFIED+=("${name}")
    else
        echo "!! ${name} failed to verify" >&2
        FAILED+=("${name}")
    fi
}

echo "Verifying GemFot contracts on chain ${CHAIN_ID} via ${VERIFIER} (${VERIFIER_URL})"

# ---------------------------------------------------------------------------- #
#                          CONSTRUCTOR-LESS CONTRACTS                          #
# ---------------------------------------------------------------------------- #

verify IndexerSubscriber     "${INDEXER}"                          "src/contracts/subscribers/Indexer.sol:IndexerSubscriber"
verify FeeEscrowRegistry     "${FEE_ESCROW_REGISTRY}"              "src/contracts/escrows/FeeEscrowRegistry.sol:FeeEscrowRegistry"
verify ProtocolFeeRecipient  "${PROTOCOL_FEE_RECIPIENT}"           "src/contracts/ProtocolFeeRecipient.sol:ProtocolFeeRecipient"
verify Memecoin              "${MEMECOIN_IMPLEMENTATION}"          "src/contracts/Memecoin.sol:Memecoin"
verify MemecoinTreasury      "${MEMECOIN_TREASURY_IMPLEMENTATION}" "src/contracts/treasury/MemecoinTreasury.sol:MemecoinTreasury"
verify Launch                "${LAUNCH}"                           "src/contracts/Launch.sol:Launch"
verify BlankAction           "${BLANK_ACTION}"                     "src/contracts/treasury/actions/Blank.sol:BlankAction"

# ---------------------------------------------------------------------------- #
#                        SINGLE `address` CONSTRUCTORS                         #
# ---------------------------------------------------------------------------- #

verify USDCMarketCappedPrice "${INITIAL_PRICE}"          "src/contracts/price/MarketCappedPrice.sol:USDCMarketCappedPrice" \
    "constructor(address)" "${PROTOCOL_OWNER}"

verify FeeExemptions         "${FEE_EXEMPTIONS}"         "src/contracts/hooks/FeeExemptions.sol:FeeExemptions" \
    "constructor(address)" "${PROTOCOL_OWNER}"

verify TreasuryActionManager "${ACTION_MANAGER}"         "src/contracts/treasury/ActionManager.sol:TreasuryActionManager" \
    "constructor(address)" "${PROTOCOL_OWNER}"

verify Notifier              "${NOTIFIER}"               "src/contracts/hooks/Notifier.sol:Notifier" \
    "constructor(address)" "${PROTOCOL_OWNER}"

verify FairLaunch            "${FAIR_LAUNCH}"            "src/contracts/hooks/FairLaunch.sol:FairLaunch" \
    "constructor(address)" "${POOL_MANAGER}"

verify PoolSwap              "${POOL_SWAP}"              "src/contracts/zaps/PoolSwap.sol:PoolSwap" \
    "constructor(address)" "${POOL_MANAGER}"

verify PreventNoFairLaunch   "${PREVENT_NO_FAIR_LAUNCH}" "src/contracts/subscribers/PreventNoFairLaunch.sol:PreventNoFairLaunch" \
    "constructor(address)" "${NOTIFIER}"

verify BurnTokensAction      "${BURN_TOKENS_ACTION}"     "src/contracts/treasury/actions/BurnTokens.sol:BurnTokensAction" \
    "constructor(address)" "${NATIVE_TOKEN}"

# ---------------------------------------------------------------------------- #
#                          MULTI ARGUMENT CONSTRUCTORS                         #
# ---------------------------------------------------------------------------- #

verify FeeEscrow             "${FEE_ESCROW}"             "src/contracts/escrows/FeeEscrow.sol:FeeEscrow" \
    "constructor(address,address)" "${NATIVE_TOKEN}" "${INDEXER}"

verify BuyBackAction         "${BUY_BACK_ACTION}"        "src/contracts/treasury/actions/BuyBack.sol:BuyBackAction" \
    "constructor(address,address)" "${NATIVE_TOKEN}" "${POOL_SWAP}"

verify BidWall               "${BID_WALL}"               "src/contracts/bidwall/BidWall.sol:BidWall" \
    "constructor(address,address,address)" "${NATIVE_TOKEN}" "${POOL_MANAGER}" "${PROTOCOL_OWNER}"

# ---------------------------------------------------------------------------- #
#                         STRUCT CONSTRUCTOR (THE HOOK)                        #
# ---------------------------------------------------------------------------- #
#
# GemFotManager takes a single `ConstructorParams` struct which itself nests a `FeeDistribution`
# struct, so the encoded signature is:
#
#   constructor((address,address,(uint24,uint24,bool),address,address,address,address,address,address,address,address))
#
# Field order (see GemFotManager.ConstructorParams):
#   nativeToken, poolManager, feeDistribution{swapFee,protocol,active}, initialPrice,
#   protocolOwner, protocolFeeRecipient, feeEscrow, feeExemptions, actionManager, bidWall, fairLaunch

verify GemFotManager "${GEMFOT_MANAGER}" "src/contracts/GemFotManager.sol:GemFotManager" \
    "constructor((address,address,(uint24,uint24,bool),address,address,address,address,address,address,address,address))" \
    "(${NATIVE_TOKEN},${POOL_MANAGER},(${SWAP_FEE},${PROTOCOL_FEE},${FEE_DISTRIBUTION_ACTIVE}),${INITIAL_PRICE},${PROTOCOL_OWNER},${PROTOCOL_FEE_RECIPIENT},${FEE_ESCROW},${FEE_EXEMPTIONS},${ACTION_MANAGER},${BID_WALL},${FAIR_LAUNCH})"

# ---------------------------------------------------------------------------- #
#                                   SUMMARY                                    #
# ---------------------------------------------------------------------------- #

echo ""
echo "================================ VERIFY DONE ================================"
[[ ${#VERIFIED[@]} -gt 0 ]] && echo "Verified : ${VERIFIED[*]}"
[[ ${#SKIPPED[@]} -gt 0 ]]  && echo "Skipped  : ${SKIPPED[*]}"
if [[ ${#FAILED[@]} -gt 0 ]]; then
    echo "Failed   : ${FAILED[*]}"
    echo "============================================================================"
    exit 1
fi
echo "============================================================================"

# ---------------------------------------------------------------------------- #
#                          DEPENDENCY CONTRACTS (manual)                       #
# ---------------------------------------------------------------------------- #
#
# These live under lib/ and are not part of the GemFot source tree. This is the corrected form
# of the two commands you were running by hand:
#
#   forge verify-contract \
#     --chain-id 5042002 --rpc-url https://arc-testnet.drpc.org \
#     --verifier blockscout --verifier-url https://testnet.arcscan.app/api \
#     --compiler-version 0.8.26 --num-of-optimizations 0 --evm-version cancun --via-ir --watch \
#     --constructor-args "$(cast abi-encode 'constructor(address)' 0x5Ac521f6814c2D09188A6838e7CDBfe7aEaC0cf9)" \
#     0xC8d4D8fd9121D92ba790A70a60c07143A2C0Cd98 \
#     lib/v4-hooks-public/lib/v4-periphery/lib/v4-core/src/PoolManager.sol:PoolManager
#
#   forge verify-contract \
#     --chain-id 5042002 --rpc-url https://arc-testnet.drpc.org \
#     --verifier blockscout --verifier-url https://testnet.arcscan.app/api \
#     --compiler-version 0.8.17 --num-of-optimizations 1000000 --watch \
#     0xC733B042D7f7785af5606012831705797A7285f1 \
#     lib/v4-hooks-public/lib/v4-periphery/lib/permit2/src/Permit2.sol:Permit2
#
# (Permit2 has no constructor args but is built with its own solc / optimizer settings, so it
#  needs different --compiler-version / --num-of-optimizations values than the GemFot contracts.)
