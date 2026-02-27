'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  SelectionInfo as SelectionInfoType,
  ChatMessage,
  Settings,
  ReviewItem,
} from './lib/types';
import { sendToPlugin, onPluginMessage } from './lib/figmaAPI';
import SelectionInfo from './components/SelectionInfo';
import ChatWindow from './components/ChatWindow';
import QuickPrompts from './components/QuickPrompts';
import SettingsPanel from './components/SettingsPanel';

const DEFAULT_SETTINGS: Settings = {
  provider: 'anthropic',
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
  includeScreenshot: true,
  autoClearPrevious: true,
  outputMode: 'sticky-notes',
};

export default function Home() {
  const [selection, setSelection] = useState<SelectionInfoType | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  // Ref to hold pending design data for the current review
  const pendingReview = useRef<{
    prompt: string;
    resolve: (data: { json: object; screenshot?: string }) => void;
    reject: (err: Error) => void;
  } | null>(null);

  // --- Plugin message listeners ---
  useEffect(() => {
    const cleanups = [
      onPluginMessage('SELECTION_DATA', (msg) => {
        setSelection(msg.payload);
      }),
      onPluginMessage('DESIGN_DATA_READY', (msg) => {
        if (pendingReview.current) {
          pendingReview.current.resolve(msg.payload);
          pendingReview.current = null;
        }
      }),
      onPluginMessage('ANNOTATIONS_WRITTEN', (msg) => {
        // Update the last assistant message with annotation result
        setMessages((prev) => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === 'assistant' && updated[i].reviewItems) {
              updated[i] = {
                ...updated[i],
                annotationResult: msg.payload,
              };
              break;
            }
          }
          return updated;
        });
      }),
      onPluginMessage('STICKY_NOTES_WRITTEN', (msg) => {
        setMessages((prev) => {
          const updated = [...prev];
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === 'assistant' && updated[i].reviewItems) {
              const existing = updated[i].content;
              updated[i] = {
                ...updated[i],
                content: existing.includes('sticky note')
                  ? existing
                  : `${existing} ${msg.payload.created} sticky note${msg.payload.created !== 1 ? 's' : ''} added to canvas.`,
              };
              break;
            }
          }
          return updated;
        });
      }),
      onPluginMessage('ANNOTATIONS_CLEARED', () => {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'AI review output cleared.',
            timestamp: Date.now(),
          },
        ]);
      }),
      onPluginMessage('SETTINGS_LOADED', (msg) => {
        setSettings(msg.payload);
      }),
      onPluginMessage('ERROR', (msg) => {
        setIsLoading(false);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Error: ${msg.payload.message}`,
            timestamp: Date.now(),
          },
        ]);
      }),
    ];

    // Request initial data
    sendToPlugin({ type: 'GET_SELECTION' });
    sendToPlugin({ type: 'GET_SETTINGS' });

    return () => cleanups.forEach((fn) => fn());
  }, []);

  // --- Run a review ---
  const runReview = useCallback(
    async (prompt: string) => {
      if (!selection) return;
      if (!settings.apiKey) {
        setShowSettings(true);
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: 'Please set your API key in settings first.',
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      setIsLoading(true);

      // Add user message
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'user',
          content: prompt,
          timestamp: Date.now(),
        },
      ]);

      try {
        // 1. Request design data from the plugin
        const designData = await new Promise<{
          json: object;
          screenshot?: string;
        }>((resolve, reject) => {
          pendingReview.current = { prompt, resolve, reject };
          sendToPlugin({
            type: 'RUN_REVIEW',
            payload: {
              prompt,
              includeScreenshot: settings.includeScreenshot,
            },
          });

          // Timeout after 30s
          setTimeout(() => {
            if (pendingReview.current) {
              pendingReview.current = null;
              reject(new Error('Timed out waiting for design data from Figma.'));
            }
          }, 30000);
        });

        // 2. Call the API route
        const response = await fetch('/api/review', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            designData: designData.json,
            screenshot: designData.screenshot,
            userPrompt: prompt,
            provider: settings.provider,
            apiKey: settings.apiKey,
            model: settings.model,
          }),
        });

        const result = await response.json();

        if (result.error) {
          throw new Error(result.error);
        }

        const reviewItems: ReviewItem[] = result.items || [];

        // 3. Add assistant message with results
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content:
              reviewItems.length > 0
                ? `Found ${reviewItems.length} item${reviewItems.length !== 1 ? 's' : ''} to review.`
                : 'No issues found — the design looks good!',
            reviewItems,
            timestamp: Date.now(),
          },
        ]);

        // 4. Send review items to plugin to write annotations
        if (reviewItems.length > 0) {
          sendToPlugin({
            type: 'WRITE_ANNOTATIONS',
            payload: { reviewItems },
          });
        }
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: crypto.randomUUID(),
            role: 'assistant',
            content: `Error: ${err?.message || 'Something went wrong.'}`,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [selection, settings]
  );

  // --- Handlers ---
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = inputValue.trim();
    if (!prompt || isLoading) return;
    setInputValue('');
    runReview(prompt);
  };

  const handleSettingsChange = (newSettings: Settings) => {
    setSettings(newSettings);
    sendToPlugin({ type: 'STORE_SETTINGS', payload: newSettings });
  };

  const handleClearAnnotations = () => {
    sendToPlugin({ type: 'CLEAR_ANNOTATIONS' });
    setShowSettings(false);
  };

  return (
    <div className="relative flex flex-col h-[480px] w-[320px] bg-figma-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-figma-border shrink-0">
        <h1 className="text-13 font-semibold text-figma-text">Pair Designer</h1>
        <button
          onClick={() => setShowSettings(!showSettings)}
          className="text-figma-text-secondary hover:text-figma-text text-[16px] leading-none p-0.5"
          title="Settings"
        >
          &#9881;
        </button>
      </div>

      {/* Selection info */}
      <div className="shrink-0">
        <SelectionInfo selection={selection} />
      </div>

      {/* Chat area */}
      <ChatWindow messages={messages} />

      {/* Quick prompts */}
      <div className="shrink-0">
        <QuickPrompts
          onSelect={runReview}
          disabled={isLoading || !selection}
        />
      </div>

      {/* Input area */}
      <form
        onSubmit={handleSubmit}
        className="shrink-0 px-3 py-2 border-t border-figma-border"
      >
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Ask about this frame..."
            disabled={isLoading || !selection}
            className="flex-1 bg-figma-surface border border-figma-border rounded px-2 py-1.5
                       text-12 text-figma-text placeholder:text-figma-text-tertiary
                       focus:outline-none focus:border-figma-accent
                       disabled:opacity-40 disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isLoading || !selection || !inputValue.trim()}
            className="shrink-0 w-7 h-7 flex items-center justify-center rounded
                       bg-figma-accent text-white text-13
                       hover:bg-figma-accent-hover
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors"
            title="Send"
          >
            {isLoading ? (
              <span className="animate-spin text-11">&#9696;</span>
            ) : (
              '\u25B6'
            )}
          </button>
        </div>
        <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.includeScreenshot}
            onChange={(e) =>
              handleSettingsChange({
                ...settings,
                includeScreenshot: e.target.checked,
              })
            }
            className="rounded border-figma-border"
          />
          <span className="text-11 text-figma-text-secondary">
            Include screenshot
          </span>
        </label>
      </form>

      {/* Settings overlay */}
      {showSettings && (
        <SettingsPanel
          settings={settings}
          onChange={handleSettingsChange}
          onClearAnnotations={handleClearAnnotations}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
