'use client';

import { useRef, useState } from 'react';
import { DesignSystemCacheData } from '../lib/types';

interface Props {
  dsCache: DesignSystemCacheData | null;
  dsScanLoading: boolean;
  onScan: () => void;
  onImport: (cache: DesignSystemCacheData) => void;
}

export default function ComponentsPanel({ dsCache, dsScanLoading, onScan, onImport }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [exported, setExported] = useState(false);
  const cache = dsCache?.cache;

  const handleExport = () => {
    if (!dsCache) return;
    const blob = new Blob([JSON.stringify(dsCache, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `design-system-${cache?.pageName || 'components'}.json`;
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
    e.target.value = '';
  };

  // --- Empty state ---
  if (!cache) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
        <div className="text-2xl">
          <span role="img" aria-label="components">&#129513;</span>
        </div>
        <p className="text-12 text-figma-text-secondary leading-relaxed">
          Scan your file to discover which components are used and how often.
          Agents use this to check component consistency.
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

  const components = cache.components;
  const totalInstances = components.reduce((sum, c) => sum + c.instances, 0);

  return (
    <div className="flex-1 overflow-y-auto">
      {/* Header bar */}
      <div className="sticky top-0 z-10 bg-figma-bg border-b border-figma-border px-3 py-1.5 flex items-center justify-between">
        <span className="text-11 text-figma-text-tertiary">
          {components.length} component{components.length !== 1 ? 's' : ''} &middot; {totalInstances} instance{totalInstances !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-1">
          <button
            onClick={handleExport}
            className={`text-11 px-2 py-0.5 rounded-full border transition-colors
              ${exported
                ? 'border-figma-success text-figma-success'
                : 'border-figma-border text-figma-text-secondary hover:text-figma-text hover:border-figma-text-secondary'
              }`}
            title="Export as JSON"
          >
            {exported ? 'Exported!' : 'Export'}
          </button>
          <button
            onClick={handleImportClick}
            className="text-11 px-2 py-0.5 rounded-full border border-figma-border
                       text-figma-text-secondary hover:text-figma-text hover:border-figma-text-secondary
                       transition-colors"
            title="Import from JSON"
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

      <div className="px-3 py-2">
        {components.length === 0 ? (
          <p className="text-12 text-figma-text-tertiary text-center py-6">
            No component instances found on this page.
          </p>
        ) : (
          <div className="space-y-0.5">
            {components.map((comp, i) => {
              const pct = Math.round((comp.instances / totalInstances) * 100);
              return (
                <div key={i} className="flex items-center gap-2 text-11 py-0.5">
                  <span className="text-figma-text truncate flex-1" title={comp.name}>
                    {comp.name}
                  </span>
                  {/* Mini usage bar */}
                  <div className="w-12 h-1 bg-figma-surface rounded-full overflow-hidden shrink-0">
                    <div
                      className="h-full bg-figma-accent rounded-full"
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    />
                  </div>
                  <span className="text-figma-text-tertiary shrink-0 w-8 text-right">
                    &times;{comp.instances}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Scan timestamp */}
        <p className="text-11 text-figma-text-tertiary text-center pt-3">
          Scanned {new Date(cache.scannedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
