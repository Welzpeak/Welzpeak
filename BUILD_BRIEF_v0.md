# Build brief — v0 vertical slice

Paste this into Claude Code as the opening instruction. Keep `PRODUCT_LOG.md` in the repo root
so it can be read for context.

---

## What you are building

A document reconciliation engine that audits South African payslips against timecards, finds
underpayments, and drafts the correspondence to recover them.

This is **v0**: a working vertical slice, not the product. One employer configuration, one rules
pack, one document pair, a real finding out the other end. No auth, no payments, no WhatsApp,
no multi-tenancy. Those come later and the architecture must not preclude them.

**Success test:** upload a December 2025 timecard and a January 2026 payslip, and the system
independently produces the finding that R79.48 was underpaid across three premium codes,
without that number being hardcoded anywhere.

---

## Non-negotiable architecture

The engine has six stages. All six are core and generic. Nothing module-specific may live in
them.

```
ingest → normalise → reconcile → flag → draft → track
```

Per-document-type work is confined to exactly three plug-in pieces:

1. **Parser** — a document type into structured fields
2. **Normaliser** — format quirks
3. **Rules pack** — assertions that emit findings

If a rules pack needs to reach into the letter generator, or a parser needs to know what module
it belongs to, the abstraction is wrong. Stop and fix it rather than working around it.

### The finding

Every rule emits this shape regardless of source document. Define it once, in core.

```ts
type Strength = 'proven' | 'arguable' | 'informational';

interface Finding {
  rule_id: string;              // 'hhmm_decimal_conversion'
  source_documents: string[];   // document ids
  period: string;               // '2025-12'
  description: string;
  expected: number;
  actual: number;
  rand_impact: number;
  recurrence: 'once' | 'monthly' | 'annual';
  strength: Strength;
  counterparty: string;         // 'SAA Payroll'
  deadline_rule?: string;       // '14_working_days_from_submission'
  letter_template?: string;     // 'T4'
  sequencing_rank?: number;     // assigned by the sequencer, not the rule
  evidence: Evidence[];         // the arithmetic, shown
}
```

`strength` and `sequencing_rank` are load-bearing. They encode the central insight: submit the
smallest **proven** finding first to obtain a written concession, then raise the larger
**arguable** one. A sequencer in core assigns rank — proven ascending by value first, then
arguable descending. Rules never set their own rank.

`evidence` must carry the working, not just the answer. A finding the user cannot check is a
finding they cannot submit.

---

## Domain rules you must get right

### Payroll lag

Last month's timecard pays on **this** month's payslip. December 2025 timecard reconciles
against the January 2026 payslip. Getting this wrong invalidates everything downstream.

### The hh:mm conversion fault

Timecards record `26:48`, meaning 26 hours 48 minutes = **26.80** decimal hours. The fault being
detected is payroll treating that as **26.48**. Never parse `hh:mm` as a float.

### Rate derivation (SAA reference config)

```
ordinary_hourly = pensionable_basic × 12 ÷ 2184
```

Note it is **pensionable basic**, not cash emoluments. Whether that is the correct base is a
separate `arguable` finding — the engine must be able to compute against either base and report
the difference, without asserting which is correct.

Multipliers: overtime 1.5× · Sunday 2.0× · public holiday 2.0×.

### Universal BCEA floor

These rules run against any employer even with no verified configuration, because they compare
an employer against itself:

- `hhmm_decimal_conversion` — hh:mm read as decimal
- `period_drift` — identical timecard input, different payment across periods
- `undisclosed_deduction` — a deduction code with no prior history (BCEA s34)
- `payslip_completeness` — required fields absent (BCEA s33)
- `internal_arithmetic` — line items do not sum to stated totals

### Degraded mode

An employer without a verified config runs the floor rules only and **says so on screen**. Never
emit a confident finding derived from an unverified rate base. Wrong findings destroy the
product.

### Rules pack versioning

Every rules pack and every employer config carries an `effective_from` date. Resolution is by
the period being audited, not by today's date. Auditing a 2026 payslip against 2024 rules is the
one failure with no recovery.

---

## Input quirks

- **Payslip PDFs are ZIP archives.** Read with `zipfile.ZipFile(path).read('1.txt')`. Not a
  standard PDF — detect and handle both.
- **Timecard PDFs are standard.** Extract with layout preserved.
- Both formats vary by employer. The parser interface must tolerate that; only the
  SAA implementation is in scope for v0.

---

## Stack

- TypeScript throughout
- Next.js App Router
- SQLite via Prisma for v0, schema portable to Postgres
- Tailwind
- Vitest

No auth. No file storage service — local disk is fine. No payment integration.

---

## Data model

Model these as first-class entities from the start, even unused in v0. Retrofitting them is
expensive.

- `Person` — the account unit. Payroll, tax and employment are per person.
- `Organisation` — holds seats, for the union tier later. Nullable on Person.
- `EmployerConfig` — versioned by `effective_from`
- `Document` — type, period, raw path, parsed payload, owning Person
- `Finding`
- `Deadline` — computed, not stored as a fixed date. `14 working days from submission` must
  recompute if the submission date changes. South African public holidays needed.
- `Correspondence` — generated letter, sent date, response date, outcome

---

## Build order

1. Finding schema, sequencer, and their tests. Nothing else until these are right.
2. Timecard parser + hh:mm normaliser, with tests on the real fixture.
3. Payslip parser (ZIP-aware) + pay code extraction.
4. Reconciler: given a config, recompute every premium line from timecard hours.
5. The five floor rules.
6. SAA employer config as data, not code.
7. Letter generator — templates take a Finding and emit text.
8. Deadline engine with SA public holidays.
9. Minimal UI: upload → findings list → finding detail showing the arithmetic → generated letter.

Stop after each step and show me the tests passing before moving on.

---

## What good looks like

The finding detail screen shows this, and a user can verify every line by hand:

```
Sunday Time (code 1193) — December 2025
Timecard total:        26:48
Correct decimal:       26.80 hours
Rate:                  R91.35 × 2.0 = R182.70
Expected:              R2,448.18
Paid (Jan payslip):    R2,418.95
Shortfall:             R29.23

Corroboration: March 2026 timecard shows the identical 26:48 total
and was paid R2,448.18 on the April payslip. Same hours, R29.23 apart.
```

---

## Constraints

- Do not hardcode any expected figure. Every number is derived or read from a document.
- Do not build auth, payments, WhatsApp or multi-tenancy in v0.
- Do not let a rules pack import from the letter generator or the UI.
- Handle currency in integer cents internally. Never float arithmetic on money.
- Ask before adding a dependency.
- POPIA: documents contain ID numbers, salaries and bank details. No logging of document
  contents. No third-party analytics on any page that renders a document or a finding.

---

## First task

Read `PRODUCT_LOG.md`. Then set up the project and implement step 1 only — the finding schema,
the sequencer, and their tests. Show me the tests before writing anything else.
