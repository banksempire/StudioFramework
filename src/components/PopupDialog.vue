<script setup lang="ts">
import { computed, ref, useSlots } from 'vue';
import type { PopupDocument, PopupSection, PopupValues } from '../types/popup';
import Dialog from './Dialog.vue';
import FormFields from './FormFields.vue';

const props = withDefaults(
  defineProps<{
    doc: PopupDocument;
    values?: PopupValues;
    open: boolean;
    wide?: boolean;
    busy?: boolean;
    error?: string;
    footNote?: string;
    footNoteTone?: 'warn' | 'error';
    submitLabel?: string;
    cancelLabel?: string;
    disableClose?: boolean;
  }>(),
  {
    values: () => ({}),
    wide: false,
    busy: false,
    error: '',
    footNote: '',
    footNoteTone: undefined,
    submitLabel: 'Save',
    cancelLabel: 'Cancel',
    disableClose: false,
  },
);

const emit = defineEmits<{
  (e: 'update:open', value: boolean): void;
  (e: 'update:values', value: PopupValues): void;
  (e: 'action', id: string): void;
  (e: 'cancel'): void;
  (e: 'close'): void;
}>();

const slots = useSlots();
const uid = `sf-form-${Math.random().toString(36).slice(2, 8)}`;
const activeGroup = ref('');
const contentEl = ref<HTMLElement | null>(null);

const groups = computed(() =>
  props.doc.groups && props.doc.groups.length > 0
    ? props.doc.groups
    : [{ id: 'main', title: props.doc.title, sections: props.doc.sections ?? [] }],
);

const hasNav = computed(() => (props.doc.groups?.length ?? 0) > 1);

const actions = computed(
  () =>
    props.doc.actions ?? [
      { id: 'cancel', label: props.cancelLabel, close: true },
      { id: 'submit', label: props.submitLabel, tone: 'accent' as const },
    ],
);

const leftActions = computed(() => actions.value.filter((a) => a.align === 'left'));
const rightActions = computed(() => actions.value.filter((a) => a.align !== 'left'));

function isEmpty(value: unknown): boolean {
  if (Array.isArray(value)) return value.length === 0;
  return value === undefined || value === null || String(value).trim() === '';
}

function validate(): string | null {
  for (const group of groups.value) {
    for (const section of group.sections) {
      for (const field of section.fields) {
        if (field.type === 'info' || field.type === 'slot' || field.type === 'switch') continue;
        const value = props.values[field.key];
        if (field.required && isEmpty(value)) return `${field.label ?? field.key} is required`;
        if (field.type === 'number' && !isEmpty(value) && !Number.isFinite(Number(value))) {
          return `${field.label ?? field.key} must be a number`;
        }
      }
    }
  }
  return null;
}

function patch(key: string, value: string | number | boolean | Array<string | number>) {
  emit('update:values', { ...props.values, [key]: value });
}

