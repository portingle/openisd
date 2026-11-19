# Plan: testing the sums engine so input cases, not just lines, are covered

Status: DRAFT for John's decision (19 Nov 2026). Task T933 (this plan, `tasks/T933.yml`). No test or code is changed by it.

## John's verdict (19 Nov 2026, on the board)

After an independent code review of the engine found ten problems (`_agent_files/reference/ULTRA_REVIEW_20261119_engine_findings.md`
in the workspace repo) that our tests and our WinISD comparisons had passed:

- "what's wrong with our process we didn't spot this? / we compared to WinISD too"
- "your notes make it clear we have inadequate testing and problems with coverage analysis"
- 18:19 UTC, on another card: "we need improve guardrails not just isolated fixes"
- 18:20 UTC, on the passive radiator NaN bug (review finding 8): "I was under the impression that our API tests and standard for
  the engine and solver made this impossible ... what is the systemic flaw and how to prevent regression"

- 18:25 UTC: "reflect on why the ultra review found stuff despite all our tests and good intentions, we had serious bugs,
  what's the solution"

## What John must decide

Pick which of options A to H below to fund (each has examples and a cost). Recommendation: B, A, F and G now (about 4 days of
agent work, about 2 extra CI minutes per pull request); D for the six gap cells named below; C as a nightly measurement, not a
pull-request gate; E once per release; H kind by kind, physics kinds first. The gate to build first is B's rules matrix
(section 7 says why).

## Why the review found what our tests did not

| # | Cause | What it looked like here | Remedy |
|---|---|---|---|
| 1 | The same author writes the code and its test, so the test confirms the author's belief | `xmax-limited-spl.test.ts` checks the Xmax-limited curve against OpenISD's own rule, one driver; `sealed-resonance.test.ts` asserts the lossless shortcut the code takes | An independent adversarial review of every engine pull request by a model or session that did not write it (it writes the cases it thinks will break, not a summary); a full outside review once per release (option E) |
| 2 | Tests are examples; bugs live where features meet | Nd = 2 tested, Xmax-limited tested, never both; BL typed in every chart capture | Rules that must always hold, run over combinations, edge values (0, blank, the lossless limit) and smoothness across branch switches (options A, B, G) |
| 3 | Gates check process, not the maths; the author picks the `done_test` | Every gate was green with the ten faults present; the engine was at 99.75 % lines covered | A mutation-score ratchet on the engine: a pull request may not lower the share of code changes the tests notice (option C) |
| 4 | Reviews read the diff, never the whole engine | Each fault sits in code that was right for the case its own change was about (the Nd wrapper, the Iso-Barik pair) | Combination tests run over the whole engine on every pull request, so a change is checked against every feature it meets (option B) |
| 5 | Claims outgrew their proof | "Matched WinISD" meant one fixture: one driver, all values typed, one setting changed | Every claim states its scope: which boxes, Nd, switches and blank values it was checked on (the gap table in section 3 is that scope today) |

## The answer in one paragraph

Our tests run every line of the engine but try few combinations of inputs. Line coverage of the engine is 99.75 % and branch
coverage 98.9 %, and every one of the ten faulty lines was executed by the test suite hundreds or thousands of times (table
below). The faults sit in input combinations nobody tried: a value left blank, two drivers with a switch ticked, a loss at its
"lossless" limit while another loss is not. Our WinISD comparisons share the blind spot: all 651 WinISD chart captures type every
driver value, and each captures one setting changed at a time (Nd = 2, or Iso-Barik, or Xmax-limited, never two together).
Coverage said "tested"; it measures which lines ran, not which input cases were checked.

## 1. What coverage is measured today (measured 19 Nov 2026, on origin/main at the T933 branch point)

| What | Where | Gate today |
|---|---|---|
| Design package (engine + domain), 100 % per file, all four measures | `scripts/coverage-design.sh`, `packages/design/vitest.coverage.config.ts` | **Off.** Removed from `suite.yml` on 31 Oct 2026 (QO316, John: "for now you can remove the 100% coverage rule - we need a separate ticket for that"). The restore task, T631, is still open. `scripts/land/test/coverage-design-gate.test.sh` asserts the job is absent. |
| UI package, ratchet against `packages/ui/coverage-baseline.json` | `scripts/coverage-ui.sh`, `scripts/coverage-ratchet.mjs` | **Off**, same ruling. |
| Pull-request gate (`pr.yml`) | lint, typecheck, unit tests the change reaches, architecture tests, done_test | No coverage measure at all. |

