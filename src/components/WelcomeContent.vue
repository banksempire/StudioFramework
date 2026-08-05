<script setup lang="ts">
import { layout } from '../layout/loadLayout';
</script>

<template>
  <div class="sf-welcome">
    <div class="sf-welcome-content">
      <h1>{{ layout.framework.title }}</h1>
      <p>A VSCode-like UI framework built with Vue 3 + TypeScript</p>
      <div class="sf-welcome-shortcuts">
        <div class="sf-shortcut"><kbd>Ctrl+N</kbd> New File</div>
        <div class="sf-shortcut"><kbd>Ctrl+O</kbd> Open Folder</div>
        <div class="sf-shortcut"><kbd>Ctrl+S</kbd> Save</div>
        <div class="sf-shortcut"><kbd>Ctrl+P</kbd> Quick Open</div>
      </div>
    </div>
  </div>
</template>