function jump(groupId: string) {
  activeGroup.value = groupId;
  contentEl.value
    ?.querySelector(`[data-popup-group="${groupId}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function onContentScroll() {
  if (!hasNav.value || !contentEl.value) return;
  const tops = groups.value
    .map((g) => ({
      id: g.id,
      top: contentEl.value?.querySelector(`[data-popup-group="${g.id}"]`)?.getBoundingClientRect().top ?? 0,
    }))
    .filter((g) => g.top > 0);
  if (tops.length === 0) return;
  activeGroup.value = tops[0].id;
}

function runAction(id: string) {
  const action = actions.value.find((a) => a.id === id);
  if (!action || action.disabled || props.busy) return;
  emit('action', id);
  if (action.close) {
    emit('update:open', false);
    emit('close');
  }
}

function onCancel() {
  emit('cancel');
}

function onClose() {
  emit('close');
}

defineExpose({ validate });
</script>

<template>
  <Dialog
    :open="open"
    :title="doc.title"
    :wide="wide"
    :close-on-backdrop="!disableClose && !busy"
    :close-on-escape="!disableClose && !busy"
    @update:open="(v) => emit('update:open', v)"
    @close="onCancel(); onClose()"
  >
    <div class="sf-form" :class="{ 'sf-form--nav': hasNav }">
      <nav v-if="hasNav" class="sf-form-nav">
        <button
          v-for="g in doc.groups"
          :key="g.id"
          type="button"
          class="sf-form-nav-item"
          :class="{ 'sf-form-nav-item--on': activeGroup === g.id }"
          @click="jump(g.id)"
        >
          {{ g.title }}
        </button>
      </nav>
      <div ref="contentEl" class="sf-form-content" @scroll.passive="onContentScroll">
        <slot name="preamble" />
        <section
          v-for="(group, gi) in groups"
          :key="group.id"
          class="sf-form-group"
          :data-popup-group="group.id"
        >
          <h2 v-if="hasNav && group.title" class="sf-form-group-title">{{ group.title }}</h2>
          <section
            v-for="(section, si) in group.sections"
            :key="section.title ?? si"
            class="sf-form-section"
            :class="{ 'sf-form-section--first': si === 0 && !(hasNav && gi === 0) }"
          >
            <h3 v-if="section.title" class="sf-form-section-title">{{ section.title }}</h3>
            <FormFields
              :section="section"
              :values="values"
              :uid="uid"
              :busy="busy"
              @patch="patch"
            >
              <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
                <slot :name="name" v-bind="slotProps ?? {}" />
              </template>
            </FormFields>
          </section>
        </section>
        <p v-if="error" class="sf-form-error">{{ error }}</p>
        <p
          v-else-if="footNote"
          class="sf-form-footnote"
          :class="{ 'sf-form-footnote--warn': footNoteTone === 'warn', 'sf-form-footnote--error': footNoteTone === 'error' }"
        >{{ footNote }}</p>
      </div>
    </div>
    <template #actions>
      <button
        v-for="a in leftActions"
        :key="a.id"
        type="button"
        class="sf-dialog-btn"
        :class="[a.tone === 'accent' ? 'sf-dialog-btn--accent' : a.tone === 'danger' ? 'sf-dialog-btn--danger' : '', a.class]"
        :disabled="a.disabled || busy"
        :title="a.title"
        @click="runAction(a.id)"
      >
        {{ a.label }}
      </button>
      <span v-if="leftActions.length" class="sf-form-actions-space" />
      <button
        v-for="a in rightActions"
        :key="a.id"
        type="button"
        class="sf-dialog-btn"
        :class="[a.tone === 'accent' ? 'sf-dialog-btn--accent' : a.tone === 'danger' ? 'sf-dialog-btn--danger' : '', a.class]"
        :disabled="a.disabled || busy"
        :title="a.title"
        @click="runAction(a.id)"
      >
        {{ a.label }}
      </button>
    </template>
  </Dialog>
</template>

<style scoped>
.sf-form {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sf-form--nav {
  flex-direction: row;
  gap: 14px;
}

.sf-form-nav {
  flex-shrink: 0;
  width: 150px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  position: sticky;
  top: 0;
  align-self: flex-start;
}

.sf-form-nav-item {
  text-align: left;
  padding: 5px 8px;
  border: none;
  border-left: 2px solid transparent;
  border-radius: 0 var(--sf-radius-sm) 0 0;
  background: transparent;
  color: var(--sf-text-muted);
  font-family: var(--sf-font);
  font-size: 13px;
  cursor: pointer;
}

@media (hover: hover) {
  .sf-form-nav-item:hover {
    color: var(--sf-text-bright);
    background: var(--sf-hover-overlay);
  }
}

.sf-form-nav-item--on {
  color: var(--sf-text-bright);
  border-left-color: var(--sf-accent);
  background: var(--sf-hover-overlay);
}

.sf-form-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.sf-form-group + .sf-form-group {
  margin-top: 18px;
  padding-top: 14px;
  border-top: 1px solid var(--sf-border);
}

.sf-form-group-title {
  margin: 0 0 8px;
  font-size: 16px;
  font-weight: 700;
  color: var(--sf-text-bright);
}

.sf-form-actions-space {
  flex: 1;
}
</style>
