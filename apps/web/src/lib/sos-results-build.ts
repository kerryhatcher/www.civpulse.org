import { getBuildSupabase } from "./supabase-build";
import { readRpcSos, type SosRpc, type SosView } from "./sos-results-reader";
import type { SosContestMapping } from "./sos-ballot";

export async function publicSosMappings(
  electionId: string,
): Promise<SosContestMapping[]> {
  const db = getBuildSupabase();
  if (!db) return [];
  const { data, error } = await db.rpc("get_sos_results_mappings", {
    p_election_id: electionId,
  });
  if (error) throw error;
  if (data?.status !== "ok" || !Array.isArray(data.mappings))
    throw Error("Public SOS mappings unavailable");
  return data.mappings;
}

const cache = new Map<string, Promise<SosView | null>>();
/** Static ballot counts require the complete selected scope, within the reader's 10,000-item cap. */
export async function readPublicSosFallback(
  rpc: SosRpc,
  electionId: string,
): Promise<SosView | null> {
  const result = await readRpcSos(rpc, electionId, "011");
  return result.pointer && result.scope
    ? { pointer: result.pointer, scope: result.scope, truncated: result.truncated }
    : null;
}

/** Call only after the election was admitted to the anonymous public slug snapshot. */
export function publicSosFallback(electionId: string): Promise<SosView | null> {
  if (import.meta.env.DEV) cache.delete(electionId);
  let pending = cache.get(electionId);
  if (!pending) {
    pending = (async () => {
      const db = getBuildSupabase();
      if (!db) return null;
      return readPublicSosFallback(
        async (args) => {
          const { data, error } = await db.rpc("get_sos_results", args);
          if (error) throw error;
          return data;
        },
        electionId,
      );
    })();
    cache.set(electionId, pending);
  }
  return pending;
}
