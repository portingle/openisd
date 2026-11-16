<script setup lang="ts">
// The editor "+ Define new passive radiator" opens: a NEW, blank radiator, its name box focused,
// its eight figures. Only the radiator's own figures are here; the project's choices (count, added mass, tuning) are not. OK files it
// in My passive radiators (as a new driver goes to My Drivers) and never touches the project; Cancel, Esc
// and a click outside leave everything as it was. The hook holds the draft and files it.
// (Issue 522: the button used to swap a blank radiator into the project with no editor at all.)
import {onMounted, ref} from 'vue';
import type {PassiveRadiatorStepCells} from '../../hooks/OriginalNewProject-hooks.js';
import {NumberField, TextField} from '@openisd/design/fields';
import UIField from './UIField.vue';
import {inputValue} from '../../logic/domEvents.js';
import {useEscToClose} from '../../logic/useEscToClose.js';

defineProps<{ cells: PassiveRadiatorStepCells; phone?: boolean }>();
const emit = defineEmits<{ ok: []; cancel: []; rename: [string] }>();

const nameEl = ref<HTMLInputElement | null>(null);
onMounted(() => { nameEl.value?.focus(); });
useEscToClose(() => true, () => emit('cancel'));
// OK needs a name: the radiator is filed and shown under it.
const name = ref('');
function rename(e: Event): void { name.value = inputValue(e); emit('rename', name.value); }
function ok(): void { if (name.value.trim() !== '') emit('ok'); }
</script>

<template>
  <div class="prd-scrim" @click.self="emit('cancel')">
    <div class="prd-panel" :class="{'prd-phone': phone}" role="dialog" aria-label="Define new passive radiator">
      <h3>Define new passive radiator</h3>
      <p class="prd-note">A new, blank passive radiator: only what the maker publishes. OK files it in your passive radiators; the project keeps its own until you pick it from the list.</p>
      <label class="prd-name">{{ TextField.PR_NAME.label }}
        <input ref="nameEl" id="pr-define-name" type="text" :value="name" placeholder="e.g. Dayton SD270A-88" @input="rename" @keydown.enter="ok">
      </label>
      <div class="prd-fields">
        <UIField :class="phone ? 'mob-ui-field' : undefined" input-id="pr-define-vas" :field="NumberField.PR_VAS_L" :cell="cells.Vas_m3" />
        <UIField :class="phone ? 'mob-ui-field' : undefined" input-id="pr-define-qms" :field="NumberField.PR_QMS" :cell="cells.Qms" />
        <UIField :class="phone ? 'mob-ui-field' : undefined" input-id="pr-define-fs" :field="NumberField.PR_FS_HZ" :cell="cells.Fs_hz" />
        <UIField :class="phone ? 'mob-ui-field' : undefined" input-id="pr-define-sd" :field="NumberField.PR_SD_CM2" :cell="cells.Sd_m2" />
        <UIField :class="phone ? 'mob-ui-field' : undefined" input-id="pr-define-mms" :field="NumberField.MMS_KG" :cell="cells.Mms_kg" />
        <UIField :class="phone ? 'mob-ui-field' : undefined" input-id="pr-define-cms" :field="NumberField.CMS_M_PER_N" :cell="cells.Cms_m_per_N" />
        <UIField :class="phone ? 'mob-ui-field' : undefined" input-id="pr-define-rms" :field="NumberField.RMS_KG_PER_S" :cell="cells.Rms_kg_per_s" />
        <UIField :class="phone ? 'mob-ui-field' : undefined" input-id="pr-define-xmax" :field="NumberField.PR_XMAX_MM" :cell="cells.Xmax_m" />
      </div>
      <div class="prd-foot">
        <button type="button" class="pri prd-ok" :class="phone ? 'mob-btn mob-btn-primary' : undefined" :disabled="name.trim() === ''" @click="ok">OK</button>
        <button type="button" class="prd-cancel" :class="phone ? 'mob-btn mob-btn-plain' : undefined" @click="emit('cancel')">Cancel</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prd-scrim { position: fixed; inset: 0; z-index: 1300; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, .35); }
.prd-panel {
  box-sizing: border-box; width: 460px; max-width: calc(100% - 24px); max-height: calc(100% - 24px); overflow-y: auto;
  background: var(--panel); color: var(--fg); border: 1px solid var(--line); box-shadow: 0 6px 22px rgba(0,0,0,.35);
  padding: 14px 16px; display: flex; flex-direction: column; gap: 8px;
}
.prd-panel h3 { margin: 0 0 2px 0; font-size: 14px; font-weight: 600; }
.prd-note { margin: 0; font-size: 11px; line-height: 1.45; color: var(--mut); }
.prd-name { display: flex; align-items: center; gap: 10px; font-size: 12px; font-weight: 600; color: var(--mut); }
.prd-name input { flex: 1 1 auto; min-width: 0; box-sizing: border-box; padding: 6px 10px; font-size: 13px; border: 1px solid var(--line); border-radius: 4px; background: var(--panel); color: var(--fg); }
.prd-fields { display: flex; flex-direction: column; gap: 4px; }
.prd-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
.prd-foot .pri { background: var(--acc); color: #fff; border-color: var(--acc); }
.prd-foot button:disabled { opacity: .5; cursor: default; }
.prd-phone { width: min(340px, 100%); padding: 16px; border-radius: 8px; gap: 10px; }
.prd-phone .prd-name { flex-direction: column; align-items: stretch; gap: 4px; }
.prd-phone .prd-foot { gap: 8px; }
.prd-phone .prd-foot button { flex: 1 1 0; }
.prd-phone .prd-cancel { order: -1; }
</style>
