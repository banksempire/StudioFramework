<script setup lang="ts">
import { computed } from 'vue';
import type { PanelPayload } from '../types/panel.js';
import Panel from './Panel.vue';

const props = defineProps<{
  activeTag: string;
  visible: boolean;
}>();

const emit = defineEmits<{
  'collapse': [];
}>();

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

const payload = computed<PanelPayload>(() => {
  switch (props.activeTag) {
    case 'explorer':
      return {
        title: title.value,
        sections: [
          {
            id: 'workspace',
            label: 'Workspace',
            subSections: [
              {
                id: 'file-tree',
                displayName: 'Project Files',
                expanded: true,
                actionButtons: [
                  { id: 'refresh', icon: '⟳', tooltip: 'Refresh' },
                  { id: 'collapse-all', icon: '⊟', tooltip: 'Collapse All' },
                ],
                components: [
                  {
                    type: 'tree',
                    id: 'explorer-tree',
                    contents: [
                      { id: 'src', label: 'src', icon: '📁', expanded: true, children: [
                        { id: 'components', label: 'components', icon: '📁', expanded: true, children: [
                          { id: 'menubar', label: 'MenuBar.vue', icon: '📄' },
                          { id: 'docker', label: 'Docker.vue', icon: '📄' },
                          { id: 'workspace', label: 'Workspace.vue', icon: '📄' },
                        ]},
                        { id: 'composables', label: 'composables', icon: '📁', children: [
                          { id: 'useresize', label: 'useResize.ts', icon: '📄' },
                        ]},
                        { id: 'styles', label: 'styles', icon: '📁', children: [
                          { id: 'maincss', label: 'main.css', icon: '📄' },
                        ]},
                      ]},
                      { id: 'package', label: 'package.json', icon: '📄' },
                      { id: 'tsconfig', label: 'tsconfig.json', icon: '📄' },
                      { id: 'readme', label: 'README.md', icon: '📄' },
                    ],
                  },
                ],
              },
              {
                id: 'outline',
                displayName: 'Outline',
                expanded: false,
                lazyLoad: true,
                components: [],
              },
            ],
          },
        ],
      };

    case 'search':
      return {
        title: title.value,
        sections: [
          {
            id: 'search-section',
            label: 'Search',
            subSections: [
              {
                id: 'search-files',
                displayName: 'Search Results',
                components: [
                  { type: 'textBox', id: 'search-input', contents: { value: '', placeholder: 'Search files...', label: 'Find' } },
                  { type: 'label', id: 'search-result-1', contents: { text: 'App.vue — import { ref } from \'vue\'' } },
                  { type: 'label', id: 'search-result-2', contents: { text: 'MenuBar.vue — addMenu' } },
                  { type: 'label', id: 'search-result-3', contents: { text: 'Docker.vue — onTagSelected' } },
                ],
              },
            ],
          },
        ],
      };

    case 'source-control':
      return {
        title: title.value,
        sections: [
          {
            id: 'scm-section',
            label: 'Changes',
            subSections: [
              {
                id: 'changes',
                displayName: 'Changes (3)',
                components: [
                  { type: 'label', id: 'change-1', contents: { text: 'M  Workspace.vue' } },
                  { type: 'label', id: 'change-2', contents: { text: 'A  StatusBar.vue' } },
                  { type: 'label', id: 'change-3', contents: { text: 'M  main.css' } },
                ],
              },
              {
                id: 'staged',
                displayName: 'Staged (0)',
                components: [
                  { type: 'label', id: 'staged-empty', contents: { text: 'No staged changes' } },
                ],
              },
              {
                id: 'commit',
                displayName: 'Commit',
                components: [
                  { type: 'textBox', id: 'commit-msg', contents: { value: '', placeholder: 'Commit message...' } },
                  { type: 'button', id: 'commit-btn', contents: { label: '✓ Commit', variant: 'primary' } },
                ],
              },
            ],
          },
        ],
      };

    case 'extensions':
      return {
        title: title.value,
        sections: [{
          id: 'ext',
          label: 'Extensions',
          subSections: [
            {
              id: 'installed',
              displayName: 'Installed',
              components: [
                { type: 'label', id: 'ext-1', contents: { text: '🧩 Theme: Dark+ — Default dark theme' } },
                { type: 'label', id: 'ext-2', contents: { text: '🎨 Icon Pack — Material icons' } },
                { type: 'label', id: 'ext-3', contents: { text: '🐛 Debugger — Integrated debugger' } },
              ],
            },
          ],
        }],
      };

    case 'settings':
      return {
        title: title.value,
        sections: [{
          id: 'settings-sec',
          label: 'Settings',
          subSections: [
            {
              id: 'editor-settings',
              displayName: 'Editor',
              components: [
                { type: 'slider', id: 'font-size', contents: { min: 10, max: 32, value: 14, label: 'Font Size' } },
                { type: 'dropdown', id: 'tab-size', contents: { options: ['2', '4', '8'], value: '2', label: 'Tab Size' } },
                { type: 'checkbox', id: 'auto-save', contents: { checked: true, label: 'Auto Save' } },
                { type: 'checkbox', id: 'minimap', contents: { checked: true, label: 'Minimap' } },
              ],
            },
          ],
        }],
      };

    default:
      return { title: title.value, sections: [] };
  }
});
</script>

<template>
  <Panel
    :payload="payload"
    :visible="visible"
    position="left"
    @collapse="emit('collapse')"
  />
</template>
