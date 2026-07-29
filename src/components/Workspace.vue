<script setup lang="ts">
import { ref } from 'vue';

interface Tab {
  id: string;
  label: string;
  icon?: string;
  closable?: boolean;
}

const tabs = ref<Tab[]>([
  { id: 'welcome', label: 'Welcome', icon: '🏠', closable: false },
  { id: 'app-ts', label: 'app.ts', icon: '📄' },
  { id: 'utils-ts', label: 'utils.ts', icon: '📄' },
  { id: 'styles-css', label: 'styles.css', icon: '🎨' },
]);

const activeTabId = ref('welcome');

function selectTab(tabId: string) {
  activeTabId.value = tabId;
}

function closeTab(tabId: string) {
  const idx = tabs.value.findIndex(t => t.id === tabId);
  if (idx === -1) return;
  tabs.value.splice(idx, 1);
  if (activeTabId.value === tabId) {
    activeTabId.value = tabs.value[Math.min(idx, tabs.value.length - 1)]?.id ?? '';
  }
}

function newTab() {
  const id = `untitled-${Date.now()}`;
  tabs.value.push({ id, label: 'Untitled', icon: '📄' });
  activeTabId.value = id;
}
</script>

<template>
  <div class="sf-workspace">
    <!-- Tab Bar -->
    <div class="sf-tab-bar">
      <div class="sf-tab-container">
        <div
          v-for="tab in tabs"
          :key="tab.id"
          class="sf-tab"
          :class="{ active: tab.id === activeTabId }"
          @click="selectTab(tab.id)"
        >
          <span v-if="tab.icon" class="sf-tab-icon">{{ tab.icon }}</span>
          <span class="sf-tab-label">{{ tab.label }}</span>
          <span
            v-if="tab.closable !== false"
            class="sf-tab-close"
            @click.stop="closeTab(tab.id)"
          >✕</span>
        </div>
      </div>
      <button class="sf-tab-new" @click="newTab">+</button>
    </div>

    <!-- Panel Container -->
    <div class="sf-panel-container">
      <div v-if="activeTabId === 'welcome'" class="sf-welcome">
        <div class="sf-welcome-content">
          <h1>Studio Framework</h1>
          <p>A VSCode-like UI framework built with Vue 3 + TypeScript</p>
          <div class="sf-welcome-shortcuts">
            <div class="sf-shortcut"><kbd>Ctrl+N</kbd> New File</div>
            <div class="sf-shortcut"><kbd>Ctrl+O</kbd> Open Folder</div>
            <div class="sf-shortcut"><kbd>Ctrl+S</kbd> Save</div>
            <div class="sf-shortcut"><kbd>Ctrl+P</kbd> Quick Open</div>
          </div>
        </div>
      </div>
      <div v-else class="sf-editor-placeholder">
        <div class="sf-editor-lines">
          <div v-for="n in 12" :key="n" class="sf-editor-line">
            <span class="sf-line-number">{{ n }}</span>
            <span class="sf-line-text">{{ n === 1 ? '// Edit ' + tabs.find(t => t.id === activeTabId)?.label : '' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sf-editor-placeholder {
  height: 100%;
  background: var(--sf-bg);
  font-family: var(--sf-mono);
  font-size: 14px;
  padding: 12px;
}

.sf-editor-lines {
  display: flex;
  flex-direction: column;
}

.sf-editor-line {
  display: flex;
  line-height: 1.6;
}

.sf-line-number {
  color: var(--sf-text-muted);
  min-width: 40px;
  text-align: right;
  padding-right: 16px;
  user-select: none;
}

.sf-line-text {
  color: var(--sf-text);
}
</style>