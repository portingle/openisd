# Plan: a "Transmission line" box type (18-19 Nov 2026)

Status: draft for John. Nothing is built. No app code is written until John has said OK to the project-file fields
(section 3). John's rule: "do not change the datamodel without my agreement first" (17 Oct).

## 1. What John has decided (questions.yml, thread QO953, the 18-19 Nov board talk)

| Where | John's words | What it means here |
|---|---|---|
| QO953.c5 | "ah so this is a new boz type?" | Yes: a new box type with its own New Project picture and Box tab fields. |
| QO953.c7 | "would it be two types or one type with an option" | One type, "Transmission line". A straight line has equal end areas, a tapered line a different mouth area. One box kind in the project file. |
| QO953.c8 | "straight, build tononw side and this is a major enhance and we have tibfind goldens from somewhere" | Straight line first. A major enhancement, built on its own branch until proven. Needs goldens. |
| QO953.c39 | "I would use both goldens for research this is a whole new folder of research for hornresp not WinIsd ..." | Two goldens: Hornresp's results, and the textbook formula. Hornresp research lives in its own `hornresp/` folder in the research repo. |
| QO953.c46 | "A: Hornresp, a free Windows simulator that models transmission lines; run here under wine like WinISD; its results saved as the goldens" | Hornresp is the main golden; the formula is the second check. The Hornresp capture runs separately on the research repo's `hornresp` branch, folder `hornresp/runs/tl-straight-20261119/`. |

## 2. What a straight transmission line is

A **transmission line** (TL) box is a long tube, usually folded to fit in a cabinet. The driver sits at or near the closed
end; the other end (the **mouth**) is open and radiates. The back wave of the cone travels down the tube and comes out of
the mouth. At the frequency where the tube is a quarter of a wavelength long, the back wave leaves the mouth in step with the
front of the cone and adds to it; this is the bass boost a TL gives, like a vented box's port.

- **Straight** line: the same cross-section all the way along (folding does not matter). Equal end areas.
- **Tapered** line (later): the mouth is smaller (or larger) than the closed end.

Example, Tang Band W5-1138SMF (Fs 45 Hz, cone area Sd 94 cm2): a line 1.91 m long with 94 cm2 cross-section holds 17.9 L
of air and its first quarter-wave resonance is about 44 Hz. It also resonates at 3x and 5x that (about 132 and 220 Hz),
which show as ripples in the response when the line is not stuffed.

### 2.1 Physics model the engine will use

The line is a uniform acoustic duct: plane waves only (valid while the line's width is well under half a wavelength; at
94 cm2 that is up to about 1.5 kHz, far above where a TL matters).

- Characteristic impedance `Z0 = rho*c/S`, wavenumber `k = omega/c` (lossless; a lossy line replaces `k` by a complex
  propagation constant, which is how stuffing would come in later).
- A segment of length `l` is a two-port (transfer, "ABCD") matrix:
  `[p1; U1] = [cos kl, j*Z0*sin kl; j*sin kl/Z0, cos kl] [p2; U2]`.
- Mouth load: the radiation impedance of a circular piston of the mouth's area in an infinite baffle (half space,
  2*pi steradians, the same space WinISD's and OpenISD's SPL assume), `Zr = Z0*[1 - J1(2ka)/ka + j*H1(2ka)/ka]`,
  `a = sqrt(S_mouth/pi)`; J1 is the Bessel function, H1 the Struve function. Its low-frequency reactance is the
  0.8216a end correction.
- Driver at distance `x` from the closed end: the stub behind it (closed end, rigid) is `Zs = -j*Z0*cot(kx)`, the line in
  front of it to the mouth is the matrix of length `L - x` loaded by `Zr`; the box impedance the cone's back sees is
  `Zbox = Zs || Zline`. With the driver at the closed end (`x = 0`) the stub vanishes and `Zbox = Zline`.
