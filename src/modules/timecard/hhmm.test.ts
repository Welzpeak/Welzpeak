import { describe, expect, it } from 'vitest';
import {
  HhmmParseError,
  hhmmToMinutes,
  minutesToDecimalHours,
  minutesToHhmm,
  parseHhmm,
} from './hhmm.js';

describe('parseHhmm', () => {
  it('reads 26:48 as 26h 48m = 1608 minutes (the canonical fault case)', () => {
    expect(parseHhmm('26:48')).toEqual({ hours: 26, minutes: 48, totalMinutes: 1608 });
  });

  it('parses a plain shift', () => {
    expect(parseHhmm('8:30')).toEqual({ hours: 8, minutes: 30, totalMinutes: 510 });
  });

  it('parses zero', () => {
    expect(parseHhmm('0:00')).toEqual({ hours: 0, minutes: 0, totalMinutes: 0 });
  });

  it('accepts accumulated hours past 24 (timecards total a month)', () => {
    expect(parseHhmm('148:12')).toEqual({ hours: 148, minutes: 12, totalMinutes: 8892 });
  });

  it('tolerates surrounding whitespace', () => {
    expect(hhmmToMinutes('  26:48 ')).toBe(1608);
  });

  it('REFUSES a decimal — hh:mm must never be parsed as a float', () => {
    // 26.48 is exactly the misreading the product exists to catch.
    expect(() => parseHhmm('26.48')).toThrow(HhmmParseError);
    expect(() => parseHhmm('26.80')).toThrow(HhmmParseError);
  });

  it('rejects minutes >= 60', () => {
    expect(() => parseHhmm('26:60')).toThrow(HhmmParseError);
    expect(() => parseHhmm('1:99')).toThrow(HhmmParseError);
  });

  it('rejects one-digit minutes as ambiguous (8:5 could be 8:05 or 8:50)', () => {
    expect(() => parseHhmm('8:5')).toThrow(HhmmParseError);
  });

  it('rejects empty and non-numeric input', () => {
    expect(() => parseHhmm('')).toThrow(HhmmParseError);
    expect(() => parseHhmm('   ')).toThrow(HhmmParseError);
    expect(() => parseHhmm('abc')).toThrow(HhmmParseError);
    expect(() => parseHhmm('26:')).toThrow(HhmmParseError);
    expect(() => parseHhmm(':48')).toThrow(HhmmParseError);
  });
});

describe('minutesToDecimalHours', () => {
  it('renders 1608 minutes as 26.80 hours — NOT 26.48', () => {
    expect(minutesToDecimalHours(1608)).toBe('26.80');
    expect(minutesToDecimalHours(1608)).not.toBe('26.48');
  });

  it('renders exact half hours', () => {
    expect(minutesToDecimalHours(510)).toBe('8.50');
    expect(minutesToDecimalHours(0)).toBe('0.00');
  });

  it('rounds non-terminating fractions deterministically', () => {
    // 26:50 = 1610 min = 26.8333... -> 26.83 at 2dp
    expect(minutesToDecimalHours(1610)).toBe('26.83');
    // 0:20 = 20 min = 0.3333... -> 0.33
    expect(minutesToDecimalHours(20)).toBe('0.33');
    // 0:10 = 10 min = 0.1666... -> 0.17
    expect(minutesToDecimalHours(10)).toBe('0.17');
  });

  it('supports other precisions', () => {
    expect(minutesToDecimalHours(1608, 4)).toBe('26.8000');
    expect(minutesToDecimalHours(1610, 0)).toBe('27');
  });
});

describe('minutesToHhmm', () => {
  it('round-trips 26:48', () => {
    expect(minutesToHhmm(1608)).toBe('26:48');
    expect(hhmmToMinutes(minutesToHhmm(1608))).toBe(1608);
  });

  it('zero-pads minutes', () => {
    expect(minutesToHhmm(505)).toBe('8:25');
    expect(minutesToHhmm(60)).toBe('1:00');
    expect(minutesToHhmm(5)).toBe('0:05');
  });
});
