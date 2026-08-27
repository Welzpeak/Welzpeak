import { describe, expect, it } from 'vitest';
import { normaliseTimecardTotal, normaliseTimecardTotals } from './normalise.js';
import type { RawTimecardTotal } from './types.js';

const sampleTotals: RawTimecardTotal[] = [
  { label: 'Sunday Time', raw_total: '26:48' },
  { label: 'Overtime 1.5', raw_total: '15:24' },
];

describe('normaliseTimecardTotal', () => {
  it('attaches canonical integer minutes without altering printed fields', () => {
    expect(normaliseTimecardTotal(sampleTotals[0]!)).toEqual({
      label: 'Sunday Time',
      raw_total: '26:48',
      total_minutes: 1608,
    });
  });

  it('propagates the hh:mm refusal for a decimal-shaped total', () => {
    expect(() => normaliseTimecardTotal({ label: 'Sunday Time', raw_total: '26.48' })).toThrow();
  });
});

describe('normaliseTimecardTotals', () => {
  it('normalises every entry', () => {
    expect(normaliseTimecardTotals(sampleTotals).map((t) => t.total_minutes)).toEqual([1608, 924]);
  });

  it('returns an empty array for no entries', () => {
    expect(normaliseTimecardTotals([])).toEqual([]);
  });

  it('does not mutate the input', () => {
    const before = JSON.parse(JSON.stringify(sampleTotals));
    normaliseTimecardTotals(sampleTotals);
    expect(sampleTotals).toEqual(before);
  });
});
