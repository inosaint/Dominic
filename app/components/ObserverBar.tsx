'use client';

import { ObserverHints } from '../lib/types';

interface Props {
  observerEnabled: boolean;
  onToggle: (enabled: boolean) => void;
  hints: ObserverHints | null;
  hasCache: boolean;
}

const HINT_ICONS: Record<string, string> = {
  color: '\u25CF',      // ●
  spacing: '\u2194',    // ↔
  typography: 'Aa',
  radius: '\u25E0',     // ◠
};

export default function ObserverBar({ observerEnabled, onToggle, hints, hasCache }: Props) {
  if (!hasCache) return null;

  return (
    <div className="shrink-0 border-b border-figma-border">
      {/* Toggle row */}
      <div className="px-3 py-1.5 flex items-center justify-between">
        <span className="text-11 text-figma-text-secondary">
          Observer
        </span>
        <button
          onClick={() => onToggle(!observerEnabled)}
          className={`relative w-7 h-4 rounded-full transition-colors ${
            observerEnabled ? 'bg-figma-accent' : 'bg-figma-border'
          }`}
        >
          <span
            className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-transform ${
              observerEnabled ? 'left-3.5' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      {/* Hints */}
      {observerEnabled && hints && hints.hints.length > 0 && (
        <div className="px-3 pb-2 space-y-1">
          {hints.hints.map((hint, i) => (
            <div
              key={i}
              className="flex items-start gap-1.5 text-11"
            >
              <span className="text-figma-warning shrink-0 w-3 text-center text-10 mt-px">
                {HINT_ICONS[hint.type] || '!'}
              </span>
              <span className="text-figma-text-secondary leading-snug">
                {hint.message}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Clean state */}
      {observerEnabled && hints && hints.hints.length === 0 && (
        <div className="px-3 pb-2">
          <span className="text-11 text-figma-text-tertiary">
            No deviations found in {hints.frameName}
          </span>
        </div>
      )}
    </div>
  );
}
