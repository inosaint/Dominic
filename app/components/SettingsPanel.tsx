'use client';

import { Settings } from '../lib/types';

interface Props {
  settings: Settings;
  onChange: (settings: Settings) => void;
  onClearAnnotations: () => void;
  onClose: () => void;
}

export default function SettingsPanel({
  settings,
  onChange,
  onClearAnnotations,
  onClose,
}: Props) {
  const update = (partial: Partial<Settings>) => {
    onChange({ ...settings, ...partial });
  };

  return (
    <div className="absolute inset-0 bg-figma-bg z-10 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-figma-border">
        <h2 className="text-12 font-semibold text-figma-text">Settings</h2>
        <button
          onClick={onClose}
          className="text-figma-text-secondary hover:text-figma-text text-13 px-1"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Provider */}
        <div>
          <label className="block text-11 text-figma-text-secondary mb-1">
            API Provider
          </label>
          <select
            value={settings.provider}
            onChange={(e) => {
              const provider = e.target.value as 'anthropic' | 'openai';
              const model =
                provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o';
              update({ provider, model });
            }}
            className="w-full bg-figma-surface border border-figma-border rounded px-2 py-1.5
                       text-12 text-figma-text focus:outline-none focus:border-figma-accent"
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>

        {/* API Key */}
        <div>
          <label className="block text-11 text-figma-text-secondary mb-1">
            API Key
          </label>
          <input
            type="password"
            value={settings.apiKey}
            onChange={(e) => update({ apiKey: e.target.value })}
            placeholder={
              settings.provider === 'anthropic'
                ? 'sk-ant-...'
                : 'sk-...'
            }
            className="w-full bg-figma-surface border border-figma-border rounded px-2 py-1.5
                       text-12 text-figma-text placeholder:text-figma-text-tertiary
                       focus:outline-none focus:border-figma-accent"
          />
          <p className="text-11 text-figma-text-tertiary mt-1">
            Stored locally on your machine only.
          </p>
        </div>

        {/* Model */}
        <div>
          <label className="block text-11 text-figma-text-secondary mb-1">
            Model
          </label>
          <input
            type="text"
            value={settings.model}
            onChange={(e) => update({ model: e.target.value })}
            className="w-full bg-figma-surface border border-figma-border rounded px-2 py-1.5
                       text-12 text-figma-text focus:outline-none focus:border-figma-accent"
          />
        </div>

        {/* Toggles */}
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.includeScreenshot}
              onChange={(e) => update({ includeScreenshot: e.target.checked })}
              className="rounded border-figma-border"
            />
            <span className="text-12 text-figma-text">Include screenshot</span>
          </label>
          <p className="text-11 text-figma-text-tertiary ml-6">
            Sends a 2x PNG for visual context. Uses more tokens.
          </p>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoClearPrevious}
              onChange={(e) => update({ autoClearPrevious: e.target.checked })}
              className="rounded border-figma-border"
            />
            <span className="text-12 text-figma-text">
              Auto-clear previous annotations
            </span>
          </label>
        </div>

        {/* Clear annotations */}
        <div className="pt-2 border-t border-figma-border">
          <button
            onClick={onClearAnnotations}
            className="w-full py-1.5 text-12 rounded border border-figma-error text-figma-error
                       hover:bg-figma-error hover:text-white transition-colors"
          >
            Clear all AI annotations
          </button>
          <p className="text-11 text-figma-text-tertiary mt-1">
            Removes all &ldquo;AI Review&rdquo; annotations from the selected frame.
          </p>
        </div>
      </div>
    </div>
  );
}
