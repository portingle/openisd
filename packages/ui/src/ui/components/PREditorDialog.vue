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
// MOCK: the tab and the phone More menu.
const tab = ref<'general' | 'parameters'>(name.value === '' ? 'general' : 'parameters');
const more = ref(false);
useEscToClose(() => true, cancel);
</script>

<template>
  <div class="prd-scrim" :class="{'prd-phone-scrim': phone}" @click.self="cancel">
    <div class="prd-panel" :class="{'prd-phone': phone, 'mob-classic': phone}" role="dialog" :aria-label="title" :style="props.phone ? PHONE_DRIVER_EDITOR_SKIN.rowVars : undefined">
      <div class="prd-head"><h3>{{ title }}</h3><span class="prd-help">?</span><button type="button" class="prd-x" aria-label="Close" @click="cancel">&#10005;</button></div>
      <div class="prd-tabs">
        <button type="button" :class="{on: tab === 'general'}" @click="tab = 'general'">General</button>
        <button type="button" :class="{on: tab === 'parameters'}" @click="tab = 'parameters'">Parameters</button>
      </div>
      <div class="prd-legend"><i class="g"></i>Entered <i class="b"></i>Calculated <i class="k"></i>Not Available</div>
      <div class="prd-scroll">
        <template v-if="tab === 'general'">
          <div class="prd-band">General</div>
          <label class="prd-name">{{ TextField.PR_NAME.label }}
            <input ref="nameEl" id="pr-editor-name" type="text" :value="name" placeholder="e.g. Dayton SD270A-88" @input="e => setName(inputValue(e))" @keydown.enter="ok">
          </label>
        </template>
        <template v-else>
          <div class="prd-band">Passive radiator parameters <span class="prd-help">?</span></div>
          <div class="prd-fields">
            <UIField :class="phone ? 'mob-ui-field' : undefined" stepper input-id="pr-editor-vas" :field="NumberField.PR_VAS_L" :cell="cells.Vas_m3" />
            <UIField :class="phone ? 'mob-ui-field' : undefined" stepper input-id="pr-editor-qms" :field="NumberField.PR_QMS" :cell="cells.Qms" />
            <UIField :class="phone ? 'mob-ui-field' : undefined" stepper input-id="pr-editor-fs" :field="NumberField.PR_FS_HZ" :cell="cells.Fs_hz" />
            <UIField :class="phone ? 'mob-ui-field' : undefined" stepper input-id="pr-editor-sd" :field="NumberField.PR_SD_CM2" :cell="cells.Sd_m2" />
            <UIField :class="phone ? 'mob-ui-field' : undefined" stepper input-id="pr-editor-mms" :field="NumberField.MMS_KG" :cell="cells.Mms_kg" :deviation="WinisdDeviation.PR_MMS_CMS_TYPING" />
            <UIField :class="phone ? 'mob-ui-field' : undefined" stepper input-id="pr-editor-cms" :field="NumberField.CMS_M_PER_N" :cell="cells.Cms_m_per_N" :deviation="WinisdDeviation.PR_MMS_CMS_TYPING" />
            <UIField :class="phone ? 'mob-ui-field' : undefined" stepper input-id="pr-editor-rms" :field="NumberField.RMS_KG_PER_S" :cell="cells.Rms_kg_per_s" />
            <UIField :class="phone ? 'mob-ui-field' : undefined" stepper input-id="pr-editor-xmax" :field="NumberField.PR_XMAX_MM" :cell="cells.Xmax_m" />
          </div>
        </template>
      </div>
      <div class="prd-checks"><label><input type="checkbox" checked> Auto calculate unknowns</label><label><input type="checkbox"> Inspect Provenance</label></div>
      <p v-if="savedNote" class="prd-saved" role="status">{{ savedNote }}</p>
      <div v-if="!phone" class="prd-foot">
        <button type="button">Export</button>
        <button type="button">Import</button>
        <button type="button" class="prd-save" :disabled="!canSave" title="Copy this passive radiator into My passive radiators" @click="saveToMyPRs">Copy to My PRs</button>
        <span class="prd-gap"></span>
        <button type="button" class="pri prd-ok" @click="ok">OK</button>
        <button type="button">Reset</button>
        <button type="button" class="prd-cancel" @click="cancel">Cancel</button>
      </div>
      <div v-else class="prd-foot">
        <button type="button" class="pri prd-ok mob-btn mob-btn-primary" @click="ok">OK</button>
        <button type="button" class="prd-cancel mob-btn mob-btn-plain" @click="cancel">Cancel</button>
        <button type="button" class="prd-more mob-btn mob-btn-secondary" @click="more = !more">More &#9650;</button>
        <div v-if="more" class="prd-more-menu" role="menu">
          <button type="button" role="menuitem">Export</button>
          <button type="button" role="menuitem">Import</button>
          <button type="button" role="menuitem" :disabled="!canSave" @click="saveToMyPRs(); more = false">Copy to My PRs</button>
          <button type="button" role="menuitem">Reset</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prd-scrim { position: fixed; inset: 0; z-index: 1300; display: flex; align-items: center; justify-content: center; background: rgba(0, 0, 0, .35); }
