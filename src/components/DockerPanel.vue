<script setup lang="ts">
import { computed } from 'vue';
import { useResize } from '../composables/useResize.js';

const props = defineProps<{
  activeTag: string;
  visible: boolean;
}>();

const emit = defineEmits<{
  'update:width': [width: number];
}>();

const { width, dragging, onMouseDown } = useResize({
  min: 180,
  max: 500,
  direction: 'right',
  onResize: (w) => emit('update:width', w),
});

const title = computed(() => {
  const map: Record<string, string> = {
    explorer: 'Files',
    search: 'Search',
    'source-control': 'Source Control',
    extensions: 'Extensions',
    settings: 'Settings',
    debug: 'Debug',
  };
  return map[props.activeTag] || 'Explorer';
});
</script>

<template>
  <div
    class="sf-docker-panel"
    :class="{ 'sf-docker-panel--hidden': !visible, 'sf-docker-panel--dragging': dragging }"
    :style="visible ? { width: width + 'px' } : {}"
  >
    <div class="sf-docker-panel-header">
      <span class="sf-docker-panel-title">{{ title }}</span>
    </div>

    <div class="sf-docker-panel-content">
      <!-- File Explorer -->
      <div v-if="activeTag === 'explorer'" class="sf-file-tree">
        <div class="sf-file-item folder expanded">
          <span class="sf-file-arrow">▼</span> 📁 src
        </div>
        <div class="sf-file-item indent">
          <span class="sf-file-arrow">▼</span> 📁 components
        </div>
        <div class="sf-file-item indent2">📄 MenuBar.vue</div>
        <div class="sf-file-item indent2">📄 Docker.vue</div>
        <div class="sf-file-item indent2">📄 Workspace.vue</div>
        <div class="sf-file-item indent">📁 core</div>
        <div class="sf-file-item indent2">📄 component.ts</div>
        <div class="sf-file-item indent">📁 styles</div>
        <div class="sf-file-item indent2">📄 main.css</div>
        <div class="sf-file-item">📁 tests</div>
        <div class="sf-file-item">📄 package.json</div>
        <div class="sf-file-item">📄 tsconfig.json</div>
        <div class="sf-file-item">📄 README.md</div>
      </div>

      <!-- Search -->
      <div v-else-if="activeTag === 'search'" class="sf-search-panel">
        <div class="sf-search-box">
          <input type="text" placeholder="Search files..." />
          <button>🔍</button>
        </div>
        <div class="sf-search-results">
          <div class="sf-search-result">
            <span class="sf-search-file">App.vue</span>
            <span class="sf-search-match">import { ref } from 'vue'</span>
          </div>
          <div class="sf-search-result">
            <span class="sf-search-file">MenuBar.vue</span>
            <span class="sf-search-match">addMenu</span>
          </div>
          <div class="sf-search-result">
            <span class="sf-search-file">Docker.vue</span>
            <span class="sf-search-match">onTagSelected</span>
          </div>
        </div>
      </div>

      <!-- Source Control -->
      <div v-else-if="activeTag === 'source-control'" class="sf-scm-panel">
        <div class="sf-scm-section">
          <div class="sf-scm-section-title">Changes (3)</div>
          <div class="sf-scm-file modified">M  Workspace.vue</div>
          <div class="sf-scm-file added">A  StatusBar.vue</div>
          <div class="sf-scm-file modified">M  main.css</div>
        </div>
        <div class="sf-scm-section">
          <div class="sf-scm-section-title">Staged (0)</div>
          <div class="sf-scm-empty">No staged changes</div>
        </div>
        <div class="sf-scm-commit">
          <input type="text" placeholder="Commit message..." />
          <button>✓ Commit</button>
        </div>
      </div>

      <!-- Extensions -->
      <div v-else-if="activeTag === 'extensions'" class="sf-ext-panel">
        <div class="sf-ext-item">
          <span>🧩</span>
          <div><strong>Theme: Dark+</strong><br /><small>Default dark theme</small></div>
        </div>
        <div class="sf-ext-item">
          <span>🎨</span>
          <div><strong>Icon Pack</strong><br /><small>Material icons</small></div>
        </div>
        <div class="sf-ext-item">
          <span>🐛</span>
          <div><strong>Debugger</strong><br /><small>Integrated debugger</small></div>
        </div>
      </div>

      <!-- Settings -->
      <div v-else-if="activeTag === 'settings'" class="sf-settings-panel">
        <div class="sf-settings-item">
          <label>Font Size</label>
          <input type="number" value="14" />
        </div>
        <div class="sf-settings-item">
          <label>Tab Size</label>
          <input type="number" value="2" />
        </div>
        <div class="sf-settings-item">
          <label>Auto Save</label>
          <input type="checkbox" checked />
        </div>
        <div class="sf-settings-item">
          <label>Minimap</label>
          <input type="checkbox" checked />
        </div>
      </div>
    </div>

    <div
      class="sf-panel-resize-handle sf-panel-resize-handle--right"
      @mousedown="onMouseDown"
    />
  </div>
</template>