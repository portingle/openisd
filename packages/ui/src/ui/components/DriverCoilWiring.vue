<script setup lang="ts">
// The project's one wiring control (QO941): "Coil wiring" on both skins (John, QO942.c12).
// It is the use the project makes of the driver's coils; the maker's measured wiring is the driver's data and
// is not shown here, nor anywhere outside the Driver editor (John, QO942.c9). Under the control, one line: the coil count and the figures in use.
// Display and wiring only: the words and the conversion come from packages/design through useDriverCoilWiring().
import UIPickField from './UIPickField.vue';
import {EnumField} from '@openisd/design/fields';
import {useDriverCoilWiring} from '../../hooks/DriverCoilWiring-hooks.js';

const props = defineProps<{phone?: boolean}>();
const {shown, disabled, options, mine, inUseLine, onSelect} = useDriverCoilWiring(props.phone === true);
</script>

<template>
  <template v-if="shown && phone">
    <div class="mob-crow">
      <label class="mob-crow-label" for="mob-coil-wiring">{{ EnumField.VCCON.label }}</label>
      <select id="mob-coil-wiring" class="mob-cselect" :value="mine" @change="onSelect">
        <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <p class="coil-wiring-note" data-testid="coil-wiring-figures">{{ inUseLine }}</p>
  </template>
  <template v-else-if="shown">
    <div class="field-row" style="margin-bottom:4px;">
      <UIPickField class="field" common :label="EnumField.VCCON.label" input-id="og-coil-wiring">
        <select id="og-coil-wiring" :value="mine" :disabled="disabled" @change="onSelect">
          <option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option>
        </select>
      </UIPickField>
    </div>
    <p v-if="!disabled" class="coil-wiring-note" data-testid="coil-wiring-figures">{{ inUseLine }}</p>
  </template>
</template>

<style scoped>
.coil-wiring-note { max-width: 320px; margin: 2px 0 4px; font-size: 12px; line-height: 16px; color: #555; overflow-wrap: anywhere; }
.mob-crow ~ .coil-wiring-note { max-width: none; padding: 4px var(--mob-edge); margin: 0; box-shadow: inset 0 -1px 0 #e6e6e6; font-size: 13px; line-height: 18px; }
</style>
