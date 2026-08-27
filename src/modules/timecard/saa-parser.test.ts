import { describe, expect, it } from 'vitest';
import { minutesToDecimalHours } from './hhmm.js';
import { parseSaaTotalsBlock, saaTimecardParser } from './saa-parser.js';
import type { RawTimecardDocument, TimecardTotal } from './types.js';

/**
 * The real extracted 2025-12 totals block (STEP2_TIMECARD_PARSER.md section 2),
 * verbatim — ellipsis-truncated org/job columns and all. Kept in sync with
 * fixtures/timecards/2025-12.totals.txt. Inlined here so the test needs no
 * filesystem access (and no @types/node) to run.
 */
const DEC_2025_TOTALS = `Totals
Span by All   Group by All
South African Airways/… Jnr Op - Check in. Board… Day Off Taken          4:00
South African Airways/… Jnr Op - Check in. Board… Monthly Expected Hrs 186:00
South African Airways/… Jnr Op - Check in. Board… Normal Hours         138:26
South African Airways/… Jnr Op - Check in. Board… Overtime 1.5          15:24
South African Airways/… Jnr Op - Check in. Board… PPH Worked Hours      20:46
South African Airways/… Jnr Op - Check in. Board… Sunday Time           26:48
South African Airways/… Jnr Op - Check in. Board… Total Actual Hrs+Leave 186:00
`;

const decDoc: RawTimecardDocument = {
  id: 'timecard-2025-12',
  period: '2025-12',
  text: DEC_2025_TOTALS,
};

function byLabel(totals: TimecardTotal[]): Map<string, TimecardTotal> {
  return new Map(totals.map((t) => [t.label, t]));
}

describe('parseSaaTotalsBlock', () => {
  it('extracts every labelled total from the real Dec 2025 block', () => {
    const totals = new Map(parseSaaTotalsBlock(DEC_2025_TOTALS).map((t) => [t.label, t.raw_total]));
    // Golden values from section 3.
    expect(totals.get('Sunday Time')).toBe('26:48');
    expect(totals.get('PPH Worked Hours')).toBe('20:46');
    expect(totals.get('Overtime 1.5')).toBe('15:24');
    expect(totals.get('Normal Hours')).toBe('138:26');
    expect(totals.get('Monthly Expected Hrs')).toBe('186:00');
    expect(totals.get('Total Actual Hrs+Leave')).toBe('186:00');
    expect(totals.get('Day Off Taken')).toBe('4:00');
  });

  it('reads the label preceding the trailing token, not the ellipsis prefix', () => {
    // 'Overtime 1.5' contains a dot but no colon, so it is never mistaken for
    // the h:mm token, and the truncated org/job prefix is ignored.
    const totals = new Map(parseSaaTotalsBlock(DEC_2025_TOTALS).map((t) => [t.label, t.raw_total]));
    expect(totals.has('Overtime 1.5')).toBe(true);
    expect(totals.get('Overtime 1.5')).toBe('15:24');
  });

  it('zero-fills an absent premium category as 0:00, never null (Jan 2026 has no Overtime)', () => {
    const janLike = `Totals
South African Airways/… Jnr Op… Sunday Time     22:55
South African Airways/… Jnr Op… PPH Worked Hours 6:59
South African Airways/… Jnr Op… Normal Hours   109:55
`;
    const totals = new Map(parseSaaTotalsBlock(janLike).map((t) => [t.label, t.raw_total]));
    expect(totals.get('Overtime 1.5')).toBe('0:00');
    expect(totals.get('Sunday Time')).toBe('22:55');
  });

  it('returns only zero-filled premiums when there is no Totals section', () => {
    const totals = new Map(parseSaaTotalsBlock('no totals here\njust noise').map((t) => [t.label, t.raw_total]));
    expect([...totals.keys()].sort()).toEqual(['Overtime 1.5', 'PPH Worked Hours', 'Sunday Time']);
    expect([...totals.values()]).toEqual(['0:00', '0:00', '0:00']);
  });
});

describe('saaTimecardParser', () => {
  it('canParse recognises an SAA archive', () => {
    expect(saaTimecardParser.canParse(decDoc)).toBe(true);
    expect(saaTimecardParser.canParse({ id: 'x', period: '2025-12', text: 'unrelated document' })).toBe(false);
  });

  it('parses Dec 2025 into normalised totals with canonical minutes and the right period', () => {
    const parsed = saaTimecardParser.parse(decDoc);
    expect(parsed.period).toBe('2025-12');

    const totals = byLabel(parsed.totals);
    expect(totals.get('Sunday Time')!.total_minutes).toBe(1608);
    expect(totals.get('PPH Worked Hours')!.total_minutes).toBe(1246);
    expect(totals.get('Overtime 1.5')!.total_minutes).toBe(924);
    expect(totals.get('Normal Hours')!.total_minutes).toBe(8306);
    expect(totals.get('Monthly Expected Hrs')!.total_minutes).toBe(11160);
    expect(totals.get('Day Off Taken')!.total_minutes).toBe(240);
  });
});

describe('step 2 acceptance test (STEP2_TIMECARD_PARSER.md section 6)', () => {
  it('parse(December_2025) yields the documented h:mm totals', () => {
    const totals = byLabel(saaTimecardParser.parse(decDoc).totals);
    expect(totals.get('Sunday Time')!.raw_total).toBe('26:48');
    expect(totals.get('PPH Worked Hours')!.raw_total).toBe('20:46');
    expect(totals.get('Overtime 1.5')!.raw_total).toBe('15:24');
  });

  it('normalise decimalises under round_2dp: 26:48->26.80, 20:46->20.77, 15:24->15.40', () => {
    const totals = byLabel(saaTimecardParser.parse(decDoc).totals);
    expect(minutesToDecimalHours(totals.get('Sunday Time')!.total_minutes)).toBe('26.80');
    // 20:46 = 20.76667 exact; round_2dp -> 20.77 (the payslip-provable convention).
    expect(minutesToDecimalHours(totals.get('PPH Worked Hours')!.total_minutes)).toBe('20.77');
    expect(minutesToDecimalHours(totals.get('Overtime 1.5')!.total_minutes)).toBe('15.40');
  });
});
