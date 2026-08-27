# Product log — working title: recovery engine

**Owner:** Wellington Junior Manyathi
**Started:** 7 August 2026
**Last updated:** 10 August 2026 (rev 2)
**Status:** pre-build. Concept settled, architecture decided, no code written.

> This is a living document. Update it at the end of every working session.
> Re-upload to the project files after each update so it persists across chats.

---

## 1. What this is

A document reconciliation engine that finds money people are already owed but have not claimed.

Not a budgeting app. Not financial planning. The product ingests documents a person already
receives — payslips, timecards, medical scheme statements, tax certificates, rental invoices,
bank statements — recomputes each line from first principles, flags variances, drafts the letter
that recovers the money, and tracks the deadline.

**Origin:** thirteen months of the owner's own payroll, medical, tax and rental records were
audited manually between July and August 2026. That process is the product specification.

### Positioning

The crowded space is budgeting and visibility. This is recovery and verification. The
differentiator is not finding the error — it is knowing the order in which to raise findings,
and generating the correspondence that gets them conceded.

---

## 2. Decisions made

| # | Decision | Rationale | Date |
|---|---|---|---|
| D1 | Responsive web app (PWA), not native | Value is server-side; distribution is by shared link; iteration speed; lower trust barrier for document upload | 7 Aug |
| D2 | WhatsApp as primary ingestion and reminder channel | Nobody uploads 13 payslips through a web form; people forward PDFs on WhatsApp daily. Deadline reminders land where people already look | 7 Aug |
| D3 | Modular, sequential unlock | Prove the system on payroll, then sell adjacent modules | 7 Aug |
| D4 | Free tier = existence of findings, not detail | A time-limited trial gives away a product that delivers its value in one session | 7 Aug |
| D5 | Payroll and timecards is module 1 | User cannot self-verify it; inputs are monthly; rules are arithmetic not judgement; employer patterns compound across users | 8 Aug |
| D6 | Deadline tracking ships inside module 1 | Cheapest thing to build, prevents total loss, drives subscription renewal | 8 Aug |
| D7 | Account unit is the person, with linked accounts | Payroll, tax and employment are per person. Medical scheme and home loan are not | 9 Aug |
| D8 | One finding schema across all modules | Anything module-specific reaching into core forces a rewrite at module 3 | 9 Aug |
| D9 | Rules are employer-scoped, not industry-scoped | Two mines on different bargaining council agreements differ more than a mine and an airline on the same one | 10 Aug |
| D10 | Universal BCEA floor runs before any employer config exists | Lets an unmapped employer still produce real findings | 10 Aug |
| D11 | Onboarding narrows the search space; documents resolve it | Users guess at rate bases and divisors. A guess becomes a confident wrong finding | 10 Aug |
| D12 | Individual and union distribution, one codebase | Not everyone belongs to a union. Product is identical; only payer and arrival route differ | 9 Aug |
| D13 | No percentage-of-recovery pricing | Unverifiable, turns into collections, edges toward regulated territory | 9 Aug |

---

## 3. Architecture

### The engine

```
ingest → normalise → reconcile → flag → draft → track
```

All six stages are core and written once. Per-module work is only three pieces:

1. **Parser** — turn a document type into structured fields
2. **Normaliser** — format quirks (hh:mm to decimal, reason codes, ZIP-wrapped PDFs)
3. **Rules pack** — the assertions that produce findings

### The finding schema

Every module emits the same object regardless of source document.

| Field | Example |
|---|---|
| `source_documents` | Dec 2025 timecard, Jan 2026 payslip |
| `rule_id` | `hhmm_decimal_conversion` |
| `expected` / `actual` | 26.80 / 26.48 |
| `rand_impact` | 29.23 |
| `recurrence` | once / monthly / annual |
| `strength` | proven arithmetic \| arguable \| informational |
| `counterparty` | SAA Payroll |
| `deadline` | 14 working days from submission |
| `letter_template` | T4 |
| `sequencing_rank` | 1 of 4 |

