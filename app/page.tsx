'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  SelectionInfo as SelectionInfoType,
  ChatMessage,
  Settings,
  ReviewItem,
  ConversationTurn,
  CustomAgentConfig,
  DesignSystemCacheData,
  ObserverHints,
} from './lib/types';
import { sendToPlugin, onPluginMessage } from './lib/figmaAPI';
import { getAgent, getAllAgents, BUILT_IN_AGENTS, CustomAgent, ReviewAgent } from './lib/agents';
import { callAnthropic } from './lib/providers/anthropic';
import { callOpenAI } from './lib/providers/openai';
import { parseReviewResponse } from './lib/parseResponse';
import SelectionInfo from './components/SelectionInfo';
import ChatWindow from './components/ChatWindow';
import QuickPrompts from './components/QuickPrompts';
import SettingsPanel from './components/SettingsPanel';
import TabBar, { TabId } from './components/TabBar';
import TokensPanel from './components/TokensPanel';
import ComponentsPanel from './components/ComponentsPanel';
import ObserverBar from './components/ObserverBar';

const CHAT_MODE_ADDENDUM = `

CHAT MODE:
You are in a conversation with the user. You may respond in two ways:
1. If the user asks for a review or analysis, respond with the JSON array as specified above.
2. If the user asks a follow-up question, wants clarification, or is having a discussion, respond in plain text. Be helpful, specific, and stay in character.
Do NOT wrap plain text responses in JSON. Just write naturally.`;

const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6';
const DEFAULT_OPENAI_MODEL = 'gpt-4o-mini';

const ICON_DATA_URL = `data:image/svg+xml,${encodeURIComponent('<svg width="128" height="128" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg"><rect width="128" height="128" fill="white"/><path d="M100 60C100 79.8823 83.8823 96 64 96C54.7797 96 28 96 28 96C28 96 28 70.662 28 60C28 40.1177 44.1178 24 64 24C83.8823 24 100 40.1177 100 60Z" fill="#7762F6"/><circle cx="55.1429" cy="60.1429" r="5.14286" fill="#F5F5F0"/><circle cx="72.2858" cy="60.1429" r="5.14286" fill="#F5F5F0"/></svg>')}`;

const DEFAULT_SETTINGS: Settings = {
  provider: 'anthropic',
  apiKey: '',
  model: DEFAULT_ANTHROPIC_MODEL,
  includeScreenshot: true,
  autoClearPrevious: true,
  outputMode: 'sticky-notes',
  customAgents: [],
};

function normalizeModelForProvider(
  provider: Settings['provider'],
  model: string
): string {
  const raw = (model || '').trim();
  if (!raw) return '';

  if (provider === 'anthropic') {
    if (raw === 'claude-sonnet-4-20250514') return 'claude-sonnet-4-6';
    if (raw.startsWith('claude-sonnet-4-6')) return 'claude-sonnet-4-6';
    if (raw.startsWith('claude-haiku-4-5')) return 'claude-haiku-4-5';
    if (raw.startsWith('claude-opus-4-6')) return 'claude-opus-4-6';
    return DEFAULT_ANTHROPIC_MODEL;
  }

  if (provider === 'openai') {
    if (raw.startsWith('gpt-4o-mini-')) return 'gpt-4o-mini';
    if (raw.startsWith('gpt-4o-') && raw.split('-').length > 2) return 'gpt-4o';
    if (raw === 'gpt-4o-mini' || raw === 'gpt-4o') return raw;
    return DEFAULT_OPENAI_MODEL;
  }

  return raw;
}

function normalizeSettings(settings: Settings): Settings {
  return {
    ...settings,
    model: normalizeModelForProvider(settings.provider, settings.model),
  };
}

