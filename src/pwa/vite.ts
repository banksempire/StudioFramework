import type { Plugin } from 'vite';

const FALLBACK_ICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><title>App</title><rect width="64" height="64" rx="14" fill="#1e1e1e"/><rect x="1" y="1" width="62" height="62" rx="13" fill="none" stroke="#3a3a3a" stroke-width="2"/><g stroke="#007acc" stroke-width="5" stroke-linecap="round" fill="none"><rect x="14" y="15" width="36" height="34" rx="6"/><path d="M14 27h36"/><path d="M27 27v22"/></g></svg>';

export interface SfPwaOptions {
  name: string;
  shortName?: string;
  description?: string;
  themeColor?: string;
  backgroundColor?: string;
  display?: 'fullscreen' | 'standalone' | 'minimal-ui' | 'window-controls-overlay';
  startUrl?: string;
  scope?: string;
  iconUrl?: string;
}

export function sfPwa(options: SfPwaOptions): Plugin {
  const shortName = options.shortName ?? options.name;
  const display = options.display ?? 'standalone';
  const startUrl = options.startUrl ?? '/';
  const scope = options.scope ?? '/';
  const backgroundColor = options.backgroundColor ?? '#1e1e1e';
  const fallbackIcon = !options.iconUrl;
  const iconUrl = options.iconUrl ?? '/sf-pwa-icon.svg';

  function buildManifest(): Record<string, unknown> {
    const manifest: Record<string, unknown> = {
      name: options.name,
      short_name: shortName,
      start_url: startUrl,
      scope,
      display,
      background_color: backgroundColor,
      icons: [{ src: iconUrl, sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    };
    if (options.description) manifest.description = options.description;
    if (options.themeColor) manifest.theme_color = options.themeColor;
    return manifest;
  }

  function serveJson(res: {
    statusCode: number;
    setHeader: (k: string, v: string) => void;
    end: (b: string) => void;
  }) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
    res.end(`${JSON.stringify(buildManifest(), null, 2)}\n`);
  }

  function serveIcon(res: {
    statusCode: number;
    setHeader: (k: string, v: string) => void;
    end: (b: string) => void;
  }) {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.end(FALLBACK_ICON_SVG);
  }

  return {
    name: 'sf-pwa',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        if (html.includes('rel="manifest"')) return html;
        return html.replace('</head>', '  <link rel="manifest" href="/manifest.webmanifest" />\n</head>');
      },
    },
    configureServer(server) {
      server.middlewares.use('/manifest.webmanifest', (_req, res) => serveJson(res));
      if (fallbackIcon) server.middlewares.use('/sf-pwa-icon.svg', (_req, res) => serveIcon(res));
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: `${JSON.stringify(buildManifest(), null, 2)}\n`,
      });
      if (fallbackIcon)
        this.emitFile({ type: 'asset', fileName: 'sf-pwa-icon.svg', source: FALLBACK_ICON_SVG });
    },
  };
}