Design coverage run (`bash scripts/coverage-design.sh`, 422 test files, 12,143 tests passed and 30 expected-fail, 155 s):

| Scope | Lines | Branches | Statements | Functions |
|---|---|---|---|---|
| packages/design (engine + domain) | 99.51 % | 97.6 % | 99.05 % | 99.3 % |
| packages/design/engine only (72 files) | 99.75 % (2011/2016) | 98.9 % (1620/1638) | 99.71 % | 99.64 % |

The script is red today: 71 threshold errors, 16 of them on engine files (consistency.ts, DriverEngine.ts, dvolRelation.ts,
airSolver.ts, FilterEngine.ts, PrEngine.ts). With the gate off nobody sees them. 66 of 72 engine files are at 100 % lines and
branches.

### Were the faulty lines executed? Yes, every one.

Execution counts from the same run (v8 coverage, JSON report). Line numbers are today's.

| # | Finding (one line) | File, file coverage (lines / branches) | The faulty code ran |
|---|---|---|---|
| 1 | Iso-Barik SPL +3.01 dB when BL is blank | SimulationEngine.ts 100 / 100 | the blank-BL fallback (line 260) taken 1,508 times |
| 2 | 6th-order bandpass lossless branch adds the port flows instead of subtracting | Bandpass6Box.ts 100 / 100 | lines 39-41 ran 144 times |
| 3 | Xmax-limited SPL and pressure H not scaled for 2+ drivers (-6.02 dB at Nd 2) | SimulationEngine.ts 100 / 100 | the Nd > 1 wrapper ran 140 times |
| 4 | bandpass/ABC pick lossless vs lossy from the shared Ql/Qa, which they do not use | circuit.ts 100 / 100 | the lossless arm taken 107,757 times |
| 5 | Sealed Box-tab Fsc/Qtc readout ignores Qa when Ql is at the lossless limit | sealedResonance.ts 100 / 100 | the shortcut taken 2,058 times |
| 6 | Sealed handle solve: Vb from Qtc lossless, Qtc from Vb lossy | SealedEngine.ts 100 / 100 | line 166 ran 3 times |
| 7 | Passive radiator array with prNum blank gets N radiators, not 1 | SimulationEngine.ts 100 / 100 | the "prNum undefined" arm taken 196 times |
| 8 | PR solve accepts Sd or Cms = 0, writes NaN into tuning/added mass | PrEngine.ts 98.8 / 100 | line 247 ran 6,428 times |
| 9 | volumeForQtc has no guard for Qts or Vas = 0, writes Vb = 0 | SealedEngine.ts 100 / 100 | lines 120-121 ran 201 times |
| 10 | Air solver stops a pass after a failed step, so a typed c never solves T | airSolver.ts 99.42 / 93.29 | the failed-step arm ran 310 times |

Lesson: line and branch coverage were at or near 100 % on every faulty file. Coverage cannot find a fault that needs a
particular combination of inputs, and it cannot tell whether an assertion checked the result. Restoring the coverage gate
(T631) is still worth doing, but it would have caught none of the ten.

A related fact: the suite passed with all ten faults present. Read as mutation testing, the engine suite let 10 out of 10
known real faults survive.

## 2. Which test would have caught each finding, and why none existed