function createMessageId(): string {
  if (
    typeof globalThis !== 'undefined' &&
    globalThis.crypto &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toCustomAgents(configs: CustomAgentConfig[] = []): CustomAgent[] {
  return configs.map((c) => ({ ...c, builtIn: false as const }));
}

/** Flatten a design data tree into a map of node name → node id */
function buildNodeMap(data: any): Map<string, string> {
  const map = new Map<string, string>();
  function walk(node: any) {
    if (!node || typeof node !== 'object') return;
    if (node.id && node.name && typeof node.name === 'string' && node.name.length > 2) {
      // Prefer the first occurrence (higher in the tree)
      if (!map.has(node.name)) {
        map.set(node.name, node.id);
      }
    }
    if (Array.isArray(node.children)) {
      for (const child of node.children) walk(child);
    }
  }
  walk(data);
  return map;
}

export default function Home() {
  const [selection, setSelection] = useState<SelectionInfoType | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [highlightedMarker, setHighlightedMarker] = useState<number | null>(null);

  // Tab navigation
  const [activeTab, setActiveTab] = useState<TabId>('chat');
  const [bannerDismissed, setBannerDismissed] = useState(false);

  // Design system cache state
  const [dsCache, setDsCache] = useState<DesignSystemCacheData | null>(null);
  const [dsScanLoading, setDsScanLoading] = useState(false);

  // Observer state
  const [observerEnabled, setObserverEnabled] = useState(false);
  const [observerHints, setObserverHints] = useState<ObserverHints | null>(null);

  // Chat mode state
  const [activeAgent, setActiveAgent] = useState<ReviewAgent | null>(null);
  const [nodeMap, setNodeMap] = useState<Map<string, string>>(new Map());
  const chatDesignData = useRef<{ json: object; screenshot?: string } | null>(null);
  const chatHistory = useRef<ConversationTurn[]>([]);

  // Ref to hold pending design data for the current review
  const pendingReview = useRef<{
    prompt: string;
    resolve: (data: { json: object; screenshot?: string }) => void;
    reject: (err: Error) => void;
  } | null>(null);
  const pendingReviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Plugin message listeners ---
  useEffect(() => {
    const cleanups = [
      onPluginMessage('SELECTION_DATA', (msg) => {
        if (msg.payload === null) {
          setSelection(null);
        } else {
          setSelection((prev) => {
            // Preserve existing thumbnail when the plugin re-sends the same node without one
            if (prev && prev.id === msg.payload.id && prev.thumbnail && !msg.payload.thumbnail) {
              return { ...msg.payload, thumbnail: prev.thumbnail };
            }
            return msg.payload;
          });
        }
      }),
      onPluginMessage('DESIGN_DATA_READY', (msg) => {
        if (pendingReview.current) {
          if (pendingReviewTimeout.current) {
            clearTimeout(pendingReviewTimeout.current);
            pendingReviewTimeout.current = null;
          }
          pendingReview.current.resolve(msg.payload);
          pendingReview.current = null;
        }
      }),
      onPluginMessage('ANNOTATIONS_WRITTEN', (msg) => {
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
            id: createMessageId(),
            role: 'assistant',
            content: 'AI review output cleared.',
            timestamp: Date.now(),
          },
        ]);
      }),
      onPluginMessage('MARKER_SELECTED', (msg) => {
        setHighlightedMarker(msg.payload.index);
      }),
      onPluginMessage('ITEM_DISMISSED', (msg) => {
        const dismissedIndex = msg.payload.index;
        setMessages((prev) =>
          prev.map((m) => {
            if (!m.reviewItems) return m;
            const filtered = m.reviewItems.filter((_: any, i: number) => i !== dismissedIndex);
            return {
              ...m,
              reviewItems: filtered.length > 0 ? filtered : undefined,
              content: filtered.length > 0
                ? `${filtered.length} item${filtered.length !== 1 ? 's' : ''} remaining.`
                : 'All items dismissed.',
            };
          })
        );
      }),
      onPluginMessage('SETTINGS_LOADED', (msg) => {
        const normalized = normalizeSettings(msg.payload);
        setSettings(normalized);
      }),
      onPluginMessage('ERROR', (msg) => {
        setIsLoading(false);
        if (pendingReview.current) {
          if (pendingReviewTimeout.current) {
            clearTimeout(pendingReviewTimeout.current);
            pendingReviewTimeout.current = null;
          }
          pendingReview.current.reject(new Error(msg.payload.message));
          pendingReview.current = null;
          return;
        }
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: 'assistant',
            content: `Error: ${msg.payload.message}`,
            timestamp: Date.now(),
          },
        ]);
      }),
      onPluginMessage('DESIGN_SYSTEM_SCANNED', (msg) => {
        setDsCache(msg.payload);
        setDsScanLoading(false);
        // Auto-enable design system context when a scan completes
        setSettings((prev) => {
          if (!prev.designSystemCache) {
            const updated = { ...prev, designSystemCache: true };
            sendToPlugin({ type: 'STORE_SETTINGS', payload: updated });
            return updated;
          }
          return prev;
        });
      }),
      onPluginMessage('DESIGN_SYSTEM_CACHE_LOADED', (msg) => {
        if (msg.payload) {
          setDsCache(msg.payload);
        }
      }),
      onPluginMessage('OBSERVER_HINTS', (msg) => {
        setObserverHints(msg.payload);
      }),
    ];

    // Request initial data
    sendToPlugin({ type: 'GET_SELECTION' });
    sendToPlugin({ type: 'GET_SETTINGS' });
    sendToPlugin({ type: 'GET_DESIGN_SYSTEM_CACHE' });

    return () => {
      cleanups.forEach((fn) => fn());
      if (pendingReviewTimeout.current) {
        clearTimeout(pendingReviewTimeout.current);
        pendingReviewTimeout.current = null;
      }
    };
  }, []);

  // --- Request design data from plugin (shared step) ---
  const requestDesignData = useCallback(
    (prompt: string): Promise<{ json: object; screenshot?: string }> => {
      return new Promise((resolve, reject) => {
        pendingReview.current = {
          prompt,
          resolve: (data) => {
            // Build node map from the design data for clickable layer refs
            setNodeMap(buildNodeMap(data.json));
            resolve(data);
          },
          reject,
        };
        sendToPlugin({
          type: 'RUN_REVIEW',
          payload: {
            prompt,
            includeScreenshot: settings.includeScreenshot,
          },
        });

        pendingReviewTimeout.current = setTimeout(() => {
          if (pendingReview.current) {
            pendingReview.current = null;
            pendingReviewTimeout.current = null;
            reject(new Error('Timed out waiting for design data from Figma.'));
          }
        }, 30000);
      });
    },
    [settings.includeScreenshot]
  );

  // --- Call LLM providers directly (no server needed) ---
  const callReviewAPI = useCallback(
    async (
      designData: { json: object; screenshot?: string },
      prompt: string,
      agentId?: string,
      agentSystemPrompt?: string,
      conversationHistory?: ConversationTurn[],
      chatMode?: boolean
    ): Promise<{ items: ReviewItem[]; text?: string }> => {
      // Resolve system prompt
      let systemPrompt: string;
      if (agentSystemPrompt) {
        systemPrompt = agentSystemPrompt;
      } else if (agentId) {
        const agent = getAgent(agentId);
        systemPrompt = agent?.systemPrompt || BUILT_IN_AGENTS[0].systemPrompt;
      } else {
        systemPrompt = BUILT_IN_AGENTS[0].systemPrompt;
      }

      if (chatMode) {
        systemPrompt += CHAT_MODE_ADDENDUM;
      }

      // Inject cached design system context (compact token summary)
      if (settings.designSystemCache && dsCache?.promptContext) {
        systemPrompt += `\n\n${dsCache.promptContext}`;
        console.log('[Dominic] Design system context injected into system prompt (%d chars)', dsCache.promptContext.length);
      }

      let rawResponse: string;
      const selectedModel = normalizeModelForProvider(
        settings.provider,
        settings.model
      );

      if (!selectedModel) {
        throw new Error('Set a model ID in Settings before running a review.');
      }

      if (settings.provider === 'openai') {
        rawResponse = await callOpenAI({
          apiKey: settings.apiKey,
          model: selectedModel,
          designData: designData.json,
          screenshot: designData.screenshot,
          userPrompt: prompt || 'Do a comprehensive design review.',
          systemPrompt,
          conversationHistory,
        });
      } else {
        rawResponse = await callAnthropic({
          apiKey: settings.apiKey,
          model: selectedModel,
          designData: designData.json,
          screenshot: designData.screenshot,
          userPrompt: prompt || 'Do a comprehensive design review.',
          systemPrompt,
          conversationHistory,
        });
      }

      return parseReviewResponse(rawResponse);
    },
    [settings.provider, settings.apiKey, settings.model, settings.designSystemCache, dsCache]
  );

  // --- Run a single-agent review (one-shot) ---
  const runReview = useCallback(
    async (prompt: string, agentId?: string) => {
      if (!selection) return;
      if (!settings.apiKey) {
        setActiveTab('settings');
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: 'assistant',
            content: 'Please set your API key in settings first.',
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      setIsLoading(true);

      const customAgents = toCustomAgents(settings.customAgents);
      const agent = agentId ? getAgent(agentId, customAgents) : undefined;

      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: 'user',
          content: prompt,
          timestamp: Date.now(),
        },
      ]);

      try {
        const designData = await requestDesignData(prompt);
        const { items: reviewItems, text } = await callReviewAPI(
          designData,
          prompt,
          agent?.builtIn ? agent.id : undefined,
          agent && !agent.builtIn ? agent.systemPrompt : undefined
        );

        const content = text
          || (reviewItems.length > 0
            ? `Found ${reviewItems.length} item${reviewItems.length !== 1 ? 's' : ''} to review.`
            : 'No issues found — the design looks good!');

        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: 'assistant',
            content,
            reviewItems: reviewItems.length > 0 ? reviewItems : undefined,
            timestamp: Date.now(),
            agentId: agent?.id,
            agentName: agent?.name,
            agentEmoji: agent?.emoji,
          },
        ]);

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
            id: createMessageId(),
            role: 'assistant',
            content: `Error: ${err?.message || 'Something went wrong.'}`,
            timestamp: Date.now(),
            agentId: agent?.id,
            agentName: agent?.name,
            agentEmoji: agent?.emoji,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [selection, settings, requestDesignData, callReviewAPI]
  );

  // --- Run all agents in parallel ---
  const runAllAgents = useCallback(
    async (prompt: string) => {
      if (!selection) return;
      if (!settings.apiKey) {
        setActiveTab('settings');
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: 'assistant',
            content: 'Please set your API key in settings first.',
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      setIsLoading(true);

      const customAgents = toCustomAgents(settings.customAgents);
      const allAgentsList = getAllAgents(customAgents);

      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: 'user',
          content: prompt,
          timestamp: Date.now(),
        },
      ]);

      try {
        const designData = await requestDesignData(prompt);

        const results = await Promise.allSettled(
          allAgentsList.map((agent) =>
            callReviewAPI(
              designData,
              prompt,
              agent.builtIn ? agent.id : undefined,
              !agent.builtIn ? agent.systemPrompt : undefined
            ).then((result) => ({ agent, ...result }))
          )
        );

        let allItems: ReviewItem[] = [];

        for (let idx = 0; idx < results.length; idx++) {
          const result = results[idx];
          const agent = allAgentsList[idx];
          if (result.status === 'fulfilled') {
            const { items, text } = result.value;
            allItems = allItems.concat(items);
            const content = text
              || (items.length > 0
                ? `Found ${items.length} item${items.length !== 1 ? 's' : ''}.`
                : 'No issues found from my perspective.');
            setMessages((prev) => [
              ...prev,
              {
                id: createMessageId(),
                role: 'assistant',
                content,
                reviewItems: items.length > 0 ? items : undefined,
                timestamp: Date.now(),
                agentId: agent.id,
                agentName: agent.name,
                agentEmoji: agent.emoji,
              },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              {
                id: createMessageId(),
                role: 'assistant',
                content: `Error: ${result.reason?.message || 'Something went wrong.'}`,
                timestamp: Date.now(),
                agentId: agent.id,
                agentName: agent.name,
                agentEmoji: agent.emoji,
              },
            ]);
          }
        }

        if (allItems.length > 0) {
          sendToPlugin({
            type: 'WRITE_ANNOTATIONS',
            payload: { reviewItems: allItems },
          });
        }
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: 'assistant',
            content: `Error: ${err?.message || 'Something went wrong.'}`,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [selection, settings, requestDesignData, callReviewAPI]
  );

  // --- Chat mode: start chatting with an agent ---
  const startChat = useCallback(
    async (agentId: string) => {
      if (!selection) return;
      if (!settings.apiKey) {
        setActiveTab('settings');
        return;
      }

      const customAgents = toCustomAgents(settings.customAgents);
      const agent = getAgent(agentId, customAgents);
      if (!agent) return;

      setIsLoading(true);
      try {
        // Capture design data once for the conversation
        const designData = await requestDesignData('Starting chat session');
        chatDesignData.current = designData;
        chatHistory.current = [];
        setActiveAgent(agent);

        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: 'assistant',
            content: `Hey! I'm ${agent.name} — ${agent.subtitle.toLowerCase()}. What would you like to discuss about this design?`,
            timestamp: Date.now(),
            agentId: agent.id,
            agentName: agent.name,
            agentEmoji: agent.emoji,
          },
        ]);
      } catch (err: any) {
        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: 'assistant',
            content: `Error starting chat: ${err?.message || 'Something went wrong.'}`,
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [selection, settings, requestDesignData]
  );

  // --- Chat mode: send a message ---
  const sendChatMessage = useCallback(
    async (prompt: string) => {
      if (!activeAgent || !chatDesignData.current) return;

      setIsLoading(true);

      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: 'user',
          content: prompt,
          timestamp: Date.now(),
        },
      ]);

      try {
        const { items: reviewItems, text } = await callReviewAPI(
          chatDesignData.current,
          prompt,
          activeAgent.builtIn ? activeAgent.id : undefined,
          !activeAgent.builtIn ? activeAgent.systemPrompt : undefined,
          chatHistory.current.length > 0 ? chatHistory.current : undefined,
          true
        );

        // Update conversation history
        chatHistory.current.push({ role: 'user', content: prompt });

        const responseContent = text
          || (reviewItems.length > 0
            ? `Found ${reviewItems.length} item${reviewItems.length !== 1 ? 's' : ''} to review.`
            : 'No issues found — the design looks good!');

        chatHistory.current.push({ role: 'assistant', content: responseContent });

        setMessages((prev) => [
          ...prev,
          {
            id: createMessageId(),
            role: 'assistant',
            content: responseContent,
            reviewItems: reviewItems.length > 0 ? reviewItems : undefined,
            timestamp: Date.now(),
            agentId: activeAgent.id,
            agentName: activeAgent.name,
            agentEmoji: activeAgent.emoji,
          },
        ]);

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
            id: createMessageId(),
            role: 'assistant',
            content: `Error: ${err?.message || 'Something went wrong.'}`,
            timestamp: Date.now(),
            agentId: activeAgent.id,
            agentName: activeAgent.name,
            agentEmoji: activeAgent.emoji,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [activeAgent, callReviewAPI]
  );

  // --- End chat mode ---
  const endChat = useCallback(() => {
    const agent = activeAgent;
    setActiveAgent(null);
    chatDesignData.current = null;
    chatHistory.current = [];
    if (agent) {
      setMessages((prev) => [
        ...prev,
        {
          id: createMessageId(),
          role: 'assistant',
          content: `Chat with ${agent.name} ended.`,
          timestamp: Date.now(),
          agentId: agent.id,
          agentName: agent.name,
          agentEmoji: agent.emoji,
        },
      ]);
    }
  }, [activeAgent]);

  // --- Handlers ---
  const handleQuickPrompt = useCallback(
    (prompt: string, agentId?: string, allAgents?: boolean) => {
      if (allAgents) {
        runAllAgents(prompt);
      } else {
        runReview(prompt, agentId);
      }
    },
    [runReview, runAllAgents]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const prompt = inputValue.trim();
    if (!prompt || isLoading) return;
    setInputValue('');

    if (activeAgent) {
      sendChatMessage(prompt);
    } else {
      runReview(prompt, 'oscar');
    }
  };

  const handleSettingsChange = (newSettings: Settings) => {
    const normalized = normalizeSettings(newSettings);
    setSettings(normalized);
    sendToPlugin({ type: 'STORE_SETTINGS', payload: normalized });
  };

  const handleFocusNode = useCallback((nodeId: string) => {
    sendToPlugin({ type: 'FOCUS_NODE', payload: { nodeId } });
  }, []);

  const handleDismissItem = useCallback((index: number) => {
    sendToPlugin({ type: 'DISMISS_REVIEW_ITEM', payload: { index } });
  }, []);

  const handleClearAllNotes = useCallback(() => {
    sendToPlugin({ type: 'CLEAR_ANNOTATIONS' });
  }, []);

  const handleClearAnnotations = () => {
    sendToPlugin({ type: 'CLEAR_ANNOTATIONS' });
  };

  const handleScanDesignSystem = useCallback(() => {
    setDsScanLoading(true);
    sendToPlugin({ type: 'SCAN_DESIGN_SYSTEM' });
  }, []);

  const handleImportDesignSystem = useCallback((data: DesignSystemCacheData) => {
    setDsCache(data);
    sendToPlugin({ type: 'IMPORT_DESIGN_SYSTEM_CACHE', payload: { cache: data.cache } });
  }, []);

  const handleObserverToggle = useCallback((enabled: boolean) => {
    setObserverEnabled(enabled);
    setObserverHints(null);
    sendToPlugin({ type: 'SET_OBSERVER', payload: { enabled } });
  }, []);

  return (
    <div className="relative flex flex-col h-full w-full bg-figma-bg">
      {/* Tab bar (top) */}
      <TabBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        hasCache={!!dsCache}
      />

      {/* Selection info (below tabs, visible on all tabs except settings) */}
      {activeTab !== 'settings' && (
        <div className="shrink-0">
          <SelectionInfo selection={selection} />
        </div>
      )}

      {/* Observer bar (below selection, visible on chat tab when DS cache exists) */}
      {activeTab === 'chat' && (
        <ObserverBar
          observerEnabled={observerEnabled}
          onToggle={handleObserverToggle}
          hints={observerHints}
          hasCache={!!dsCache}
        />
      )}

      {/* Dismissable onboarding banner */}
      {activeTab === 'chat' && !dsCache && !bannerDismissed && (
        <div className="shrink-0 mx-3 mt-2 px-3 py-2 bg-figma-surface border border-figma-border rounded-lg flex items-start gap-2">
          <span className="text-12 leading-relaxed text-figma-text-secondary flex-1">
            Want better feedback? <button
              onClick={() => { setActiveTab('tokens'); handleScanDesignSystem(); }}
              className="text-figma-accent hover:underline"
            >Scan your design system</button> so agents can reference your actual tokens.
          </span>
          <button
            onClick={() => setBannerDismissed(true)}
            className="text-figma-text-tertiary hover:text-figma-text text-13 shrink-0 leading-none mt-0.5"
          >
            &times;
          </button>
        </div>
      )}

      {/* Tab content */}
      {activeTab === 'chat' && (
        <>
          {/* Chat area */}
          <ChatWindow
            messages={messages}
            highlightedMarker={highlightedMarker}
            onFocusNode={handleFocusNode}
            onDismissItem={handleDismissItem}
            onClearAll={handleClearAllNotes}
            nodeMap={nodeMap}
            isLoading={isLoading}
          />

          {/* Quick prompts / Chat mode indicator */}
          <div className="shrink-0">
            {activeAgent ? (
              <div className="px-3 py-2 border-b border-figma-border flex items-center justify-between">
                <span className="text-12 text-figma-text">
                  {activeAgent.emoji} Chatting with <span className="font-semibold">{activeAgent.name}</span>
                  <span className="text-figma-text-tertiary ml-1">— {activeAgent.subtitle}</span>
                </span>
                <button
                  onClick={endChat}
                  className="text-11 px-2 py-0.5 rounded-full border border-figma-border
                             text-figma-text-secondary hover:text-figma-text hover:border-figma-text-secondary
                             transition-colors"
                >
                  End
                </button>
              </div>
            ) : (
              <QuickPrompts
                onSelect={handleQuickPrompt}
                onStartChat={startChat}
                disabled={isLoading || !selection}
                customAgents={settings.customAgents}
                enableAgentChat={settings.enableAgentChat}
              />
            )}
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
                placeholder={
                  activeAgent
                    ? `Ask ${activeAgent.name}...`
                    : 'Ask about this frame...'
                }
                disabled={isLoading || !selection}
                className="flex-1 bg-figma-surface border border-figma-border rounded-full px-3 py-1.5
                           text-12 text-figma-text placeholder:text-figma-text-tertiary
                           focus:outline-none focus:border-figma-accent
                           disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <button
                type="submit"
                disabled={isLoading || !selection || !inputValue.trim()}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full
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
            {!activeAgent && (
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
                  className="circle-check"
                />
                <span className="text-11 text-figma-text-secondary">
                  Include screenshot
                </span>
              </label>
            )}
          </form>
        </>
      )}

      {activeTab === 'tokens' && (
        <TokensPanel
          dsCache={dsCache}
          dsScanLoading={dsScanLoading}
          onScan={handleScanDesignSystem}
          onImport={handleImportDesignSystem}
        />
      )}

      {activeTab === 'components' && (
        <ComponentsPanel
          dsCache={dsCache}
          dsScanLoading={dsScanLoading}
          onScan={handleScanDesignSystem}
          onImport={handleImportDesignSystem}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsPanel
          settings={settings}
          onChange={handleSettingsChange}
          onClearAnnotations={handleClearAnnotations}
          onClose={() => setActiveTab('chat')}
          dsCache={dsCache}
          dsScanLoading={dsScanLoading}
          onScanDesignSystem={handleScanDesignSystem}
        />
      )}
    </div>
  );
}
