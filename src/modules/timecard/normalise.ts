import { hhmmToMinutes } from './hhmm.js';
import type { RawTimecardTotal, TimecardTotal } from './types.js';

/**
 * The "normalise" stage for timecards: attach canonical integer minutes to a
 * totals-block entry. Layout-agnostic — the employer-specific work of finding
 * the totals in the archive lives in the parser; this only fixes the hh:mm
 * format quirk, so it is reusable across every timecard layout.
 */
export function normaliseTimecardTotal(raw: RawTimecardTotal): TimecardTotal {
  return {
    ...raw,
    total_minutes: hhmmToMinutes(raw.raw_total),
  };
}

export function normaliseTimecardTotals(
  raws: readonly RawTimecardTotal[],
): TimecardTotal[] {
  return raws.map(normaliseTimecardTotal);
}
