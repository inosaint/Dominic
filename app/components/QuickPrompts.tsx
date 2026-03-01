'use client';

import { QUICK_PROMPTS } from '../lib/prompts';
import { BUILT_IN_AGENTS } from '../lib/agents';
import { CustomAgentConfig } from '../lib/types';

interface Props {
  onSelect: (prompt: string, agentId?: string, allAgents?: boolean) => void;
  onStartChat: (agentId: string) => void;
  disabled: boolean;
  customAgents?: CustomAgentConfig[];
  enableAgentChat?: boolean;
}

export default function QuickPrompts({ onSelect, onStartChat, disabled, customAgents, enableAgentChat }: Props) {
  return (
    <div className="px-3 py-2 border-b border-figma-border space-y-2">
      {/* One-shot review prompts */}
      <div>
        <p className="text-11 text-figma-text-tertiary mb-1.5">Quick review:</p>
        <div className="flex flex-wrap gap-1">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.label}
              onClick={() => onSelect(qp.prompt, qp.agentId, qp.allAgents)}
              disabled={disabled}
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
              onClick={() => onSelect(
                `Review this design from your perspective as ${ca.name}.`,
                ca.id
              )}
              disabled={disabled}
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

      {/* Chat with agent — experimental */}
      {enableAgentChat && (
        <div>
          <p className="text-11 text-figma-text-tertiary mb-1.5">Chat with:</p>
          <div className="flex flex-wrap gap-1">
            {BUILT_IN_AGENTS.map((agent) => (
              <button
                key={agent.id}
                onClick={() => onStartChat(agent.id)}
                disabled={disabled}
                className="px-2 py-1 text-11 rounded-full border border-figma-border text-figma-text-secondary
                           hover:border-figma-accent hover:text-figma-accent
                           disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors"
              >
                {agent.emoji} {agent.name}
              </button>
            ))}
            {customAgents?.map((ca) => (
              <button
                key={`chat-${ca.id}`}
                onClick={() => onStartChat(ca.id)}
                disabled={disabled}
                className="px-2 py-1 text-11 rounded-full border border-figma-border text-figma-text-secondary
                           hover:border-figma-accent hover:text-figma-accent
                           disabled:opacity-40 disabled:cursor-not-allowed
                           transition-colors"
              >
                {ca.emoji} {ca.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
