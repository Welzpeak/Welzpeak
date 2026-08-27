# Step 2 — timecard parser and hh:mm normaliser

Companion to `BUILD_BRIEF_v0.md`. Contains real extracted format detail and golden fixtures.
**Two corrections to the build brief are recorded in section 1. Apply them.**

---

## 1. Corrections to the build brief

### 1.1 Timecards are ZIP archives too

The brief states timecards are standard PDFs. They are not. Both document types are ZIP
archives with a `.pdf` extension:

```
December_2025_Timecard.pdf
  ├── 1.jpeg  2.jpeg  3.jpeg     page images
  ├── 1.txt   2.txt   3.txt      page text, one file per page
  └── manifest.json
```

Payslips are the same structure with a single page. **One ingest path handles both.** Detect by
magic bytes, not by extension — a real PDF may appear later from a different employer.

### 1.2 Rounding convention is a config field, not an assumption

Payroll converts `hh:mm` to decimal hours **rounded to two decimal places**, then multiplies.
This is provable from the April 2026 payslip: the March timecard shows Overtime `17:13`, which
is 17.21666… hours. The payslip line reads `17,22` — the rounded value, not the exact one.

This matters more than it looks. On the December 1194 line:

| Method | Decimal | Shortfall |
|---|---|---|
| Round to 2dp | 20.77 | R28.32 |
| Exact | 20.76667 | R28.01 |

A 31 cent difference on one line. Across a full audit it compounds, and a finding that does not
tie to the cent invites dismissal. Add `hours_rounding: 'round_2dp'` to `EmployerConfig` and
never assume it.

The ordinary rate is likewise **stored rounded**. R91.35, not the R91.3461538 that
`16625 × 12 ÷ 2184` actually produces. Carry `ordinary_rate_rounding: 'round_2cents'`.

---

## 2. Document structure

### Page 1 — header and daily rows

```
MANYATHI, WELLINGTON            Requested by MANYATHI, WELLINGTON
 01/12/2025 - 31/12/2025         03/08/2026 09:53
Timecard

Date Absence Schedule Pay code Amount In Transfer Out Daily Period
Mon 01/12  Day Off Taken 1:00
Tue 02/12                        04:24  11:21  6:57  6:57
Wed 03/12                        04:59  11:57  6:58  13:55
```

### Page 2 — daily rows continue, whitespace destroyed

```
Mon15/12
07:4712:404:5393:43
Tue16/12
DayofReconcil…
0:00
03:5609:535:5799:40
```

Column separation is gone. **Do not attempt to parse page 2 positionally.** Recover with a
time-token regex over the whole line, then assign by position in the sequence. `Thu 11/12` has
an out time of `03:02` against an in time of `15:51` — an overnight shift — so a token
sequence may not be monotonic.

### Last page — the totals block

This is the only part v0 needs.

```
Totals
Span by All   Group by All
South African Airways/… Jnr Op - Check in. Board… Day Off Taken          4:00
South African Airways/… Jnr Op - Check in. Board… Monthly Expected Hrs 186:00
South African Airways/… Jnr Op - Check in. Board… Normal Hours         138:26
South African Airways/… Jnr Op - Check in. Board… Overtime 1.5          15:24
South African Airways/… Jnr Op - Check in. Board… PPH Worked Hours      20:46
South African Airways/… Jnr Op - Check in. Board… Sunday Time           26:48
South African Airways/… Jnr Op - Check in. Board… Total Actual Hrs+Leave 186:00
```

Parse rule: last `.txt` in the archive, lines after `Totals`, take the trailing `h:mm` token
and the label immediately preceding it. The organisation and job columns are truncated with an
ellipsis character and must not be relied on.

**A category absent from the block means zero, not missing.** January 2026 has no
`Overtime 1.5` line and the February payslip correspondingly has no 1181 line. The parser must
emit `0:00` rather than `null`, or the reconciler will skip a code that should have been checked.

---

## 3. Golden fixtures — timecards

Extracted from the real archives. These are the expected parser outputs.

| Period | Expected | Normal | OT 1.5 | PPH | Sunday | Day off |
|---|---|---|---|---|---|---|
| 2025-12 | 186:00 | 138:26 | 15:24 | 20:46 | 26:48 | 4:00 |
| 2026-01 | 186:00 | 109:55 | — | 6:59 | 22:55 | 6:00 |
| 2026-02 | 168:00 | 123:22 | — | — | 21:52 | 4:00 |
| 2026-03 | 186:00 | 149:15 | 17:13 | 9:57 | 26:48 | 4:00 |
| 2026-04 | 180:00 | 139:16 | 17:27 | 20:19 | 20:25 | 5:00 |
| 2026-05 | 186:00 | 118:01 | — | 7:12 | 30:40 | 5:00 |
| 2026-06 | 180:00 | 124:35 | — | 6:10 | 20:49 | 6:00 |

