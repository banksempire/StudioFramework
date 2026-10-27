<script setup lang="ts">
import { computed, ref, useSlots } from 'vue';
import { popupH1Groups, toPanelH1 } from '../lib/popupPanel';
import type { PanelAction } from '../types/panel';
import type { PopupDocument, PopupValues } from '../types/popup';
import Dialog from './Dialog.vue';
import SubsectionBody from './SubsectionBody.vue';

const props = withDefaults(
  defineProps<{
    doc: PopupDocument;
    values?: PopupValues;
    open: boolean;
    wide?: boolean;
    narrow?: boolean;
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
    narrow: false,
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
  (e: 'action', id: string, key?: string): void;
  (e: 'cancel'): void;
  (e: 'close'): void;
}>();

const slots = useSlots();
const activeH1 = ref('');
const contentEl = ref<HTMLElement | null>(null);

const h1s = computed(() => popupH1Groups(props.doc));

const panelGroups = computed(() =>
  h1s.value.map((group) => ({ group, panel: toPanelH1(group, props.values) })),
);

const noHidden = computed(() => new Set<string>());

const hasNav = computed(() => (props.doc.h1?.length ?? 0) > 1);

const totalH2s = computed(() => h1s.value.reduce((n, g) => n + g.h2s.length, 0));

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
  for (const h1 of h1s.value) {
    for (const h2 of h1.h2s) {
      const groups = [h2.fields, ...(h2.h3 ?? []).map((h3) => h3.fields)];
      for (const fields of groups) {
        for (const field of fields) {
          if (
            field.type === 'info' ||
            field.type === 'slot' ||
            field.type === 'switch' ||
            field.type === 'button'
          )
            continue;
          const value = props.values[field.key];
          if (field.required && isEmpty(value)) return `${field.label ?? field.key} is required`;
          if (field.type === 'number' && !isEmpty(value) && !Number.isFinite(Number(value))) {
            return `${field.label ?? field.key} must be a number`;
          }
        }
      }
    }
  }
  return null;
}

function patch(key: string, value: string | number | boolean | Array<string | number>) {
  emit('update:values', { ...props.values, [key]: value });
}

function jump(h1Id: string) {
  activeH1.value = h1Id;
  contentEl.value
    ?.querySelector(`[data-popup-h1="${h1Id}"]`)
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function onPanelComponentAction(a: PanelAction) {
  if (a.source !== 'form') return;
  const payload = (a.payload ?? {}) as { key?: string; value?: unknown };
  if (typeof payload.key === 'string' && payload.value !== undefined) {
    patch(payload.key, payload.value as string | number | boolean | Array<string | number>);
    return;
  }
  if (a.action) emit('action', a.action);
}

function onContentScroll() {
  if (!hasNav.value || !contentEl.value) return;
  const tops = h1s.value
    .map((g) => ({
      id: g.id,
      top: contentEl.value?.querySelector(`[data-popup-h1="${g.id}"]`)?.getBoundingClientRect().top ?? 0,
    }))
    .filter((g) => g.top > 0);
  if (tops.length === 0) return;
  activeH1.value = tops[0].id;
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
    :narrow="narrow"
    lock-height
    :close-on-backdrop="!disableClose && !busy"
    :close-on-escape="!disableClose && !busy"
    @update:open="(v) => emit('update:open', v)"
    @close="onCancel(); onClose()"
  >
    <div class="sf-form" :class="{ 'sf-form--nav': hasNav }">
      <nav v-if="hasNav" class="sf-form-nav">
        <button
          v-for="g in doc.h1"
          :key="g.id"
          type="button"
          class="sf-form-nav-item"
          :class="{ 'sf-form-nav-item--on': activeH1 === g.id }"
          @click="jump(g.id)"
        >
          {{ g.title }}
        </button>
      </nav>
      <div ref="contentEl" class="sf-form-content" @scroll.passive="onContentScroll">
        <slot name="preamble" />
        <section
          v-for="entry in panelGroups"
          :key="entry.group.id"
          class="sf-form-group"
          :data-popup-h1="entry.group.id"
        >
          <h2 v-if="hasNav && entry.group.title" class="sf-form-group-title">
            {{ entry.group.title }}
          </h2>
          <SubsectionBody
            :h2s="entry.panel.h2"
            :hidden-ids="noHidden"
            :scroll="false"
            :collapsible="totalH2s > 1"
            @component-action="onPanelComponentAction"
          >
            <template v-for="(_, name) in $slots" :key="name" #[name]="slotProps">
              <slot :name="name" v-bind="slotProps ?? {}" />
            </template>
          </SubsectionBody>
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
