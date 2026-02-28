'use client';

import { useState } from 'react';
import { Settings, OutputMode, CustomAgentConfig } from '../lib/types';

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
  const [showAgentForm, setShowAgentForm] = useState(false);
  const [newAgentName, setNewAgentName] = useState('');
  const [newAgentEmoji, setNewAgentEmoji] = useState('');
  const [newAgentSubtitle, setNewAgentSubtitle] = useState('');
  const [newAgentPrompt, setNewAgentPrompt] = useState('');

  const update = (partial: Partial<Settings>) => {
    onChange({ ...settings, ...partial });
  };

  const addCustomAgent = () => {
    if (!newAgentName.trim() || !newAgentPrompt.trim()) return;
    const id = newAgentName.toLowerCase().replace(/[^a-z0-9]/g, '-') + '-' + Date.now();
    const agent: CustomAgentConfig = {
      id,
      name: newAgentName.trim(),
      emoji: newAgentEmoji.trim() || '',
      subtitle: newAgentSubtitle.trim() || 'Custom agent',
      systemPrompt: newAgentPrompt.trim(),
    };
    update({ customAgents: [...(settings.customAgents || []), agent] });
    setNewAgentName('');
    setNewAgentEmoji('');
    setNewAgentSubtitle('');
    setNewAgentPrompt('');
    setShowAgentForm(false);
  };

  const removeCustomAgent = (id: string) => {
    update({
      customAgents: (settings.customAgents || []).filter((a) => a.id !== id),
    });
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

        {/* Output mode */}
        <div>
          <label className="block text-11 text-figma-text-secondary mb-1">
            Output Mode
          </label>
          <select
            value={settings.outputMode || 'sticky-notes'}
            onChange={(e) => update({ outputMode: e.target.value as OutputMode })}
            className="w-full bg-figma-surface border border-figma-border rounded px-2 py-1.5
                       text-12 text-figma-text focus:outline-none focus:border-figma-accent"
          >
            <option value="sticky-notes">Sticky notes on canvas</option>
            <option value="annotations">Annotations (requires paid plan)</option>
            <option value="both">Both</option>
          </select>
          <p className="text-11 text-figma-text-tertiary mt-1">
            Sticky notes work on all plans. Annotations require Dev Mode (paid).
          </p>
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
              Auto-clear previous review output
            </span>
          </label>
        </div>

        {/* Custom Agents */}
        <div className="pt-2 border-t border-figma-border">
          <label className="block text-11 text-figma-text-secondary mb-2">
            Custom Review Agents
          </label>

          {/* Existing custom agents */}
          {(settings.customAgents || []).map((agent) => (
            <div
              key={agent.id}
              className="flex items-center justify-between bg-figma-surface rounded px-2 py-1.5 mb-1"
            >
              <span className="text-12 text-figma-text">
                {agent.emoji} {agent.name}
                <span className="text-figma-text-tertiary ml-1">{agent.subtitle}</span>
              </span>
              <button
                onClick={() => removeCustomAgent(agent.id)}
                className="text-figma-text-tertiary hover:text-figma-error text-11 px-1"
              >
                &times;
              </button>
            </div>
          ))}

          {/* Add agent form */}
          {showAgentForm ? (
            <div className="space-y-2 mt-2">
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newAgentEmoji}
                  onChange={(e) => setNewAgentEmoji(e.target.value)}
                  placeholder="Emoji"
                  maxLength={4}
                  className="w-12 bg-figma-surface border border-figma-border rounded px-2 py-1
                             text-12 text-figma-text text-center focus:outline-none focus:border-figma-accent"
                />
                <input
                  type="text"
                  value={newAgentName}
                  onChange={(e) => setNewAgentName(e.target.value)}
                  placeholder="Name"
                  className="flex-1 bg-figma-surface border border-figma-border rounded px-2 py-1
                             text-12 text-figma-text focus:outline-none focus:border-figma-accent"
                />
              </div>
              <input
                type="text"
                value={newAgentSubtitle}
                onChange={(e) => setNewAgentSubtitle(e.target.value)}
                placeholder="Short description (e.g. Brand guidelines)"
                className="w-full bg-figma-surface border border-figma-border rounded px-2 py-1
                           text-12 text-figma-text focus:outline-none focus:border-figma-accent"
              />
              <textarea
                value={newAgentPrompt}
                onChange={(e) => setNewAgentPrompt(e.target.value)}
                placeholder="Paste the agent's system prompt here. Describe their expertise, personality, and what rules they should check..."
                rows={6}
                className="w-full bg-figma-surface border border-figma-border rounded px-2 py-1.5
                           text-12 text-figma-text placeholder:text-figma-text-tertiary
                           focus:outline-none focus:border-figma-accent resize-y"
              />
              <div className="flex gap-1">
                <button
                  onClick={addCustomAgent}
                  disabled={!newAgentName.trim() || !newAgentPrompt.trim()}
                  className="flex-1 py-1 text-11 rounded bg-figma-accent text-white
                             hover:bg-figma-accent-hover disabled:opacity-40 transition-colors"
                >
                  Add agent
                </button>
                <button
                  onClick={() => setShowAgentForm(false)}
                  className="px-3 py-1 text-11 rounded border border-figma-border text-figma-text-secondary
                             hover:bg-figma-surface transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowAgentForm(true)}
              className="w-full py-1.5 text-11 rounded border border-dashed border-figma-border
                         text-figma-text-secondary hover:border-figma-accent hover:text-figma-accent
                         transition-colors mt-1"
            >
              + Add custom agent
            </button>
          )}
        </div>

        {/* Clear all review output */}
        <div className="pt-2 border-t border-figma-border">
          <button
            onClick={onClearAnnotations}
            className="w-full py-1.5 text-12 rounded border border-figma-error text-figma-error
                       hover:bg-figma-error hover:text-white transition-colors"
          >
            Clear all AI review output
          </button>
          <p className="text-11 text-figma-text-tertiary mt-1">
            Removes AI Review annotations and sticky notes from the selected frame.
          </p>
        </div>
      </div>
    </div>
  );
}
