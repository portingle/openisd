# Plan: Driver wiring (several drivers wired to the amplifier), ticket #519

Written 16 Nov 2026 for John, who asked (16 Nov, 12:53 UTC): "ok what is a good design for this feature? / plan a good
functioning and data design for it". This is a design only. No product code is in this branch.

Decisions this plan is bound by are cited by their `questions.yml` id (thread QO946) or the ticket comment
(Johnlon/openisd#519, "Design approved by John, 16 Nov 2026"). Code is cited as `file:line` on **PR 137's head
(`portingle/t838`, stacked on PR 138)**, because the feature is built on top of both: PR 138 makes several drivers
behave exactly as WinISD, PR 137 renames the project's old `wiring` key to `VCCon` (the coil wiring). Lines that exist
only on `portingle/main` (5b9666b8) say so.

## 1. What is decided (do not reopen)

- OpenISD replicates WinISD. WinISD has no driver wiring: with Nd drivers it uses Vas×Nd and Sd×Nd in one shared Vb,
  feeds each driver P/Nd, never scales Re or BL by Nd, and draws ONE driver's impedance
  (`winisd_research/findings/FINDING_20261115_voice-coil-connection-and-driver-count-in-the-code.md`). PR 138 makes
  OpenISD do exactly that.
- New project option **"Driver wiring"**: Parallel / Series only. Shown only with 2 or more drivers. Default
  **Parallel**. A project setting, never part of the driver record. No series-parallel, no mixed driver types (QO946.c13,
  "forget that").
- New switch **"Share power between drivers"** in the non-yellow **"Enable WinISD-style"** group, **off by default**.
  Ticked = WinISD's behaviour, Driver wiring ignored (QO946.c69-c76, ticket comment of 16 Nov 04:00).
- Accepted: multi-driver projects show different results from WinISD unless the switch is ticked (QO946.c72).
- Help texts approved by John; they are copied into the field registry **exactly** (section 4.4).
- Not the same thing as **Coil wiring** (the voice coils inside one driver; driver `VCCon` = how the maker measured,
  project `VCCon` = how the user wires the coils; PR 137, QO946.c18/c23). The new feature has its own field name.
- Standing rules: the engine does the calculations; no stored value is ever overwritten; tests first; WinISD `.wpr`
  files carry no driver wiring.

## 2. The physics, and a correction to the ticket's example

An amplifier is a voltage source V with an output (source) resistance Rg (QO946.c50-c53). N identical drivers, each of
impedance Z (Z already includes the user's Coil wiring, see section 6). By symmetry every driver does the same thing, so
each driver can be replaced by a one-driver circuit with its own EMF and its own series resistance (Thevenin):

| Wiring | Rg placement | EMF each driver sees | Rg each driver sees | Load the amplifier sees |
|---|---|---|---|---|
| Parallel | at the amplifier | V | N·Rg | Z/N (plus Rg) |
| Series | at the amplifier | V/N | Rg/N | N·Z (plus Rg) |
| Parallel | at each driver | V | Rg | (Z+Rg)/N |
| Series | at each driver | V/N | Rg | N·(Z+Rg) |
| Share power ticked (WinISD) | either | V each (the field's meaning) | Rg | one driver's Z |

"Rg is at driver side" already exists (Advanced tab, `adv_RgAtDriverSide`, schema
`packages/design/domain/openisdSchema.ts:844`, circuit `packages/design/engine/circuit.ts:82,128`). The ticket's
"Rg acts on the whole load (parallel N·Rg, series Rg/N)" is the at-the-amplifier row. With Rg at each driver, the wiring
does not change what Rg does. Both rows follow from the circuit; nothing here needs a ruling.

**Correction to the example in QO946.c66 and the ticket** ("4 drivers, same voltage: parallel highest SPL, WinISD-style
6 dB lower, series 12 dB lower"). Worked through (DA215-8 ×4, Rg 0, section 7):

- At the **same amplifier voltage**, series is 12.04 dB below parallel. Correct.
- WinISD's voltage field is the voltage **at each driver** ("Driver input voltage (each)",
  `packages/design/fields/field.ts:597` on main). Typed 2.83 V, WinISD drives each driver at 2.83 V, which is exactly
  what Parallel does at an amplifier voltage of 2.83 V. **Same SPL, 0 dB.**
- At the **same typed power**, all three give the same SPL: identical drivers share the power equally whatever the
  wiring; only the amplifier voltage needed differs (parallel 1.415 V, series 5.66 V for 1.178 W).
- WinISD-style is 6 dB below parallel only if it is fed the power ONE driver would draw at the amplifier's voltage
  (1.178 W = 2.83²/6.8) while parallel draws 4.71 W. That is not a comparison any user makes.

Consequence for John's acceptance (QO946.c72): with the default (Parallel, switch off) and Rg 0 or Rg at the driver
side (the default placement), an existing multi-driver project keeps **every SPL, excursion, port-velocity, VA and
maximum curve**; only the **impedance chart** changes, to the amplifier's load Z/N (which is what OpenISD drew before
PR 138). SPL changes only with Series, or with Rg > 0 at the amplifier.

## 3. User-facing behaviour

### 3.1 The "Driver wiring" control

- **Desktop**, Driver tab, left column, directly under "Num. of drivers"
  (`packages/ui/src/ui/shells/original/OriginalShell.vue:468`), above the Standard/Iso-Barik radios and the Coil
  wiring control (`DriverCoilWiring`, line 475). A select: `Driver wiring  [Parallel | Series]`.
- **Phone**, Driver tab, directly under "Drivers" (`packages/ui/src/ui/shells/mobile/MobileDriverTab.vue:27`), above
  Coil wiring (line 28). Same label, same two choices.
- **Shown only when Num. of drivers is 2 or more** (approved). At 1 driver the row is not drawn on either skin.
- **With "Share power between drivers" ticked** the wiring is not used. Same pattern as Coil wiring (QO942.c88-c91):
  desktop shows the select disabled, with a click-catcher that shows "Driver wiring is not used while 'Share power
  between drivers' is ticked (Advanced tab)."; phone omits the row.
- Changing the number of drivers never changes the stored wiring (4 → 1 → 4 brings back the user's Series).
- New component `packages/ui/src/ui/components/DriverWiring.vue` with hooks `DriverWiring-hooks.ts`, built like
  `DriverCoilWiring.vue` / `DriverCoilWiring-hooks.ts`, used by both skins.
- Not in the New Project wizards: a new project with 2+ drivers starts Parallel and is changed on the Driver tab
  (open question Q2).

### 3.2 The "Share power between drivers" switch

- **Desktop**: Advanced tab, "Enable WinISD-style" group, after "Simplified ABC intra-port velocity"
  (`OriginalShell.vue:637-648`). **Phone**: `MobileAdvancedTab.vue:46-59`, same group, same place.
- Unticked by default (approved). Editable only with 2+ drivers; greyed (`compat-switch-na`, as the ABC intra-port
  switch) at 1 driver, where it changes nothing.
- Ticked: today's WinISD path exactly (PR 138): power shared P/N, voltage field = each driver, impedance chart = one
  driver, Driver wiring ignored.

### 3.3 Signal tab: what the voltage and power mean

The stored pair `signal.power_W` / `signal.voltage_V` keeps whichever the user entered (no stored value is changed by
this feature). What the voltage **means** follows the mode:

| Mode | Voltage field means | Power field means |
|---|---|---|
| 1 driver, or switch ticked | the voltage at each driver (WinISD) | system input power, shared P/N |
| 2+ drivers, switch off | the **amplifier's output voltage** | the power the amplifier delivers into the drivers (and Rg) |

- Desktop label of the voltage field: "Driver input voltage (each)" (WinISD's) in the first mode; "Amplifier voltage"
  in the second (proposed; Q1). Power label "System input power" unchanged in both.
- Phone label "Volts" unchanged. Its help today says "the amplifier output voltage"
  (`packages/design/fields/phoneText.ts:154`), which is wrong in WinISD mode with 2+ drivers; the help becomes
  mode-dependent (proposed text in Q1).
- In Parallel the two meanings are the same number, so a default project's figures do not move.
- Entered voltage + switch Parallel → Series: the amplifier voltage stays, each driver gets V/N, SPL −20·log10(N).
- Entered power + switch Parallel → Series: the power stays, the voltage readout becomes N times higher; SPL unchanged
  at Rg 0.
- No new readout line ("Amplifier load", "each driver gets"): John ruled the coil-wiring figures line out because the
  charts show it (A5, QO946.c34-c35). The same holds here.

### 3.4 How the charts change (switch off, versus switch ticked)

| Chart | Parallel | Series | Notes |
|---|---|---|---|
| Impedance (magnitude) | one driver's ÷ N | one driver's × N | It is the amplifier's load. Phase unchanged. Frequencies of peaks/minimum unchanged. |
| SPL, Transfer function level | as WinISD at the same typed voltage | −20·log10(N) at the same amplifier voltage | Shape changes only through Rg at the amplifier. |
| Cone excursion, port / PR velocity, PR excursion | as WinISD | × 1/N | at the same amplifier voltage |
| Amplifier apparent load power (VA) | N × (per driver) | N × (per driver) | per driver at its own EMF; parallel 16× series at the same voltage |
| Maximum SPL, Maximum power | unchanged | unchanged | power-limited and excursion-limited: wiring-neutral at Rg 0 (QO946.c45) |
| Group delay, phase | unchanged at Rg 0 | unchanged at Rg 0 | Rg at the amplifier changes Qes′, so they move with Rg > 0 |
| EQ/Filter charts | unchanged | unchanged | line level |

Compare traces: each project's trace is drawn with its own wiring and switch.

## 4. Data design

### 4.1 Fields

| Where | Key | Values | Default | Meaning |
|---|---|---|---|---|
| `driverEmbedding` | **`driverWiring`** | `'parallel'` \| `'series'` | `'parallel'` | how the project's N drivers are wired to the amplifier |
| `advanced` | **`winisdSharedDriverPower`** | boolean | `false` | "Share power between drivers" (WinISD's way) |

- **`driverWiring`**: beside `nDrivers` and `VCCon` in `openISDDriverEmbeddingJsonSchema`
  (`openisdSchema.ts:922-946`), whose comment already says this section holds "how many units, how they're wired
  together". It is unmistakably not `VCCon` (coil wiring) and not the retired `wiring`. Values are the same strings
  as `VCCon` (QO946.c18: names, not 1/2).
- **`winisdSharedDriverPower`**: follows the switch naming rule `winisd<calculation>` of the Advanced section
  (`openisdSchema.ts:858-896`). Field `ToggleField.ADV_WINISDSHAREDDRIVERPOWER`, value key
  `adv_WinisdSharedDriverPower`; `CompatSwitch.SHARED_DRIVER_POWER`, kind `'option'`
  (`packages/design/domain/project/compatSwitch.ts:29-31`).
- **Exception to state in code**: `CompatSwitch.winisdValue` makes every option ticked for a new project and for a file
  that does not say (`compatSwitch.ts:33-40`; schema comment `openisdSchema.ts:858-860`). This switch is the first
  option that is **off** by default (John, QO946.c76). `CompatSwitch` gets a per-switch `defaultValue` (bugs false,
  options true, this one false) and the comment cites QO946.c76. A test pins it.
- Both keys are **optional in the schema**; absent means Parallel and off. Every save writes both, also at 1 driver, so
  a later count change brings back the user's choice.
- Project facade: `OpenISDProject.driverWiring` and `OpenISDProject.winisdSharedDriverPower`
  (`packages/design/domain/project/openISDProject.ts`, next to `nDrivers` at :175 and `winisdWrapPhase` at :322),
  passed into `ProjectSweepSource` (`packages/design/domain/project/projectSweep.ts:26-59`, `sweepParamsOf` :77-120)
  and into `ProjectSignal` (`openISDProject.ts:712-722`, `projectSignal.ts:26-42`).

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

### 4.4 Help texts (exact, from the ticket; field registry `packages/design/fields/field.ts`)

`EnumField.PROJECT_DRIVERWIRING`, value `project_driverWiring`, label "Driver wiring", options Parallel/Series:

> How the drivers are connected to the amplifier. Parallel: each driver gets the full amplifier voltage; the load is
> one driver's impedance divided by the number of drivers (4 × 8 Ω → 2 Ω). Series: the voltage is split between the
> drivers; the load is the impedance times the number (4 × 8 Ω → 32 Ω). This changes the impedance chart, the SPL and
> excursion for a given amplifier voltage, and how Rg acts. Not the same as Coil wiring, which connects the voice coils
> inside one driver.

`ToggleField.ADV_WINISDSHAREDDRIVERPOWER`, label "Share power between drivers":

> WinISD's way. The input power is shared equally between the drivers, whatever their wiring, and the impedance chart
> shows one driver. But a real amplifier delivers a voltage, not a power: the power the drivers actually get, and the
> load the amplifier sees, depend on how they are wired, and this switch hides that. Untick to use Driver wiring: the
> charts then show what your amplifier really sees at its voltage.

A test compares both strings character for character with this section. Phone short lines, if the phone help needs
them, go to John for approval (Q1).

### 4.5 `.owpr`, `.wpr`

- **`.owpr` / browser storage**: both keys saved and loaded as they are; round trip test.
- **`.wpr` import** (`packages/design/domain/winIsdProjectConverter.ts:591-596`): WinISD files have no driver wiring.
  The project gets the defaults (Parallel, switch off). The file's `[SignalSource] P` is the total power; in Parallel
  each driver gets P/N, the same as in WinISD, so SPL, excursion and port velocity equal WinISD's at Rg 0 or Rg at the
  driver side. Only the impedance chart differs (the amplifier's load). This is the accepted difference (QO946.c72).
- **`.wpr` export** (`winIsdProjectConverter.ts:280-320`): writes `Nd` and `P` (the system input power) as today; no
  wiring key exists to write. WinISD shares that P equally, which is what identical drivers get in either wiring, so the
  `.wpr` reproduces the project's SPL in WinISD at Rg 0. With Rg at the amplifier and Rg > 0 WinISD's result differs
  (it has no array Rg); listed in the differences, not worked around.

## 5. Engine design

### 5.1 One function, in the engine

New file `packages/design/engine/array/driverWiring.ts`, the **only** place that turns an amplifier voltage and Rg into
what each driver sees (an architecture test refuses a second site, as PR 137's
`architecture-coil-wiring-arithmetic-has-one-site.test.ts`):

```ts
export type DriverWiring = 'parallel' | 'series';
/** What ONE of n identical drivers sees, as a one-driver circuit (Thevenin), and how its impedance maps to the amplifier's load. */
export interface DriverDrive { readonly eg_V: number; readonly Rg_ohm: number; readonly loadScale: number }
export function driverDrive(n: number, wiring: DriverWiring, sharedPower: boolean,
                            amp_V: number, Rg_ohm: number, rgAtDriverSide: boolean): DriverDrive
```

- `n ≤ 1` or `sharedPower`: `{eg: amp_V, Rg: Rg_ohm, loadScale: 1}`. This is PR 138's WinISD path, byte for byte.
- Parallel: `eg = amp_V`, `loadScale = 1/n`, `Rg = rgAtDriverSide ? Rg : n·Rg`.
- Series: `eg = amp_V/n`, `loadScale = n`, `Rg = rgAtDriverSide ? Rg : Rg/n`.

### 5.2 Where it is used

- `SweepParams` (`packages/design/engine/types.ts:182-190, 319`) gains `driverWiring?: DriverWiring` and
  `winisdSharedDriverPower?: boolean`. `eg`'s doc becomes "the amplifier voltage; the voltage each driver gets when
  N = 1 or power is shared". Absent `driverWiring` = shared power, so the engine PR (PR 1) changes nothing until the
  project passes the fields (PR 3).
- **Sweep**, the N > 1 branch (`packages/design/engine/simulation/SimulationEngine.ts:455-470`): today it sweeps one
  driver in Vb/N (`oneBoxOfN`, :217) at `eg` and scales SPL +20·log10(N) and VA ×N. New: compute
  `d = driverDrive(...)` once, sweep the one driver with `{...oneBoxOfN(P, n), eg: d.eg_V, Rs: d.Rg_ohm}`, then the
  same SPL and VA scaling plus `zmag × d.loadScale`. Nothing else in the loop changes: per-driver excursion, port
  velocity (port area is already /N), VA = N × one driver's EMF²·|Hf|²/|Z+Rg| (this is exactly the amplifier's apparent
  power in both wirings), group delay and transfer function come out right.
- The one-driver circuit (`packages/design/engine/circuit.ts:82-145`) is **not touched**. Its own `rgAtDriverSide`
  rule already keeps Rg out of the chart for Rg at the amplifier and in it for Rg at the driver, which is what `zmag ×
  loadScale` needs.
- **Maximum curves**, N > 1 branch (`SimulationEngine.ts:697-705`): pass `Rs: d.Rg_ohm` to the one-driver call;
  max power and max SPL are N × one driver's limits, wiring-neutral at Rg 0.
- **Signal engine** (`packages/design/engine/signal/SignalEngine.ts:54-73`): `SignalSolverParams` gains the wiring
  inputs; power from voltage becomes `P = N · driveFromVoltage(d.eg_V, Re, d.Rg_ohm)` and voltage from power
  `amp_V = k · driveVoltage(P/N, Re, d.Rg_ohm)` with k = N for series, else 1, both through `driverDrive`. With
  shared power this is today's `P = N·V²/(Re+Rg)`. The "Re without Rg" bug switch keeps working (`Rg = 0` → `d.Rg = 0`).
- `ProjectSignal` (`packages/design/domain/project/projectSignal.ts:64, 90-96`) divides by N itself today; it calls the
  engine's function instead, so no arithmetic stays in the domain.

### 5.3 Rg, worked

DA215-8, 4 drivers, Rg 0.5 Ω, passband level relative to Rg 0 = 20·log10(Re/(Re+Rg_each)):

| | Rg each driver sees | passband level | Qes′ = Qes·(Re+Rg)/Re |
|---|---|---|---|
| Parallel, Rg at amplifier | 2.0 Ω | −2.239 dB | 0.582 |
| Series, Rg at amplifier | 0.125 Ω | −0.158 dB | 0.458 |
| Shared power (WinISD) | 0.5 Ω | −0.616 dB | 0.483 |
| Either wiring, Rg at driver | 0.5 Ω | −0.616 dB | 0.483 |

## 6. Together with Coil wiring

Order: **Coil wiring first, per driver; Driver wiring second, on N copies of that driver.** The coil conversion is
PR 137's single site (`convertWiring`, called from `OpenIsdDriverSpec.terminalMotor`); its result is the one driver
the sweep sees. `driverDrive` never reads `VCCon` or `numVC`, and the coil conversion never reads `driverWiring` or N.
A test asserts both directions.

Example, Dayton MX12-22 (2 coils, measured in series: Re 3.95 Ω, BL 21.5, Qes 0.39, Qms 3.25), 4 drivers, VCInd off,
lossless box (impedance peak = Re·(1+Qms/Qes), box-independent):

| Coil wiring | Driver wiring | One driver Re / BL | Amp load at high frequency | Amp load at the peak |
|---|---|---|---|---|
| Series (as measured) | Parallel | 3.95 Ω / 21.5 | 0.9875 Ω | 9.217 Ω |
| Parallel | Series | 0.9875 Ω / 10.75 | 3.95 Ω | 36.867 Ω |
| Parallel | Parallel | 0.9875 Ω / 10.75 | 0.247 Ω | 2.304 Ω |
| Series | Series | 3.95 Ω / 21.5 | 15.8 Ω | 147.47 Ω |

SPL at 2.83 V, row 2 against row 1: force ∝ eg·BL/Re = (0.7075·10.75/0.9875)/(2.83·21.5/3.95) → **−6.021 dB**.

## 7. Worked numbers for the tests (Dayton DA215-8 ×4, 2.83 V)

DA215-8: Fs 34.9 Hz, Qes 0.45, Qms 1.95, Vas 42.7 L, Sd 211.2 cm², Re 6.8 Ω, Le 1.44 mH (bundled record
`packages/ui/public/drivers/dayton-audio/da215-8.json`). The circuit uses the BL and Mms implied by Fs, Vas, Qes, Re
(one-BL default): with ρ 1.204 kg/m³, c 343.2 m/s, Mms = 30.81 g, BL = 10.104 T·m.

Settings: sealed, 4 drivers, VCInd off (Le out), Rg 0 unless stated, Rg at driver side (default).

| Quantity | One driver | Shared power (WinISD), 2.83 V each | Parallel, amp 2.83 V | Series, amp 2.83 V |
|---|---|---|---|---|
| Voltage at each driver | 2.83 V | 2.83 V | 2.83 V | 0.7075 V |
| System input power | 1.1778 W | 4.7111 W | 4.7111 W | 0.29444 W |
| Impedance peak, lossless box (Re·(1+Qms/Qes)) | 36.267 Ω | 36.267 Ω | 9.067 Ω | 145.07 Ω |
| Impedance at high frequency (→ Re) | 6.8 Ω | 6.8 Ω | 1.70 Ω | 27.2 Ω |
| Passband SPL, 1 m, half space (ρ·BL·eg·Sd/(2π·Mms·Re)) | 88.82 dB | 100.87 dB | 100.87 dB | 88.82 dB |
| SPL against Parallel, every frequency | | 0.000 dB | 0 | −12.041 dB |
| Excursion against Parallel | | ×1 | 1 | ×0.25 |
| VA at high frequency (V²/load) | 1.178 | 4.711 | 4.711 | 0.2944 |

Power entered instead (4.7111 W): voltage readout shared 2.83 V each, Parallel 2.83 V, Series 11.32 V; SPL equal in all
three. With Rg 0.5 Ω at the amplifier, voltage 2.83 V: power Parallel 3.6404 W (= 4·2.83²/(6.8+2.0)), Series
0.28913 W (= 4·0.7075²/(6.8+0.125)).

The absolute SPL values hang on the air model; goldens assert them to 0.05 dB and every ratio to 1e-9 dB.

## 8. Tests (all written first, each failing on the code before its PR)

**Unit, engine**
- `driverDrive` table: N 4, 2.83 V, Rg 0.5, both placements × both wirings × shared, expected
  (eg, Rg, loadScale) = par/amp (2.83, 2.0, 0.25), par/drv (2.83, 0.5, 0.25), ser/amp (0.7075, 0.125, 4),
  ser/drv (0.7075, 0.5, 4), shared (2.83, 0.5, 1). N 1: identity for every input.
- Signal solve: the power and voltage rows of section 7, both directions, with and without Rg, with "Re without Rg".
- Architecture: one site for the N-scaling of eg/Rg/load (`driverWiring.ts`); the coil conversion and `driverDrive`
  never read each other's inputs.

**Engine goldens** (`packages/design/test/engine/`, new `driver-wiring-goldens.test.ts`; DA215-8 sealed, Vb 4 × 40 L)
- Shared power: equal to the PR 138 golden `sealed-2drv.json` / `vented-2drv.json` setup output, byte for byte.
- Parallel vs shared at 2.83 V: SPL, excursion, VA, group delay equal at every point; zmag ×0.25.
- Series vs parallel: SPL −12.041 dB at every point, excursion ×0.25, vented port velocity ×0.25, zmag ×16, zph equal.
- Impedance peak 9.067 / 145.07 Ω with a lossless box (Ql, Qa very high) to 0.1 %; HF impedance 1.70 / 27.2 Ω to 1 %.
- Passband SPL 100.87 / 88.82 dB to 0.05 dB.
- Rg 0.5 Ω table of section 5.3, passband level to 0.01 dB.
- Maximum SPL and maximum power equal across the three at Rg 0.
- MX12-22 coil × driver wiring table of section 6 and the −6.021 dB.

**Data**
- `schema-version-6-driver-wiring.test.ts`: a v5 file loads with Parallel/off and is otherwise unchanged; a v7 file is
  refused with the "newer" message; old `wiring`/`VCCon` never becomes `driverWiring`.
- Round trip `.owpr` and storage keeps both keys; a count change never writes `driverWiring`.
- `.wpr` import gives Parallel/off; `.wpr` export writes `Nd` and `P`, no wiring.
- `compat-switch.test.ts`: the new switch is an option, off for a new project and for a file that does not say.
- `every-input-recalculates.test.ts`: both new inputs move the sweep.
- Field registry: labels and both help texts equal section 4.4.

**Browser specs, both skins** (`packages/ui/test/ui/`)
- Driver wiring row absent at 1 driver, present at 2; choosing Series moves the impedance chart data ×4 per driver
  count and the SPL by −20·log10(N); saved and reloaded.
- Switch ticked: desktop select disabled and its click message shows; phone row gone; charts equal the shared path.
- Signal tab voltage label follows the mode (desktop).
- Layout gate and stable-columns specs pass with the new row shown and hidden.
- Pictures: desktop and phone Driver tab at 4 drivers (Parallel, Series), Advanced tab with the new switch, impedance
  chart before/after. Looked at by the lead before review, then shown to John.

## 9. Out of scope

- Series-parallel and mixed driver types (QO946.c13).
- Iso-Barik wiring (QO941.c16; the Iso-Barik radio is "not modelled", `OriginalShell.vue:471`). Driver wiring counts the
  N positions as the box models them.
- A low-load warning (for example 0.25 Ω in section 6), an "amplifier voltage needed" readout, an amplifier power or
  current limit.
- Asking Driver wiring in the New Project wizards (unless John says otherwise, Q2).
- Any change to how one driver is simulated, or to Coil wiring.

## 10. Open questions for John

- **Q1. Signal-tab wording in the two modes.** Proposed: desktop voltage label "Amplifier voltage" when 2+ drivers and
  the switch is off, WinISD's "Driver input voltage (each)" otherwise. Phone "Volts" help: "the amplifier output
  voltage. Power and Volts set each other." when 2+ drivers and the switch is off; "the voltage at each driver. Power
  and Volts set each other." otherwise (today's phone text is wrong for WinISD mode with 2+ drivers). Yes, or other
  words?
- **Q2. New Project wizard.** Leave Driver wiring out of the wizards (new projects start Parallel; change it on the
  Driver tab)? Recommended: yes, leave it out.

## 11. Order of work (small PRs, each tested first; after PR 138 and PR 137 are merged)

1. **Engine, inert.** `engine/array/driverWiring.ts`, `SweepParams` fields, sweep / maxCurves / signal use
   `driverDrive`; absent fields = shared power, so every existing golden is unchanged. Unit tests, engine goldens,
   architecture test.
2. **Data, inert.** Schema v6 step, `driverWiring` and `winisdSharedDriverPower` keys, facade fields, `CompatSwitch`
   default exception, `.owpr`/`.wpr` round trips. Saved and loaded but not yet passed to the engine.
   `openisdSchema.ts` is a driver model file: the task file names `ruling: QO946` (c69-c76) or the PR check refuses it.
   This repo's `CLAUDE.md` says a new project has "every option ticked"; the same PR adds an allowance line there for
   this switch (QO946.c76), without removing the rule.
3. **Feature on.** Pass both fields into `sweepParamsOf` and the signal solve; Driver tab control and Advanced switch on
   both skins; signal labels (after Q1); field registry help texts. Regenerated goldens differ only in multi-driver
   `zmag` (proof in the PR). Browser specs and pictures. Held for John's pictures.
4. **Docs.** `FEATURES.md`, the WinISD differences list (`OPENISD_WINISD_GAPS_AND_BUGS.md`,
   `packages/design/fields/winisdDeviation.ts`), `docs/FIELD_REFERENCE.md`, `docs/research/WINISD_PARITY.md`; close
   #519.
