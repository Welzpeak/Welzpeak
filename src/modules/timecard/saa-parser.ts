import { normaliseTimecardTotals } from './normalise.js';
import type {
  ParsedTimecard,
  RawTimecardDocument,
  RawTimecardTotal,
  TimecardParser,
} from './types.js';

/**
 * SAA timecard parser — the only employer layout in scope for v0.
 *
 * v0 reads ONLY the last-page totals block (STEP2_TIMECARD_PARSER.md section 2).
 * Parse rule: after the `Totals` line, each data line ends with an `h:mm` token
 * preceded by a label. The organisation/job columns before the label are
 * ellipsis-truncated and MUST NOT be relied on, and page 2's whitespace is
 * destroyed — so we never parse positionally. Instead we take the trailing
 * `h:mm` token and match the label the remainder ends with against SAA's known
 * label set.
 */

/** SAA totals-block labels, longest-first so suffix overlaps match greedily. */
const SAA_LABELS: readonly string[] = [
  'Total Actual Hrs+Leave',
  'Monthly Expected Hrs',
  'PPH Worked Hours',
  'Overtime 1.5',
  'Sunday Time',
  'Normal Hours',
  'Day Off Taken',
];

/**
 * Premium labels that MUST always appear in the output, zero-filled to '0:00'
 * when absent from the block. A category absent from the timecard means the
 * employee worked zero of it, not that it is unknown — emitting null would make
 * the reconciler silently skip a code it should have checked
 * (STEP2_TIMECARD_PARSER.md section 2, "A category absent ... means zero").
 */
const SAA_ALWAYS_REPORT: readonly string[] = ['Sunday Time', 'PPH Worked Hours', 'Overtime 1.5'];

/** Trailing h:mm token on a line, e.g. the '26:48' in a totals row. */
const TRAILING_HHMM = /(\d+:\d{2})\s*$/;

/** True once we have seen the last `Totals` header; parse the lines after it. */
function totalsSection(text: string): string[] {
  const lines = text.split(/\r?\n/);
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i]!.trim() === 'Totals') start = i; // last occurrence wins
  }
  return start === -1 ? [] : lines.slice(start + 1);
}

/**
 * Extract raw (label, h:mm) pairs from the totals block of already-extracted
 * text. Pure and layout-tolerant; exported for direct testing.
 */
export function parseSaaTotalsBlock(text: string): RawTimecardTotal[] {
  const found = new Map<string, string>();

  for (const line of totalsSection(text)) {
    const match = TRAILING_HHMM.exec(line);
    if (match === null) continue;
    const rawTotal = match[1]!;
    const beforeToken = line.slice(0, match.index).trimEnd();

    // The label is whichever known label the pre-token text ends with. Longest
    // labels are tried first so e.g. 'PPH Worked Hours' wins over a shorter
    // accidental suffix.
    const label = SAA_LABELS.find((candidate) => beforeToken.endsWith(candidate));
    if (label === undefined) continue;
    if (!found.has(label)) found.set(label, rawTotal);
  }

  // Zero-fill the always-report premium labels that did not appear.
  for (const label of SAA_ALWAYS_REPORT) {
    if (!found.has(label)) found.set(label, '0:00');
  }

  // Emit in the canonical SAA_LABELS order for stable, predictable output.
  const ordered: RawTimecardTotal[] = [];
  for (const label of SAA_LABELS) {
    const raw = found.get(label);
    if (raw !== undefined) ordered.push({ label, raw_total: raw });
  }
  return ordered;
}

export const saaTimecardParser: TimecardParser = {
  employer: 'SAA',

  canParse(doc: RawTimecardDocument): boolean {
    return doc.text.includes('South African Airways') || /^\s*Totals\s*$/m.test(doc.text);
  },

  parse(doc: RawTimecardDocument): ParsedTimecard {
    return {
      period: doc.period,
      totals: normaliseTimecardTotals(parseSaaTotalsBlock(doc.text)),
    };
  },
};
