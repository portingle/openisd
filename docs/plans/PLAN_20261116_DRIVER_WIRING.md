# Plan: Driver wiring (several drivers wired to the amplifier), ticket #519

Written 16 Nov 2026 for John, who asked (16 Nov, 12:53 UTC): "ok what is a good design for this feature? / plan a good
functioning and data design for it". Revised the same day to John's decisions of 13:04-13:05 UTC (QO946.c129-c131).
This is a design only. No product code is in this branch.

Decisions this plan is bound by are cited by their `questions.yml` id (thread QO946) or the ticket comment
(Johnlon/openisd#519). Code is cited as `file:line` on **PR 137's head (`portingle/t838`, stacked on PR 138)**, because
the feature is built on top of both: PR 138 makes several drivers behave exactly as WinISD, PR 137 renames the
project's old `wiring` key to `VCCon` (the coil wiring). Lines that exist only on `portingle/main` (5b9666b8) say so.

## 1. What is decided (do not reopen)

- OpenISD replicates WinISD. WinISD has no driver wiring: with Nd drivers it uses Vas×Nd and Sd×Nd in one shared Vb,
  feeds each driver P/Nd, never scales Re or BL by Nd, and draws ONE driver's impedance
  (`winisd_research/findings/FINDING_20261115_voice-coil-connection-and-driver-count-in-the-code.md`). PR 138 makes
  OpenISD do exactly that.
- **WinISD is not a third wiring** (QO946.c129-c131). For SPL, excursion and port speed WinISD is Parallel: the typed
  voltage is across each driver. Its only difference from Parallel is that the impedance chart shows one driver
  instead of the real parallel load Z/N.
- New project option **"Driver wiring"**: Parallel / Series. Shown only with 2 or more drivers. Default **Parallel**.
  A project setting, never part of the driver record. No series-parallel, no mixed driver types (QO946.c13).
- New switch **"Impedance of one driver"** in the non-yellow **"Enable WinISD-style"** group, **off by default**
  (QO946.c131). Ticked, the impedance chart shows one driver's impedance, as WinISD does. It changes nothing else:
  every other chart and readout follows Driver wiring. It replaces the earlier "Share power between drivers" switch
  (ticket comment of 16 Nov 04:00), which is dropped.
- Accepted: multi-driver projects show a different impedance chart from WinISD unless the switch is ticked
  (QO946.c72, c131).
- The help text of "Driver wiring" is the one John approved on the ticket and is copied **exactly** (section 4.4).
- Not the same thing as **Coil wiring** (the voice coils inside one driver; driver `VCCon` = how the maker measured,
  project `VCCon` = how the user wires the coils; PR 137, QO946.c18/c23). The new feature has its own field name.
- Standing rules: the engine does the calculations; no stored value is ever overwritten; tests first; WinISD `.wpr`
  files carry no driver wiring.

## 2. The physics, and a correction to the ticket's example

An amplifier is a voltage source V with an output (source) resistance Rg (QO946.c50-c53). N identical drivers, each of
impedance Z (Z already includes the user's Coil wiring, see section 6). By symmetry every driver does the same thing, so
each driver can be replaced by a one-driver circuit with its own EMF and its own series resistance (Thevenin):

| Wiring   | Rg placement     | EMF each driver sees | Rg each driver sees | Load the amplifier sees |
|----------|------------------|----------------------|---------------------|-------------------------|
| Parallel | at the amplifier | V                    | N·Rg                | Z/N (plus Rg)           |
| Series   | at the amplifier | V/N                  | Rg/N                | N·Z (plus Rg)           |
| Parallel | at each driver   | V                    | Rg                  | (Z+Rg)/N                |
| Series   | at each driver   | V/N                  | Rg                  | N·(Z+Rg)                |

"Impedance of one driver" ticked changes only the last column as drawn on the impedance chart: Z (or Z+Rg at the
driver), one driver's, as WinISD. The amplifier still sees the load in the table.

"Rg is at driver side" already exists (Advanced tab, `adv_RgAtDriverSide`, schema
`packages/design/domain/openisdSchema.ts:844`, circuit `packages/design/engine/circuit.ts:82,128`). The ticket's
"Rg acts on the whole load (parallel N·Rg, series Rg/N)" is the at-the-amplifier rows. With Rg at each driver, the
wiring does not change what Rg does.

**Correction to the example in QO946.c66 and the ticket** ("4 drivers, same voltage: parallel highest SPL, WinISD-style
6 dB lower, series 12 dB lower"). Worked through (DA215-8 ×4, Rg 0, section 7):

- At the **same amplifier voltage**, series is 12.04 dB below parallel. Correct.
- WinISD's voltage field is the voltage **at each driver** ("Driver input voltage (each)",
  `packages/design/fields/field.ts:597` on main). Typed 2.83 V, WinISD drives each driver at 2.83 V, which is exactly
  what Parallel does at an amplifier voltage of 2.83 V. **Same SPL, 0 dB.** This is why WinISD is Parallel (c129).
- At the **same typed power**, Parallel and Series give the same SPL: identical drivers share the power equally whatever
  the wiring; only the amplifier voltage needed differs (parallel 1.415 V, series 5.66 V for 1.178 W).
- "WinISD 6 dB lower" holds only if WinISD is fed the power ONE driver would draw at the amplifier's voltage
  (1.178 W = 2.83²/6.8) while parallel draws 4.71 W. That is not a comparison any user makes.

Consequence: with the default (Parallel, switch off) and Rg 0 or Rg at the driver side (the default placement), an
existing multi-driver project keeps **every SPL, excursion, port-velocity, VA and maximum curve**; only the
**impedance chart** changes, to the amplifier's load Z/N (which is what OpenISD drew before PR 138). Ticking
"Impedance of one driver" gives back WinISD's chart exactly. SPL changes only with Series, or with Rg > 0 at the
amplifier (section 5.3).

## 3. User-facing behaviour

### 3.1 The "Driver wiring" control

- **Desktop**, Driver tab, left column, directly under "Num. of drivers"
  (`packages/ui/src/ui/shells/original/OriginalShell.vue:468`), above the Standard/Iso-Barik radios and the Coil
  wiring control (`DriverCoilWiring`, line 475). A select: `Driver wiring  [Parallel | Series]`.
- **Phone**, Driver tab, directly under "Drivers" (`packages/ui/src/ui/shells/mobile/MobileDriverTab.vue:27`), above
  Coil wiring (line 28). Same label, same two choices.
- **Shown only when Num. of drivers is 2 or more** (approved). At 1 driver the row is not drawn on either skin.
- Always editable with 2+ drivers. "Impedance of one driver" does not disable it, because the wiring still sets the
  sound and the voltages.
- Changing the number of drivers never changes the stored wiring (4 → 1 → 4 brings back the user's Series).
- New component `packages/ui/src/ui/components/DriverWiring.vue` with hooks `DriverWiring-hooks.ts`, built like
  `DriverCoilWiring.vue` / `DriverCoilWiring-hooks.ts`, used by both skins.
- Not in the New Project wizards (decided, QO946.c142-c143): a new project with 2+ drivers starts Parallel and is
  changed on the Driver tab.

### 3.2 The "Impedance of one driver" switch

- **Desktop**: Advanced tab, "Enable WinISD-style" group, after "Simplified ABC intra-port velocity"
  (`OriginalShell.vue:637-648`). **Phone**: `MobileAdvancedTab.vue:46-59`, same group, same place.
- Unticked by default (QO946.c131). Editable only with 2+ drivers; greyed (`compat-switch-na`, as the ABC intra-port
  switch) at 1 driver, where it changes nothing.
- Ticked: the Impedance chart (magnitude) shows one driver's impedance, as WinISD's. Nothing else changes: SPL,
  excursion, port velocity, VA, maximum curves, group delay, the Signal tab and its power all follow Driver wiring.
- No ≠W cue by the impedance chart while it is off: it is a WinISD-style option, not a bug (CLAUDE.md, "An option is
  never yellow"); the difference is listed in the WinISD differences (PR 4).

### 3.3 Signal tab: what the voltage and power mean

The stored pair `signal.power_W` / `signal.voltage_V` keeps whichever the user entered (no stored value is changed by
this feature).

- With 2+ drivers the voltage is the **amplifier's output voltage**. In Parallel that is also the voltage at each
  driver, the meaning of WinISD's field, so a WinISD or old OpenISD project's number means the same thing. In Series
  each driver gets V/N.
- The power is the power the amplifier delivers into the drivers (and Rg). In Parallel this is WinISD's
  `P = N·V²/(Re+Rg)`; in Series `P = N·(V/N)²/(Re+Rg_each)`.
- The "Impedance of one driver" switch does not touch the Signal tab.
- Desktop label of the voltage field: WinISD's "Driver input voltage (each)" is wrong in Series. Proposed: "Amplifier
  voltage" when Driver wiring is in use (2+ drivers), "Voltage at each driver" otherwise (Q1). Power label "System input power" unchanged.
- Phone label "Volts" unchanged. Its help today says "the amplifier output voltage"
  (`packages/design/fields/phoneText.ts:154`); that becomes true with 2+ drivers in either wiring (Q1 covers the
  wording).
- Entered voltage + Parallel → Series: the amplifier voltage stays, each driver gets V/N, SPL −20·log10(N).
- Entered power + Parallel → Series: the power stays, the voltage readout becomes N times higher; SPL unchanged at Rg 0.
- No new readout line ("Amplifier load", "each driver gets"): John ruled the coil-wiring figures line out because the
  charts show it (A5, QO946.c34-c35). The same holds here.

### 3.4 How the charts change

| Chart                                            | Parallel                         | Series                                     | "Impedance of one driver" ticked             |
|--------------------------------------------------|----------------------------------|--------------------------------------------|----------------------------------------------|
| Impedance (magnitude)                            | one driver's ÷ N (the amp load)  | one driver's × N (the amp load)            | one driver's, in either wiring (as WinISD)   |
| Impedance (phase)                                | one driver's                     | one driver's                               | unchanged                                    |
| SPL, Transfer function level                     | as WinISD at the same typed V    | −20·log10(N) at the same amplifier voltage | unchanged                                    |
| Cone excursion, port / PR velocity, PR excursion | as WinISD                        | × 1/N at the same amplifier voltage        | unchanged                                    |
| Amplifier apparent load power (VA)               | N × per driver (as WinISD)       | N × per driver; parallel 16× series at 4   | unchanged                                    |
| Maximum SPL, Maximum power                       | unchanged                        | unchanged at Rg 0 (power-limited)          | unchanged                                    |
| Group delay, phase                               | unchanged at Rg 0                | unchanged at Rg 0                          | unchanged                                    |
| EQ/Filter charts                                 | unchanged                        | unchanged                                  | unchanged                                    |

"Unchanged at Rg 0": with Rg > 0 at the amplifier each driver sees N·Rg or Rg/N, which changes Qes′ and so the shape
(section 5.3). Frequencies of the impedance peaks and minimum never move with the wiring or the switch. Compare
traces: each project's trace is drawn with its own wiring and switch.

## 4. Data design

### 4.1 Fields

| Where             | Key                             | Values                   | Default      | Meaning                                                         |
|-------------------|---------------------------------|--------------------------|--------------|-----------------------------------------------------------------|
| `driverEmbedding` | **`driverWiring`**              | `'parallel'`, `'series'` | `'parallel'` | how the project's N drivers are wired to the amplifier          |
| `advanced`        | **`winisdOneDriverImpedance`**  | boolean                  | `false`      | "Impedance of one driver": the impedance chart shows one driver |

- **`driverWiring`**: beside `nDrivers` and `VCCon` in `openISDDriverEmbeddingJsonSchema`
  (`openisdSchema.ts:922-946`), whose comment already says this section holds "how many units, how they're wired
  together". It is unmistakably not `VCCon` (coil wiring) and not the retired `wiring`. Values are the same strings as
  `VCCon` (QO946.c18: names, not 1/2).
- **`winisdOneDriverImpedance`**: follows the switch naming rule `winisd<calculation>` of the Advanced section
  (`openisdSchema.ts:858-896`). Field `ToggleField.ADV_WINISDONEDRIVERIMPEDANCE`, value key
  `adv_WinisdOneDriverImpedance`; `CompatSwitch.ONE_DRIVER_IMPEDANCE`, kind `'option'`
  (`packages/design/domain/project/compatSwitch.ts:29-31`).
- **Exception to state in code**: `CompatSwitch.winisdValue` makes every option ticked for a new project and for a file
  that does not say (`compatSwitch.ts:33-40`; schema comment `openisdSchema.ts:858-860`; this repo's `CLAUDE.md`,
  "every option ticked"). This switch is the first option that is **off** by default (QO946.c131). `CompatSwitch` gets
  a per-switch `defaultValue` (bugs false, options true, this one false) and the comment cites QO946.c131. A test pins
  it. `CLAUDE.md` gets an allowance line for this switch; the rule itself stays.
- The retired `winisdDriverCountModel` key ("Per-driver impedance", removed by PR 138, read and ignored,
  `openisdSchema.ts:890`) is **not** reused or migrated: it was a bug switch with the opposite polarity, and PR 138
  ruled saved values are ignored.
- Both new keys are **optional in the schema**; absent means Parallel and off. Every save writes both, also at 1
  driver, so a later count change brings back the user's choice.
- Project facade: `OpenISDProject.driverWiring` and `OpenISDProject.winisdOneDriverImpedance`
  (`packages/design/domain/project/openISDProject.ts`, next to `nDrivers` at :175 and `winisdWrapPhase` at :322),
  passed into `ProjectSweepSource` (`packages/design/domain/project/projectSweep.ts:26-59`, `sweepParamsOf` :77-120);
  `driverWiring` also into `ProjectSignal` (`openISDProject.ts:712-722`, `projectSignal.ts:26-42`).

### 4.2 Schema version step

- PR 137 sets `CURRENT_SCHEMA_VERSION = 5` (`packages/design/domain/schemaVersion.ts`). This feature makes it **6**.
- Upgrade step `from: 5`: adds nothing, changes nothing (absent already means Parallel/off). The step exists so that an
  older app shown a version-6 file refuses it with "made by a newer OpenISD" instead of failing the strict schema on an
  unknown key. A test proves the step is the identity on a v5 file except `schemaVersion`.
- PR 137 also stepped the browser storage layout (5 → 6). Check in PR 2 whether the layout has to step again for a
  schema version; follow PR 137's pattern if it does.

### 4.3 Migration of existing projects

- Old projects (v2-v5) open with Driver wiring Parallel and the switch off. Nothing stored is rewritten.
- The old `wiring` key is the **coil** wiring (now `VCCon`, QO946.c18/c23). It is **never** read as Driver wiring.
- What a user sees on an old 2+-driver project (section 2): the impedance chart shows the amplifier's load (Z/N); every
  other chart is unchanged unless Rg > 0 sits at the amplifier. No notice is shown (same ruling as PR 138, QO946.c23).

### 4.4 Help texts (field registry `packages/design/fields/field.ts`)

`EnumField.PROJECT_DRIVERWIRING`, value `project_driverWiring`, label "Driver wiring", options Parallel/Series.
Approved by John on the ticket; copied exactly:

> How the drivers are connected to the amplifier. Parallel: each driver gets the full amplifier voltage; the load is
> one driver's impedance divided by the number of drivers (4 × 8 Ω → 2 Ω). Series: the voltage is split between the
> drivers; the load is the impedance times the number (4 × 8 Ω → 32 Ω). This changes the impedance chart, the SPL and
> excursion for a given amplifier voltage, and how Rg acts. Not the same as Coil wiring, which connects the voice coils
> inside one driver.

`ToggleField.ADV_WINISDONEDRIVERIMPEDANCE`, label "Impedance of one driver". Approved by John (QO946.c142-c143);
copied exactly:

> Impedance of one driver: WinISD works out the sound as if the drivers were wired in parallel (each gets the full
> voltage), but its impedance chart shows only ONE driver, not the load the amplifier really sees with them in parallel
> (4 × 8 Ω is 2 Ω). So the two do not match. OpenISD shows the load for the wiring you chose under Driver wiring. Tick
> this to see one driver's impedance as WinISD does; the sound and every other chart stay the same.

The help-text test compares both strings character for character with the registry once approved. A phone short line,
if needed, goes to John for approval.

### 4.5 `.owpr`, `.wpr`

- **`.owpr` / browser storage**: both keys saved and loaded as they are; round trip test.
- **`.wpr` import** (`packages/design/domain/winIsdProjectConverter.ts:591-596`): WinISD files have no driver wiring.
  The project gets the defaults (Parallel, switch off). WinISD is Parallel for the sound (c129), so SPL, excursion and
  port velocity equal WinISD's at Rg 0 or Rg at the driver side. Only the impedance chart differs until the user ticks
  "Impedance of one driver" (accepted, QO946.c72/c131).
- **`.wpr` export** (`winIsdProjectConverter.ts:280-320`): writes `Nd` and `P` (the system input power) as today; no
  wiring key exists to write. WinISD shares that P equally, which is what identical drivers get in either wiring, so the
  `.wpr` reproduces the project's SPL in WinISD at Rg 0. With Rg at the amplifier and Rg > 0 WinISD's result differs
  (section 5.3); listed in the differences, not worked around.

## 5. Engine design

### 5.1 One function, in the engine

New file `packages/design/engine/array/driverWiring.ts`, the **only** place that turns an amplifier voltage and Rg into
what each driver sees (an architecture test refuses a second site, as PR 137's
`architecture-coil-wiring-arithmetic-has-one-site.test.ts`):

```ts
export type DriverWiring = 'parallel' | 'series';
/** What ONE of n identical drivers sees, as a one-driver circuit (Thevenin), and how its impedance maps to the amplifier's load. */
export interface DriverDrive { readonly eg_V: number; readonly Rg_ohm: number; readonly loadScale: number }
export function driverDrive(n: number, wiring: DriverWiring, amp_V: number, Rg_ohm: number, rgAtDriverSide: boolean): DriverDrive
```

- `n ≤ 1`: `{eg: amp_V, Rg: Rg_ohm, loadScale: 1}`.
- Parallel: `eg = amp_V`, `loadScale = 1/n`, `Rg = rgAtDriverSide ? Rg : n·Rg`.
- Series: `eg = amp_V/n`, `loadScale = n`, `Rg = rgAtDriverSide ? Rg : Rg/n`.

### 5.2 Where it is used

- `SweepParams` (`packages/design/engine/types.ts:182-190, 319`) gains `driverWiring?: DriverWiring` and
  `winisdOneDriverImpedance?: boolean`. `eg`'s doc becomes "the amplifier voltage; with one driver, the voltage at it".
- **Sweep**, the N > 1 branch (`packages/design/engine/simulation/SimulationEngine.ts:455-470`): today it sweeps one
  driver in Vb/N (`oneBoxOfN`, :217) at `eg` and scales SPL +20·log10(N) and VA ×N. New: compute
  `d = driverDrive(...)` once, sweep the one driver with `{...oneBoxOfN(P, n), eg: d.eg_V, Rs: d.Rg_ohm}`, then the
  same SPL and VA scaling, and `zmag × (P.winisdOneDriverImpedance ? 1 : d.loadScale)`. The switch is read in this one
  line and nowhere else. Nothing else in the loop changes: per-driver excursion, port velocity (port area is already
  /N), VA = N × one driver's EMF²·|Hf|²/|Z+Rg| (the amplifier's apparent power in both wirings), group delay and the
  transfer function come out right.
- The one-driver circuit (`packages/design/engine/circuit.ts:82-145`) is **not touched**. Its own `rgAtDriverSide`
  rule already keeps Rg out of the chart for Rg at the amplifier and in it for Rg at the driver, which is what
  `zmag × loadScale` needs.
- **Maximum curves**, N > 1 branch (`SimulationEngine.ts:697-705`): pass `Rs: d.Rg_ohm` to the one-driver call; max
  power and max SPL are N × one driver's limits, wiring-neutral at Rg 0.
- **Signal engine** (`packages/design/engine/signal/SignalEngine.ts:54-73`): `SignalSolverParams` gains the wiring
  inputs; power from voltage becomes `P = N · driveFromVoltage(d.eg_V, Re, d.Rg_ohm)` and voltage from power
  `amp_V = k · driveVoltage(P/N, Re, d.Rg_ohm)` with k = N for series, else 1, both through `driverDrive`. In Parallel
  with Rg at the driver this is today's `P = N·V²/(Re+Rg)`. The "Re without Rg" bug switch keeps working
  (`Rg = 0` → `d.Rg = 0`).
- `ProjectSignal` (`packages/design/domain/project/projectSignal.ts:64, 90-96`) divides by N itself today; it calls the
  engine's function instead, so no arithmetic stays in the domain.
- Inert first: in PR 1 an absent `driverWiring` keeps today's path exactly (eg and Rg unscaled, impedance one
  driver's), so every existing golden is unchanged. PR 3 always passes the field and removes that path.

### 5.3 Rg, worked (the one place Parallel differs from WinISD's sound)

DA215-8, 4 drivers, Rg 0.5 Ω, passband level relative to Rg 0 = 20·log10(Re/(Re+Rg_each)):

| Case                                      | Rg each driver sees | Passband level | Qes′ = Qes·(Re+Rg)/Re |
|-------------------------------------------|---------------------|----------------|-----------------------|
| Parallel, Rg at amplifier                 | 2.0 Ω               | −2.239 dB      | 0.582                 |
| Series, Rg at amplifier                   | 0.125 Ω             | −0.158 dB      | 0.458                 |
| WinISD (PR 138 today), Rg at amplifier    | 0.5 Ω               | −0.616 dB      | 0.483                 |
| Either wiring, Rg at driver (the default) | 0.5 Ω               | −0.616 dB      | 0.483                 |

WinISD applies Rg to each driver as if each had its own (finding: BL/(Sd·√(Nd·(Re+Rg+ΔRe)))). With Rg at the
amplifier and Rg > 0 that is not what a real amplifier does, and OpenISD follows the circuit. Per QO946.c131
("everything else follows Driver wiring") no switch restores it; it is listed in the WinISD differences (PR 4).

## 6. Together with Coil wiring

Order: **Coil wiring first, per driver; Driver wiring second, on N copies of that driver.** The coil conversion is
PR 137's single site (`convertWiring`, called from `OpenIsdDriverSpec.terminalMotor`); its result is the one driver
the sweep sees. `driverDrive` never reads `VCCon` or `numVC`, and the coil conversion never reads `driverWiring` or N.
A test asserts both directions. "Impedance of one driver" shows that one converted driver.

Example, Dayton MX12-22 (2 coils, measured in series: Re 3.95 Ω, BL 21.5, Qes 0.39, Qms 3.25), 4 drivers, VCInd off,
lossless box (impedance peak = Re·(1+Qms/Qes), box-independent):

| Coil wiring          | Driver wiring | One driver Re / BL | Amp load, high frequency | Amp load at the peak | Chart with the switch ticked (peak) |
|----------------------|---------------|--------------------|--------------------------|----------------------|-------------------------------------|
| Series (as measured) | Parallel      | 3.95 Ω / 21.5      | 0.9875 Ω                 | 9.217 Ω              | 36.867 Ω                            |
| Parallel             | Series        | 0.9875 Ω / 10.75   | 3.95 Ω                   | 36.867 Ω             | 9.217 Ω                             |
| Parallel             | Parallel      | 0.9875 Ω / 10.75   | 0.247 Ω                  | 2.304 Ω              | 9.217 Ω                             |
| Series               | Series        | 3.95 Ω / 21.5      | 15.8 Ω                   | 147.47 Ω             | 36.867 Ω                            |

SPL at 2.83 V, row 2 against row 1: force ∝ eg·BL/Re = (0.7075·10.75/0.9875)/(2.83·21.5/3.95) → **−6.021 dB**.

## 7. Worked numbers for the tests (Dayton DA215-8 ×4, 2.83 V)

DA215-8: Fs 34.9 Hz, Qes 0.45, Qms 1.95, Vas 42.7 L, Sd 211.2 cm², Re 6.8 Ω, Le 1.44 mH (bundled record
`packages/ui/public/drivers/dayton-audio/da215-8.json`). The circuit uses the BL and Mms implied by Fs, Vas, Qes, Re
(one-BL default): with ρ 1.204 kg/m³, c 343.2 m/s, Mms = 30.81 g, BL = 10.104 T·m.

Settings: sealed, 4 drivers, VCInd off (Le out), Rg 0 unless stated, Rg at driver side (default).

| Quantity                                         | One driver | Parallel  | Parallel + "Impedance of one driver" (= WinISD) | Series    |
|--------------------------------------------------|------------|-----------|-------------------------------------------------|-----------|
| Voltage at each driver                           | 2.83 V     | 2.83 V    | 2.83 V                                          | 0.7075 V  |
| System input power                               | 1.1778 W   | 4.7111 W  | 4.7111 W                                        | 0.29444 W |
| Impedance chart peak, lossless box               | 36.267 Ω   | 9.067 Ω   | 36.267 Ω                                        | 145.07 Ω  |
| Impedance chart at high frequency (→ Re)         | 6.8 Ω      | 1.70 Ω    | 6.8 Ω                                           | 27.2 Ω    |
| Passband SPL, 1 m, half space                    | 88.82 dB   | 100.87 dB | 100.87 dB                                       | 88.82 dB  |
| SPL against Parallel, every frequency            |            | 0         | 0.000 dB                                        | −12.041 dB|
| Excursion against Parallel                       |            | 1         | ×1                                              | ×0.25     |
| VA at high frequency (V²/load)                   | 1.178      | 4.711     | 4.711                                           | 0.2944    |

Series with the switch ticked: chart 36.267 Ω peak, 6.8 Ω at high frequency; every other row as Series.

Passband SPL = ρ·BL·eg·Sd/(2π·Mms·Re) at 1 m. Power entered instead (4.7111 W): voltage readout Parallel 2.83 V,
Series 11.32 V; SPL equal. With Rg 0.5 Ω at the amplifier, voltage 2.83 V: power Parallel 3.6404 W
(= 4·2.83²/(6.8+2.0)), Series 0.28913 W (= 4·0.7075²/(6.8+0.125)).

The absolute SPL values hang on the air model; goldens assert them to 0.05 dB and every ratio to 1e-9 dB.

## 8. Tests (all written first, each failing on the code before its PR)

**Unit, engine**
- `driverDrive` table: N 4, 2.83 V, Rg 0.5, both placements × both wirings, expected (eg, Rg, loadScale) = par/amp
  (2.83, 2.0, 0.25), par/drv (2.83, 0.5, 0.25), ser/amp (0.7075, 0.125, 4), ser/drv (0.7075, 0.5, 4). N 1: identity.
- Signal solve: the power and voltage rows of section 7, both directions, with and without Rg, with "Re without Rg".
- Architecture: one site for the N-scaling of eg/Rg/load (`driverWiring.ts`); `winisdOneDriverImpedance` read only in
  the sweep's impedance line; the coil conversion and `driverDrive` never read each other's inputs.

**Engine goldens** (`packages/design/test/engine/`, new `driver-wiring-goldens.test.ts`; DA215-8 sealed, Vb 4 × 40 L)
- Parallel + "Impedance of one driver", Rg 0 or Rg at the driver: equal to PR 138's goldens (`sealed-2drv.json`,
  `vented-2drv.json` setups) byte for byte. This is "WinISD = Parallel plus the one-driver chart" in a test.
- The switch, in each wiring: every output array equal byte for byte except `zmag`; `zmag` ×N (parallel) or ÷N
  (series) against unticked.
- Series vs Parallel: SPL −12.041 dB at every point, excursion ×0.25, vented port velocity ×0.25, zmag ×16, zph equal.
- Impedance peak 9.067 / 145.07 Ω with a lossless box (Ql, Qa very high) to 0.1 %; high-frequency impedance
  1.70 / 27.2 Ω to 1 %.
- Passband SPL 100.87 / 88.82 dB to 0.05 dB.
- Rg 0.5 Ω table of section 5.3, passband level to 0.01 dB.
- Maximum SPL and maximum power equal across both wirings at Rg 0.
- MX12-22 coil × driver wiring table of section 6 (both chart columns) and the −6.021 dB.

**Data**
- `schema-version-6-driver-wiring.test.ts`: a v5 file loads with Parallel/off and is otherwise unchanged; a v7 file is
  refused with the "newer" message; old `wiring`/`VCCon` never becomes `driverWiring`; a saved
  `winisdDriverCountModel` never sets `winisdOneDriverImpedance`.
- Round trip `.owpr` and storage keeps both keys; a count change never writes `driverWiring`.
- `.wpr` import gives Parallel/off; `.wpr` export writes `Nd` and `P`, no wiring.
- `compat-switch.test.ts`: the new switch is an option, off for a new project and for a file that does not say.
- `every-input-recalculates.test.ts`: both new inputs move the sweep.
- Field registry: labels; Driver wiring help equal to section 4.4; switch help equal to the approved text.

**Browser specs, both skins** (`packages/ui/test/ui/`)
- Driver wiring row absent at 1 driver, present at 2; choosing Series moves the impedance chart and the SPL by
  −20·log10(N); saved and reloaded.
- Switch ticked: the impedance chart shows one driver's values, the SPL chart does not move, Driver wiring stays
  editable; switch greyed at 1 driver.
- Signal tab voltage label follows the driver count (desktop, after Q1).
- Layout gate and stable-columns specs pass with the new row shown and hidden.
- Pictures: desktop and phone Driver tab at 4 drivers (Parallel, Series), Advanced tab with the new switch, impedance
  chart unticked and ticked. Looked at by the lead before review, then shown to John.

## 9. Out of scope

- Series-parallel and mixed driver types (QO946.c13).
- Reproducing WinISD's per-driver Rg with Rg at the amplifier (section 5.3; QO946.c131: only the impedance chart has a
  WinISD switch).
- Iso-Barik wiring (QO941.c16; the Iso-Barik radio is "not modelled", `OriginalShell.vue:471`). Driver wiring counts the
  N positions as the box models them.
- A low-load warning (for example 0.25 Ω in section 6), an "amplifier voltage needed" readout, an amplifier power or
  current limit.
- Asking Driver wiring in the New Project wizards (QO946.c142-c143).
- Any change to how one driver is simulated, or to Coil wiring.

## 10. Open questions for John

- **Q1. Signal-tab wording (open).** Proposed: desktop voltage label "Amplifier voltage" when Driver wiring is in use
  (2+ drivers), "Voltage at each driver" otherwise. Phone "Volts" help stays "the amplifier output voltage. Power and
  Volts set each other." Yes, or other words?

Decided (QO946.c142-c143): Driver wiring stays out of the New Project wizards (was Q2); the help text of "Impedance of
one driver" is John's, section 4.4 (was Q3).

## 11. Order of work (small PRs, each tested first; after PR 138 and PR 137 are merged)

1. **Engine, inert.** `engine/array/driverWiring.ts`, `SweepParams` fields, sweep / maxCurves / signal use
   `driverDrive`; absent `driverWiring` = today's path, so every existing golden is unchanged. Unit tests, engine
   goldens, architecture test.
2. **Data, inert.** Schema v6 step, `driverWiring` and `winisdOneDriverImpedance` keys, facade fields, `CompatSwitch`
   default exception, `.owpr`/`.wpr` round trips. Saved and loaded but not yet passed to the engine.
   `openisdSchema.ts` is a driver model file: the task file names `ruling: QO946` (c129-c131) or the PR check refuses
   it. This repo's `CLAUDE.md` says a new project has "every option ticked"; the same PR adds an allowance line there
   for this switch (QO946.c131), without removing the rule.
3. **Feature on.** Pass both fields into `sweepParamsOf` and the signal solve; remove the engine's absent-field path;
   Driver tab control and Advanced switch on both skins; signal label (after Q1); help texts of section 4.4. Regenerated
   goldens differ only in multi-driver `zmag` (proof in the PR). Browser specs and pictures. Held for John's pictures.
4. **Docs.** `FEATURES.md`, the WinISD differences list (`OPENISD_WINISD_GAPS_AND_BUGS.md`,
   `packages/design/fields/winisdDeviation.ts`), `docs/FIELD_REFERENCE.md`, `docs/research/WINISD_PARITY.md`; close
   #519.
