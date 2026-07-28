import { MenuBar } from './components/menu-bar.js';
import { Docker } from './components/docker.js';
import { TagWindow } from './components/tag-window.js';
import { AppFrame } from './components/app-frame.js';
import { PropertyWindow } from './components/property-window.js';
import { StatusBar } from './components/status-bar.js';
import { Component } from './core/component.js';

// ─── Build the UI ──────────────────────────────────────────────────────────

const app = document.getElementById('app')!;

// Root layout
const root = document.createElement('div');
root.className = 'sf-root';
app.appendChild(root);

// 1. Menu Bar
const menuBar = new MenuBar();
menuBar.addMenu('File', [
  { label: 'New File', action: () => console.log('New File') },
  { label: 'Open Folder...', action: () => console.log('Open Folder') },
  { label: '', separator: true },
  { label: 'Save', action: () => console.log('Save') },
  { label: 'Save As...', action: () => console.log('Save As') },
  { label: '', separator: true },
  { label: 'Exit', action: () => console.log('Exit') },
]);
menuBar.addMenu('Edit', [
  { label: 'Undo', action: () => console.log('Undo') },
  { label: 'Redo', action: () => console.log('Redo') },
  { label: '', separator: true },
  { label: 'Cut', action: () => console.log('Cut') },
  { label: 'Copy', action: () => console.log('Copy') },
  { label: 'Paste', action: () => console.log('Paste') },
]);
menuBar.addMenu('Selection', [
  { label: 'Select All', action: () => console.log('Select All') },
  { label: 'Expand Selection', action: () => console.log('Expand') },
]);
menuBar.addMenu('View', [
  { label: 'Toggle Sidebar', action: () => console.log('Sidebar') },
  { label: 'Toggle Terminal', action: () => console.log('Terminal') },
  { label: '', separator: true },
  { label: 'Zoom In', action: () => console.log('Zoom In') },
  { label: 'Zoom Out', action: () => console.log('Zoom Out') },
]);
menuBar.addMenu('Help', [
  { label: 'About', action: () => alert('Studio Framework v1.0') },
  { label: 'Documentation', action: () => console.log('Docs') },
]);

root.appendChild(menuBar.el);

// 2. Workbench (horizontal row)
const workbench = document.createElement('div');
workbench.className = 'sf-workbench';
root.appendChild(workbench);

// 2a. Docker
const docker = new Docker();
docker.addTag({ id: 'explorer', icon: '📁', label: 'Explorer' });
docker.addTag({ id: 'search', icon: '🔍', label: 'Search' });
docker.addTag({ id: 'source-control', icon: '📄', label: 'Source Control', badge: 3 });
docker.addTag({ id: 'debug', icon: '🐛', label: 'Debug' });
docker.addTag({ id: 'extensions', icon: '🧩', label: 'Extensions' });
docker.addTag({ id: 'settings', icon: '⚙️', label: 'Settings' });
workbench.appendChild(docker.el);

// 2b. Tag Window
const tagWindow = new TagWindow('Files');
workbench.appendChild(tagWindow.el);

// 2c. App Frame
const appFrame = new AppFrame();
appFrame.addTab({ id: 'welcome', label: 'Welcome', icon: '🏠', closable: false });
appFrame.addTab({ id: 'app-ts', label: 'app.ts', icon: '📄' });
appFrame.addTab({ id: 'utils-ts', label: 'utils.ts', icon: '📄' });
appFrame.addTab({ id: 'styles-css', label: 'styles.css', icon: '🎨' });

// Show a welcome panel
const welcomePanel = new Component('div', { className: 'sf-welcome' });
welcomePanel.el.innerHTML = `
  <div class="sf-welcome-content">
    <h1>Studio Framework</h1>
    <p>A VSCode-like UI framework built with TypeScript</p>
    <div class="sf-welcome-shortcuts">
      <div class="sf-shortcut"><kbd>Ctrl+N</kbd> New File</div>
      <div class="sf-shortcut"><kbd>Ctrl+O</kbd> Open Folder</div>
      <div class="sf-shortcut"><kbd>Ctrl+S</kbd> Save</div>
      <div class="sf-shortcut"><kbd>Ctrl+P</kbd> Quick Open</div>
    </div>
  </div>
`;
appFrame.getPanelContainer().appendChild(welcomePanel.el);
workbench.appendChild(appFrame.el);

// 2d. Property Window
const propertyWindow = new PropertyWindow();
propertyWindow.setSections([
  {
    title: 'Font',
    fields: [
      { label: 'Family', value: 'Consolas', type: 'select', options: ['Consolas', 'Fira Code', 'JetBrains Mono', 'Monaco'] },
      { label: 'Size', value: '14', type: 'number' },
      { label: 'Ligatures', value: '✓', type: 'checkbox' },
    ],
  },
  {
    title: 'Language',
    fields: [
      { label: 'Mode', value: 'TypeScript', type: 'select', options: ['TypeScript', 'JavaScript', 'CSS', 'HTML', 'JSON'] },
      { label: 'Tab Size', value: '2', type: 'number' },
    ],
  },
  {
    title: 'Workspace',
    fields: [
      { label: 'Auto Save', value: '', type: 'checkbox' },
      { label: 'Word Wrap', value: '✓', type: 'checkbox' },
    ],
  },
]);
workbench.appendChild(propertyWindow.el);

