<script setup lang="ts">
import { computed, ref } from 'vue';
import type { PopupOption } from '../types/popup';

const props = withDefaults(
  defineProps<{
    modelValue: string;
    options: PopupOption[];
    id?: string;
    placeholder?: string;
    disabled?: boolean;
    title?: string;
  }>(),
  { id: undefined, placeholder: undefined, disabled: false, title: undefined },
);

const emit = defineEmits<(e: 'update:modelValue', value: string) => void>();

const query = ref<string | null>(null);
const open = ref(false);
const cursor = ref(0);

function labelOf(value: string): string {
  return props.options.find((o) => o.value === value)?.label ?? value;
}

const display = computed(() => query.value ?? labelOf(props.modelValue));

const matches = computed(() => {
  const q = (query.value ?? '').trim().toLowerCase();
  const all = props.options;
  if (!q) return all.slice(0, 12);
  const out = all.filter(
    (o) => String(o.label).toLowerCase().includes(q) || String(o.value).toLowerCase().includes(q),
  );
  return out.slice(0, 12);
});

function onInput(event: Event) {
  query.value = (event.target as HTMLInputElement).value;
  open.value = true;
  cursor.value = 0;
}

function onFocus() {
  query.value = null;
  open.value = true;
}

function pick(option: PopupOption) {
  query.value = null;
  open.value = false;
  if (option.value !== props.modelValue) emit('update:modelValue', String(option.value));
}

function commitText() {
  const q = query.value;
  query.value = null;
  open.value = false;
  if (!q) return;
  const exact = props.options.find((o) => String(o.label).toLowerCase() === q.trim().toLowerCase());
  if (exact) {
    if (exact.value !== props.modelValue) emit('update:modelValue', String(exact.value));
    return;
  }
  const single = matches.value.length === 1 ? matches.value[0] : null;
  if (single && single.value !== props.modelValue) emit('update:modelValue', String(single.value));
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter') {
    const hit = matches.value[cursor.value];
    if (open.value && hit) pick(hit);
    else commitText();
  } else if (event.key === 'Escape') {
    query.value = null;
    open.value = false;
  } else if (event.key === 'ArrowDown') {
    open.value = true;
    cursor.value = Math.min(cursor.value + 1, matches.value.length - 1);
  } else if (event.key === 'ArrowUp') {
    cursor.value = Math.max(cursor.value - 1, 0);
  }
}
</script>

<template>
  <div class="sf-search-select">
    <input
      :id="id"
      class="sf-form-input sf-search-select-box"
      type="text"
      :value="display"
      :placeholder="placeholder ?? 'search…'"
      :disabled="disabled"
      :title="title"
      spellcheck="false"
      autocomplete="off"
      @input="onInput"
      @focus="onFocus"
      @blur="commitText"
      @keydown="onKeydown"
    />
    <div v-if="open && matches.length" class="sf-search-select-pop">
      <button
        v-for="(opt, i) in matches"
        :key="String(opt.value)"
        type="button"
        class="sf-search-select-row"
        :class="{ 'sf-search-select-row--on': i === cursor || opt.value === modelValue }"
        @mousedown.prevent="pick(opt)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.sf-search-select {
  position: relative;
  min-width: 0;
}

.sf-search-select-box {
  width: 100%;
  min-width: 0;
}

.sf-search-select-pop {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 60;
  max-height: 240px;
  overflow-y: auto;
  background: var(--sf-bg, #1b1d22);
  border: 1px solid var(--sf-border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}

.sf-search-select-row {
  text-align: left;
  padding: 7px 10px;
  background: transparent;
  border: none;
  color: var(--sf-text);
  font-size: 16px;
  cursor: pointer;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sf-search-select-row--on {
  color: var(--sf-text-bright);
  background: var(--sf-hover-overlay, rgba(255, 255, 255, 0.06));
}
</style>
