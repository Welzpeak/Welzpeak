import { describe, expect, it } from 'vitest';
import { normaliseTimecardLine, normaliseTimecardLines } from './normalise.js';
import type { RawTimecardLine } from './types.js';

/**
 * NOTE: these rows are a SYNTHETIC stand-in for parser output. They are NOT the
 * real SAA timecard — the actual PDF layout has not been provided yet, so the
 * concrete parser is deliberately not built. These tests prove the normalise
 * stage attaches correct integer minutes to whatever rows a parser emits.
 */
const sampleRows: RawTimecardLine[] = [
  { pay_code: '1193', description: 'Sunday Time', raw_total: '26:48' },
  { pay_code: '1200', description: 'Overtime', raw_total: '8:30' },
];

describe('normaliseTimecardLine', () => {
  it('attaches canonical integer minutes without altering printed fields', () => {
    const line = normaliseTimecardLine(sampleRows[0]!);
    expect(line).toEqual({
      pay_code: '1193',
      description: 'Sunday Time',
      raw_total: '26:48',
      total_minutes: 1608,
    });
  });

  it('propagates the hh:mm refusal for a decimal-shaped total', () => {
    expect(() =>
      normaliseTimecardLine({ pay_code: '1193', description: 'Sunday Time', raw_total: '26.48' }),
    ).toThrow();
  });
});

describe('normaliseTimecardLines', () => {
  it('normalises every row', () => {
    const lines = normaliseTimecardLines(sampleRows);
    expect(lines.map((l) => l.total_minutes)).toEqual([1608, 510]);
  });

  it('returns an empty array for no rows', () => {
    expect(normaliseTimecardLines([])).toEqual([]);
  });

  it('does not mutate the input rows', () => {
    const before = JSON.parse(JSON.stringify(sampleRows));
    normaliseTimecardLines(sampleRows);
    expect(sampleRows).toEqual(before);
  });
});
