<script setup lang="ts">
import { computed, inject } from 'vue';
import { kMobilePanelDismiss } from '../composables/useWorkspace';
import type { PanelListItem } from '../types/panel';
import Icon from './Icon.vue';
import SingleMenu from './SingleMenu.vue';
import SwitchToggle from './SwitchToggle.vue';

const props = defineProps<{
  items: PanelListItem[];
  empty?: string;
  variant?: 'plain' | 'card';
  dismissOnActivate?: boolean;
}>();

const emit = defineEmits<{
  activate: [item: PanelListItem];
  menu: [item: PanelListItem, optionId: string];
  button: [item: PanelListItem, buttonId: string];
  'switch-toggle': [item: PanelListItem];
  dragstart: [item: PanelListItem, event: DragEvent];
  dragend: [event: DragEvent];
}>();

const dismissMobilePanel = inject<(() => void) | null>(kMobilePanelDismiss, null);

const rich = computed(
  () =>
    props.variant === 'card' ||
    props.items.some(
      (it) =>
        it.meta !== undefined ||
        it.detail !== undefined ||
        it.note !== undefined ||
        it.dot !== undefined ||
        it.iconBlink === true ||
        it.switch !== undefined ||
        it.active === true ||
        it.muted === true ||
        (it.buttons?.length ?? 0) > 0 ||
        (it.options?.length ?? 0) > 0,
    ),
);

const hasDrag = computed(() => props.items.some((it) => it.dragType));

function onActivate(item: PanelListItem) {
  if (item.action) {
    emit('activate', item);
    if (props.dismissOnActivate) dismissMobilePanel?.();
  }
}

function onDragStart(item: PanelListItem, e: DragEvent) {
  const type = item.dragType;
  if (!type) {
    e.preventDefault();
    return;
  }
  e.dataTransfer?.setData(type, item.dragData ?? item.id);
  emit('dragstart', item, e);
}
</script>

<template>
  <div v-if="props.items.length === 0 && props.empty" class="sf-empty">{{ props.empty }}</div>
  <div v-else-if="!rich" class="sf-pc-list">
    <div
      v-for="item in props.items"
      :key="item.id"
      class="sf-pc-list-item"
      @click="emit('activate', item)"
    >
      <Icon v-if="item.icon" class="sf-pc-list-icon" :icon="item.icon" />
      <span class="sf-pc-list-label">{{ item.label }}</span>
      <span v-if="item.badge" class="sf-pc-list-badge">{{ item.badge }}</span>
    </div>
  </div>
  <div v-else class="sf-pl" :class="'sf-pl--' + (props.variant ?? 'plain')">
    <SingleMenu
      :items="props.items"
      :options="(it: PanelListItem) => it.options ?? []"
      :key-of="(it: PanelListItem) => it.id"
      :title-of="(it: PanelListItem) => it.label"
      :draggable="hasDrag"
      @activate="onActivate"
      @select="(it: PanelListItem, opt) => emit('menu', it, opt.id)"
      @dragstart="onDragStart"
      @dragend="(e: DragEvent) => emit('dragend', e)"
    >
      <template #item="{ item: it }">
        <div
          class="sf-pl-item"
          :class="{
            'sf-pl-item--active': it.active,
            'sf-pl-item--muted': it.muted,
          }"
          :title="it.title"
        >
          <div class="sf-pl-top">
            <SwitchToggle
              v-if="it.switch"
              :on="it.switch.on"
              :title="it.switch.title"
              @toggle="emit('switch-toggle', it)"
            />
            <span v-if="it.icon" class="sf-pl-icon" :class="{ 'sf-pl-icon--blink': it.iconBlink }">
              <Icon :icon="it.icon" />
            </span>
            <span v-else-if="it.dot" class="sf-pl-dot" :class="'sf-pl-dot--' + it.dot" />
            <span class="sf-pl-label">{{ it.label }}</span>
            <span v-if="it.meta" class="sf-pl-meta">{{ it.meta }}</span>
            <span v-if="it.badge && !it.detail" class="sf-pl-badge" :class="'sf-pl-badge--' + (it.badgeTone ?? 'muted')">
              {{ it.badge }}
            </span>
            <span class="sf-pl-actions">
              <button
                v-for="b in it.buttons ?? []"
                :key="b.id"
                class="sf-pl-btn"
                :class="{ 'sf-pl-btn--danger': b.danger }"
                type="button"
                :title="b.title ?? b.id"
                :disabled="b.disabled"
                @click.stop="emit('button', it, b.id)"
              >
                <Icon :icon="b.icon" />
              </button>
            </span>
          </div>
          <div v-if="it.detail" class="sf-pl-sub">
            <span v-if="it.badge" class="sf-pl-badge" :class="'sf-pl-badge--' + (it.badgeTone ?? 'muted')">
              {{ it.badge }}
            </span>
            <span class="sf-pl-detail">{{ it.detail }}</span>
          </div>
          <div v-if="it.note" class="sf-pl-note">{{ it.note }}</div>
        </div>
      </template>
    </SingleMenu>
  </div>
</template>
