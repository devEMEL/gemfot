import { formatUnits } from 'viem';
import { CONTRACTS } from '@/config/networks';

export function timeAgo(ts: number): string {
  const s = Math.floor(Date.now() / 1000) - ts;
  if (s < 60) return `${Math.max(s, 0)}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function countdown(endsAt: number): string {
  const s = endsAt - Math.floor(Date.now() / 1000);
  if (s <= 0) return 'ended';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

export function compact(n: number, digits = 2): string {
  if (!isFinite(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(digits)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(digits)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(digits)}K`;
  if (abs > 0 && abs < 0.01) return n.toExponential(2);
  return n.toFixed(digits);
}

/** Formats a native (USDC) bigint string into a compact human string. */
export function fmtNative(v?: string | bigint | null, digits = 2): string {
  try {
    const n = Number(formatUnits(BigInt(v ?? 0), CONTRACTS.nativeTokenDecimals));
    return compact(n, digits);
  } catch {
    return '0';
  }
}

/** Formats a memecoin (18 decimals) bigint string into a compact human string. */
export function fmtToken(v?: string | bigint | null, digits = 2): string {
  try {
    const n = Number(formatUnits(BigInt(v ?? 0), 18));
    return compact(n, digits);
  } catch {
    return '0';
  }
}

export function shortAddress(a?: string | null, size = 4): string {
  if (!a) return '';
  return `${a.slice(0, 2 + size)}…${a.slice(-size)}`;
}

export function progressPct(initial?: string | null, remaining?: string | null): number {
  try {
    const init = BigInt(initial ?? 0);
    if (init === 0n) return 0;
    const sold = init - BigInt(remaining ?? 0);
    return Number((sold * 10_000n) / init) / 100;
  } catch {
    return 0;
  }
}