// 3. Status Bar
const statusBar = new StatusBar();
statusBar.setItems([
  { text: 'Ln 1, Col 1' },
  { text: 'Spaces: 2' },
  { text: 'UTF-8' },
  { text: 'TypeScript', align: 'right' },
  { text: '🟢 main', align: 'right' },
  { text: 'Errors: 0 ⚠ 0', align: 'right' },
]);
root.appendChild(statusBar.el);

// ─── Docker → TagWindow interaction ─────────────────────────────────────────

docker.onTagSelected = (tagId: string) => {
  switch (tagId) {
    case 'explorer':
      tagWindow.setTitle('Files');
      showFileExplorer(tagWindow);
      break;
    case 'search':
      tagWindow.setTitle('Search');
      showSearch(tagWindow);
      break;
    case 'source-control':
      tagWindow.setTitle('Source Control');
      showSourceControl(tagWindow);
      break;
    case 'extensions':
      tagWindow.setTitle('Extensions');
      showExtensions(tagWindow);
      break;
    case 'settings':
      tagWindow.setTitle('Settings');
      showSettings(tagWindow);
      break;
  }
};

// Activate explorer by default
docker.setActive('explorer');
showFileExplorer(tagWindow);

// ─── AppFrame tab interaction ───────────────────────────────────────────────

appFrame.onTabSelected = (tabId) => {
  if (tabId === '__new__') {
    const count = appFrame as any;
    const id = `untitled-${Date.now()}`;
    appFrame.addTab({ id, label: `Untitled`, icon: '📄' });
    return;
  }
  console.log('Tab selected:', tabId);
};

appFrame.onTabClosed = (tabId) => {
  console.log('Tab closed:', tabId);
};

// ─── Tag Window content helpers ─────────────────────────────────────────────

function showFileExplorer(tw: TagWindow): void {
  const files = new Component('div', { className: 'sf-file-tree' });
  files.el.innerHTML = `
    <div class="sf-file-item folder expanded">
      <span class="sf-file-arrow">▼</span> 📁 src
    </div>
    <div class="sf-file-item indent">
      <span class="sf-file-arrow">▼</span> 📁 components
    </div>
    <div class="sf-file-item indent2">
      📄 menu-bar.ts
    </div>
    <div class="sf-file-item indent2">
      📄 docker.ts
    </div>
    <div class="sf-file-item indent2">
      📄 app-frame.ts
    </div>
    <div class="sf-file-item indent">
      📁 core
    </div>
    <div class="sf-file-item indent2">
      📄 component.ts
    </div>
    <div class="sf-file-item indent">
      📁 styles
    </div>
    <div class="sf-file-item indent2">
      📄 main.css
    </div>
    <div class="sf-file-item">
      📁 tests
    </div>
    <div class="sf-file-item">
      📄 package.json
    </div>
    <div class="sf-file-item">
      📄 tsconfig.json
    </div>
    <div class="sf-file-item">
      📄 README.md
    </div>
  `;
  tw.setContent(files);
}

function showSearch(tw: TagWindow): void {
  const search = new Component('div', { className: 'sf-search-panel' });
  search.el.innerHTML = `
    <div class="sf-search-box">
      <input type="text" placeholder="Search files..." />
      <button>🔍</button>
    </div>
    <div class="sf-search-results">
      <div class="sf-search-result">
        <span class="sf-search-file">app.ts</span>
        <span class="sf-search-match">import { Component }</span>
      </div>
      <div class="sf-search-result">
        <span class="sf-search-file">menu-bar.ts</span>
        <span class="sf-search-match">addMenu</span>
      </div>
      <div class="sf-search-result">
        <span class="sf-search-file">docker.ts</span>
        <span class="sf-search-match">onTagSelected</span>
      </div>
    </div>
  `;
  tw.setContent(search);
}

function showSourceControl(tw: TagWindow): void {
  const scm = new Component('div', { className: 'sf-scm-panel' });
  scm.el.innerHTML = `
    <div class="sf-scm-section">
      <div class="sf-scm-section-title">Changes (3)</div>
      <div class="sf-scm-file modified">M  app-frame.ts</div>
      <div class="sf-scm-file added">A  status-bar.ts</div>
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
  `;
  tw.setContent(scm);
}

function showExtensions(tw: TagWindow): void {
  const ext = new Component('div', { className: 'sf-ext-panel' });
  ext.el.innerHTML = `
    <div class="sf-ext-item">
      <span>🧩</span>
      <div><strong>Theme: Dark+</strong><br/><small>Default dark theme</small></div>
    </div>
    <div class="sf-ext-item">
      <span>🎨</span>
      <div><strong>Icon Pack</strong><br/><small>Material icons</small></div>
    </div>
    <div class="sf-ext-item">
      <span>🐛</span>
      <div><strong>Debugger</strong><br/><small>Integrated debugger</small></div>
    </div>
  `;
  tw.setContent(ext);
}

function showSettings(tw: TagWindow): void {
  const settings = new Component('div', { className: 'sf-settings-panel' });
  settings.el.innerHTML = `
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
  `;
  tw.setContent(settings);
}

console.log('Studio Framework ready ✓');