`strength` and `sequencing_rank` are not optional. They encode the core insight: submit the
smallest provable finding first to secure a written concession, then raise the larger
interpretive question. That judgement must live in the data model, not in UI copy.

### Payroll configuration

The unit of employer variation. Each config holds:

- Ordinary rate derivation — which salary component, which annual divisor
- Multipliers per pay code — overtime, Sunday, public holiday, night shift
- Pay code dictionary — what each numeric code means at this employer
- Payslip layout and extraction rules
- Governing instrument — BCEA, sectoral determination, bargaining council, company agreement

**Reference config (SAA, verified):** ordinary rate = pensionable basic × 12 ÷ 2,184.
R91.35 to June 2026, R93.59 from July 2026. Overtime 1.5×. Sunday 2.0×. Public holiday 2.0×.
Sunday multiplier exceeds the BCEA s16(2) minimum of 1.5× for ordinary Sunday workers — do not
raise it, review could only reduce it.

### Degraded mode

An employer without a verified config runs reduced checks and says so plainly. Available
without a config, because they compare the employer against itself:

- hh:mm to decimal conversion faults
- Month-on-month drift on identical inputs
- Unauthorised deductions (BCEA s34)
- Missing or non-compliant payslips (BCEA s33)
- Internal arithmetic consistency

Never ship a confident finding built on an unverified rate base.

### Config derivation

Two routes, both needed:

1. **Instrument matching** — sector plus bargaining council answer resolves to a published
   agreement. Public document, encoded once, inherited by every user under it.
2. **Crowd derivation** — with enough payslips from one employer, infer divisor and multipliers
   statistically. Flag weak inference. Requires signup consent for anonymised use.

Users may *confirm* a derived config. They may never *originate* one.

---

## 4. Modules

| Rank | Module | Unit | Status | Notes |
|---|---|---|---|---|
| 1 | Payroll + timecards | Person | v1 | Only module the user cannot self-verify |
| 2 | Deadline tracking | Person | v1, inside module 1 | Cheap; prevents total loss; drives renewal |
| 3 | Home loan readiness | Person or joint | v2 | Forward-facing. Recovery angle: duplicate debit orders, bounce fees, timing collisions |
| 4 | Medical aid | Scheme membership | v3 | Highest value, hardest to build. Needs a statement corpus first |
| 5 | Tax | Taxpayer | v3+ or never | Annual, seasonal, incumbent-owned, drifts toward practitioner registration. Keep as IRP5 anomaly reader with handoff |

Rental billing exists as a proven rules pack from the owner's own audit but is not scheduled.

---

## 5. Pricing

| Tier | Price | Contents |
|---|---|---|
| Scan | Free | Up to 3 payslips. Count, category and rand range of findings. No detail |
| Audit | R249 once (or R99 × 3 debit order) | Full 13-month reconciliation, itemised findings, all letters, sequencing order |
| Watch | R39/month, 3 months included with Audit | Monthly payslip vs timecard check, deadline tracking, new findings |
| Union | R12–18 per member/month | Everything above plus anonymised aggregation dashboard |

Anchor R249 against recovery, not against competing apps. Reference case: R15,009 historic plus
R13,850 per year ongoing. Under 2% of a single result.

Union tier sells bargaining evidence, not member welfare: *"3,000 members at this employer,
41% show the same conversion error, aggregate exposure R2.1m."* No union can generate that
itself. The aggregation layer is therefore the entire enterprise value proposition, not a
nice-to-have.

---

## 6. Accounts and linking

Account = person. Two structures alongside it:

- **Linked accounts.** Each person holds their own payroll and tax audit. A linked pair shares
  one medical membership audit and one home loan readiness view. Consent-based, revocable by
  either side.
- **Second seat** at roughly 60% of full price. Near-zero marginal cost; converts the household
  rather than losing the second earner.