- The mouth's volume velocity `Um` follows from the matrix; the radiated total is `U0 = UD - Um`, the same sign
  convention `VentedBox.ts` uses for its port (driver front and mouth taken as one point source, as WinISD does for a port).
- The driver side (Re, Le, BL, Mms, Cms, Rms, the electrical source, the Rg and Le switches) is unchanged: the TL is
  only a new `BoxModel` (`packages/design/engine/boxes/`) beside `SealedBox`, `VentedBox` and the others, so every
  driver-side choice applies to it exactly as to every other box type.
- Losses: the first build is lossless inside the line (Hornresp's unstuffed line is lossless too: "System losses are
  assumed to be zero unless an acoustically lined rear chamber, absorbent filling material or vented-box enclosure is
  specified", Hornresp help). The only damping is the driver's own and the mouth's radiation. Stuffing is a later step
  (question Q4).

### 2.2 The textbook quarter-wave formula (second golden)

A tube closed at one end and open at the other resonates at `f_n = (2n - 1) * c / (4 * L_eff)`, n = 1, 2, 3 ..., with
`L_eff = L + 0.8216a` for a baffled mouth (`a` the mouth's radius). W5-1138SMF example: `L = 1.906 m`, `a = 0.0547 m`,
`L_eff = 1.951 m`, `f_1 = 343 / (4 * 1.951) = 43.95 Hz`, `f_2 = 131.9 Hz`, `f_3 = 219.8 Hz`.

### 2.3 What Hornresp computes

Hornresp (David McBean, version 60.70, free, Windows; help file in the research repo at `hornresp/extract/Hornresp.hlp`)
models horns and transmission lines as chains of duct segments with plane-wave matrices, the same method as 2.1. Record
types that matter here: a plain line with the driver at the closed end (one segment, S1 = S2), and "Transmission Line
Enclosure With Offset Driver and Open End" (driver part way along). It radiates into a chosen solid angle (`Ang`, set to
2 x Pi to match OpenISD), drives with a voltage `Eg`, and models the driver as a rigid piston with its own front radiation
load (it takes the moving mass without air load, `Mmd`). Its "Combined" output is the total of the driver front and the
mouth; "Combined 1" also shows each part on its own. It exports chart data to text with frequencies from 10 Hz up on a log
scale.

Where Hornresp's model differs from OpenISD's (so the tolerances in 6.1 cannot be the 1e-12 of the WinISD goldens):
- driver front radiation: Hornresp uses a frequency-dependent piston load; OpenISD (as WinISD) uses the datasheet Mms,
  a constant air load. The two agree at low frequency and drift apart as the cone's `ka` grows;
- Hornresp's printed digits (known once the capture is in);
- how Hornresp sums driver and mouth in "Combined" (path length between them): handled by also comparing the driver part
  and the mouth part on their own.

Sources:
- L.E. Kinsler, A.R. Frey, A.B. Coppens, J.V. Sanders, *Fundamentals of Acoustics*, 4th ed., Wiley 2000, ch. 10 (pipes,
  input impedance, quarter-wave resonance, end corrections).
- L.L. Beranek, T.J. Mellow, *Acoustics: Sound Fields, Transducers and Vibration*, 2nd ed., Academic Press 2019 (baffled
  piston radiation impedance with J1 and H1; acoustic transmission lines).
- H. Levine, J. Schwinger, "On the radiation of sound from an unflanged circular pipe", Phys. Rev. 73(4), 383, 1948
  (end corrections).
- G.L. Augspurger, "Loudspeakers on Damped Pipes", J. Audio Eng. Soc. 48(5), 2000 (TL modelled as a lossy line).
- M.J. King, "Quarter Wave Loudspeaker Design" papers and "Classic Transmission Line Enclosure Alignment Tables" (2006),
  cited by Hornresp's own TL wizard.
- A.R. Bailey, "A Non-resonant Loudspeaker Enclosure Design", Wireless World, Oct 1965 (the origin of the TL box).
- M. Abramowitz, I.A. Stegun, *Handbook of Mathematical Functions*, 1964, ch. 9 and 12 (J1, Struve H1, tables to test
  against).
- OpenISD already has a line element for WinISD's "transmission line model for port" switch
  (`packages/design/engine/boxes/port.ts`); that is a vented-box port and stays as it is (it copies WinISD).

## 3. THE PROPOSED PROJECT-FILE FIELDS (for John's OK)

All new fields sit in one new block, `box.transmissionLine`, beside the existing `box.sealed`, `box.vented` and the others.
Like those, it is always in the file and is only used when the box type is "Transmission line". Stored in metres and square
metres (as every other field); shown in cm and cm2 by default, with the same unit switch as the vent boxes.

| # | Field in the file | Shown as | Unit stored (shown) | Meaning | Allowed (typed) | Example | An old file without it |
|---|---|---|---|---|---|---|---|
| 1 | `box.boxType` = `"transmission-line"` (a new value of the existing field) | Box type "Transmission line" | none | The project's box is a transmission line. | one of the listed types | `"transmission-line"` | Old files never have it; they keep their own box type. |
| 2 | `box.transmissionLine.length_m` | Line length | m (cm) | Length of the line along its middle, closed end to mouth, folds included. | 0 or less: refused. Under 20 cm or over 6 m: kept with a warning note. Over 20 m: refused. | 1.906 (190.6 cm) | Blank. Filled with a starting value when the user picks Transmission line. |
| 3 | `box.transmissionLine.closedEndArea_m2` | Line area (closed end) | m2 (cm2) | Inside cross-section area at the closed end. For a straight line, the area all the way along. | 0 or less: refused. Under 10 cm2 or over 2000 cm2: kept with a warning note. Over 10 m2: refused. | 0.0094 (94 cm2) | Blank, as above. |
| 4 | `box.transmissionLine.mouthArea_m2` | Mouth area | m2 (cm2) | Inside cross-section area at the open end. Equal to field 3 for a straight line. In the first build the app writes it equal to field 3 and does not offer it for typing (tapered comes later). | as field 3 | 0.0094 (94 cm2) | Blank, as above. |
| 5 | `box.transmissionLine.driverPosition_m` | Driver distance from closed end | m (cm) | Where the driver sits along the line, measured from the closed end. 0 = at the closed end. | Under 0, or equal to or over the line length: refused. Over half the length: kept with a warning note. | 0 (at the closed end); 0.45 (45 cm, an offset driver) | Blank, as above (starting value 0). |
| 6 | `schemaVersion` = 7 (the existing field, one up) | not shown | none | Marks a file that can hold a transmission line. | | 7 | A file at 6 or below is upgraded on opening: the block of fields 2-5 is added, all blank. A version 7 file opened in an older app is refused with the existing message "This file was saved by a newer OpenISD ... Please update the app to open it." |

Not stored (the engine calculates them and the Box tab shows them as read-only values):
- **Line volume**: area x length, 17.9 L in the example.
- **Line resonance**: the first quarter-wave frequency with the mouth's end correction, 44.0 Hz in the example.

Loaded impossible values (John's number-input rule, 18 Nov, QO953.c10-c32): a loaded 0 or negative length or area, or a
driver position outside the line, is repaired automatically to the starting value (field 2: a quarter wave at the driver's
Fs; field 3: the cone area Sd; field 4: equal to field 3; field 5: 0); the box shows the repaired value with no
data-quality flag, and the opening toast lists each repair.

Later steps add fields of their own and come back to John first: stuffing (question Q4); typing the line resonance to get
the length (question Q6).

## 4. Engine work (`packages/design/engine`)

1. `BoxType` and `SimulatableBoxType` (`engine/types.ts`) gain `'transmission-line'`. Every exhaustive switch over them
   then fails to compile until handled (about 30 files: `boxes/index.ts`, `box/BoxEngine.ts`, `params.ts`,
   `simulation/SimulationEngine.ts`, `domain/project/projectSweep.ts`, `projectResolve.ts`, `wizard/wizardPlan.ts`,
   `fields/options.ts`, `desktopHelp.ts`, `phoneText.ts`, `phoneWizardText.ts`, `sheetField.ts`, the UI hooks).
2. One line element, written once (dupscan checks there is no second copy): the segment matrix, the closed stub and the
   baffled-piston radiation impedance, with J1 and Struve H1 to full double precision (series below about 2ka = 8,
   asymptotic form above).
3. `boxes/TransmissionLineBox.ts`, a `BoxModel` beside the others, returning `Zbox`, `UD`, `UP` (the mouth flow) and `U0`
   (2.1). `SweepParams` gains the four line values. `DriverSideQuantities.Cab`/`Zc` come from `Vb`, which the TL sets
   to the line volume; the TL model does not read them.
4. `params.ts`: the four line values are required for this box type; a missing one stops the sweep with the usual
   message, never NaN on a chart.
5. Readouts the Box tab shows: line volume and line resonance, as engine functions (domain objects do no maths; they
   ask the engine).
6. Starting values when Transmission line is picked: an engine function (question Q5).
7. Mouth air velocity (`pv` in `SweepResult`, `Um/S_mouth`, scaled as the port velocity is) and the mouth's own output.

## 5. Domain, file and UI work

### 5.1 Domain and file (`packages/design/domain`)
- `openisdSchema.ts`: `box.transmissionLine` block; `boxType` enum gains the value. This is the data-model change of
  section 3; the commit names John's ruling.
- `schemaVersion.ts`: version 7 with the 6-to-7 step that adds the blank block.
- `box/transmissionLineBox.ts` and `Box.transmissionLine`, `volumeOf('transmission-line')` (the line volume, read-only),
  `applyStartingValues()` for the type, `lossGroupsOf` empty (no losses popup in the first build).
- Number-input rule for fields 2-5 (`fields/field.ts` NumberField entries with limits and warning bands).
- WinISD `.wpr`: opening one never makes a TL. Saving a TL project as `.wpr`: question Q7.

### 5.2 What "WinISD-style" means for this box
WinISD has no transmission line box, so there is no WinISD behaviour to copy and no WinISD switch or difference cue on the
TL fields. WinISD-style here means it looks and works like WinISD's other box types:
- same Box tab layout (fields left, drawing right, a note beside the drawing), same units and unit switch, same number
  boxes and refusals;
- the same driver model, SPL at 1 m in half space, the same charts and chart names where they apply, and every driver-side
  WinISD switch (Rg placement, inductance, the bug switches) acting on the TL as on any box;
- the WinISD "transmission line model for port" switch is about a vented box's port and does not apply here.
The box type picker lists Transmission line after ABC (WinISD's own types keep WinISD's order).

### 5.3 Desktop
- Box tab (`OriginalShell.vue`): Line length, Line area, Driver distance from closed end; read-only Line volume and Line
  resonance; a note beside the drawing in plain words ("Transmission line: a long tube behind the driver, open at the far
  end. Around the line resonance the back wave leaves the mouth in step with the cone and adds bass.").
- Drawing (`BoxTypeDiagram.vue`): a folded line, driver at the closed end, mouth at the bottom of the baffle; the driver
  drawn part way along when field 5 is not 0. Same size as the other drawings.
- New Project (`OriginalNewProject.vue`): Transmission line on the box type page; its details page shows the starting
  length, area and driver position with the line volume and resonance. The dialog keeps its fixed size.

### 5.4 Phone
- `MobileBoxTab.vue` / `MobileEnclosureTab.vue`: the same fields and readouts in the phone rows; `MobileNewProject.vue`:
  the type and its details page with the drawing. Phone help texts in `fields/phoneText.ts`, `phoneWizardText.ts`.

### 5.5 Charts
- All ten system charts (SPL, transfer function, phase, group delay, max power, max SPL, cone excursion, impedance and its
  phase, power/VA) and the three filter charts apply unchanged.
- New for the TL (question Q8): "Line mouth - Air velocity" (with the project's port velocity limit line, the existing
  field, default 17 m/s) and "Line mouth - Gain" (the mouth's own output), shaped like the vented box's port charts.
- `BoxEngine.chartsFor('transmission-line')` lists them; chart help texts in `fields/chartHelpText.ts`.

## 6. Tests

Tests are written first (TDD). No test is skipped or marked expected-to-fail without John.

### 6.1 Goldens against Hornresp
Fixture files generated from the Hornresp exports (a script in the research repo, like `toys/plotted_fixture_ts.py` for
WinISD), never hand-edited, in `packages/design/test/fixtures/hornresp/`. Runs needed from the capture
(`hornresp/runs/tl-straight-20261119/`), all with W5-1138SMF, Le 0, `Ang` 2 x Pi, Hornresp's `Mmd` set so its Mms equals
the datasheet 28.81 g, losses off in OpenISD (Ql and Qa at the lossless limit):

| Run | Box | Why |
|---|---|---|
| H0 | closed box 10 L | Calibration: OpenISD's closed box is already proven against WinISD; the difference here is the floor caused by the driver-model differences in 2.3. |
| H1 | line 1.906 m, 94 cm2 both ends, driver at the closed end | The main case. |
| H2 | as H1, driver 0.45 m from the closed end | Offset driver (field 5). |
| H3 | line 1.00 m, 150 cm2 both ends, driver at the closed end | A second size, resonance near 81 Hz. |

Each run exports SPL (Combined, plus the driver and mouth parts on their own), impedance magnitude and phase, cone
excursion, and mouth air velocity if Hornresp offers it.

Proposed tolerances, compared at Hornresp's own frequencies from 10 Hz to 500 Hz (where the cone's ka is 0.5; above it the
two programs' front radiation loads differ by design):
- SPL: within 0.1 dB, or the H0 floor at that frequency plus 0.05 dB if H0 shows a larger floor;
- impedance magnitude: within 1 %; impedance phase within 1 degree;
- cone excursion: within 1 %;
- frequencies of impedance peaks and SPL dips: within 0.5 % (about 0.2 Hz at 44 Hz);
- never tighter than half the last digit Hornresp prints.
Why: with the same plane-wave line maths the line part should agree to print precision; the left-over difference is the
driver's front radiation load and Mmd/Mms, which H0 measures on a box where OpenISD is already proven. If H0 shows a
floor above these numbers, the numbers go back to John with the evidence; nobody loosens them alone.

### 6.2 Goldens against the formula
- F1: the line element against the closed form `Zin = Z0*(Zr + j*Z0*tan kL)/(Z0 + j*Zr*tan kL)`, within 1e-12 relative
  (same maths, rounding only).
- F2: open end with no radiation load: the input impedance's minima at `(2n - 1)c/(4L)`, n = 1..3, within 1e-9 relative.
- F3: with the baffled mouth: the first minimum at `c/(4(L + 0.8216a))` within 1 % (the 0.8216a end correction is the
  low-frequency limit; at the W5 example's ka of 0.04 its own error is far under 1 %).
- F4: a closed mouth (stub only) below `c/(100L)` behaves as a closed box of volume S x L: SPL within 0.01 dB of OpenISD's
  lossless closed box (the tan series error there is 0.13 % of the compliance).
- F5: J1 and Struve H1 against Abramowitz and Stegun tables, within 1e-10.
- F6: line volume and line resonance readouts for the W5 example: 17.92 L and 43.95 Hz (to the precision shown).

### 6.3 Journeys (desktop and phone, as a person uses the app)
1. New Project: pick W5-1138SMF, choose Transmission line, see the drawing and starting values (190.6 cm, 94 cm2, driver
   at 0 cm, 17.9 L, 44 Hz), finish; the SPL chart draws with the line's ripples.
2. Box tab: change the length from 190.6 cm to 250 cm; the resonance falls to about 34 Hz, the volume rises to 23.5 L, the
   SPL curve moves.
3. Type 0, then -5, in Line length: refused with a note, 250 cm stays, charts keep drawing. Type 700 cm: kept with a
   warning note.
4. Type a driver distance of 300 cm on a 250 cm line: refused with a note.
5. Switch the box type to Vented and back: the line values are as they were.
6. Save as `.owpr`, open it again: the same values and curves. Open an older project file (version 6): it opens as before.
7. Open a hand-edited file with length 0: the box shows the repaired starting length; the opening toast lists the repair.
8. Two drivers, and Iso-Barik, on a line: the charts follow as for other boxes.
9. Save as WinISD `.wpr` from a line project: the result of question Q7, visible on screen.
10. The chart list for a line includes the mouth charts and no port or radiator charts.
Before/after pictures of each changed screen, desktop and phone, with a comment box under each, before anything ships.

## 7. Phases

| Phase | Work | Size |
|---|---|---|
| 0 | This plan; John's OK of section 3 and answers to section 9; Hornresp runs H0-H3 captured in the research repo | capture under way |
| 1 | Engine: line element, J1/H1, `TransmissionLineBox`, readouts, starting values, mouth charts; tests F1-F6 and the Hornresp goldens | about 3 days |
| 2 | File and domain: schema version 7, the upgrade step, `Box.transmissionLine`, number-input rule for fields 2-5, `.wpr` answer | about 2 days |
| 3 | Screens: desktop and phone Box tab, drawing, New Project, help texts, chart names; journeys 1-10; picture baselines | about 3 days |
| 4 | Pictures to John on the board; fixes; ship from the branch when he agrees | about 1 day plus his review |
| Later | Tapered line (conical segment, Hornresp tapered goldens): about 2 days. Stuffing: 3-5 days. What-if and Tune for the line: about 1 day. Each is its own ask. | |

All work on its own branch (QO953.c8, "build to one side"), one worktree per agent, until the Hornresp goldens pass and
John has seen the pictures.

## 8. Risks

- Hornresp's internals are only partly documented (its driver front load, how "Combined" adds driver and mouth). Handled
  by run H0 and by comparing the driver part and mouth part on their own; a remaining unexplained difference goes to John.
- Schema version 7: every project saved by the new app (TL or not) is refused by an older app with the "newer OpenISD"
  message, as happened at version 6. The installed app updates itself, so this lasts only until a device updates.
  The same version number is stamped on saved drivers (`.owdr`) and `openisd.json` records
  (`packages/design/domain/schemaVersion.ts`), so a driver saved by the new app is also refused by an older one; phase 2
  checks whether the drivers repo's records need anything (they should upgrade on load like any version 6 record).
- Unstuffed lines show strong peaks and dips at 3x and 5x the line resonance. That is the physics, but a user may read it
  as a fault; the Box tab note says so, and stuffing is question Q4.
- The Struve function needs care to be right to the last digits; test F5 guards it.
- About 30 files switch over every box type. The compiler finds each one; it is size, not risk, but it touches many
  shared files, so the branch must be kept up to date with main.

## 9. Open questions for John

Each needs an answer before the phase that uses it. Recommended answer first.

**Q1. Are the fields in section 3 right?** (Needed before any code.)
- A (recommended): yes, as listed: length, closed-end area, mouth area, driver distance, schema version 7. Cost: as planned.
- B: one area field only (no mouth area until tapered lines). Cost: a second data-model ask and upgrade step later
  (about half a day); saves nothing now.
- C: add width and height of the line (as the vent has diameter or width x height) as well as the area. Cost: about 1 day
  more; helps building the cabinet; the model only needs the area.
Examples: W5 line 190.6 cm x 94 cm2 (A stores 94 and 94); a tapered line 94 cm2 to 47 cm2 later (A already has the field;
B needs a new one); a 10 x 9.4 cm folded line (C stores 10 and 9.4).

**Q2. Mouth area in the first build.**
- A (recommended): the field is in the file now, locked equal to the closed-end area on screen until the tapered phase.
  Cost: none now.
- B: build tapered now too. Cost: about 2 days more and extra Hornresp runs.
- C: as Q1-B.
Examples: straight 94/94 cm2; tapered 94/47 cm2 (2:1, a common taper); expanding 94/150 cm2.

**Q3. Driver part way along the line in the first build?**
- A (recommended): yes. Cost: about half a day and Hornresp run H2. An offset driver (often about a fifth to a third of
  the length) smooths the 3x ripple, so most real lines use it.
- B: closed end only; the field is stored and kept at 0. Cost: none now; offset later is a screen change only.
Examples: driver at 0 cm; at 45 cm on a 190.6 cm line (about 1/4); at 64 cm (1/3).

**Q4. Stuffing (wool or polyester fill inside the line)?**
- A (recommended): none in the first build: lossless, matching Hornresp's unstuffed line, so the golden is exact. Cost:
  none now; responses show the full ripples.
- B: a simple loss figure for the line, like the vented box's Qp. Cost: about half a day; no Hornresp golden for it (not
  Hornresp's model), so it is unchecked physics.
- C: Hornresp-style stuffing: flow resistivity of the fill (mks rayls/m) and how much of the line is filled (%). Cost:
  3-5 days, research into Hornresp's fill model, two new fields (another data-model ask), Hornresp goldens with fill.
Examples: empty line (A); polyester fill about 5,000 rayls/m over the first half (C); a "Q 10" line loss (B).

**Q5. Starting values when Transmission line is picked.**
- A (recommended): length a quarter wave at the driver's Fs (`c/(4 Fs)`), area = cone area Sd, driver at the closed end.
  Cost: as planned. W5-1138SMF: 190.6 cm, 94 cm2, 17.9 L.
- B: Martin King's classic alignment tables (what Hornresp's TL wizard uses). Cost: about 2 days of research and tests.
- C: blank boxes the user fills in. Cost: none, but the charts would be empty until then, against "charts never go blank".
Examples (A): W5-1138SMF (Fs 45 Hz) 190.6 cm; a driver with Fs 30 Hz 285.8 cm; Fs 60 Hz 142.9 cm.

**Q6. Typing the line resonance to get the length (as the vented box lets you type Fb to get the vent length)?**
- A (recommended): not in the first build; the resonance is a read-only value. Cost: none.
- B: yes, now. Cost: about 1 day; field 2 becomes an "entered or calculated" slot in the file, a changed field.
Examples: type 40 Hz, get 209.9 cm; type 35 Hz, get 240.5 cm (W5, 94 cm2).

**Q7. Saving a line project as a WinISD `.wpr` file.**
- A (recommended): refused with a note on screen: "WinISD has no transmission line box; save as an OpenISD project
  instead". Cost: small.
- B: saved as a closed box of the same volume (17.9 L) with a note. Cost: small; WinISD would show a different design,
  which misleads.
- C: the WinISD save is hidden for a line project. Cost: small; a button that disappears is less clear than a note.

**Q8. Mouth charts.**
- A (recommended): two new charts, "Line mouth - Air velocity" and "Line mouth - Gain", like the vented box's port charts.
  Cost: as planned.
- B: show the mouth in the existing "Rear port" charts. Cost: less; the name is wrong for a line.
- C: air velocity only. Cost: slightly less.

**Q9. The Hornresp tolerances in 6.1** (0.1 dB, 1 %, 1 degree, 0.5 % on frequencies, 10-500 Hz): OK, or tighter/looser?
They are confirmed or sent back with evidence after run H0.