Note 2025-12 and 2026-03 share an identical Sunday total of `26:48`. That coincidence is what
makes the corroboration test possible.

---

## 4. Golden fixtures — payslips

Remember the lag: a timecard period pays on the **following** month's payslip.

| Payslip | Pensionable basic | 1193 Sunday | 1194 PPH | 1181 OT (units) |
|---|---|---|---|---|
| 2026-01 | 16,625.00 | 2,418.95 | 1,869.02 | 2,088.26 (15.24) |
| 2026-02 | 16,625.00 | 2,093.74 | 637.62 | — |
| 2026-03 | 16,625.00 | 1,997.82 | — | — |
| 2026-04 | 16,625.00 | 2,448.18 | 908.93 | 2,359.58 (17.22) |
| 2026-05 | 16,625.00 | 1,865.37 | 1,856.23 | 2,391.09 (17.45) |
| 2026-06 | 16,625.00 | 2,801.70 | 657.72 | — |
| 2026-07 | 17,033.33 | 1,948.54 | 577.45 | — |

Amounts use European formatting — `2.418,95` is 2418.95. Deductions carry a **trailing** minus
sign: `7.443,00-`. Both must be handled in the normaliser, not the parser.

The July payslip introduces deduction code `4751 SAA Gymnasium 150,00-` with no prior history,
which is the fixture for the `undisclosed_deduction` floor rule.

---

## 5. Pay code multipliers — derived, not assumed

These were derived from the fixtures above and must be reproduced by the engine, not hardcoded.

```
ordinary_rate = round(pensionable_basic × 12 ÷ 2184, 2)
              = round(16625 × 12 ÷ 2184, 2) = 91.35
```

| Code | Label | Multiplier | Proof |
|---|---|---|---|
| 1193 | Sunday Time | 1.0 | 2418.95 ÷ 91.35 = 26.48 |
| 1194 | PPH Worked | 1.0 | 1869.02 ÷ 91.35 = 20.46 |
| 1181 | Overtime 1.5 | 1.5 | 2088.26 ÷ 15.24 = 137.02 = 91.35 × 1.5 |

Codes 1193 and 1194 are **premium supplements** paid on top of normal hours, not full
replacement rates. That is why the multiplier is 1.0. Do not "correct" this to 2.0.

---

## 6. The step 2 acceptance test

```
parse(December_2025_Timecard) → { sunday: '26:48', pph: '20:46', overtime: '15:24', ... }
normalise('26:48')            → 26.80
normalise('20:46')            → 20.77   // 2dp, not 20.76667
normalise('15:24')            → 15.40
```

Then, once step 4 exists, the full slice must produce:

```
1193  expected 26.80 × 91.35 = 2448.18   paid 2418.95   short 29.23
1194  expected 20.77 × 91.35 = 1897.34   paid 1869.02   short 28.32
1181  expected 15.40 × 137.03 = 2110.19  paid 2088.26   short 21.93
                                                  total 79.48
```

**Do not hardcode 79.48.** If the engine derives 79.47 the rounding convention is off by one
step, and finding that is the point of the test.

### Corroboration test

March 2026 timecard Sunday `26:48` paid `2448.18` on the April payslip. December 2025 timecard
Sunday `26:48` paid `2418.95` on the January payslip. Identical input, R29.23 apart. The
`period_drift` floor rule must detect this **without** reference to any rate or config, purely
by comparing an employer against itself.

That rule is the most valuable thing in v0, because it works at an employer you have never
mapped.

---

## 7. Fixture files to copy into the repo

```
fixtures/timecards/2025-12.pdf   2026-01 … 2026-06
fixtures/payslips/2026-01.pdf    2026-02 … 2026-07
fixtures/expected/timecards.json
fixtures/expected/payslips.json
```

Commit the archives themselves. They are the regression suite, and a parser without real
fixtures will silently rot the first time an employer changes their export format.

**POPIA:** these contain a real ID number, salary, bank account and medical scheme number. If
the repository is ever pushed to a hosted service, redact the identifying header block first and
keep the hours and amounts. The engine never reads the header for reconciliation.