| # | Test that would have caught it | Why there was none |
|---|---|---|
| 1 | Iso-Barik chart with BL blank, against the same project with the derived BL typed | All 651 WinISD chart captures, and every chart test, type BL. |
| 2 | 6th-order bandpass with every Q at 1e6 against Q = 1e5 (continuity), or a WinISD capture of it | No bandpass-6 capture has lossless losses. The WinISD tests only reach the lossy branch. |
| 3 | Xmax-limited ticked with Nd = 2, against Nd = 1 in Vb/2 + 6.02 dB | The 7 Xmax-limited captures are all Nd = 1, the 7 Nd = 2 captures all have it unticked. `xmax-limited-spl.test.ts` checks OpenISD against its own rule with one driver. |
| 4 | Bandpass or ABC with the shared Ql/Qa at 1e6 but a chamber loss finite | No capture has that mix (measured: 0 bandpass/ABC captures with shared Ql/Qa at the limit). |
| 5 | Sealed Box-tab readout against the chart at Ql = 1e6, Qa = 7 | `sealed-resonance.test.ts` line 64 asserts the lossless answer at Ql = 1e6 with Qa = 10000 to 9 digits; that holds only because Qa is ignored there, so the test appears to encode the fault. Whether it is a stale test is John's call. |
| 6 | Round trip: type Qtc, read Vb; type that Vb, read Qtc back, with default losses | `sealed-from-qtc.test.ts` tests only the lossless volume; no round-trip test exists. |
| 7 | Nd = 2 passive radiator with "Num. of PRs" blank, against it typed as 1 | The PR Nd = 2 capture types the radiator count. |
| 8 | Load a radiator with Sd = 0 or Cms = 0: every readout finite | The 18 Nov input-limits sweep set values through the typing path and checked charts only, not readouts. |
| 9 | Load a driver with Vas = 0 or Qts = 0 (the .wdr "not present" value): Vb not calculated, missing-value issue shown | Same as 8: loaded zeros were never tried. |
| 10 | Typed c with density failing first in the same pass | `air-solver.test.ts` covers "T from a typed c" only in an order where the density step does not fail first. |

## 3. WinISD comparison tests: what they cover

Source: 651 chart captures in the research repo's `runs/` (counted from each run's `.wpr`); about 32 comparison test files in
`packages/design/test/engine` and `packages/design/test/domain`; 27 harness `.wpr`, 16 WinISD-saved `.wpr` and 168 edit-capture
JSON in the fixtures.

- Two speakers only: Tang Band W5-1138SMF (421 captures) and Dayton E150HE-44 (230).
- Every driver value typed in every chart capture: 0 of 651 leave one blank. Only the 16 field-calculation goldens leave
  values out, and they compare fields, not charts.
- One setting changed at a time. Nd = 2: 7 captures, all with Iso-Barik off and Xmax-limited off. Iso-Barik: 6, all Nd = 1.
  Xmax-limited: 7, all Nd = 1, and **no test reads them** (they exist in the research repo, unwired).

Number of comparison test files per cell (0 = no test):

| Box | Nd = 1 | Nd >= 2 | Iso-Barik | Xmax-limited | Nd >= 2 and Iso-Barik | Nd >= 2 and Xmax-limited | Array wiring series/parallel | A driver value blank (charts) | Losses at the lossless limit |
|---|---|---|---|---|---|---|---|---|---|
| sealed | 10 | 4 | 2 | **0** | **0** | **0** | **0** | **0** | 1 |
| vented | 8 | 2 | 1 (wizard volume only) | **0** | **0** | **0** | **0** | **0** | 1 (TL port) |
| passive radiator | 9 | 1 | **0** | **0** | **0** | **0** | **0** | **0** | **0** |
| bandpass 4th | 6 | 1 | **0** | **0** | **0** | **0** | **0** | **0** | **0** |
| bandpass 6th | 7 | 1 | **0** | **0** | **0** | **0** | **0** | **0** | **0** |
| ABC | 8 | 1 | **0** | **0** | **0** | **0** | **0** | **0** | **0** |

Also never captured: temperature, pressure or humidity on a chart; Nd >= 2 with filters, dTVC or non-default sealed losses.

## 4. User journeys: what has none

274 browser spec files. About 10 are journeys a person would make (a header "Journey: a person ..."; starts empty, goes
through the wizard); 4 more are dependent-value sweeps; about 78 are layout or picture checks; about 180 drive one tab or dialog
of the sample project. Five hosting end-to-end scripts (`scripts/hosting/test/*.e2e.mjs`) cover install, update and offline.

