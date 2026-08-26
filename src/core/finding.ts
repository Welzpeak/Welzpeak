/**
 * The Finding — the single shape every rule emits, regardless of the source
 * document. Defined ONCE here in core. Nothing document-type-specific belongs
 * in this file: parsers, normalisers and rules packs are the only places that
 * know about a particular employer or document layout.
 *
 * Money convention (see BUILD_BRIEF "Constraints"): all monetary fields are
 * held as **integer cents** (South African cents). Never store rands as a
 * float. R2,448.18 is the integer `244818`. The sequencer only ever compares
 * these values, so keeping them as integers also keeps ranking exact.
 */

/**
 * How defensible a finding is. Load-bearing: it drives sequencing.
 *
 * - `proven`         the arithmetic is undeniable against the employer's own
 *                    documents (e.g. an hh:mm value read as a decimal).
 * - `arguable`       depends on a contested interpretation (e.g. whether the
 *                    rate base should be cash emoluments rather than
 *                    pensionable basic).
 * - `informational`  surfaced for context; not itself a claim to submit.
 */
export type Strength = 'proven' | 'arguable' | 'informational';

/** How often the shortfall repeats, for projecting total exposure. */
export type Recurrence = 'once' | 'monthly' | 'annual';

/**
 * One line of the shown working. `evidence` must carry the arithmetic, not
 * just the answer — a finding the user cannot check by hand is a finding they
 * cannot submit. Mirrors the "what good looks like" layout in the brief:
 *
 *   label            working             value
 *   'Rate'           'R91.35 × 2.0'      'R182.70'
 *   'Correct decimal'                    '26.80 hours'
 */
export interface Evidence {
  /** Left-hand label, e.g. 'Correct decimal', 'Rate', 'Shortfall'. */
  label: string;
  /** The computation shown, e.g. 'R91.35 × 2.0'. Optional for plain values. */
  working?: string;
  /** The rendered result, e.g. 'R182.70', '26.80 hours'. */
  value: string;
}

export interface Finding {
  /** Stable identifier of the emitting rule, e.g. 'hhmm_decimal_conversion'. */
  rule_id: string;
  /** Ids of the documents this finding was derived from. */
  source_documents: string[];
  /** Period audited, in 'YYYY-MM', e.g. '2025-12' (the timecard month). */
  period: string;
  /** Human-readable summary of what is wrong. */
  description: string;
  /** What should have been paid, in integer cents. */
  expected: number;
  /** What was actually paid, in integer cents. */
  actual: number;
  /**
   * The recoverable amount, in integer cents. A positive value is an
   * underpayment (money owed to the employee). Sequencing orders by this.
   */
  rand_impact: number;
  recurrence: Recurrence;
  strength: Strength;
  /** Who the claim is against, e.g. 'SAA Payroll'. */
  counterparty: string;
  /** Which deadline rule applies, e.g. '14_working_days_from_submission'. */
  deadline_rule?: string;
  /** Which letter template drafts this, e.g. 'T4'. */
  letter_template?: string;
  /**
   * 1-based submission order, assigned by the core sequencer — NOT by the
   * rule. A rule that sets this itself is a bug; the sequencer overwrites it.
   */
  sequencing_rank?: number;
  /** The shown working. Never empty for a submittable finding. */
  evidence: Evidence[];
}
