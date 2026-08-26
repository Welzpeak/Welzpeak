import { describe, expect, it } from 'vitest';
import type { Finding, Strength } from './finding.js';
import { sequenceFindings } from './sequencer.js';

/**
 * Build a Finding with sane defaults. Tests override only what they exercise
 * (strength, rand_impact, and an id to assert order by). No expected figure is
 * hardcoded into product code — these are test fixtures only.
 */
function makeFinding(overrides: Partial<Finding> & { rule_id: string }): Finding {
  return {
    source_documents: ['doc-timecard', 'doc-payslip'],
    period: '2025-12',
    description: 'test finding',
    expected: 0,
    actual: 0,
    rand_impact: 0,
    recurrence: 'once',
    strength: 'proven',
    counterparty: 'SAA Payroll',
    evidence: [{ label: 'Shortfall', value: 'R0.00' }],
    ...overrides,
  };
}

/** Convenience: the ordered list of rule_ids after sequencing. */
function orderedIds(findings: readonly Finding[]): string[] {
  return sequenceFindings(findings).map((f) => f.rule_id);
}

describe('sequenceFindings', () => {
  it('assigns contiguous 1-based ranks in the returned order', () => {
    const findings = [
      makeFinding({ rule_id: 'a', rand_impact: 300 }),
      makeFinding({ rule_id: 'b', rand_impact: 100 }),
      makeFinding({ rule_id: 'c', rand_impact: 200 }),
    ];

    const ranked = sequenceFindings(findings);

    expect(ranked.map((f) => f.sequencing_rank)).toEqual([1, 2, 3]);
  });

  it('orders proven findings ascending by value — smallest concession first', () => {
    const findings = [
      makeFinding({ rule_id: 'big', strength: 'proven', rand_impact: 7948 }),
      makeFinding({ rule_id: 'small', strength: 'proven', rand_impact: 2923 }),
      makeFinding({ rule_id: 'mid', strength: 'proven', rand_impact: 5000 }),
    ];

    expect(orderedIds(findings)).toEqual(['small', 'mid', 'big']);
  });

  it('orders arguable findings descending by value — biggest contested claim first', () => {
    const findings = [
      makeFinding({ rule_id: 'small', strength: 'arguable', rand_impact: 1000 }),
      makeFinding({ rule_id: 'big', strength: 'arguable', rand_impact: 9000 }),
      makeFinding({ rule_id: 'mid', strength: 'arguable', rand_impact: 4000 }),
    ];

    expect(orderedIds(findings)).toEqual(['big', 'mid', 'small']);
  });

  it('places all proven before all arguable before all informational', () => {
    const findings = [
      makeFinding({ rule_id: 'info', strength: 'informational', rand_impact: 9999 }),
      makeFinding({ rule_id: 'arg', strength: 'arguable', rand_impact: 5000 }),
      makeFinding({ rule_id: 'prov', strength: 'proven', rand_impact: 100 }),
    ];

    expect(orderedIds(findings)).toEqual(['prov', 'arg', 'info']);
  });

  it('sequences a realistic mixed set: smallest proven leads, biggest arguable next', () => {
    const findings = [
      makeFinding({ rule_id: 'arguable_base', strength: 'arguable', rand_impact: 45000 }),
      makeFinding({ rule_id: 'proven_sunday', strength: 'proven', rand_impact: 2923 }),
      makeFinding({ rule_id: 'informational_note', strength: 'informational', rand_impact: 0 }),
      makeFinding({ rule_id: 'proven_holiday', strength: 'proven', rand_impact: 7948 }),
      makeFinding({ rule_id: 'arguable_smaller', strength: 'arguable', rand_impact: 12000 }),
    ];

    expect(orderedIds(findings)).toEqual([
      'proven_sunday', // smallest proven — the opening concession
      'proven_holiday', // next proven
      'arguable_base', // biggest arguable
      'arguable_smaller', // next arguable
      'informational_note', // context, last
    ]);
  });

  it('breaks ties within a group by input order (stable)', () => {
    const findings = [
      makeFinding({ rule_id: 'first', strength: 'proven', rand_impact: 5000 }),
      makeFinding({ rule_id: 'second', strength: 'proven', rand_impact: 5000 }),
      makeFinding({ rule_id: 'third', strength: 'proven', rand_impact: 5000 }),
    ];

    expect(orderedIds(findings)).toEqual(['first', 'second', 'third']);
  });

  it('overwrites any rank a rule set on itself — ranking is core-only', () => {
    const findings = [
      makeFinding({ rule_id: 'a', strength: 'proven', rand_impact: 200, sequencing_rank: 99 }),
      makeFinding({ rule_id: 'b', strength: 'proven', rand_impact: 100, sequencing_rank: 1 }),
    ];

    const ranked = sequenceFindings(findings);

    expect(ranked.map((f) => [f.rule_id, f.sequencing_rank])).toEqual([
      ['b', 1],
      ['a', 2],
    ]);
  });

  it('does not mutate the input findings or array', () => {
    const input: Finding[] = [
      makeFinding({ rule_id: 'a', strength: 'proven', rand_impact: 300 }),
      makeFinding({ rule_id: 'b', strength: 'proven', rand_impact: 100 }),
    ];
    const snapshot: Finding[] = JSON.parse(JSON.stringify(input));

    sequenceFindings(input);

    expect(input).toEqual(snapshot);
    expect(input[0]!.sequencing_rank).toBeUndefined();
    expect(input.map((f) => f.rule_id)).toEqual(['a', 'b']);
  });

  it('returns an empty array for no findings', () => {
    expect(sequenceFindings([])).toEqual([]);
  });

  it('handles a single finding', () => {
    const ranked = sequenceFindings([makeFinding({ rule_id: 'solo', rand_impact: 500 })]);
    expect(ranked).toHaveLength(1);
    expect(ranked[0]!.sequencing_rank).toBe(1);
    expect(ranked[0]!.rule_id).toBe('solo');
  });

  it('covers every Strength value', () => {
    const strengths: Strength[] = ['proven', 'arguable', 'informational'];
    const findings = strengths.map((strength, i) =>
      makeFinding({ rule_id: strength, strength, rand_impact: i * 100 }),
    );
    const ranked = sequenceFindings(findings);
    expect(ranked.map((f) => f.strength)).toEqual(['proven', 'arguable', 'informational']);
  });
});
