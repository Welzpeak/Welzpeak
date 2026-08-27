/**
 * Structured timecard contracts.
 *
 * v0 only needs the TOTALS block on the last page of the archive (see
 * STEP2_TIMECARD_PARSER.md section 2). That block carries human LABELS
 * ('Sunday Time', 'Overtime 1.5'), not numeric pay codes — the numeric codes
 * (1193, 1194, 1181) live on the payslip. Mapping label -> code is an employer
 * config concern (the pay code dictionary), not the parser's job, so the parser
 * emits labels and leaves the join to the reconciler.
 *
 * Parsers are one of the three per-document-type plug-in pieces; core never
 * knows about them. Only the SAA layout is implemented for v0.
 */

/** One totals-block entry as printed, before hh:mm normalisation. */
export interface RawTimecardTotal {
  /** Label exactly as printed, e.g. 'Sunday Time'. */
  label: string;
  /** Duration exactly as printed, e.g. '26:48'. Left untouched here. */
  raw_total: string;
}

/** One totals-block entry after hh:mm normalisation. */
export interface TimecardTotal extends RawTimecardTotal {
  /** Canonical integer minutes derived from `raw_total`. Source of truth. */
  total_minutes: number;
}

/** A parsed timecard: the period it covers and its normalised totals. */
export interface ParsedTimecard {
  /** Timecard period in 'YYYY-MM', e.g. '2025-12' (the month worked). */
  period: string;
  /** Optional employee reference as printed, if the layout carries one. */
  employee_ref?: string;
  /** The last-page totals block, normalised. */
  totals: TimecardTotal[];
}

/** The raw document handed to a parser (post text-extraction, pre-parse). */
export interface RawTimecardDocument {
  /** Document id, used in Finding.source_documents. */
  id: string;
  /** Period the document is filed under, 'YYYY-MM'. */
  period: string;
  /**
   * Extracted page text. For an archive this is the concatenation of the page
   * `.txt` files; the parser only relies on the last page's totals block.
   */
  text: string;
}

/**
 * A timecard parser for one employer's layout. `canParse` lets ingest pick the
 * right parser without core knowing any employer specifics.
 */
export interface TimecardParser {
  /** Employer this parser understands, e.g. 'SAA'. */
  readonly employer: string;
  /** True if this parser recognises the document's layout. */
  canParse(doc: RawTimecardDocument): boolean;
  /** Turn the document into normalised structured totals. */
  parse(doc: RawTimecardDocument): ParsedTimecard;
}
