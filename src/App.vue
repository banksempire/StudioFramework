<script setup lang="ts">
import { ref } from 'vue';
import MenuBar from './components/MenuBar.vue';
import Docker from './components/Docker.vue';
import DockerPanel from './components/DockerPanel.vue';
import Workspace from './components/Workspace.vue';
import PropertyPanel from './components/PropertyPanel.vue';
import StatusBar from './components/StatusBar.vue';

const activeDockerTag = ref('explorer');
const dockerPanelVisible = ref(true);
const propertyPanelVisible = ref(true);

function onTagSelected(tagId: string) {
  if (!dockerPanelVisible.value) dockerPanelVisible.value = true;
  activeDockerTag.value = tagId;
}

function onTagDoubleClicked(_tagId: string) {
  dockerPanelVisible.value = false;
}

function togglePropertyPanel() {
  propertyPanelVisible.value = !propertyPanelVisible.value;
}
</script>

<template>
  <div class="sf-root">
    <MenuBar @toggle-property-panel="togglePropertyPanel" />

    <div class="sf-workbench">
      <Docker
        :active-tag="activeDockerTag"
        @tag-selected="onTagSelected"
        @tag-double-clicked="onTagDoubleClicked"
      />

      <DockerPanel
        :active-tag="activeDockerTag"
        :visible="dockerPanelVisible"
      />

      <Workspace />

      <PropertyPanel :visible="propertyPanelVisible" />
    </div>

    <StatusBar />
  </div>
</template>