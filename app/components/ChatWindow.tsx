'use client';

import { useRef, useEffect } from 'react';
import { ChatMessage } from '../lib/types';
import ReviewSummary from './ReviewSummary';

interface Props {
  messages: ChatMessage[];
  highlightedMarker?: number | null;
  onFocusNode?: (nodeId: string) => void;
}

export default function ChatWindow({ messages, highlightedMarker, onFocusNode }: Props) {
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
              {msg.role === 'user' ? 'You' : 'AI'}:
            </span>
            <div className="text-12 text-figma-text min-w-0">
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
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
