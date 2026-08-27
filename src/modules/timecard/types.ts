/**
 * Structured timecard contracts. These are the fields a timecard parser must
 * emit, whatever the employer's PDF layout. Only the SAA implementation is in
 * scope for v0, but the interface must tolerate other layouts (parsers are one
 * of the three per-document-type plug-in pieces; core never knows about them).
 */

/** One pay-code line as printed on a timecard, before normalisation. */
export interface RawTimecardLine {
  /** Numeric pay code as printed, e.g. '1193'. */
  pay_code: string;
  /** Human label as printed, e.g. 'Sunday Time'. */
  description: string;
  /** The duration exactly as printed, e.g. '26:48'. Left untouched here. */
  raw_total: string;
}

/** One pay-code line after hh:mm normalisation. */
export interface TimecardLine extends RawTimecardLine {
  /** Canonical integer minutes derived from `raw_total`. Source of truth. */
  total_minutes: number;
}

/** A parsed timecard: which period it covers and its normalised lines. */
export interface ParsedTimecard {
  /** Timecard period in 'YYYY-MM', e.g. '2025-12' (the month worked). */
  period: string;
  /** Optional employee reference as printed, if the layout carries one. */
  employee_ref?: string;
  lines: TimecardLine[];
}

/** The raw document handed to a parser (post-extraction, pre-parse). */
export interface RawTimecardDocument {
  /** Document id, used in Finding.source_documents. */
  id: string;
  /** Period the document is filed under, 'YYYY-MM'. */
  period: string;
  /** Layout-preserved extracted text of the timecard PDF. */
  text: string;
}

/**
 * A timecard parser for one employer's layout. `canParse` lets the ingest stage
 * pick the right parser without the core knowing any employer specifics.
 */
export interface TimecardParser {
  /** Employer this parser understands, e.g. 'SAA'. */
  readonly employer: string;
  /** True if this parser recognises the document's layout. */
  canParse(doc: RawTimecardDocument): boolean;
  /** Turn the document into normalised structured fields. */
  parse(doc: RawTimecardDocument): ParsedTimecard;
}
