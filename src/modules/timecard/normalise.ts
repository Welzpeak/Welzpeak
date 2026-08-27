import { hhmmToMinutes } from './hhmm.js';
import type { RawTimecardLine, TimecardLine } from './types.js';

/**
 * The "normalise" stage for timecards: take rows a parser has separated into
 * pay_code / description / raw_total and attach canonical integer minutes.
 *
 * This is deliberately layout-agnostic. The employer-specific work of finding
 * those rows in a PDF lives in the parser; this function only fixes the hh:mm
 * format quirk, so it is reusable across every timecard layout.
 */
export function normaliseTimecardLine(raw: RawTimecardLine): TimecardLine {
  return {
    ...raw,
    total_minutes: hhmmToMinutes(raw.raw_total),
  };
}

export function normaliseTimecardLines(raws: readonly RawTimecardLine[]): TimecardLine[] {
  return raws.map(normaliseTimecardLine);
}
