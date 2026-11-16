<script setup lang="ts">
// The project's one wiring control (QO941): "Coil wiring" on both skins (John, QO942.c12).
// It is the use the project makes of the driver's coils; the maker's measured wiring is the driver's data and
// is not shown here, nor anywhere outside the Driver editor (John, QO942.c9). The control writes only the project's wiring; no figure is shown or stored (John, QO946.c35).
// Display and wiring only: the words and the conversion come from packages/design through useDriverCoilWiring().
import UIPickField from './UIPickField.vue';
import {EnumField, WinisdDeviation} from '@openisd/design/fields';
import WinisdDeviationCue from './WinisdDeviationCue.vue';
import {useDriverCoilWiring} from '../../hooks/DriverCoilWiring-hooks.js';

const help = EnumField.PROJECT_VCCON.description;
const props = defineProps<{phone?: boolean}>();
const {shown, message, explain, disabled, options, mine, deviationShown, onSelect} = useDriverCoilWiring(props.phone === true);
</script>

<template>
  <template v-if="shown && phone">
    <div class="mob-crow">
      <label class="mob-crow-label" for="mob-coil-wiring">{{ EnumField.PROJECT_VCCON.label }}</label>
      <select id="mob-coil-wiring" class="mob-cselect" :value="mine" :title="help" @change="onSelect">
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
      <WinisdDeviationCue v-if="deviationShown" :deviation="WinisdDeviation.COIL_WIRING_RE_BL_ONLY" />
    </div>
  </template>
  <template v-else-if="shown">
    <div class="field-row" style="margin-bottom:4px;">
      <UIPickField class="field" common :label="EnumField.PROJECT_VCCON.label" input-id="og-coil-wiring" :title="help">
        <select id="og-coil-wiring" :value="mine" :aria-disabled="disabled" :class="{'coil-wiring-grey': disabled}" :title="help" @mousedown="e => { if (disabled) { e.preventDefault(); explain(); } }" @keydown.enter.space="e => { if (disabled) { e.preventDefault(); explain(); } }" @change="onSelect">
          <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
        <template v-if="deviationShown" #cue><WinisdDeviationCue :deviation="WinisdDeviation.COIL_WIRING_RE_BL_ONLY" /></template>
      </UIPickField>
    </div>
    <p v-if="disabled && message" class="coil-wiring-note" role="status" data-testid="coil-wiring-message">{{ message }}</p>
  </template>
</template>

<style scoped>
.coil-wiring-grey { color: GrayText; background: Field; opacity: 0.6; cursor: default; }
.coil-wiring-note { max-width: 320px; margin: 2px 0 4px; font-size: 12px; line-height: 16px; color: #555; overflow-wrap: anywhere; }
</style>
