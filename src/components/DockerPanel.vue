<script setup lang="ts">
import { computed } from 'vue';
import Panel from './Panel.vue';
import type { PanelSection } from '../types/panel';

const props = defineProps<{
  activeTag: string;
  visible: boolean;
}>();

const emit = defineEmits<{
  collapse: [];
}>();

interface PanelDef {
  title: string;
  sections: PanelSection[];
}

const panels: Record<string, PanelDef> = {
  explorer: {
    title: 'Files',
    sections: [
      {
        id: 'files', label: 'Files',
        subSections: [
          {
            id: 'open-editors', label: 'Open Editors', isHeightVariable: false,
            components: [
              { type: 'list', items: [
                { id: '1', label: 'main.ts', icon: '📄' },
                { id: '2', label: 'App.vue', icon: '📄' },
                { id: '3', label: 'Panel.vue', icon: '📄' },
              ]},
            ],
          },
          {
            id: 'project', label: 'Project', isHeightVariable: true, minHeight: 80,
            utilities: [
              { id: 'new-file', icon: '📄', tooltip: 'New File' },
              { id: 'new-folder', icon: '📁', tooltip: 'New Folder' },
              { id: 'refresh', icon: '↻', tooltip: 'Refresh' },
              { id: 'collapse', icon: '⤢', tooltip: 'Collapse All' },
            ],
            components: [
              { type: 'tree', nodes: [
                { id: 'src', label: 'src', icon: '📁', children: [
                  { id: 'main', label: 'main.ts', icon: '📄' },
                  { id: 'app', label: 'App.vue', icon: '📄' },
                  { id: 'comp', label: 'components', icon: '📁', children: [
                    { id: 'panel', label: 'Panel.vue', icon: '📄' },
                    { id: 'docker', label: 'Docker.vue', icon: '📄' },
                    { id: 'workspace', label: 'Workspace.vue', icon: '📄' },
                    { id: 'menubar', label: 'MenuBar.vue', icon: '📄' },
                    { id: 'statusbar', label: 'StatusBar.vue', icon: '📄' },
                  ]},
                  { id: 'comp-sub', label: 'SubsectionBody.vue', icon: '📄' },
                  { id: 'comp-ss', label: 'SubSection.vue', icon: '📄' },
                  { id: 'comp-pc', label: 'PanelComponent.vue', icon: '📄' },
                ]},
                { id: 'pub', label: 'public', icon: '📁', children: [
                  { id: 'fav', label: 'favicon.ico', icon: '📄' },
                ]},
                { id: 'pkg', label: 'package.json', icon: '📄' },
                { id: 'ts', label: 'tsconfig.json', icon: '📄' },
                { id: 'vite', label: 'vite.config.ts', icon: '📄' },
              ]},
            ],
          },
          {
            id: 'outline', label: 'Outline', isHeightVariable: true, minHeight: 50,
            components: [
              { type: 'tree', nodes: [
                { id: 'o1', label: 'App', icon: '☰', children: [
                  { id: 'o2', label: 'setup()', icon: 'ƒ' },
                  { id: 'o3', label: 'onTagSelected()', icon: 'ƒ' },
                ]},
              ]},
            ],
          },
          {
            id: 'timeline', label: 'Timeline', isHeightVariable: true, minHeight: 50,
            components: [
              { type: 'list', items: [
                { id: 't1', label: 'Commit: initial scaffold' },
                { id: 't2', label: 'Commit: add Panel.vue' },
                { id: 't3', label: 'Commit: add SSB overflow' },
              ]},
            ],
          },
        ],
      },
      {
        id: 'npm', label: 'NPM Scripts', subSections: [
          {
            id: 'scripts', label: 'Scripts', isHeightVariable: false,
            components: [
              { type: 'keyValueList', items: [
                { key: 'dev', value: 'vite' },
                { key: 'build', value: 'vite build' },
                { key: 'preview', value: 'vite preview' },
              ]},
            ],
          },
        ],
      },
      {
        id: 'todo', label: 'TODO', subSections: [
          {
            id: 'todos', label: 'TODOs', isHeightVariable: true, minHeight: 50,
            components: [
              { type: 'list', items: [
                { id: 'td1', label: 'Panel.vue: fix overflow edge case', icon: '⚠' },
                { id: 'td2', label: 'SubSection: add lazy load', icon: '⚠' },
              ]},
            ],
          },
        ],
      },
    ],
  },
  search: {
    title: 'Search',
    sections: [
      {
        id: 'search', label: 'Search', subSections: [
          {
            id: 'search-input', label: 'Search', isHeightVariable: false,
            components: [
              { type: 'input', value: '', placeholder: 'Search...' },
              { type: 'text', text: '3 results in 2 files', muted: true },
            ],
          },
          {
            id: 'search-results', label: 'Results', isHeightVariable: true, minHeight: 80,
            components: [
              { type: 'list', items: [
                { id: 'r1', label: 'Panel.vue:12  onTagSelected' },
                { id: 'r2', label: 'Panel.vue:28  selectSection' },
                { id: 'r3', label: 'App.vue:5    activeDockerTag' },
              ]},
            ],
          },
        ],
      },
    ],
  },
  'source-control': {
    title: 'Source Control',
    sections: [
      {
        id: 'scm', label: 'SCM', subSections: [
          {
            id: 'changes', label: 'Changes', isHeightVariable: true, minHeight: 60,
            utilities: [{ id: 'refresh', icon: '↻', tooltip: 'Refresh' }],
            components: [
              { type: 'list', items: [
                { id: 'c1', label: 'M  App.vue', icon: 'M' },
                { id: 'c2', label: 'M  Panel.vue', icon: 'M' },
                { id: 'c3', label: 'A  SubsectionBody.vue', icon: 'A' },
                { id: 'c4', label: 'A  SubSection.vue', icon: 'A' },
              ]},
            ],
          },
          {
            id: 'staged', label: 'Staged Changes', isHeightVariable: true, minHeight: 50,
            components: [
              { type: 'list', items: [
                { id: 's1', label: 'M  main.css', icon: 'M' },
              ]},
            ],
          },
        ],
      },
    ],
  },
  debug: {
    title: 'Debug',
    sections: [
      {
        id: 'variables', label: 'Variables', subSections: [
          {
            id: 'vars', label: 'Variables', isHeightVariable: false,
            components: [
              { type: 'keyValueList', items: [
                { key: 'this', value: 'App {...}' },
                { key: 'activeTag', value: '"explorer"' },
                { key: 'panelVisible', value: 'true' },
              ]},
            ],
          },
        ],
      },
      {
        id: 'watch', label: 'Watch', subSections: [
          {
            id: 'watch-list', label: 'Watch', isHeightVariable: true, minHeight: 50,
            components: [
              { type: 'text', text: 'No watch expressions added', muted: true },
            ],
          },
        ],
      },
      {
        id: 'callstack', label: 'Call Stack', subSections: [
          {
            id: 'stack', label: 'Call Stack', isHeightVariable: true, minHeight: 50,
            components: [
              { type: 'list', items: [
                { id: 'f1', label: 'onTagSelected  App.vue:12' },
                { id: 'f2', label: 'emit           Panel.vue:28' },
              ]},
            ],
          },
        ],
      },
    ],
  },
  extensions: {
    title: 'Extensions',
    sections: [
      {
        id: 'extensions', label: 'Extensions', subSections: [
          {
            id: 'installed', label: 'Installed', isHeightVariable: true, minHeight: 60,
            components: [
              { type: 'list', items: [
                { id: 'e1', label: 'Vue 3 Snippets', icon: '🟢', badge: '3.0' },
                { id: 'e2', label: 'TypeScript Vue Plugin', icon: '🟢', badge: '1.8' },
              ]},
            ],
          },
          {
            id: 'popular', label: 'Popular', isHeightVariable: true, minHeight: 60,
            components: [
              { type: 'list', items: [
                { id: 'p1', label: 'Prettier', icon: '🟦', badge: '2.1' },
                { id: 'p2', label: 'ESLint', icon: '🟦', badge: '8.0' },
              ]},
            ],
          },
        ],
      },
    ],
  },
  settings: {
    title: 'Settings',
    sections: [
      {
        id: 'editor', label: 'Editor', subSections: [
          {
            id: 'appearance', label: 'Appearance', isHeightVariable: false,
            components: [
              { type: 'keyValueList', items: [
                { key: 'Font Family', value: 'Consolas' },
                { key: 'Font Size', value: '13' },
                { key: 'Line Height', value: '1.5' },
                { key: 'Tab Size', value: '2' },
              ]},
            ],
          },
          {
            id: 'text-editor', label: 'Text Editor', isHeightVariable: false,
            components: [
              { type: 'keyValueList', items: [
                { key: 'Word Wrap', value: 'on' },
                { key: 'Minimap', value: 'off' },
                { key: 'Render Whitespace', value: 'selection' },
              ]},
            ],
          },
        ],
      },
      {
        id: 'workspace', label: 'Workspace', subSections: [
          {
            id: 'features', label: 'Features', isHeightVariable: false,
            components: [
              { type: 'keyValueList', items: [
                { key: 'Auto Save', value: 'afterDelay' },
                { key: 'Files Exclude', value: '**/node_modules' },
              ]},
            ],
          },
        ],
      },
    ],
  },
};

const def = computed(() => panels[props.activeTag] ?? panels.explorer);
const title = computed(() => def.value.title);
const sections = computed(() => def.value.sections);
</script>

<template>
  <Panel
    :title="title"
    :visible="visible"
    position="left"
    :sections="sections"
    @collapse="emit('collapse')"
  />
</template>