**POPIA constraint:** linking shares the aggregate view, never the underlying documents. Two
people see a joint bond readiness score without either seeing the other's salary line.

---

## 7. Onboarding

**Collect** — facts the user cannot get wrong:
employer name · sector · bargaining council or union agreement · shift pattern · whether they
regularly work Sundays and public holidays (determines BCEA s16 treatment) · employment type ·
consent for anonymised use of documents to improve employer configs.

**Never collect** — rate base · annual divisor · multipliers. Users guess, and the guess becomes
the assumption the engine tests against.

**Safe to ask:** *"We think your ordinary rate is R91.35, derived as basic × 12 ÷ 2,184. Does
that match anything you've been told?"* Confirmation is safe. Origination is not.

---

## 8. Distribution

**Individual first.** Self-serve, launchable without anyone's signature, and it becomes the
evidence needed in a union meeting.

**Union second.** Requires from day one: employer-scoped rule sets, organisation accounts with
seat provisioning, anonymised cohort aggregation. Retrofitting these is painful.

**Recruiter network.** Contacts across sectors provide structural intel: which employers sit
under which agreement, in-house vs outsourced payroll, typical shift structures, standard
contracts, HR contacts, and which employers have payroll reputations.

Boundary: **structural facts about employers, yes; documents belonging to individuals, no.**
A recruiter's candidate consented to a job application, not to a third-party product. The
correct ask is that the recruiter shares the link, not the payslip — users upload under their
own consent, and five users arrive via someone they trust.

Decide before it matters whether recruiters receive anything commercially. Keep informal in
phase one.

---

## 8a. Sector priority

Recruiter network covers: IT · manufacturing · mining · engineering · aviation ·
transport and logistics.

| Priority | Sector | Instrument | Why |
|---|---|---|---|
| 1 | Transport and logistics | National bargaining council, published main agreement | Encode once, inherit across every employer under it. Enormous, shift-based, night-heavy. Long-distance driver pay is complex in exactly the ways that produce conversion and rate-base faults |
| 2 | Manufacturing and engineering | Metal and engineering bargaining council, published main agreement | Same advantage. Standardised wage schedules by grade. Very large covered population |
| 3 | Aviation | Company-level | Owner speaks the language and holds the reference config. But each employer is separate work. Target ground handlers and other carriers — **not SAA**, see compliance |
| 4 | Mining | Company-level agreements with unions | High value, no single published instrument. Each large employer needs its own derivation. Revisit once crowd derivation works |
| 5 | IT | None material | Mostly salaried, few shift premiums, low error density. Wrong sector for module 1. **Right sector for modules 3 and 4** — salaries and scheme options make home loan readiness and gap analysis pay off. Keep contact warm |

**Rules packs must be versioned by effective date.** Bargaining council agreements are
republished and wage schedules change annually. Auditing 2026 payslips against 2024 rules
produces confident wrong findings — the one failure mode with no recovery.

---

## 8b. Assumptions register

Decisions rest on beliefs that have not been tested. When something fails, find the wrong
belief here rather than rebuilding blindly.

| # | Assumption | Underpins | Test | Status |
|---|---|---|---|---|
| A1 | People will pay for a finding they have already been shown exists | Scan free tier, R249 Audit | First 20 Scan users — measure conversion | Untested |
| A2 | A union will buy aggregated bargaining evidence | Entire enterprise tier | One conversation with one official | Untested |
| A3 | R249 sits below the deliberation threshold for a shift worker | Pricing | Offer at three price points | Untested |
| A4 | People will forward payslips over WhatsApp more readily than upload them | Ingestion architecture | Run both, measure completion | Untested |
| A5 | Employer payroll errors are systematic, not random, and repeat across employees | Whole business model | Second employee at same employer, same config | Partly evidenced — one employer, one employee |
| A6 | Bargaining council agreements contain enough detail to derive a full config | Sector priority 1 and 2 | Read one agreement end to end | Untested |
| A7 | Recruiters will share the link rather than expect to be paid | Distribution | Ask one directly | Untested |
| A8 | Employers respond to a well-drafted query rather than ignoring it | Letter generation as core value | Owner's own 17 Aug submission | In progress |

