#!/usr/bin/env bash
#
# GemFot protocol deployment script (arc_testnet).
#
# Usage:
#   1. Fill in the placeholder values in `.env` (at the root of gemfot-contract).
#   2. Run: ./script/deploy.sh
#
# `.env` is sourced automatically and every variable below uses `${VAR:-default}`, so the
# environment always wins.
#
# Each contract has its own forge script under `script/`. Addresses that are produced by
# earlier deployments are exported as environment variables for later scripts, so the whole
# protocol can be deployed in a single run.
#
# NOTE: the deployment order matters, do not re-order the steps.
#
set -euo pipefail

cd "$(dirname "$0")/.."

# ---------------------------------------------------------------------------- #
#                                CONFIGURATION                                 #
# ---------------------------------------------------------------------------- #

# --- .env -------------------------------------------------------------------- #
# `set -a` makes everything defined in .env an exported environment variable.
if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi

# --- Network / signer -------------------------------------------------------- #
export NETWORK="${NETWORK:-arc_testnet}"                            # matches [rpc_endpoints] in foundry.toml
export RPC_URL="${RPC_URL:-https://arc-testnet.drpc.org}"
export CHAIN_ID="${CHAIN_ID:-5042002}"
export KEYSTORE_ACCOUNT="${KEYSTORE_ACCOUNT:?set KEYSTORE_ACCOUNT in .env}"
export DEPLOYER="${DEPLOYER:?set DEPLOYER in .env}"                 # keystore account address

# --- Verification (optional) ------------------------------------------------- #
export VERIFY="${VERIFY:-false}"                                    # "true" to append --verify
export VERIFIER="${VERIFIER:-blockscout}"                           # blockscout | etherscan | sourcify
export VERIFIER_URL="${VERIFIER_URL:-https://testnet.arcscan.app/api}"
export ETHERSCAN_API_KEY="${ETHERSCAN_API_KEY:-}"

# --- Protocol parameters ----------------------------------------------------- #
export PROTOCOL_OWNER="${PROTOCOL_OWNER:?set PROTOCOL_OWNER in .env}"   # EOA owning the protocol contracts
export NATIVE_TOKEN="${NATIVE_TOKEN:?set NATIVE_TOKEN in .env}"         # USDC on arc_testnet
export POOL_MANAGER="${POOL_MANAGER:?set POOL_MANAGER in .env}"         # Uniswap V4 PoolManager on arc_testnet

# Fee distribution defaults used by {GemFotManager}
export SWAP_FEE="${SWAP_FEE:-100}"                                  # 1.00%
export PROTOCOL_FEE="${PROTOCOL_FEE:-10_00}"                         # 10.00%
export FEE_DISTRIBUTION_ACTIVE="${FEE_DISTRIBUTION_ACTIVE:-true}"

# {Launch} ERC721 metadata base URI
export BASE_URI="${BASE_URI:-}"                                     # e.g. https://api.gemfot.xyz/metadata/

# ---------------------------------------------------------------------------- #
#                                   HELPERS                                    #
# ---------------------------------------------------------------------------- #

# The keystore password may be supplied non-interactively via KEYSTORE_PASSWORD (env or .env).
PASSWORD_FLAGS=()
if [[ -n "${KEYSTORE_PASSWORD:-}" ]]; then
    PASSWORD_FLAGS=(--password "${KEYSTORE_PASSWORD}")
fi

FORGE_FLAGS=(--rpc-url "${RPC_URL}" --account "${KEYSTORE_ACCOUNT}" --sender "${DEPLOYER}" "${PASSWORD_FLAGS[@]+"${PASSWORD_FLAGS[@]}"}" --broadcast -vvv)
CAST_SEND_FLAGS=(--rpc-url "${RPC_URL}" --account "${KEYSTORE_ACCOUNT}" --from "${DEPLOYER}" "${PASSWORD_FLAGS[@]+"${PASSWORD_FLAGS[@]}"}")


# `ProtocolRoles.GEMFOT_MANAGER` == keccak256("GemFotManager") (NOT "GEMFOT_MANAGER")
GEMFOT_MANAGER_ROLE="$(cast keccak "GemFotManager")"


if [[ "${VERIFY}" == "true" ]]; then
    FORGE_FLAGS+=(--verify --verifier "${VERIFIER}" --verifier-url "${VERIFIER_URL}")