No journey covers: Iso-Barik; series/parallel array wiring; "SPL graph is Xmax limited"; box losses; Rg; any WinISD bug switch;
a driver typed by hand with a value left blank; loading a WinISD `.wpr`; the max power chart.

**No browser spec reads a value off a chart (SPL, impedance, excursion, port velocity, group delay, max power) and checks it
against an expected number.** Journeys check readouts (Qtc, Fsc, alignment volume) only.

## 5. The systemic flaw behind the NaN bugs (findings 8 and 9)

Three things, each measured:

1. **No single place refuses a non-finite number.** Each solver guards its inputs by hand, and not the same way: VentEngine's
   `geometryComplete` checks `> 0` (`engine/vent/VentEngine.ts` line 104), PrEngine's checks `!= null`
   (`engine/pr/PrEngine.ts` line 247). Every calculated value goes through one function, `calculated(v)` in
   `packages/design/domain/cell.ts` (lines 392, 433, 499, reached by `setCalculated`), and it stores NaN or Infinity without a
   word.
2. **The 18 Nov input-limits sweep tried the typing path, not the loading path, and looked at charts only.**
   `bugs/BUG_20261118_input-limits-sweep.md`: values were set "through the same domain cell its screen binds", and it recorded NaN
   in "the project's sweep, max curves, peaks and impedance peak". A loaded radiator with Sd = 0 never ran, and the NaN it
   causes is in readouts (tuning, added mass), which were not checked. Its own note: 113 of 135 failing values "reach the engine
   only by another way (a loaded file, a calculated value); the sweep did not check which of those ways exist."
3. **The standard John remembers exists but was left half done.** `ARCHITECTURE.md` section 4: "The engine is pure: it takes
   numbers and returns values and issues; failure is a value (`{values, issues}`), never an exception." And
   `docs/_archive/CODE_REVIEW/ENGINE_HARDENING.md` (July 2026), "Engine hardening: communicate failure, never emit silent `NaN`":
   "Status: partially implemented ... What remains is the _postcondition_: catching non-finite results the precondition can't
   foresee." The postcondition was never built and the document was archived. No test enforces either statement.

## 6. Options

Costs are agent hours (to build and get green, not counting fixing the faults the option finds) and extra CI minutes per run.
Sweep cost measured: the input-limits sweep runs 3,229 project cases in 35 s, about 11 ms a case.

### A. Blank-value re-run of every WinISD match

Every WinISD comparison is run a second time per value OpenISD can derive (BL, Mms, Cms, Vas, one of Qes/Qms/Qts, a radiator
count, a PR value), with that value left blank. Each blank run must equal the same project with the derived value typed in
(1e-9), and must equal WinISD where WinISD was also captured blank (option D). Comparing a blank run straight against WinISD is
wrong when the datasheet values disagree slightly (BL from Fs/Qes/Re/Vas is not exactly 7.17).

- Example 1: `sealed-w5-isobarik` with BL blank against BL typed as the value OpenISD derives: catches finding 1 (3.01 dB).
- Example 2: `pr-w5-nd2` with "Num. of PRs" blank against it typed as 1: catches finding 7.
- Example 3: `vented-w5-2` with Vas blank (Mms and Cms typed): checks the Fs/Mms/Cms/Vas group solves the same chart.
- Cost: 6-10 h (one shared helper over the existing fixtures); about 50 fixtures x 6 blanks x 11 ms: under 10 s CI.
- Catches: 1, 7.

### B. Combination matrix checked against physics rules that always hold

A generated matrix: box type (6) x Nd (1, 2, 3) x Iso-Barik (off, on) x array wiring (parallel, series) x Xmax-limited (off,
on) x each Advanced switch (pairwise) x each derivable value blank or typed. Full product of the first five is 144 projects;
pairwise over the switches and blanks keeps it to about 1,000 projects, about 5 sweeps each: about 1 minute of CI.
Each project is checked against rules that follow from the physics and from OpenISD's own model, not from WinISD:

