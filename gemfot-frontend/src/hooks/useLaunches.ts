import { useCallback, useEffect, useState } from 'react';
import {
  gemfotQuery,
  GET_LAUNCHES,
  type SubgraphLaunch,
} from '@/lib/gemfotQueries';
import { ipfsToHttp } from '@/lib/pinata';

export interface LaunchMeta {
  description?: string;
  image?: string;
  links?: Record<string, string | undefined>;
}

export interface EnrichedLaunch extends SubgraphLaunch {
  imageUrl: string;
  description: string;
  /** true while the fair launch window is open */
  isLive: boolean;
}

const metaCache = new Map<string, LaunchMeta>();

async function fetchMeta(tokenUri: string): Promise<LaunchMeta> {
  if (!tokenUri) return {};
  if (metaCache.has(tokenUri)) return metaCache.get(tokenUri)!;
  try {
    const res = await fetch(ipfsToHttp(tokenUri));
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as LaunchMeta;
    metaCache.set(tokenUri, json);
    return json;
  } catch {
    return {};
  }
}

export function useLaunches(options: { first?: number; pollMs?: number } = {}) {
  const { first = 50, pollMs = 15_000 } = options;

  const [launches, setLaunches] = useState<EnrichedLaunch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const data = await gemfotQuery<{ launches: SubgraphLaunch[] }>(GET_LAUNCHES, {
          first,
          skip: 0,
          orderBy: 'createdAtTimestamp',
          orderDirection: 'desc',
        });

        const now = Math.floor(Date.now() / 1000);
        const enriched = await Promise.all(
          (data.launches ?? []).map(async (l) => {
            const meta = await fetchMeta(l.tokenUri);
            return {
              ...l,
              creator: typeof l.creator === 'string' ? l.creator : l.creator?.id ?? '',
              imageUrl: ipfsToHttp(meta.image),
              description: meta.description ?? '',
              isLive: !l.fairLaunchClosed && now < Number(l.fairLaunchEndsAt),
            } as EnrichedLaunch;
          })
        );

        setLaunches(enriched);
        setError(null);
      } catch (e: any) {
        setError(e?.message ?? 'Failed to load launches');
      } finally {
        setLoading(false);
      }
    },
    [first]
  );

  useEffect(() => {
    load();
    if (!pollMs) return;
    const id = setInterval(() => load(true), pollMs);
    return () => clearInterval(id);
  }, [load, pollMs]);

  return { launches, loading, error, refetch: () => load(true) };
}