fi

# deploy <ScriptFile>:<ScriptContract>
# Runs a forge script and echoes the deployed address (parsed from the script return value).
deploy() {
    local target="$1"
    local name="${target##*:}"

    echo ""
    echo "==> Deploying ${name} ..."

    local output
    output="$(forge script "script/${target}" "${FORGE_FLAGS[@]}" 2>&1)"
    echo "${output}"

    # The scripts return a single `address`, printed by forge as `initialPrice_: address 0x...`
    local address
    address="$(echo "${output}" | grep -Eo 'address 0x[a-fA-F0-9]{40}' | tail -1 | awk '{print $2}')"

    if [[ -z "${address}" ]]; then
        echo "!! Could not parse deployed address for ${name}" >&2
        exit 1
    fi

    echo "${address}"
}

# ---------------------------------------------------------------------------- #
#                                 DEPLOYMENTS                                  #
# ---------------------------------------------------------------------------- #

echo "Deploying GemFot protocol to ${NETWORK} with deployer ${DEPLOYER}"

# 1. Initial price calculator
export INITIAL_PRICE="$(deploy DeployMarketCappedPrice.s.sol:DeployMarketCappedPrice | tail -1)"

# 2. Fee exemptions
export FEE_EXEMPTIONS="$(deploy DeployFeeExemptions.s.sol:DeployFeeExemptions | tail -1)"

# 3. Treasury action manager
export ACTION_MANAGER="$(deploy DeployActionManager.s.sol:DeployActionManager | tail -1)"

# 4. Indexer subscriber (required by the FeeEscrow)
export INDEXER="$(deploy DeployIndexer.s.sol:DeployIndexer | tail -1)"

# 5. Fee escrow (requires NATIVE_TOKEN + INDEXER)
export FEE_ESCROW="$(deploy DeployFeeEscrow.s.sol:DeployFeeEscrow | tail -1)"

# 6. Fee escrow registry (optional bookkeeping contract)
export FEE_ESCROW_REGISTRY="$(deploy DeployFeeEscrowRegistry.s.sol:DeployFeeEscrowRegistry | tail -1)"

# 7. Protocol fee recipient
export PROTOCOL_FEE_RECIPIENT="$(deploy DeployProtocolFeeRecipient.s.sol:DeployProtocolFeeRecipient | tail -1)"

# 8. Fair launch (requires POOL_MANAGER)
export FAIR_LAUNCH="$(deploy DeployFairLaunch.s.sol:DeployFairLaunch | tail -1)"

# 9. Bid wall (requires NATIVE_TOKEN + POOL_MANAGER + PROTOCOL_OWNER)
export BID_WALL="$(deploy DeployBidWall.s.sol:DeployBidWall | tail -1)"

# 10. Clonable implementations
export MEMECOIN_IMPLEMENTATION="$(deploy DeployMemecoin.s.sol:DeployMemecoin | tail -1)"
export MEMECOIN_TREASURY_IMPLEMENTATION="$(deploy DeployMemecoinTreasury.s.sol:DeployMemecoinTreasury | tail -1)"

# 11. GemFotManager hook (CREATE2 mined address, requires all of the above)
export GEMFOT_MANAGER="$(deploy DeployGemFotManager.s.sol:DeployGemFotManager | tail -1)"

# 12. Launch ERC721 (requires the implementations + GEMFOT_MANAGER)
export LAUNCH="$(deploy DeployLaunch.s.sol:DeployLaunch | tail -1)"

# 13. Notifier + subscribers
#
# NOTE: {GemFotManager} deploys its OWN {Notifier} in its constructor and only ever calls
# `notifySubscribers` on that instance. Deploying a standalone Notifier would leave the
# subscribers wired to a contract that never notifies, so we read it off the hook instead.
export NOTIFIER="$(cast call "${GEMFOT_MANAGER}" "notifier()(address)" --rpc-url "${RPC_URL}")"
echo "==> Notifier (deployed by GemFotManager): ${NOTIFIER}"
export PREVENT_NO_FAIR_LAUNCH="$(deploy DeployPreventNoFairLaunch.s.sol:DeployPreventNoFairLaunch | tail -1)"


# 14. Zaps
export POOL_SWAP="$(deploy DeployPoolSwap.s.sol:DeployPoolSwap | tail -1)"

