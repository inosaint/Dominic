'use client';

import { useRef, useState } from 'react';
import { DesignSystemCacheData } from '../lib/types';

interface Props {
  dsCache: DesignSystemCacheData | null;
  dsScanLoading: boolean;
  onScan: () => void;
  onImport: (cache: DesignSystemCacheData) => void;
}

function ColorSwatch({ hex }: { hex: string }) {
  return (
    <span
      className="inline-block w-3 h-3 rounded-sm border border-figma-border shrink-0"
      style={{ backgroundColor: hex }}
    />
  );
}

export default function TokensPanel({ dsCache, dsScanLoading, onScan, onImport }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exported, setExported] = useState(false);
  const cache = dsCache?.cache;

  const handleExport = () => {
    if (!dsCache) return;
    const blob = new Blob([JSON.stringify(dsCache, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `design-system-${cache?.pageName || 'tokens'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as DesignSystemCacheData;
        if (data.cache && data.promptContext) {
          onImport(data);
        }
      } catch {
        // Invalid file — silently ignore
      }
    };
    reader.readAsText(file);
    // Reset so the same file can be re-imported
    e.target.value = '';
  };

  // --- Empty state ---
  if (!cache) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
        <div className="text-2xl">
          <span role="img" aria-label="palette">&#127912;</span>
        </div>
        <p className="text-12 text-figma-text-secondary leading-relaxed">
          Scan your file to extract design tokens — colors, type scale, spacing,
          and more. Agents use this to give token-aware feedback.
        </p>
        <button
          onClick={onScan}
          disabled={dsScanLoading}
          className="px-4 py-1.5 text-11 rounded-full bg-figma-accent text-white
                     hover:bg-figma-accent-hover disabled:opacity-40 transition-colors"
        >
          {dsScanLoading ? 'Scanning...' : 'Scan design system'}
        </button>
        <button
          onClick={handleImportClick}
          className="text-11 text-figma-text-tertiary hover:text-figma-text-secondary transition-colors"
        >
          or import from file
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>
    );
  }

  // --- Token display ---
  const fillEntries = Object.entries(cache.colors.fills).sort(
    (a, b) => b[1].count - a[1].count
  );
  const strokeEntries = Object.entries(cache.colors.strokes).sort(
    (a, b) => b[1].count - a[1].count
  );
  const padEntries = Object.entries(cache.spacing.padding).sort(
    (a, b) => Number(a[0]) - Number(b[0])
  );
  const gapEntries = Object.entries(cache.spacing.gap).sort(
    (a, b) => Number(a[0]) - Number(b[0])
  );
  const radiiEntries = Object.entries(cache.radii).sort(
    (a, b) => Number(a[0]) - Number(b[0])
  );
  const effectEntries = Object.entries(cache.effects).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header bar */}
      <div className="sticky top-0 z-10 bg-figma-bg border-b border-figma-border px-3 py-1.5 flex items-center justify-between">
        <span className="text-11 text-figma-text-tertiary">
          {cache.nodeCount} nodes &middot; {cache.pageName}
        </span>
        <div className="flex gap-1">
          <button
            onClick={handleExport}
            className={`text-11 px-2 py-0.5 rounded-full border transition-colors
              ${exported
                ? 'border-figma-success text-figma-success'
                : 'border-figma-border text-figma-text-secondary hover:text-figma-text hover:border-figma-text-secondary'
              }`}
            title="Export tokens as JSON"
          >
            {exported ? 'Exported!' : 'Export'}
          </button>
          <button
            onClick={handleImportClick}
            className="text-11 px-2 py-0.5 rounded-full border border-figma-border
                       text-figma-text-secondary hover:text-figma-text hover:border-figma-text-secondary
                       transition-colors"
            title="Import tokens from JSON"
          >
            Import
          </button>
          <button
            onClick={onScan}
            disabled={dsScanLoading}
            className="text-11 px-2 py-0.5 rounded-full border border-figma-accent
                       text-figma-accent hover:bg-figma-accent hover:text-white
                       disabled:opacity-40 transition-colors"
          >
            {dsScanLoading ? 'Scanning...' : 'Rescan'}
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      <div className="px-3 py-2 space-y-3">
        {/* Fill Colors */}
        {fillEntries.length > 0 && (
          <section>
            <h3 className="text-11 font-semibold text-figma-text-secondary mb-1">
              Fill Colors ({fillEntries.length})
            </h3>
            <div className="space-y-0.5">
              {fillEntries.map(([hex, entry]) => (
                <div key={hex} className="flex items-center gap-2 text-11">
                  <ColorSwatch hex={hex} />
                  <span className="text-figma-text font-mono">{hex}</span>
                  {entry.token && (
                    <span className="text-figma-accent truncate">{entry.token}</span>
                  )}
                  <span className="ml-auto text-figma-text-tertiary shrink-0">
                    &times;{entry.count}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Stroke Colors */}
        {strokeEntries.length > 0 && (
          <section>
            <h3 className="text-11 font-semibold text-figma-text-secondary mb-1">
              Stroke Colors ({strokeEntries.length})
            </h3>
            <div className="space-y-0.5">
              {strokeEntries.map(([hex, entry]) => (
                <div key={hex} className="flex items-center gap-2 text-11">
                  <ColorSwatch hex={hex} />
                  <span className="text-figma-text font-mono">{hex}</span>
                  {entry.token && (
                    <span className="text-figma-accent truncate">{entry.token}</span>
                  )}
                  <span className="ml-auto text-figma-text-tertiary shrink-0">
                    &times;{entry.count}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Typography */}
        {cache.typography.length > 0 && (
          <section>
            <h3 className="text-11 font-semibold text-figma-text-secondary mb-1">
              Type Scale ({cache.typography.length})
            </h3>
            <div className="space-y-0.5">
              {cache.typography.map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-11">
                  <span className="text-figma-text">
                    {t.family} {t.size}px
                  </span>
                  <span className="text-figma-text-tertiary">
                    w{t.weight}
                    {t.lineHeight != null && ` / lh ${t.lineHeight}`}
                  </span>
                  <span className="ml-auto text-figma-text-tertiary shrink-0">
                    &times;{t.count}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Spacing */}
        {(padEntries.length > 0 || gapEntries.length > 0) && (
          <section>
            <h3 className="text-11 font-semibold text-figma-text-secondary mb-1">
              Spacing
            </h3>
            {padEntries.length > 0 && (
              <div className="text-11 text-figma-text mb-0.5">
                <span className="text-figma-text-tertiary">Padding: </span>
                {padEntries.map(([v, c]) => `${v}px ×${c}`).join(', ')}
              </div>
            )}
            {gapEntries.length > 0 && (
              <div className="text-11 text-figma-text">
                <span className="text-figma-text-tertiary">Gap: </span>
                {gapEntries.map(([v, c]) => `${v}px ×${c}`).join(', ')}
              </div>
            )}
          </section>
        )}

        {/* Radii */}
        {radiiEntries.length > 0 && (
          <section>
            <h3 className="text-11 font-semibold text-figma-text-secondary mb-1">
              Corner Radii
            </h3>
            <div className="text-11 text-figma-text">
              {radiiEntries.map(([v, c]) => `${v}px ×${c}`).join(', ')}
            </div>
          </section>
        )}

        {/* Effects */}
        {effectEntries.length > 0 && (
          <section>
            <h3 className="text-11 font-semibold text-figma-text-secondary mb-1">
              Effects ({effectEntries.length})
            </h3>
            <div className="space-y-0.5">
              {effectEntries.map(([key, count]) => (
                <div key={key} className="flex items-center gap-2 text-11">
                  <span className="text-figma-text">{key}</span>
                  <span className="ml-auto text-figma-text-tertiary shrink-0">
                    &times;{count}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Scan timestamp */}
        <p className="text-11 text-figma-text-tertiary text-center pt-2">
          Scanned {new Date(cache.scannedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
