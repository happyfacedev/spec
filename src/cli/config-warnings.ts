import type { Config } from '../core/schemas';

/**
 * Whether afterMerge is set but no generated globs are: `generated` and a legacy `generatedGlobs` are
 * one key, either makes paths generated, and history authorizes afterMerge commits only on generated
 * paths (LNT-003/R11).
 */
const afterMergeLacksGeneratedGlobs = (config: Config | null): boolean =>
  !!config?.afterMerge && config.generatedGlobs.length === 0 && config.generated === undefined;

/** The L034 text of `spec lint` (LNT-003/S27). */
export function afterMergeGeneratedGlobsWarning(config: Config | null): string | null {
  if (!afterMergeLacksGeneratedGlobs(config)) return null;
  return 'afterMerge is configured but generated is not set; history only authorizes its generated-path commits';
}

/** The note `spec upgrade` prints for the same condition (INS-016/S4); its wording is unchanged. */
export function afterMergeUpgradeNote(config: Config | null): string | null {
  if (!afterMergeLacksGeneratedGlobs(config)) return null;
  return 'afterMerge is configured but generatedGlobs is empty and generated is not set; history only authorizes its generated-path commits';
}

/** LNT-003/R12: a non-empty legacy `generatedGlobs` is replaced by `generated`. */
export function legacyGeneratedGlobsWarning(config: Config | null): string | null {
  if (!config || config.generatedGlobs.length === 0) return null;
  return 'generatedGlobs is replaced by generated; it is read as generated.globs without a command';
}