.prd-panel { box-sizing: border-box; width: 1100px; max-width: calc(100% - 24px); max-height: calc(100% - 24px); display: flex; flex-direction: column; background: #f7f7f7; color: #222; border: 1px solid #bbb; border-radius: 4px; box-shadow: 0 6px 22px rgba(0,0,0,.35); font-size: 13px; }
.prd-head { display: flex; align-items: center; gap: 10px; height: 46px; padding: 0 12px; background: #e8e8e8; border-bottom: 1px solid #d0d0d0; }
.prd-head h3 { flex: 1 1 auto; margin: 0; font-size: 15px; font-weight: 600; }
.prd-help { display: inline-flex; align-items: center; justify-content: center; width: 20px; height: 20px; border: 1px solid #1565c0; border-radius: 50%; color: #1565c0; font-size: 11px; font-weight: 700; }
.prd-x { width: 38px; height: 30px; border: 1px solid #aaa; border-radius: 4px; background: #fff; font-size: 18px; cursor: pointer; }
.prd-tabs { display: flex; gap: 2px; padding: 6px 12px 0; border-bottom: 1px solid #c8c8c8; }
.prd-tabs button { padding: 7px 14px; border: 1px solid #c8c8c8; border-bottom: 0; border-radius: 3px 3px 0 0; background: #ececec; font: inherit; font-size: 14px; cursor: pointer; }
.prd-tabs button.on { background: #f7f7f7; font-weight: 600; margin-bottom: -1px; }
.prd-legend { display: none; }
.prd-scroll { flex: 1 1 auto; overflow: auto; padding: 10px 14px; min-height: 0; }
.prd-band { position: relative; padding: 3px 8px; margin-bottom: 8px; background: #e6e6e6; text-align: center; font-size: 12px; color: #444; }
.prd-band .prd-help { position: absolute; right: 8px; top: 2px; width: 14px; height: 14px; font-size: 9px; }
.prd-name { display: flex; align-items: center; gap: 10px; font-size: 13px; color: #444; }
.prd-name input { width: 330px; box-sizing: border-box; padding: 5px 8px; font-size: 13px; border: 1px solid #bbb; border-radius: 3px; background: #fff; }
.prd-fields { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px 20px; }
.prd-panel:not(.prd-phone) .prd-fields :deep(.ui-field) { --joined-chip: 60px !important; }
.prd-checks { display: flex; gap: 16px; padding: 8px 14px; border-top: 1px solid #ddd; }
.prd-checks label { display: inline-flex; align-items: center; gap: 6px; padding: 3px 8px; border: 1px solid #ccc; border-radius: 3px; background: #fff; }
.prd-saved { margin: 0; padding: 4px 14px; font-size: 12px; }
.prd-foot { display: flex; align-items: center; gap: 8px; padding: 10px 14px 12px; border-top: 1px solid #ddd; }
.prd-foot button { padding: 5px 12px; border: 1px solid #bbb; border-radius: 3px; background: #fff; font: inherit; cursor: pointer; }
.prd-gap { flex: 1 1 auto; }
.prd-foot .pri { background: #1565c0; color: #fff; border-color: #1565c0; font-weight: 600; }
.prd-foot button:disabled { opacity: .5; cursor: default; }
/* Phone: full screen, as the driver editor is. */
.prd-phone-scrim { align-items: stretch; }
.prd-phone { width: 100%; max-width: 100%; max-height: 100%; height: 100%; border: 0; border-radius: 0; box-shadow: none; }
.prd-phone .prd-head { height: 56px; }
.prd-phone .prd-head h3 { font-size: 15px; }
.prd-phone .prd-help { width: 22px; height: 22px; }
.prd-phone .prd-x { width: 42px; height: 42px; font-size: 22px; }
.prd-phone .prd-tabs { padding: 6px 6px 0; }
.prd-phone .prd-tabs button { flex: 1; padding: 12px 4px; }
.prd-phone .prd-legend { display: flex; justify-content: center; align-items: center; gap: 4px; padding: 4px; font-size: 13px; color: #555; }
.prd-phone .prd-legend i { display: inline-block; width: 9px; height: 9px; margin-left: 6px; }
.prd-phone .prd-legend .g { background: #1b7f1b; } .prd-phone .prd-legend .b { background: #1565c0; } .prd-phone .prd-legend .k { background: #555; }
.prd-phone .prd-scroll { padding: 0; }
.prd-phone .prd-band { margin: 0; padding: 8px 16px; text-align: left; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; font-size: 12px; }
.prd-phone .prd-band .prd-help { right: 16px; top: 6px; width: 18px; height: 18px; }
.prd-phone .prd-fields { display: block; }
.prd-phone .prd-fields :deep(.ui-field) { --mob-chip: var(--mob-col-chip-wide) !important; }
.prd-phone .prd-name { flex-direction: column; align-items: stretch; gap: 4px; padding: 10px 16px; }
.prd-phone .prd-name input { width: 100%; }
.prd-phone .prd-checks { padding: 8px 10px; gap: 8px; }
.prd-phone .prd-checks label { flex: 1; padding: 8px 6px; white-space: nowrap; font-size: 12.5px; }
.prd-phone .prd-foot { position: relative; padding: 10px; gap: 8px; }
.prd-phone .prd-foot .mob-btn { flex: 1 1 0; height: 44px; }
.prd-phone .prd-foot .prd-ok { flex: 1.4 1 0; }
.prd-phone .prd-foot .prd-more { flex: 0.7 1 0; }
.prd-more-menu { position: absolute; right: 10px; bottom: 60px; display: flex; flex-direction: column; min-width: 190px; background: #fff; border: 1px solid #bbb; border-radius: 6px; box-shadow: 0 4px 14px rgba(0,0,0,.25); }
.prd-more-menu button { padding: 12px 14px; border: 0; border-bottom: 1px solid #eee; background: none; text-align: left; font-size: 15px; }
</style>
