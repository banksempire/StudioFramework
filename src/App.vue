<script setup lang="ts">
import { ref } from 'vue';
import MenuBar from './components/MenuBar.vue';
import Docker from './components/Docker.vue';
import DockerPanel from './components/DockerPanel.vue';
import Workspace from './components/Workspace.vue';
import PropertyPanel from './components/PropertyPanel.vue';
import StatusBar from './components/StatusBar.vue';

const activeDockerTag = ref('explorer');
const leftPanelVisible = ref(true);
const dockerPanelVisible = ref(true);
const savedPanelState = ref(true);
const propertyPanelVisible = ref(true);

function onTagSelected(tagId: string) {
  if (!leftPanelVisible.value) leftPanelVisible.value = true;
  if (!dockerPanelVisible.value) dockerPanelVisible.value = true;
  activeDockerTag.value = tagId;
}

function onTagDoubleClicked(_tagId: string) {
  dockerPanelVisible.value = !dockerPanelVisible.value;
}

function toggleLeftPanel() {
  if (leftPanelVisible.value) {
    // Hide: remember panel state, then collapse everything
    savedPanelState.value = dockerPanelVisible.value;
    dockerPanelVisible.value = false;
    leftPanelVisible.value = false;
  } else {
    // Restore: bring back to previous state
    leftPanelVisible.value = true;
    dockerPanelVisible.value = savedPanelState.value;
  }
}

function togglePropertyPanel() {
  propertyPanelVisible.value = !propertyPanelVisible.value;
}
</script>

<template>
  <div class="sf-root">
    <MenuBar
      @toggle-left-panel="toggleLeftPanel"
      @toggle-property-panel="togglePropertyPanel"
    />

    <div class="sf-workbench">
      <Docker
        :active-tag="activeDockerTag"
        :visible="leftPanelVisible"
        :panel-visible="dockerPanelVisible"
        @tag-selected="onTagSelected"
        @tag-double-clicked="onTagDoubleClicked"
      />

      <DockerPanel
        :active-tag="activeDockerTag"
        :visible="dockerPanelVisible && leftPanelVisible"
        @collapse="dockerPanelVisible = false"
      />

      <Workspace />

      <PropertyPanel
        :visible="propertyPanelVisible"
        @collapse="propertyPanelVisible = false"
      />
    </div>

    <StatusBar />
  </div>
</template>