| Rule | Formula | Why it is physically right | Catches |
|---|---|---|---|
| R1 Array scaling, parallel | N drivers in N x Vb (ports and radiators x N), Rg = 0, wired in parallel, same voltage: SPL_N(f) = SPL_1(f) + 20 log10 N; excursion, phase, group delay, port velocity equal; \|Z\|_N = \|Z\|_1 / N; max power x N | Each driver sees the same voltage and the same box share, so each moves as the single one does; N in-phase sources add N x volume velocity | 3 |
| R2 Array scaling, series | Same, wired in series: SPL_N = SPL_1; excursion / N; \|Z\| x N | Each driver gets V/N, so N x (1/N) volume velocity | wiring faults |
| R3 Xmax limit never raises SPL | SPLxlim(f) <= SPL(f) at every f; equal where excursion < Xmax; R1 holds for SPLxlim too | A limit only lowers the drive | 3 |
| R4 Iso-Barik shape | Pair in Vb against one driver in 2 x Vb: the SPL curves differ by a constant (Le = 0), and that constant is the same with BL typed or blank | The pair has Mms x 2, Cms / 2, Rms x 2, BL x sqrt2 (`isobarikPair`): Fs, Qms, Qes and Vas/Vb unchanged, so the response shape is identical; the constant level is WinISD's convention, pinned by a capture | 1 |
| R5 Blank equals derived | A value left blank gives the same charts and readouts as that value typed as OpenISD derives it | The model has one answer for one set of facts | 1, 7 |
| R6 No jump at the lossless limit | Moving any one Q from 0.999e6 to 1e6, others held finite: every chart changes by < 0.01 dB | A loss resistance of Q = 1e6 is effectively open; the lumped model is continuous, a branch switch must be too | 2, 4, 5 |
| R7 Readout matches chart | Sealed Box-tab Fsc and Qtc equal the ones fitted from the same project's plotted response (Le = 0, Rg = 0) | Both describe the same system | 5 |
| R8 Inverse round trips | Qtc -> Vb -> Qtc; Fb -> vent length -> Fb; PR tuning -> added mass -> tuning; c -> T -> c: each returns the start (1e-9) | Each pair is one equation solved two ways | 6, 10 |
| R9 Always finite | Every chart point and every calculated field is a finite number, or empty with an issue that says why | The engine standard in section 5 | 8, 9 |

- Example 1: sealed, Nd 2, Xmax-limited: R1 on SPLxlim fails by 6.02 dB (finding 3).
- Example 2: bandpass 6th, every Q moved to 1e6: R6 fails (finding 2).
- Example 3: sealed, type Qtc 0.707 with Ql 10: R8 returns a different Qtc (finding 6).
- Cost: 16-24 h to build the generator and rules; about 1-2 CI minutes. Each rule needs a short physics note in the test,
  reviewed by the lead, so no rule is weakened later.
