'use client';

import { useRef, useEffect, useMemo } from 'react';
import { ChatMessage } from '../lib/types';
import ReviewSummary from './ReviewSummary';

interface Props {
  messages: ChatMessage[];
  highlightedMarker?: number | null;
  onFocusNode?: (nodeId: string) => void;
  nodeMap?: Map<string, string>;
}

/**
 * Build a regex that matches any known node name in text.
 * Sorted longest-first so "Header Section" matches before "Header".
 */
function buildNodeRegex(nodeMap: Map<string, string>): RegExp | null {
  const names = Array.from(nodeMap.keys())
    .filter((n) => n.length > 2)
    .sort((a, b) => b.length - a.length);
  if (names.length === 0) return null;
  const escaped = names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`(${escaped.join('|')})`, 'g');
}

/** Render text with known layer names as clickable links that focus the node in Figma */
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

export default function ChatWindow({ messages, highlightedMarker, onFocusNode, nodeMap }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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
      {messages.map((msg) => (
        <div key={msg.id}>
          <div className="flex items-start gap-2">
            <span className="text-11 text-figma-text-tertiary font-medium shrink-0 mt-0.5">
              {msg.role === 'user'
                ? 'You'
                : msg.agentName
                  ? `${msg.agentEmoji || ''} ${msg.agentName}`
                  : 'AI'}:
            </span>
            <div className="text-12 text-figma-text min-w-0">
              <p>
                {nodeMap && nodeMap.size > 0 ? (
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
                <div className="mt-1.5">
                  <ReviewSummary
                    items={msg.reviewItems}
                    annotationResult={msg.annotationResult}
                    highlightedIndex={highlightedMarker}
                    onFocusNode={onFocusNode}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
