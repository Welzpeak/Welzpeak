/**
 * hh:mm normalisation — the single most important primitive in module 1.
 *
 * Timecards print durations as `hh:mm`. `26:48` means 26 hours and 48 minutes,
 * which is **26.80** decimal hours (48/60 = 0.80). The fault this whole product
 * exists to catch is payroll reading `26:48` as the float **26.48**. So this
 * module NEVER parses an hh:mm value as a float: the colon is mandatory and a
 * decimal point is rejected.
 *
 * Canonical form is INTEGER MINUTES. Money is computed downstream from minutes
 * with integer arithmetic (rate_cents_per_hour x minutes / 60), never from a
 * float number of hours. Decimal-hours strings produced here are for display
 * and evidence only, never for monetary calculation.
 */

/** Thrown when a value is not a well-formed hh:mm duration. */
export class HhmmParseError extends Error {
  constructor(
    public readonly raw: string,
    reason: string,
  ) {
    super(`Invalid hh:mm value ${JSON.stringify(raw)}: ${reason}`);
    this.name = 'HhmmParseError';
  }
}

/**
 * hh:mm with:
 *  - one or more hour digits (timecards accumulate past 24, e.g. 148:12),
 *  - a colon,
 *  - exactly two minute digits.
 *
 * Two minute digits are required so `8:5` is rejected as ambiguous (is it 8:05
 * or 8:50?) rather than silently misread. Surrounding whitespace is tolerated.
 */
const HHMM = /^(\d+):(\d{2})$/;

export interface Hhmm {
  hours: number;
  minutes: number;
  /** Canonical integer minutes: hours * 60 + minutes. */
  totalMinutes: number;
}

/**
 * Parse an hh:mm string into its parts and canonical minutes.
 * Throws HhmmParseError on anything that is not a clean hh:mm duration —
 * including a decimal like "26.48", which is the very misreading we detect.
 */
export function parseHhmm(raw: string): Hhmm {
  if (typeof raw !== 'string') {
    throw new HhmmParseError(String(raw), 'not a string');
  }
  const trimmed = raw.trim();
  if (trimmed === '') {
    throw new HhmmParseError(raw, 'empty');
  }
  if (trimmed.includes('.')) {
    // A decimal point here is the classic fault: hh:mm rendered/entered as a
    // float. Refuse it loudly rather than guessing.
    throw new HhmmParseError(raw, 'looks like a decimal, not hh:mm (never parse hh:mm as a float)');
  }

  const match = HHMM.exec(trimmed);
  if (match === null) {
    throw new HhmmParseError(raw, 'not in hh:mm form (need <hours>:<mm>)');
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (minutes > 59) {
    throw new HhmmParseError(raw, `minutes ${minutes} out of range 00-59`);
  }

  return { hours, minutes, totalMinutes: hours * 60 + minutes };
}

/** Convenience: hh:mm string straight to canonical integer minutes. */
export function hhmmToMinutes(raw: string): number {
  return parseHhmm(raw).totalMinutes;
}

/**
 * Render integer minutes as a decimal-hours string, e.g. 1608 -> "26.80".
 * DISPLAY / EVIDENCE ONLY. Rounding is done in integer hundredths so the shown
 * figure is deterministic; never feed this back into money arithmetic.
 */
export function minutesToDecimalHours(totalMinutes: number, dp = 2): string {
  if (!Number.isInteger(totalMinutes)) {
    throw new HhmmParseError(String(totalMinutes), 'totalMinutes must be an integer');
  }
  const scale = 10 ** dp;
  // hundredths (for dp=2) of an hour, rounded from exact minutes.
  const scaled = Math.round((totalMinutes * scale) / 60);
  const whole = Math.trunc(scaled / scale);
  const frac = Math.abs(scaled - whole * scale)
    .toString()
    .padStart(dp, '0');
  return dp > 0 ? `${whole}.${frac}` : `${whole}`;
}

/** Render integer minutes back to canonical hh:mm, e.g. 1608 -> "26:48". */
export function minutesToHhmm(totalMinutes: number): string {
  if (!Number.isInteger(totalMinutes) || totalMinutes < 0) {
    throw new HhmmParseError(String(totalMinutes), 'totalMinutes must be a non-negative integer');
  }
  const hours = Math.trunc(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}:${minutes.toString().padStart(2, '0')}`;
}
