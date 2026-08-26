import type { Finding, Strength } from './finding.js';

/**
 * The sequencer encodes the central strategic insight of the product:
 *
 *   Submit the smallest PROVEN finding first to obtain a written concession,
 *   then raise the larger ARGUABLE ones once the counterparty is on record.
 *
 * So the submission order is:
 *
 *   1. proven         — ascending by rand_impact (smallest first: the easiest,
 *                       least-contestable concession to extract)
 *   2. arguable       — descending by rand_impact (largest first: press the
 *                       biggest contested claim once a concession exists)
 *   3. informational  — last; not itself a claim to submit. Ordered descending
 *                       by rand_impact for a stable, sensible display order.
 *                       (This group's ordering is not load-bearing; the brief
 *                       specifies only proven-ascending then arguable-descending.)
 *
 * Rank is assigned HERE, in core — rules never set their own rank. Any
 * `sequencing_rank` a rule left on a finding is overwritten.
 *
 * Pure function: the input array and its findings are not mutated; a new array
 * of new finding objects is returned, each with `sequencing_rank` set 1..N.
 */

const GROUP_ORDER: Record<Strength, number> = {
  proven: 0,
  arguable: 1,
  informational: 2,
};

/** True when a strength group is ranked smallest-value-first. */
function isAscending(strength: Strength): boolean {
  return strength === 'proven';
}

export function sequenceFindings(findings: readonly Finding[]): Finding[] {
  // Decorate with original index so ties resolve to a stable, input order.
  const decorated = findings.map((finding, index) => ({ finding, index }));

  decorated.sort((a, b) => {
    const groupA = GROUP_ORDER[a.finding.strength];
    const groupB = GROUP_ORDER[b.finding.strength];
    if (groupA !== groupB) return groupA - groupB;

    const impactA = a.finding.rand_impact;
    const impactB = b.finding.rand_impact;
    if (impactA !== impactB) {
      return isAscending(a.finding.strength)
        ? impactA - impactB
        : impactB - impactA;
    }

    // Equal group and equal value: preserve input order.
    return a.index - b.index;
  });

  return decorated.map(({ finding }, i) => ({
    ...finding,
    sequencing_rank: i + 1,
  }));
}
