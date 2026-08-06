import { useCallback, useEffect, useState } from 'react';
import { gemfotQuery, GET_VOLUME } from '@/lib/gemfotQueries';

interface BuyRow {
  id: string;
  nativeIn: string;
  timestamp: string;
}

export interface VolumeStats {
  /** USDC (native token) traded in the trailing 24 hours, raw bigint string */
  volume24h: string;
  /** USDC traded since genesis, raw bigint string */
  volumeAllTime: string;
  /** number of trades in the trailing 24 hours */
  trades24h: number;
}

const EMPTY: VolumeStats = { volume24h: '0', volumeAllTime: '0', trades24h: 0 };

const sum = (rows: BuyRow[] = []) =>
  rows.reduce((acc, r) => acc + BigInt(r.nativeIn || '0'), 0n).toString();

/**
 * Aggregates protocol volume from fair-launch buys.
 * Cheap enough for a hackathon-scale subgraph; swap for a
 * pre-aggregated entity once volume grows past 1k trades.
 */
export function useVolume(pollMs = 30_000) {
  const [stats, setStats] = useState<VolumeStats>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const since = Math.floor(Date.now() / 1000) - 86_400;
      const data = await gemfotQuery<{ allTime: BuyRow[]; recent: BuyRow[] }>(GET_VOLUME, {
        since: String(since),
      });

      setStats({
        volumeAllTime: sum(data.allTime),
        volume24h: sum(data.recent),
        trades24h: data.recent?.length ?? 0,
      });
    } catch {
      /* keep last known values */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!pollMs) return;
    const id = setInterval(load, pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  return { ...stats, loading, refetch: load };
}