- Catches: 1, 2, 3, 4, 5, 6, 7, 10 directly; 8, 9 through R9 (with option G's zero values).

### C. Coverage gate restored as a ratchet, plus mutation testing

- Restore T631, but as a ratchet on the engine (a pull request may not lower line or branch coverage of any engine file;
  today 99.75 % lines / 98.9 % branches) rather than 100 % per file, which is red today with 71 errors and was turned off for
  that reason. Cost: 2-4 h; CI about 3 minutes (the run takes 155 s).
- Mutation testing (Stryker for TypeScript with the vitest runner) on `packages/design/engine`: it changes the code a little at a
  time (a `+` to `-`, a `>` to `>=`, removes a line) and counts how many changes the tests notice. Not measured: setting it up
  needs a new development dependency and a config, which this plan does not change. Estimate: 2,395 engine statements give about
  4,000-5,000 changes; with per-test coverage each runs only the tests that reach it, about 1-3 s each on 8 workers: 1-3 hours
  for a full run, so nightly, not per pull request; Stryker's incremental mode on the changed files of a pull request: 5-15 min.
  Setup 4-6 h.
- Example 1: Stryker turning `cAdd(UP, UPr)` into `cSub(UP, UPr)` in Bandpass6Box.ts: if no test fails, the lossless branch is
  untested in substance (here the mutant is the fix, which is the point).
- Example 2: removing `+ gain` from the array wrapper for `splXlim`: the same blind spot as finding 3.
- Example 3: `> 0` to `>= 0` in a geometry guard: survives today (finding 8).
- What it would have shown: the 10 findings behave as 10 surviving mutants, so the score would have been visibly low on
  exactly these files. It measures test strength; it does not write the missing tests.

### D. More WinISD captures for the gap cells

- Gap cells worth a capture (section 3): Nd 2 with Xmax-limited (all 6 boxes); Nd 2 with Iso-Barik; Iso-Barik with BL blank;
  bandpass 6 with every Q at 1e6; bandpass 4 / ABC with the shared Ql/Qa at 1e6 and a chamber loss finite; a PR Nd 2 with the
  radiator count blank. About 15 captures.
- First, wire the 7 existing Xmax-limited captures (`runs/*-w5-xmaxlim`, Nd 1) into a test: they exist and nothing reads them.
- Example 1: `sealed-w5-nd2-xmaxlim`: WinISD's own answer for finding 3.
- Example 2: `sealed-w5-isobarik-blankbl`: tells whether WinISD itself treats a blank BL the same as typed.
- Example 3: `bp6-w5-lossless`: WinISD's answer for finding 2.
- Cost (estimated, no timing is logged in the runs): the harness drives WinISD under wine from a `.wpr`, a few minutes each;
  Xmax-limited is a screen tick-box, not a `.wpr` key, so it needs the screen-driving harness. About 1 h agent time per new kind
  of setting plus 0.5 h per capture to wire into a test: 10-15 h for the list. CI cost negligible (fixtures, 1e-12 checks).
- Limit: captures only check the cells someone thought to capture; they are the proof for B's rules where WinISD has a
  convention (R4's constant), not a substitute for B.

### E. Independent review of the engine once per release

- An outside code review of `packages/design/engine` (like 19 Nov's), the findings triaged by the lead into bugs with a test
  each; each finding also asks "which rule in B, or which check in F/G, would have caught this?" and adds it.
- Example 1: today's review: 10 findings, 7 real bugs.
- Example 2: a review limited to the files a release changed.
- Cost: about 1 h of review run plus 2-3 h of triage per release. No CI cost.

### F. Every calculated value refuses NaN and Infinity (one choke point)

`calculated(v)` in `packages/design/domain/cell.ts` (the one write path behind `setCalculated`) refuses a non-finite number:
under test it throws, naming the field and the solver, so every unit, journey and sweep test becomes a finiteness check for
free; in the app it writes the field as "not available" (empty, the chart says why) instead of storing NaN.

- Fit with John's rule (18 Nov, number inputs: "a loaded impossible value is repaired automatically ... only a toast"): that
  rule is about the **input** that was loaded. The repair belongs at load (option G finds which inputs need one): a loaded
  radiator Sd of 0 is an empty box, and "a field the app can calculate is recalculated, others get their minimum or default".
  F is the backstop for a non-finite **result** from inputs that passed the repair. **Question for John**: what the screen shows
  when that backstop fires: (a) empty box and a toast "could not calculate X from these values"; (b) empty box with the field's
  issue text and no toast; (c) the previous good value kept and a toast. Agent's pick: (a), the same toast channel as repairs.
- Example 1: radiator Sd = 0 on a loaded project: the tuning readout today stores NaN; with F the test run throws at
  `tuning_goal_hz`.
- Example 2: driver Vas = 0: Vb = 0 is finite, so F does not catch finding 9; R9 plus G's "missing value issue shown" does.
- Example 3: the 135 breaking cases of the input-limits sweep (`it.fails`) keep failing and now name the field.
- Cost: 2-4 h for the check; unknown hours for the tests it turns red (each is a real NaN that is stored today, reported as a
  bug, never skipped). CI: none.

### G. Load-fuzz test: every record shape loaded with each number at 0, negative, blank, huge

Every shape a person can open (a driver record, a radiator record, a project of each box type, a WinISD `.wpr`) is loaded
through the same path File > Open uses, with each numeric field in turn at 0, -1, blank and 1e9. After loading: every readout and
every chart is finite or empty with a reason, and every repair is listed in the opening toast (John's 18 Nov rule).

- Example 1: a radiator record with Sd 0: today NaN in tuning and added mass (finding 8).
- Example 2: a `.wdr` driver with Vas 0 (the "not present" value): today Vb = 0 calculated, the missing-value issue skipped
  (finding 9).
- Example 3: a `.wpr` with Nd 0: must load as Nd 1 with a toast.
- Cost: 6-10 h; about 150 fields x 4 values x 6 box types = 3,600 cases x 11 ms: about 40 s CI.

### H. Burn down the baselined duplicate-logic copies

`scripts/dupscan.mjs` refuses new copies of engine formulas and code, but the 18 Nov baseline (`scripts/dupscan-allow.json`,
QO946.c256) allows 262 entries: 13 resolved, **249 still open**. Two copies of one formula can disagree in one input case, which
is how finding 6 arose (Vb from Qtc and Qtc from Vb are two formulas, one lossless, one lossy). Burn-down kind by kind, each copy
replaced by a call to the one engine function, the allow-list entry marked resolved (QO949):

| Kind (open entries) | Count | Cost each | Cost for the kind |
|---|---|---|---|
| Physics formulas: driver-count scaling 14, end correction 19, drive voltage/power 13, air compliance 13, resonance mass/compliance 9, Q in parallel 5, coil-wiring scaling 3, sealed box ratio 3, BL from Qes 2, displacement 2 | 83 | 0.5-1 h (each needs the B rule that pins it) | 40-80 h |
| Air defaults 8, circle area 4, decibel 19 | 31 | 0.25-0.5 h | 8-15 h |
| Display rounding 37, unit factor 24 (formatting, not physics) | 61 | 0.25 h | 15 h |
| Code copies: ui 24, design/domain 17, persistence 13, design/engine 11, cloud 8, chart 1 | 74 | 0.5 h | 35-40 h |

- Example 1: the 14 driver-count scaling copies: the same `20 log10 N` / `x N` rule written in 14 places; finding 3 is one place
  that forgot a quantity.
- Example 2: the 3 sealed box ratio copies: `sqrt(1 + Vas/Vb)` beside the lossy resonance, the same split as findings 5 and 6.
- Example 3: the 37 display-rounding copies: lowest risk, do last.
- CI cost: none (dupscan already runs). Do physics kinds first, each after its B rule exists, so the replacement is checked.

## 7. Recommendation

| Option | Would have caught (of the 10) | Build | CI per run |
|---|---|---|---|
| A blank re-run | 1, 7 | 6-10 h | < 10 s |
| B rules matrix | 1-7, 10; 8, 9 with G | 16-24 h | 1-2 min |
| C coverage ratchet | none | 2-4 h | 3 min |
| C mutation testing | shows all 10 as weak spots; writes no test | 4-6 h | nightly 1-3 h |
| D captures | 1-4, 7 (only the cells captured) | 10-15 h | ~0 |
| E review per release | found these 10 | 3-4 h a release | 0 |
| F refuse non-finite | 8 | 2-4 h | 0 |
| G load fuzz | 8, 9 | 6-10 h | ~40 s |
| H duplicate burn-down | 6 (two formulas for one fact) | about 100-150 h, kind by kind | 0 |

**Build first: B's rules matrix, as a required test in `pr-gate`.** It is the one gate that would have caught most of the ten
(1-7 and 10), it runs over the whole engine on every pull request (causes 2 and 4 above), and its rules come from physics, not
from the author's belief about the code (cause 1). Start with R1, R5 and R6 over box x Nd x Iso-Barik x Xmax-limited (about
8 h), then add the other rules. F is cheap (2-4 h) and should follow the same day, since it closes the NaN class John asked about.

Do B, A, F and G now (about 30-48 h), D for the six gap cells (wiring the existing Xmax-limited captures first), C's ratchet with
T631 and mutation testing nightly as a measure, and E once per release. The order matters: B and G are the guardrails John
asked for ("improve guardrails not just isolated fixes"): they check every combination and every loaded value against rules,
so the next fault of this kind is found by a red test, not by a reviewer. Every rule or check added is a gate that refuses,
never a warning. Faults they find are fixed in their own tasks; the review's ten findings are fixed separately.

## 8. How each remedy stays (John, 18:27 UTC: "for everything you write above specify how we will prevent recurring")

Each remedy is held by a tool that refuses, never by an agent remembering. Checked against the repo on 19 Nov 2026.

| # | Remedy | How it stays (the tool that refuses) | Exists today? | Cost |
|---|---|---|---|---|
| 1 | Independent review of engine changes | A required `pr-gate` job refuses a pull request touching `packages/design/engine/**` without a review record in the task file: reviewer (a session that did not write the change), and each finding either fixed with a test or disproved with a test, named | No. `scripts/land/check-task-contract.sh` already reads the task file in `pr-gate`; the job is a new rule in it | 4-6 h |
| 2 | Rules over combinations (B) | An architecture test lists every box type, every `CompatSwitch` and Advanced switch, Iso-Barik, wiring and every derivable field from their own source definitions, and fails when one is missing from the combination matrix; the rule list only grows (a count ratchet in the same test) | No. Architecture tests run in `pr-gate` (`scripts/land/unit-architecture.sh`) | 4 h on top of B |
| 3 | Mutation score (C) | Nightly run records the engine score; `scripts/release.sh` refuses to promote a build whose nightly score is below the recorded floor; the floor only rises | No. `scripts/release.sh` exists and already runs release checks (`--prepare`) | 3-4 h on top of C's setup |
| 4 | Whole-engine review per release (E) | `scripts/release.sh` refuses unless an independent engine review record is newer than the last commit touching `packages/design/engine/**` | No; same script | 2-3 h |
| 5 | Claims state their scope | A task file that says "matched WinISD" (or "parity") needs a `scope:` line (boxes, Nd, switches, blank values); `check-task-contract.sh` refuses otherwise; `qboard.py check` (workspace `_agent_files/bin/qboard.py`) flags a board card saying "matched" without a scope | No. The contract script exists; qboard's `check` exists. Changing the board tooling needs John's yes first (his 17 Nov rule) | 3-4 h |
| 6 | Duplicate copies only go down (H) | `scripts/dupscan.mjs` already refuses a new copy in `pr-gate` (`pr.yml` line 141), and `scripts/dupscan-allow.json` is a gate file (`land.conf` `GATE_FILES`, editable only with `gates_approved: QO<n>`). Missing: a ratchet that refuses any growth of the open-entry count (249 today) | Partly | 1-2 h |
| 7 | The value store refuses NaN (F) | The check sits in code, in `calculated(v)` in `packages/design/domain/cell.ts`, so no solver can bypass it; an architecture test fails if a second write path to a cell appears | No | inside F's 2-4 h, plus 1 h |
| 8 | Gates do not quietly disappear | A gates register file (each gate, the job and script that runs it, John's ruling that created it) and a test that fails when a listed gate is missing from `pr.yml`/`suite.yml`/`release.sh`. Today `GATE_FILES` stops a gate file being edited without a ruling, but nothing notices a gate switched off: the design coverage gate has been off since 31 Oct (QO316) and its own test (`scripts/land/test/coverage-design-gate.test.sh`) asserts it is absent | No | 4-6 h |

Total for the "how it stays" tools: about 25-35 h, on top of the options themselves.

Also: add journeys that read a chart value (Xmax-limited SPL with 2 drivers; Iso-Barik with BL blank; loading a `.wpr`), since
no browser spec checks a chart number today.

## How the numbers were measured

- Coverage: `bash scripts/coverage-design.sh` on the T933 branch (origin/main 19 Nov 2026), then the same config with a JSON
  reporter into a scratch folder for per-line counts.
- Captures: every `runs/*/*.wpr` with chart data in the research repo, read for BType, Nd, Isobarik and blank driver fields.
- Test and journey inventories: two read-only agents, spot-checked by the author (the Xmax-limited captures exist in the
  research repo but no openisd test names them: `grep -rl xmaxlim packages/` finds nothing).
- Not measured, estimated: mutation testing run time; capture time per WinISD run.
