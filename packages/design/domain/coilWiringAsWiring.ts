/**
 * schemaVersion 4 → 5 (QO941; John, QO942.c54: "the project already had a connection setting"): the project's `wiring` field,
 * which held the wiring of SEVERAL DRIVERS (usually the default "parallel"), now holds the wiring of the driver's own coils,
 * and `coilWiring` (added on 15 Nov 2026, never released) is gone. On a parsed JSON value, before the strict schema reads it,
 * at every depth: a session, or any record holding a `driverEmbedding`.
 *
 * For each project state (saved, edited):
 *   - `coilWiring` present: its value becomes `wiring`; the key goes.
 *   - otherwise `wiring` goes: its old meaning is not the coil wiring, and keeping it would rewire a series-measured driver
 *     to parallel without anyone choosing it.
 *   - the dropped array `wiring` is kept as `retiredArrayWiring` only for a project with more than one driver that had not
 *     ticked "Per-driver impedance" (it showed the array's impedance until now), so the project is told once that its
 *     impedance chart changed. Never applied.
 */
type PlainRecord = Record<string, unknown>;

function isRecord(v: unknown): v is PlainRecord {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isWiring(v: unknown): v is 'series' | 'parallel' {
    return v === 'series' || v === 'parallel';
}

/** One project state: a record with a `driverEmbedding` (and its sibling `advanced`). */
function stateWithCoilWiringAsWiring(state: PlainRecord): PlainRecord {
    const embedding = state.driverEmbedding;
    if (!isRecord(embedding)) return state;
    const {coilWiring, wiring: arrayWiring, ...rest} = embedding;
    const advanced = isRecord(state.advanced) ? state.advanced : {};
    const nDrivers = typeof rest.nDrivers === 'number' ? rest.nDrivers : 1;
    const perDriverImpedanceTicked = advanced.winisdDriverCountModel === true;
    const next: PlainRecord = {...rest};
    if (isWiring(coilWiring)) next.wiring = coilWiring;
    if (isWiring(arrayWiring) && nDrivers > 1 && !perDriverImpedanceTicked) next.retiredArrayWiring = arrayWiring;
    return {...state, driverEmbedding: next};
}

/** `value` with every project state's `wiring` as the coil wiring. `value` is not changed. */
export function withCoilWiringAsWiring(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(withCoilWiringAsWiring);
    if (!isRecord(value)) return value;
    const here = isRecord(value.driverEmbedding) ? stateWithCoilWiringAsWiring(value) : value;
    return Object.fromEntries(Object.entries(here).map(([key, v]) => [key, key === 'driverEmbedding' ? v : withCoilWiringAsWiring(v)]));
}
