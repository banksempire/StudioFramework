<script setup lang="ts">
import { ref } from 'vue';
import MenuBar from './components/MenuBar.vue';
import Docker from './components/Docker.vue';
import TagWindow from './components/TagWindow.vue';
import AppFrame from './components/AppFrame.vue';
import PropertyWindow from './components/PropertyWindow.vue';
import StatusBar from './components/StatusBar.vue';

const activeDockerTag = ref('explorer');
const tagWindowVisible = ref(true);
const propertyWindowVisible = ref(true);

function onTagSelected(tagId: string) {
  if (!tagWindowVisible.value) tagWindowVisible.value = true;
  activeDockerTag.value = tagId;
}

function onTagDoubleClicked(_tagId: string) {
  tagWindowVisible.value = false;
}

function togglePropertyWindow() {
  propertyWindowVisible.value = !propertyWindowVisible.value;
}
</script>

<template>
  <div class="sf-root">
    <MenuBar @toggle-property="togglePropertyWindow" />

    <div class="sf-workbench">
      <Docker
        :active-tag="activeDockerTag"
        @tag-selected="onTagSelected"
        @tag-double-clicked="onTagDoubleClicked"
      />

      <TagWindow
        :active-tag="activeDockerTag"
        :visible="tagWindowVisible"
      />

      <AppFrame />

      <PropertyWindow :visible="propertyWindowVisible" />
    </div>

    <StatusBar />
  </div>
</template>