# 15. Treasury actions (BuyBack requires POOL_SWAP)
export BLANK_ACTION="$(deploy DeployBlankAction.s.sol:DeployBlankAction | tail -1)"
export BURN_TOKENS_ACTION="$(deploy DeployBurnTokensAction.s.sol:DeployBurnTokensAction | tail -1)"
export BUY_BACK_ACTION="$(deploy DeployBuyBackAction.s.sol:DeployBuyBackAction | tail -1)"

# ---------------------------------------------------------------------------- #
#                          WIRING (SETTERS / ROLES)                            #
# ---------------------------------------------------------------------------- #
#
# Every one of these is owner/admin gated and the deployer (${DEPLOYER}) is the owner of
# each contract it deployed, so they can all be executed in this same run.

echo ""
echo "==> Wiring the protocol ..."

# --- Access control ---------------------------------------------------------- #
# {FairLaunch} grants DEFAULT_ADMIN_ROLE to `msg.sender` (the deployer),
# {BidWall} grants it to PROTOCOL_OWNER. Both need the GEMFOT_MANAGER role for the hook.
cast send "${FAIR_LAUNCH}" "grantRole(bytes32,address)" "${GEMFOT_MANAGER_ROLE}" "${GEMFOT_MANAGER}" "${CAST_SEND_FLAGS[@]}"
cast send "${BID_WALL}"    "grantRole(bytes32,address)" "${GEMFOT_MANAGER_ROLE}" "${GEMFOT_MANAGER}" "${CAST_SEND_FLAGS[@]}"

# --- {GemFotManager} --------------------------------------------------------- #
# `launchContract` and `initialPrice` are only settable post-deployment.
cast send "${GEMFOT_MANAGER}" "setLaunch(address)"       "${LAUNCH}"        "${CAST_SEND_FLAGS[@]}"
cast send "${GEMFOT_MANAGER}" "setInitialPrice(address)" "${INITIAL_PRICE}" "${CAST_SEND_FLAGS[@]}"

# The global {FeeDistributor} values are already set in the constructor, but we re-assert
# them here so a redeploy of the same hook can be re-configured without a new deployment.
cast send "${GEMFOT_MANAGER}" "setFeeDistribution((uint24,uint24,bool))" \
    "(${SWAP_FEE},${PROTOCOL_FEE},${FEE_DISTRIBUTION_ACTIVE})" "${CAST_SEND_FLAGS[@]}"

# --- {IndexerSubscriber} ----------------------------------------------------- #
# Maps the notifier -> launch contract, without this the indexer silently no-ops.
cast send "${INDEXER}" "setNotifierLaunch(address,address)" "${NOTIFIER}" "${LAUNCH}" "${CAST_SEND_FLAGS[@]}"

# --- {Notifier} subscribers -------------------------------------------------- #
# The {Notifier} is owned by PROTOCOL_OWNER (set in the GemFotManager constructor).
# NOTE: the {IndexerSubscriber} MUST be subscribed too, otherwise no pool is ever indexed
# and the {FeeEscrow} creator-fee lookups will fail.
cast send "${NOTIFIER}" "subscribe(address,bytes)" "${INDEXER}"                0x "${CAST_SEND_FLAGS[@]}"
cast send "${NOTIFIER}" "subscribe(address,bytes)" "${PREVENT_NO_FAIR_LAUNCH}" 0x "${CAST_SEND_FLAGS[@]}"

# --- {ProtocolFeeRecipient} / {FeeEscrowRegistry} ---------------------------- #
cast send "${PROTOCOL_FEE_RECIPIENT}" "setFeeEscrow(address,bool)" "${FEE_ESCROW}" true  "${CAST_SEND_FLAGS[@]}"
cast send "${FEE_ESCROW_REGISTRY}"    "addFeeEscrow(address,bool)" "${FEE_ESCROW}" false "${CAST_SEND_FLAGS[@]}"

# --- {TreasuryActionManager} ------------------------------------------------- #
cast send "${ACTION_MANAGER}" "approveAction(address)" "${BLANK_ACTION}"       "${CAST_SEND_FLAGS[@]}"
cast send "${ACTION_MANAGER}" "approveAction(address)" "${BURN_TOKENS_ACTION}" "${CAST_SEND_FLAGS[@]}"
cast send "${ACTION_MANAGER}" "approveAction(address)" "${BUY_BACK_ACTION}"    "${CAST_SEND_FLAGS[@]}"

