/**
 * `DriverCoilWiring.vue`'s hook: the project's one wiring control, "Coil wiring" on both skins (John, QO942.c12).
 * (QO941). It reads and writes the focused project's `coilWiring`; the words and the
 * conversion come from `@openisd/design`. Its default is the driver's measured wiring, which is not shown.
 *
 * - A driver with more than one coil whose measured wiring is known: enabled, on both skins.
 * - A driver with one coil (or no coil count): the desktop shows it greyed, as WinISD does; the phone shows nothing.
 * - A driver whose measured wiring is not stated: nothing on either skin (John, 2026-11-15); the data-quality
 *   mark in the Driver editor is the only sign.
 */
import {computed} from 'vue';
import type {Wiring} from '@openisd/design/engine';
import {useFocusedProject} from '../logic/focusedProjectContext.js';
import {useApp} from '../logic/app.js';
import {selectedOption} from '../logic/domEvents.js';

export function useDriverCoilWiring(phone: boolean) {
  const {appState} = useApp();
  const project = useFocusedProject();
  const coil = computed(() => { void appState.projectChanged.value; return project.value.coilWiring; });

  const enabled = computed(() => coil.value.canChoose);
  const shown = computed(() => enabled.value || (!phone && coil.value.measuredBasis === 'single-coil'));
  const disabled = computed(() => !enabled.value);
  const options = computed(() => coil.value.options);
  /** The wiring in force; a greyed control reads Parallel, as WinISD's does with one coil. */
  const mine = computed<string>(() => coil.value.mine ?? 'parallel');
  /** "2 coils · Re 4.70 Ω · BL 12.30 Tm": the one line under the control. No datasheet wiring is named (QO942.c9). */
  const inUseLine = computed(() => coil.value.inUseLine);

  function choose(wiring: Wiring): void { coil.value.choose(wiring); }
  function onSelect(e: Event): void {
    const wiring = selectedOption(e, coil.value.options);
    if (wiring !== null) choose(wiring);
  }

  return {shown, disabled, options, mine, inUseLine, choose, onSelect};
}
