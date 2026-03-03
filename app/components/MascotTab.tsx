'use client';

import { useState, useEffect, useRef } from 'react';
import Mascot from './Mascot';
import { SelectionInfo, ObserverHints, ObserverFix, CustomAgentConfig } from '../lib/types';
import { QUICK_PROMPTS } from '../lib/prompts';

interface Props {
  selection: SelectionInfo | null;
  observerHints: ObserverHints | null;
  observerEnabled: boolean;
  isLoading: boolean;
  onQuickPrompt: (prompt: string, agentId?: string, allAgents?: boolean) => void;
  onToggleObserver: (enabled: boolean) => void;
  onFix: (fixes: ObserverFix[]) => void;
  customAgents?: CustomAgentConfig[];
}

const FIX_ICONS: Record<string, string> = {
  color: '\u25CF',
  spacing: '\u2194',
  typography: 'Aa',
  radius: '\u25E0',
};

const THINKING_LINES = [
  'Hmm, let me take a closer look...',
  'Reviewing your design...',
  'Checking against your design system...',
  'Almost there...',
];

type Mood = 'idle' | 'watching' | 'clean' | 'alert' | 'thinking' | 'done';

function getSpeechContent(
  selection: SelectionInfo | null,
  observerEnabled: boolean,
  observerHints: ObserverHints | null,
  isLoading: boolean,
  thinkingLine: string,
  justFinished: boolean,
): { text: string; mood: Mood } {
  if (isLoading) {
    return { text: thinkingLine, mood: 'thinking' };
  }

  if (justFinished) {
    return { text: 'Done! I\'ve annotated the frame with my feedback.', mood: 'done' };
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

  const fixCount = observerHints.fixes?.length ?? 0;
  if (observerHints.hints.length === 0) {
    return { text: `"${observerHints.frameName}" looks clean! No deviations from your design system.`, mood: 'clean' };
  }

  return {
    text: fixCount > 0
      ? `I found ${fixCount} thing${fixCount > 1 ? 's' : ''} to fix in "${observerHints.frameName}":`
      : `I noticed a few things in "${observerHints.frameName}":`,
    mood: 'alert',
  };
}

export default function MascotTab({
  selection,
  observerHints,
  observerEnabled,
  isLoading,
  onQuickPrompt,
  onToggleObserver,
  onFix,
  customAgents,
}: Props) {
  // Cycle through thinking lines while loading
  const [thinkingIdx, setThinkingIdx] = useState(0);
  const wasLoading = useRef(false);
  const [justFinished, setJustFinished] = useState(false);
  const finishedTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!isLoading) {
      setThinkingIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setThinkingIdx((i) => (i + 1) % THINKING_LINES.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [isLoading]);

  // Detect loading → done transition
  useEffect(() => {
    if (wasLoading.current && !isLoading) {
      setJustFinished(true);
      finishedTimer.current = setTimeout(() => setJustFinished(false), 4000);
    }
    wasLoading.current = isLoading;
    return () => { if (finishedTimer.current) clearTimeout(finishedTimer.current); };
  }, [isLoading]);

  const { text, mood } = getSpeechContent(
    selection, observerEnabled, observerHints, isLoading,
    THINKING_LINES[thinkingIdx], justFinished,
  );
  const fixes = observerHints?.fixes ?? [];
  const hasFixes = fixes.length > 0;

  return (
    <div className="flex-1 flex flex-col overflow-y-auto">
      {/* Mascot + speech bubble area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 gap-3">
        {/* Mascot */}
        <div
          className={`transition-all duration-500 ${
            mood === 'thinking'
              ? 'animate-pulse scale-105'
              : mood === 'done'
                ? 'scale-110'
                : ''
          }`}
        >
          <Mascot size={88} />
        </div>

        {/* Speech bubble */}
        <div className="relative max-w-[280px] w-full">
          {/* Bubble tail */}
          <div
            className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 bg-figma-surface border-l border-t border-figma-border"
          />
          {/* Bubble body */}
          <div className={`relative bg-figma-surface border rounded-xl px-3 py-2.5 transition-colors duration-300
            ${mood === 'done'
              ? 'border-green-400/50'
              : mood === 'thinking'
                ? 'border-figma-accent/40'
                : 'border-figma-border'
            }`}
          >
            <p className={`text-12 leading-relaxed transition-colors duration-300
              ${mood === 'done' ? 'text-green-500' : mood === 'thinking' ? 'text-figma-accent' : 'text-figma-text'}
            `}>{text}</p>

            {/* Loading dots animation */}
            {mood === 'thinking' && (
              <div className="flex gap-1 mt-1.5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1 h-1 rounded-full bg-figma-accent animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
            )}

            {/* Individual fixable items */}
            {observerEnabled && hasFixes && mood !== 'thinking' && mood !== 'done' && (
              <div className="mt-2 space-y-1.5">
                {fixes.map((fix) => (
                  <div key={fix.id} className="flex items-center gap-1.5 text-11">
                    <span className="text-figma-warning shrink-0 w-3 text-center text-10">
                      {FIX_ICONS[fix.type] || '!'}
                    </span>
                    <span className="text-figma-text-secondary leading-snug flex-1 min-w-0 truncate" title={`${fix.nodeName}: ${fix.currentValue} → ${fix.suggestedValue}`}>
                      {fix.currentValue} → {fix.suggestedValue}
                    </span>
                    <button
                      onClick={() => onFix([fix])}
                      className="shrink-0 px-1.5 py-0.5 text-10 rounded bg-figma-accent/15 text-figma-accent
                                 hover:bg-figma-accent/25 transition-colors font-medium"
                    >
                      Fix
                    </button>
                  </div>
                ))}

                {/* Fix all button */}
                {fixes.length > 1 && (
                  <button
                    onClick={() => onFix(fixes)}
                    className="w-full mt-1 py-1 text-11 rounded-lg bg-figma-accent/15 text-figma-accent
                               hover:bg-figma-accent/25 transition-colors font-medium"
                  >
                    Fix all ({fixes.length})
                  </button>
                )}
              </div>
            )}

            {/* Fallback: summary hints when no fixes available */}
            {observerEnabled && !hasFixes && observerHints && observerHints.hints.length > 0 && mood !== 'thinking' && mood !== 'done' && (
              <div className="mt-2 space-y-1">
                {observerHints.hints.map((hint, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-11">
                    <span className="text-figma-warning shrink-0 w-3 text-center text-10 mt-px">
                      {FIX_ICONS[hint.type] || '!'}
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