A5 and A8 are the load-bearing ones. If employer errors turn out to be random rather than
systematic, employer-scoped configs lose most of their leverage. If employers simply ignore
correspondence, the product finds money nobody can collect.

---

## 9. Compliance

| Area | Position |
|---|---|
| FAIS | Advising on financial products requires an FSP licence. Reporting factual discrepancies in a document does not. Stay on "here is what your statement says versus what it should say." Confirm with an attorney |
| POPIA | Holding payslips, medical claims, ID numbers. Encryption at rest, explicit consent, purpose limitation, data minimisation, deletion path — all day one. Sponsored (union) model changes who the responsible party is; settle in the agreement template before the first deal |
| Tax practitioner | Reason tax stays a reader-and-handoff rather than a module |
| Employment | Owner is an SAA employee building a product that audits SAA payroll while holding a live payroll query. Review employment contract on IP and outside business interests. Keep streams separate: own documents only, no employer systems, no colleagues' data, no work time |

---

## 10. Open decisions

- [x] Second payroll configuration — transport and logistics (published bargaining council agreement). Manufacturing and engineering third
- [ ] Obtain the current published main agreement for road freight and logistics, and verify effective date
- [ ] Data retention when a linked account is severed (answer before two users are mid-divorce)
- [ ] Build platform — Base44 vs Lovable vs conventional stack
- [ ] Product name
- [ ] Whether Scan requires an account or works anonymously
- [ ] Whether recruiters receive any commercial arrangement

---

## 11. Session log

**7 Aug 2026** — Concept established. Positioning as recovery rather than budgeting. Platform
decided (web PWA, WhatsApp ingestion). Module structure proposed by owner. Free-trial mechanic
replaced with free-tier mechanic.

**8 Aug 2026** — Modules ranked. Payroll confirmed as first banker. Deadline tracking pulled
forward into v1. Tax demoted.

**9 Aug 2026** — Pricing tiers set. Account unit resolved to person with linked accounts and
second-seat discount. Individual plus union distribution confirmed. Employment-contract risk
raised.

**10 Aug 2026 (later)** — Recruiter sector coverage confirmed: IT, manufacturing, mining,
engineering, aviation, transport and logistics. Sectors ranked for module 1 suitability.
Transport and logistics selected as second configuration on the strength of a published national
bargaining council agreement. IT deprioritised for module 1, retained for modules 3 and 4.
Rules-pack versioning by effective date established as a hard requirement. Assumptions register
added.

**10 Aug 2026** — Finding schema defined. Engine and rules-pack separation agreed. Multi-industry
architecture resolved to employer-scoped payroll configurations with a universal BCEA floor and
degraded mode. Onboarding boundary set. Recruiter network identified as intel source, with the
documents-vs-facts boundary drawn. First UI mockup produced (findings screen).

---

## 12. Next actions

1. Write the finding schema properly as a one-page spec before any code
2. Obtain and read the current road freight and logistics main agreement end to end (tests A6)
3. Review employment contract for IP and outside-interest clauses
4. Design the upload screen and the WhatsApp ingestion flow
5. Choose build platform

<!--
**Welzpeak/Welzpeak** is a ✨ _special_ ✨ repository because its `README.md` (this file) appears on your GitHub profile.

Here are some ideas to get you started:

- 🔭 I’m currently working on ...
- 🌱 I’m currently learning ...
- 👯 I’m looking to collaborate on ...
- 🤔 I’m looking for help with ...
- 💬 Ask me about ...
- 📫 How to reach me: ...
- 😄 Pronouns: ...
- ⚡ Fun fact: ...
-->