# ---------------------------------------------------------------------------- #
#                                   SUMMARY                                    #
# ---------------------------------------------------------------------------- #


cat <<EOF

================================ DEPLOYED ================================
Network                        : ${NETWORK}
Deployer                       : ${DEPLOYER}

USDCMarketCappedPrice          : ${INITIAL_PRICE}
FeeExemptions                  : ${FEE_EXEMPTIONS}
TreasuryActionManager          : ${ACTION_MANAGER}
IndexerSubscriber              : ${INDEXER}
FeeEscrow                      : ${FEE_ESCROW}
FeeEscrowRegistry              : ${FEE_ESCROW_REGISTRY}
ProtocolFeeRecipient           : ${PROTOCOL_FEE_RECIPIENT}
FairLaunch                     : ${FAIR_LAUNCH}
BidWall                        : ${BID_WALL}
Memecoin (implementation)      : ${MEMECOIN_IMPLEMENTATION}
MemecoinTreasury (impl)        : ${MEMECOIN_TREASURY_IMPLEMENTATION}
GemFotManager (hook)           : ${GEMFOT_MANAGER}
Launch                         : ${LAUNCH}
Notifier                       : ${NOTIFIER}
PreventNoFairLaunch            : ${PREVENT_NO_FAIR_LAUNCH}
PoolSwap                       : ${POOL_SWAP}
BlankAction                    : ${BLANK_ACTION}
BurnTokensAction               : ${BURN_TOKENS_ACTION}
BuyBackAction                  : ${BUY_BACK_ACTION}
==========================================================================

All of the required setters/roles above were executed by this script.

REMAINING OPTIONAL CONFIGURATION (not required for a working deployment):

  # Per-pool overrides (owner only, called once a pool exists)
  cast send ${GEMFOT_MANAGER} "setPoolFeeDistribution(bytes32,(uint24,uint24,bool))" <poolId> "(300,200,true)" --rpc-url ${RPC_URL} --account ${KEYSTORE_ACCOUNT}
  cast send ${GEMFOT_MANAGER} "setProtocolFeeDistribution(uint24)" <protocolFee> --rpc-url ${RPC_URL} --account ${KEYSTORE_ACCOUNT}

  # Fee exemptions for integrators / routers (owner only)
  cast send ${FEE_EXEMPTIONS} "setFeeExemption(address,uint24)" <beneficiary> <swapFee> --rpc-url ${RPC_URL} --account ${KEYSTORE_ACCOUNT}

  # BidWall tuning (owner only, defaults are already sane)
  cast send ${BID_WALL} "setSwapFeeThreshold(uint256)" <threshold> --rpc-url ${RPC_URL} --account ${KEYSTORE_ACCOUNT}
  cast send ${BID_WALL} "setStaleTimeWindow(uint256)" <seconds> --rpc-url ${RPC_URL} --account ${KEYSTORE_ACCOUNT}

  # Launch metadata / implementation upgrades (owner only, set in the constructor already)
  cast send ${LAUNCH} "setBaseURI(string)" "${BASE_URI}" --rpc-url ${RPC_URL} --account ${KEYSTORE_ACCOUNT}
  cast send ${LAUNCH} "setMemecoinImplementation(address)" ${MEMECOIN_IMPLEMENTATION} --rpc-url ${RPC_URL} --account ${KEYSTORE_ACCOUNT}
  cast send ${LAUNCH} "setMemecoinTreasuryImplementation(address)" ${MEMECOIN_TREASURY_IMPLEMENTATION} --rpc-url ${RPC_URL} --account ${KEYSTORE_ACCOUNT}

  # MarketCappedPrice launch fee (owner only, defaults to 0)
  cast send ${INITIAL_PRICE} "setLaunchFee(uint256)" <fee> --rpc-url ${RPC_URL} --account ${KEYSTORE_ACCOUNT}

  # NOT protocol-owner setters (called by memecoin creators, per pool):
  #   BidWall.setDisabledState(PoolKey,bool)
  #   Launch.setMemecoinMetadata(uint256,string)
  #   Memecoin.setMetadata(...)

EOF

