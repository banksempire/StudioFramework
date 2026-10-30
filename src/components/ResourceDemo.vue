<script setup lang="ts">
import { computed, onUnmounted, reactive } from 'vue';
import { type TabStateChange, useTabResources } from '../composables/tabResources';
import { useHostedTab } from '../composables/useHostedTab';
import { useWorkspaceContext } from '../composables/useWorkspace';

const hosted = useHostedTab();
const ws = useWorkspaceContext();
const tabId = hosted?.tabId ?? '';

interface ResourceEvent {
  kind: 'open' | 'close' | 'state' | 'unmount';
  detail: string;
  seq: number;
}

const events = reactive<ResourceEvent[]>([]);
let seq = 0;

function record(kind: ResourceEvent['kind'], detail: string) {
  seq += 1;
  events.push({ kind, detail, seq });
  const w = window as unknown as { __sfTabResources?: ResourceEvent[] };
  if (!w.__sfTabResources) w.__sfTabResources = [];
  w.__sfTabResources.push({ kind, detail, seq });
}

const code = computed(() => String(ws.tabDefs[tabId]?.props?.code ?? 'res-a'));

function switchCode() {
  const def = ws.tabDefs[tabId];
  if (!def) return;
  const next = code.value === 'res-a' ? 'res-b' : 'res-a';
  ws.tabDefs[tabId] = { ...def, props: { ...(def.props ?? {}), code: next } };
}

useTabResources({
  _on_tab_open_request_resources() {
    record('open', code.value);
  },
  _on_tab_close_release_resources() {
    record('close', code.value);
  },
  _on_tab_states_change_reload_resources(change: TabStateChange) {
    record('state', `${String(change.prev?.code)}→${String(change.next?.code)}`);
  },
});

onUnmounted(() => record('unmount', code.value));
</script>

<template>
  <div class="sf-resource-demo">
    <div class="sf-resource-demo-bar">
      <span class="sf-resource-demo-code" data-test="resource-code">{{ code }}</span>
      <button class="sf-resource-demo-btn" type="button" data-test="switch-code" @click="switchCode">
        Switch code
      </button>
    </div>
    <ul class="sf-resource-demo-log" data-test="resource-log">
      <li v-for="(e, i) in events" :key="i" :data-kind="e.kind">{{ e.kind }}: {{ e.detail }}</li>
    </ul>
  </div>
</template>

<style scoped>
.sf-resource-demo {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 14px 18px;
  font-size: 13px;
  max-width: 560px;
}

.sf-resource-demo-bar {
  display: flex;
  align-items: center;
  gap: 10px;
}

.sf-resource-demo-code {
  font-weight: 600;
}

.sf-resource-demo-btn {
  border: 1px solid var(--sf-border, #444);
  background: transparent;
  color: inherit;
  border-radius: 4px;
  padding: 3px 10px;
  cursor: pointer;
}

.sf-resource-demo-log {
  margin: 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
  opacity: 0.85;
}
</style>
