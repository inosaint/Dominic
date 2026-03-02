'use client';

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { ChatMessage, ReviewItem } from '../lib/types';
import ReviewSummary from './ReviewSummary';

interface Props {
  messages: ChatMessage[];
  highlightedMarker?: number | null;
  onFocusNode?: (nodeId: string) => void;
  onDismissItem?: (index: number) => void;
  onClearAll?: () => void;
  nodeMap?: Map<string, string>;
  isLoading?: boolean;
}

/** Collect all review items across messages and format as a structured LLM prompt. */
function formatReviewForLLM(messages: ChatMessage[]): string {
  const allItems: ReviewItem[] = [];
  for (const msg of messages) {
    if (msg.reviewItems) allItems.push(...msg.reviewItems);
  }
  if (allItems.length === 0) return '';

  const lines = [
    'The following design review feedback was generated. Please address each item:',
    '',
  ];

  for (let i = 0; i < allItems.length; i++) {
    const item = allItems[i];
    lines.push(
      `${i + 1}. [${item.severity.toUpperCase()}] ${item.category} (node: ${item.nodeId})`,
      `   ${item.feedback}`,
      '',
    );
  }

  return lines.join('\n');
}

function buildNodeRegex(nodeMap: Map<string, string>): RegExp | null {
  const names = Array.from(nodeMap.keys())
    .filter((n) => n.length > 2)
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return null;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(${escaped.join('|')})`, 'g');
}

function TextWithNodeLinks({
  text,
  nodeMap,
  onFocusNode,
}: {
  text: string;
  nodeMap: Map<string, string>;
  onFocusNode?: (nodeId: string) => void;
}) {
  const regex = useMemo(() => buildNodeRegex(nodeMap), [nodeMap]);

  if (!regex || !onFocusNode || nodeMap.size === 0) {
    return <span className="whitespace-pre-wrap break-words">{text}</span>;
  }

  const parts: (string | { name: string; nodeId: string })[] = [];
  let lastIndex = 0;

  regex.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const name = match[1];
    const nodeId = nodeMap.get(name);
    if (nodeId) {
      parts.push({ name, nodeId });
    } else {
      parts.push(name);
    }
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) => {
        if (typeof part === 'string') {
          return <span key={i}>{part}</span>;
        }
        return (
          <button
            key={i}
            onClick={() => onFocusNode(part.nodeId)}
            className="text-figma-accent hover:underline cursor-pointer font-medium"
            title={`Focus "${part.name}" in Figma`}
          >
            {part.name}
          </button>
        );
      })}
    </span>
  );
}

export default function ChatWindow({
  messages, highlightedMarker, onFocusNode, onDismissItem, onClearAll, nodeMap, isLoading,
}: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopy = useCallback(() => {
    const text = formatReviewForLLM(messages);
    if (!text) return;

    // Clipboard API is often blocked inside Figma plugin iframes,
    // so fall back to execCommand('copy') via a temporary textarea.
    function fallbackCopy(str: string): boolean {
      const textarea = document.createElement('textarea');
      textarea.value = str;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      let ok = false;
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      document.body.removeChild(textarea);
      return ok;
    }

    const onSuccess = () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess, () => {
        // Clipboard API rejected — use fallback
        if (fallbackCopy(text)) onSuccess();
      });
    } else {
      if (fallbackCopy(text)) onSuccess();
    }
  }, [messages]);

  // Check if any message has review items (for showing clear all)
  const hasReviewItems = messages.some((m) => m.reviewItems && m.reviewItems.length > 0);

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <p className="text-12 text-figma-text-tertiary text-center">
          Select a frame and ask a question, or use a quick prompt to start reviewing.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {messages.map((msg) => {
        const isUser = msg.role === 'user';

        return (
          <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
              <span className={`block text-11 font-medium mb-0.5 ${
                isUser
                  ? 'text-right text-figma-text-tertiary'
                  : 'text-left text-figma-text-tertiary'
              }`}>
                {isUser
                  ? 'You'
                  : msg.agentName
                    ? `${msg.agentEmoji || ''} ${msg.agentName}`
                    : 'AI'}
              </span>
              <div className={`text-12 min-w-0 ${
                isUser
                  ? 'bg-figma-accent text-white rounded-2xl rounded-tr-sm px-3 py-1.5'
                  : 'text-figma-text font-semibold'
              }`}>
                <p>
                  {nodeMap && nodeMap.size > 0 && !isUser ? (
                    <TextWithNodeLinks
                      text={msg.content}
                      nodeMap={nodeMap}
                      onFocusNode={onFocusNode}
                    />
                  ) : (
                    <span className="whitespace-pre-wrap break-words">{msg.content}</span>
                  )}
                </p>
                {msg.reviewItems && msg.reviewItems.length > 0 && (
                  <div className="mt-1.5 text-left font-normal">
                    <ReviewSummary
                      items={msg.reviewItems}
                      annotationResult={msg.annotationResult}
                      highlightedIndex={highlightedMarker}
                      onFocusNode={onFocusNode}
                      onDismissItem={onDismissItem}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* Reviewing indicator */}
      {isLoading && (
        <div className="flex justify-start">
          <span className="text-12 text-figma-text-tertiary italic">reviewing...</span>
        </div>
      )}

      {/* Copy / Clear action row */}
      {hasReviewItems && (
        <div className="flex items-center justify-between pt-1 pb-2">
          <button
            onClick={handleCopy}
            className={`text-11 px-3 py-1 rounded-full border transition-colors
              ${copied
                ? 'border-figma-success text-figma-success'
                : 'border-figma-border text-figma-text-secondary hover:text-figma-accent hover:border-figma-accent'
              }`}
          >
            {copied ? 'Copied!' : 'Copy feedback'}
          </button>
          {onClearAll && (
            <button
              onClick={onClearAll}
              className="text-11 px-3 py-1 rounded-full border border-figma-border
                         text-figma-text-secondary hover:text-figma-error hover:border-figma-error
                         transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
