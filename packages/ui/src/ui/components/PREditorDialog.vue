<script setup lang="ts">
// The passive-radiator editor (John, 16 Nov 2026, QO946.c115), both skins: the radiator's name and its own figures, with
// OK, Cancel and Save to My PRs. Opened by the Select popup's "+ Define new passive radiator" (a blank radiator), the
// phone Box tab's radiator row and the desktop Passive Radiator page's Edit button. The project's choices (count, added
// mass, tuning) are not here (QO946.c38). Thin: the editor object (hooks/passiveRadiatorEditor.ts) holds the copy.
import {onMounted, ref} from 'vue';
import type {PassiveRadiatorEditorView} from '../../hooks/passiveRadiatorEditor.js';
import type {PassiveRadiatorStepCells} from '../../hooks/OriginalNewProject-hooks.js';
import {NumberField, TextField, WinisdDeviation} from '@openisd/design/fields';
import UIField from './UIField.vue';
import {inputValue} from '../../logic/domEvents.js';
import {provideCellScope} from './cellScope.js';
import {PHONE_DRIVER_EDITOR_SKIN} from './driverEditorSkin.js';
import {useEscToClose} from '../../logic/useEscToClose.js';

const props = defineProps<{ editor: PassiveRadiatorEditorView; cells: PassiveRadiatorStepCells; phone?: boolean }>();
const {title, name, savedNote, canSave, setName, ok, cancel, saveToMyPRs} = props.editor;

// The copy's cells do not announce their writes (as the driver editor's draft), so this dialog is its own scope:
// without it a typed figure is committed but its box redraws blank.
const revision = ref(0);
provideCellScope({ revision, written: () => { revision.value++; } });

// A new radiator starts at its name; an existing one opens without the keyboard.
const nameEl = ref<HTMLInputElement | null>(null);
onMounted(() => { if (name.value === '') nameEl.value?.focus(); });
useEscToClose(() => true, cancel);
</script>

<template>
  <div class="prd-scrim" @click.self="cancel">
    <div class="prd-panel" :class="{'prd-phone': phone, 'mob-classic': phone}" role="dialog" :aria-label="title" :style="props.phone ? PHONE_DRIVER_EDITOR_SKIN.rowVars : undefined">
      <h3>{{ title }}</h3>
      <p class="prd-note">The passive radiator's own figures, as its maker publishes them. OK uses it in the project; Save to My PRs files a copy in your passive radiators. The number of radiators, added mass and tuning stay on the project's page.</p>
      <label class="prd-name">{{ TextField.PR_NAME.label }}
        <input ref="nameEl" id="pr-editor-name" type="text" :value="name" placeholder="e.g. Dayton SD270A-88" @input="e => setName(inputValue(e))" @keydown.enter="ok">
      </label>
      <div class="prd-fields">
        <UIField :class="phone ? 'mob-ui-field' : undefined" input-id="pr-editor-vas" :field="NumberField.PR_VAS_L" :cell="cells.Vas_m3" />
        <UIField :class="phone ? 'mob-ui-field' : undefined" input-id="pr-editor-qms" :field="NumberField.PR_QMS" :cell="cells.Qms" />
        <UIField :class="phone ? 'mob-ui-field' : undefined" input-id="pr-editor-fs" :field="NumberField.PR_FS_HZ" :cell="cells.Fs_hz" />
        <UIField :class="phone ? 'mob-ui-field' : undefined" input-id="pr-editor-sd" :field="NumberField.PR_SD_CM2" :cell="cells.Sd_m2" />
        <UIField :class="phone ? 'mob-ui-field' : undefined" input-id="pr-editor-mms" :field="NumberField.MMS_KG" :cell="cells.Mms_kg" :deviation="WinisdDeviation.PR_MMS_CMS_TYPING" />
        <UIField :class="phone ? 'mob-ui-field' : undefined" input-id="pr-editor-cms" :field="NumberField.CMS_M_PER_N" :cell="cells.Cms_m_per_N" :deviation="WinisdDeviation.PR_MMS_CMS_TYPING" />
        <UIField :class="phone ? 'mob-ui-field' : undefined" input-id="pr-editor-rms" :field="NumberField.RMS_KG_PER_S" :cell="cells.Rms_kg_per_s" />
        <UIField :class="phone ? 'mob-ui-field' : undefined" input-id="pr-editor-xmax" :field="NumberField.PR_XMAX_MM" :cell="cells.Xmax_m" />
      </div>
      <p v-if="savedNote" class="prd-saved" role="status">{{ savedNote }}</p>
      <div class="prd-foot">
        <button type="button" class="prd-save" :class="phone ? 'mob-btn mob-btn-secondary' : undefined" :disabled="!canSave" title="File a copy of this passive radiator in My passive radiators, under its name" @click="saveToMyPRs">Save to My PRs</button>
        <span class="prd-gap"></span>
        <button type="button" class="prd-cancel" :class="phone ? 'mob-btn mob-btn-plain' : undefined" @click="cancel">Cancel</button>
        <button type="button" class="pri prd-ok" :class="phone ? 'mob-btn mob-btn-primary' : undefined" @click="ok">OK</button>
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
/* One unit-chip width on the desktop, so the eight rows' boxes, chips and arrows line up (the app widens the chip of mm/N and Ns/m only). */
.prd-panel:not(.prd-phone) .prd-fields :deep(.ui-field) { --joined-chip: 60px !important; }
.prd-foot { display: flex; justify-content: flex-end; gap: 10px; margin-top: 6px; }
.prd-gap { flex: 1 1 auto; }
.prd-saved { margin: 0; font-size: 12px; color: var(--fg); }
.prd-foot .pri { background: var(--acc); color: #fff; border-color: var(--acc); }
.prd-foot button:disabled { opacity: .5; cursor: default; }
.prd-scrim:has(.prd-phone) { align-items: flex-end; }
/* Phone: the sheet is the screen's full width, as the driver editor is, so the classic phone row gets its value column. */
.prd-phone { width: 100%; max-width: 100%; max-height: 100%; padding: 14px 0 0; border-radius: 8px 8px 0 0; gap: 10px; }
.prd-phone h3, .prd-phone .prd-note, .prd-phone .prd-saved, .prd-phone .prd-name, .prd-phone .prd-foot { margin-left: 14px; margin-right: 14px; }
.prd-phone h3 { font-size: 16px; }
.prd-phone .prd-fields :deep(.ui-field) { --mob-chip: var(--mob-col-chip-wide) !important; }
.prd-phone .prd-name { flex-direction: column; align-items: stretch; gap: 4px; }
.prd-phone .prd-foot { gap: 8px; padding-bottom: 14px; }
.prd-phone .prd-foot button { flex: 1 1 0; }
.prd-phone .prd-foot { flex-wrap: wrap; }
.prd-phone .prd-gap { display: none; }
.prd-phone .prd-foot .prd-save { flex: 1 1 100%; }
</style>
