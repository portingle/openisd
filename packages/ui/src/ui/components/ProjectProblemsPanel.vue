<script setup lang="ts">
import type {ProjectProblem} from '@openisd/design';

defineProps<{problems: readonly ProjectProblem[]}>();
const emit = defineEmits<{close: []; go: [problem: ProjectProblem]}>();
</script>

<template>
  <div class="problems-panel" role="dialog" aria-label="Project problems">
    <div class="problems-heading">
      <strong>Project problems</strong>
      <button type="button" aria-label="Close project problems" @click="emit('close')">✕</button>
    </div>
    <p v-if="problems.length === 0">No problems.</p>
    <ul v-else>
      <li v-for="(problem, index) in problems" :key="index">
        <span>{{ problem.text }}</span>
        <button type="button" @click="emit('go', problem)">Go to</button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.problems-panel { position: fixed; z-index: 1200; right: 8px; bottom: 44px; width: min(560px, calc(100% - 16px)); max-height: min(60vh, 480px); overflow: auto; padding: 12px; border: 1px solid var(--line, #aaa); background: var(--panel, white); box-shadow: 0 3px 12px #0003; }
.problems-heading { display: flex; justify-content: space-between; align-items: center; }
.problems-heading button { border: 0; background: transparent; cursor: pointer; }
p { margin: 8px 0; }
ul { margin: 0; padding: 0; list-style: none; }
li { display: flex; gap: 12px; align-items: start; justify-content: space-between; padding: 8px 0; border-top: 1px solid var(--line, #aaa); }
li button { flex: none; }
</style>
