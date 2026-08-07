#!/usr/bin/env bash
#
# GemFot protocol wiring script (arc_testnet).
#
# Runs ONLY the setter/role portion of `deploy.sh` against an already-deployed set of
# addresses. Useful when `deploy.sh` aborts part-way through (e.g. a flaky RPC) and the
# contracts exist on-chain but were never wired together.
#
# Every address is read from the environment (`.env` is sourced automatically), so export
# the deployed addresses before running, or add them to `.env`.
#
# Usage:
#   ./script/wire.sh
#
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -f .env ]]; then
    set -a
    # shellcheck disable=SC1091
    source .env
    set +a
fi

# --- Network / signer -------------------------------------------------------- #
export RPC_URL="${RPC_URL:-https://arc-testnet.drpc.org}"
export KEYSTORE_ACCOUNT="${KEYSTORE_ACCOUNT:?set KEYSTORE_ACCOUNT in .env}"
export DEPLOYER="${DEPLOYER:?set DEPLOYER in .env}"

# --- Fee distribution defaults ----------------------------------------------- #
export SWAP_FEE="${SWAP_FEE:-100}"
export PROTOCOL_FEE="${PROTOCOL_FEE:-10_00}"
export FEE_DISTRIBUTION_ACTIVE="${FEE_DISTRIBUTION_ACTIVE:-true}"

# --- Deployed addresses ------------------------------------------------------ #
: "${INITIAL_PRICE:?set INITIAL_PRICE}"
: "${ACTION_MANAGER:?set ACTION_MANAGER}"
: "${INDEXER:?set INDEXER}"
: "${FEE_ESCROW:?set FEE_ESCROW}"
: "${FEE_ESCROW_REGISTRY:?set FEE_ESCROW_REGISTRY}"
: "${PROTOCOL_FEE_RECIPIENT:?set PROTOCOL_FEE_RECIPIENT}"
: "${FAIR_LAUNCH:?set FAIR_LAUNCH}"
: "${BID_WALL:?set BID_WALL}"
: "${GEMFOT_MANAGER:?set GEMFOT_MANAGER}"
: "${LAUNCH:?set LAUNCH}"
: "${PREVENT_NO_FAIR_LAUNCH:?set PREVENT_NO_FAIR_LAUNCH}"
: "${BLANK_ACTION:?set BLANK_ACTION}"
: "${BURN_TOKENS_ACTION:?set BURN_TOKENS_ACTION}"
: "${BUY_BACK_ACTION:?set BUY_BACK_ACTION}"

PASSWORD_FLAGS=()
if [[ -n "${KEYSTORE_PASSWORD:-}" ]]; then
    PASSWORD_FLAGS=(--password "${KEYSTORE_PASSWORD}")
fi

CAST_SEND_FLAGS=(--rpc-url "${RPC_URL}" --account "${KEYSTORE_ACCOUNT}" --from "${DEPLOYER}" "${PASSWORD_FLAGS[@]+"${PASSWORD_FLAGS[@]}"}")

# `ProtocolRoles.GEMFOT_MANAGER` == keccak256("GemFotManager")
GEMFOT_MANAGER_ROLE="$(cast keccak "GemFotManager")"

# The arc testnet RPC drops connections fairly often, so every call is retried.
RETRIES="${RETRIES:-5}"

# send <description> <target> <signature> [args...]
#
# `cast send` exits 0 as soon as the transaction is mined, even when it reverted, so the
# receipt status is checked explicitly rather than relying on the exit code.
send() {
    local description="$1"; shift
    local i output status

    for ((i = 1; i <= RETRIES; i++)); do
        if output="$(cast send "$@" "${CAST_SEND_FLAGS[@]}" 2>&1)"; then
            status="$(echo "${output}" | awk '/^status/ {print $2}')"

            if [[ "${status}" == "1" ]]; then
                echo "    ok   ${description}"
                return 0
            fi

            # A reverted transaction will never succeed on a retry, so fail immediately.
            echo "    FAIL ${description} (reverted)" >&2
            return 1
        fi
        sleep 5
    done

    echo "    FAIL ${description} (after ${RETRIES} attempts)" >&2
    return 1
}


# call <target> <signature>
call() {
    local i result

    for ((i = 1; i <= RETRIES; i++)); do
        if result="$(cast call "$@" --rpc-url "${RPC_URL}" 2>/dev/null)"; then
            echo "${result}"
            return 0
        fi
        sleep 5
    done

    return 1
}

# {GemFotManager} deploys its OWN {Notifier} in the constructor, so read it off the hook
# rather than using a standalone deployment.
NOTIFIER="${NOTIFIER:-$(call "${GEMFOT_MANAGER}" "notifier()(address)")}"
echo "==> Notifier (deployed by GemFotManager): ${NOTIFIER}"

echo ""
echo "==> Wiring the protocol ..."

# --- Access control ---------------------------------------------------------- #
send "FairLaunch.grantRole(GEMFOT_MANAGER)" "${FAIR_LAUNCH}" "grantRole(bytes32,address)" "${GEMFOT_MANAGER_ROLE}" "${GEMFOT_MANAGER}"
send "BidWall.grantRole(GEMFOT_MANAGER)"    "${BID_WALL}"    "grantRole(bytes32,address)" "${GEMFOT_MANAGER_ROLE}" "${GEMFOT_MANAGER}"

# --- {GemFotManager} --------------------------------------------------------- #
send "GemFotManager.setLaunch"       "${GEMFOT_MANAGER}" "setLaunch(address)"       "${LAUNCH}"
send "GemFotManager.setInitialPrice" "${GEMFOT_MANAGER}" "setInitialPrice(address)" "${INITIAL_PRICE}"
send "GemFotManager.setFeeDistribution" "${GEMFOT_MANAGER}" "setFeeDistribution((uint24,uint24,bool))" \
    "(${SWAP_FEE},${PROTOCOL_FEE},${FEE_DISTRIBUTION_ACTIVE})"

# --- {IndexerSubscriber} ----------------------------------------------------- #
send "Indexer.setNotifierLaunch" "${INDEXER}" "setNotifierLaunch(address,address)" "${NOTIFIER}" "${LAUNCH}"

# --- {Notifier} subscribers -------------------------------------------------- #
send "Notifier.subscribe(Indexer)"             "${NOTIFIER}" "subscribe(address,bytes)" "${INDEXER}"                0x
send "Notifier.subscribe(PreventNoFairLaunch)" "${NOTIFIER}" "subscribe(address,bytes)" "${PREVENT_NO_FAIR_LAUNCH}" 0x

# --- {ProtocolFeeRecipient} / {FeeEscrowRegistry} ---------------------------- #
send "ProtocolFeeRecipient.setFeeEscrow" "${PROTOCOL_FEE_RECIPIENT}" "setFeeEscrow(address,bool)" "${FEE_ESCROW}" true
send "FeeEscrowRegistry.addFeeEscrow"    "${FEE_ESCROW_REGISTRY}"    "addFeeEscrow(address,bool)" "${FEE_ESCROW}" false

# --- {TreasuryActionManager} ------------------------------------------------- #
send "ActionManager.approveAction(Blank)"      "${ACTION_MANAGER}" "approveAction(address)" "${BLANK_ACTION}"
send "ActionManager.approveAction(BurnTokens)" "${ACTION_MANAGER}" "approveAction(address)" "${BURN_TOKENS_ACTION}"
send "ActionManager.approveAction(BuyBack)"    "${ACTION_MANAGER}" "approveAction(address)" "${BUY_BACK_ACTION}"

echo ""
echo "==> Wiring complete."
