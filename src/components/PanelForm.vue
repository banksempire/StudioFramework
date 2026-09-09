<script setup lang="ts">
import type { PanelFormRow } from '../types/panel';
import PillSelector from './PillSelector.vue';
import StepperInput from './StepperInput.vue';
import SwitchToggle from './SwitchToggle.vue';

defineProps<{
  rows: PanelFormRow[];
  empty?: string;
}>();

const emit = defineEmits<{ change: [row: PanelFormRow, value: string | number | boolean] }>();
</script>

<template>
  <div v-if="rows.length === 0 && empty" class="sf-empty">{{ empty }}</div>
  <div v-else class="sf-pf">
    <div v-for="row in rows" :key="row.id" class="sf-pf-row" :data-row="row.id">
      <span v-if="row.label" class="sf-pf-key">{{ row.label }}</span>
      <span class="sf-pf-ctl">
        <PillSelector
          v-if="row.pills"
          :options="row.pills.choices"
          :model-value="row.pills.value"
          @update:model-value="(v) => emit('change', row, v)"
        />
        <StepperInput
          v-else-if="row.stepper"
          :model-value="row.stepper.value"
          :min="row.stepper.min ?? 1"
          :max="row.stepper.max ?? 100"
          :step="row.stepper.step ?? 1"
          :title="row.stepper.title"
          @update:model-value="(v) => emit('change', row, v)"
        />
        <SwitchToggle
          v-else-if="row.switch"
          :on="row.switch.on"
          :title="row.switch.title"
          @toggle="emit('change', row, !row.switch.on)"
        />
        <span v-else class="sf-pf-hint">{{ row.hint }}</span>
      </span>
      <div
        v-if="row.note"
        class="sf-pf-note"
        :class="{ 'sf-pf-note--err': row.noteTone === 'error' }"
      >{{ row.note }}</div>
    </div>
  </div>
</template>
