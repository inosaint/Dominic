'use client';

import Mascot from './Mascot';
import { SelectionInfo, ObserverHints, CustomAgentConfig } from '../lib/types';
import { QUICK_PROMPTS } from '../lib/prompts';

interface Props {
  selection: SelectionInfo | null;
  observerHints: ObserverHints | null;
  observerEnabled: boolean;
  isLoading: boolean;
  onQuickPrompt: (prompt: string, agentId?: string, allAgents?: boolean) => void;
  onToggleObserver: (enabled: boolean) => void;
  customAgents?: CustomAgentConfig[];
}

const HINT_ICONS: Record<string, string> = {
  color: '\u25CF',
  spacing: '\u2194',
  typography: 'Aa',
  radius: '\u25E0',
};

function getSpeechContent(
  selection: SelectionInfo | null,
  observerEnabled: boolean,
  observerHints: ObserverHints | null,
  isLoading: boolean
): { text: string; mood: 'idle' | 'watching' | 'clean' | 'alert' | 'thinking' } {
  if (isLoading) {
    return { text: 'Hmm, let me take a closer look...', mood: 'thinking' };
  }

  if (!selection) {
    return { text: 'Select a frame and I\'ll keep an eye on it for you.', mood: 'idle' };
  }

  if (!observerEnabled) {
    return { text: `Looking at "${selection.name}". Turn on the observer and I\'ll watch for issues as you work.`, mood: 'watching' };
  }

  if (!observerHints) {
    return { text: `Watching "${selection.name}"...`, mood: 'watching' };
  }

  if (observerHints.hints.length === 0) {
    return { text: `"${observerHints.frameName}" looks clean! No deviations from your design system.`, mood: 'clean' };
  }

  return { text: `I noticed a few things in "${observerHints.frameName}":`, mood: 'alert' };
}

export default function MascotTab({
  selection,
  observerHints,
  observerEnabled,
  isLoading,
  onQuickPrompt,
  onToggleObserver,
  customAgents,
}: Props) {
  const { text, mood } = getSpeechContent(selection, observerEnabled, observerHints, isLoading);

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      {/* Mascot + speech bubble area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 gap-3">
        {/* Mascot */}
        <div className={`transition-transform ${mood === 'thinking' ? 'animate-pulse' : ''}`}>
          <Mascot size={88} />
        </div>

        {/* Speech bubble */}
        <div className="relative max-w-[280px] w-full">
          {/* Bubble tail */}
          <div
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-figma-surface border-l border-t border-figma-border"
          />
          {/* Bubble body */}
          <div className="relative bg-figma-surface border border-figma-border rounded-xl px-3 py-2.5">
            <p className="text-12 text-figma-text leading-relaxed">{text}</p>

            {/* Observer hints inside speech bubble */}
            {observerEnabled && observerHints && observerHints.hints.length > 0 && (
              <div className="mt-2 space-y-1">
                {observerHints.hints.map((hint, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-11">
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
          </div>
        </div>

        {/* Observer toggle */}
        <button
          onClick={() => onToggleObserver(!observerEnabled)}
          className={`text-11 px-3 py-1 rounded-full border transition-colors
            ${observerEnabled
              ? 'border-figma-accent text-figma-accent bg-figma-accent/10'
              : 'border-figma-border text-figma-text-tertiary hover:text-figma-text-secondary hover:border-figma-text-secondary'
            }`}
        >
          {observerEnabled ? 'Observer on' : 'Turn on observer'}
        </button>
      </div>

      {/* Quick prompts at bottom */}
      <div className="shrink-0 px-3 py-2 border-t border-figma-border">
        <p className="text-11 text-figma-text-tertiary mb-1.5">Quick review:</p>
        <div className="flex flex-wrap gap-1">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.label}
              onClick={() => onQuickPrompt(qp.prompt, qp.agentId, qp.allAgents)}
              disabled={isLoading || !selection}
              className="px-2 py-1 text-11 rounded-full bg-figma-surface text-figma-text-secondary
                         hover:bg-figma-surface-hover hover:text-figma-text
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              {qp.label}
            </button>
          ))}
          {customAgents?.map((ca) => (
            <button
              key={ca.id}
              onClick={() => onQuickPrompt(
                `Review this design from your perspective as ${ca.name}.`,
                ca.id
              )}
              disabled={isLoading || !selection}
              className="px-2 py-1 text-11 rounded-full bg-figma-surface text-figma-text-secondary
                         hover:bg-figma-surface-hover hover:text-figma-text
                         disabled:opacity-40 disabled:cursor-not-allowed
                         transition-colors"
            >
              {ca.emoji} {ca.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
