'use client';

import { QUICK_PROMPTS } from '../lib/prompts';

interface Props {
  onSelect: (prompt: string) => void;
  disabled: boolean;
}

export default function QuickPrompts({ onSelect, disabled }: Props) {
  return (
    <div className="px-3 py-2 border-b border-figma-border">
      <p className="text-11 text-figma-text-tertiary mb-1.5">Quick prompts:</p>
      <div className="flex flex-wrap gap-1">
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp.label}
            onClick={() => onSelect(qp.prompt)}
            disabled={disabled}
            className="px-2 py-1 text-11 rounded bg-figma-surface text-figma-text-secondary
                       hover:bg-figma-surface-hover hover:text-figma-text
                       disabled:opacity-40 disabled:cursor-not-allowed
                       transition-colors"
          >
            {qp.label}
          </button>
        ))}
      </div>
    </div>
  );
}
