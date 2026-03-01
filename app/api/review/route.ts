// Server route for LLM design review calls

import { NextRequest, NextResponse } from 'next/server';
import { callAnthropic } from '../../lib/providers/anthropic';
import { callOpenAI } from '../../lib/providers/openai';
import { parseReviewResponse } from '../../lib/parseResponse';
import { ReviewRequest } from '../../lib/types';
import { getAgent, BUILT_IN_AGENTS } from '../../lib/agents';

// Fallback system prompt when no agent is specified
const FALLBACK_SYSTEM_PROMPT = BUILT_IN_AGENTS[0].systemPrompt;

// Addendum for chat mode — tells the agent it can respond conversationally
const CHAT_MODE_ADDENDUM = `

CHAT MODE:
You are in a conversation with the user. You may respond in two ways:
1. If the user asks for a review or analysis, respond with the JSON array as specified above.
2. If the user asks a follow-up question, wants clarification, or is having a discussion, respond in plain text. Be helpful, specific, and stay in character.
Do NOT wrap plain text responses in JSON. Just write naturally.`;

export async function POST(request: NextRequest) {
  try {
    const body: ReviewRequest = await request.json();
    const {
      designData, screenshot, userPrompt, provider, apiKey, model,
      agentId, agentSystemPrompt, conversationHistory, chatMode,
    } = body;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required. Set it in plugin settings.' },
        { status: 400 }
      );
    }

    if (!designData) {
      return NextResponse.json(
        { error: 'No design data provided.' },
        { status: 400 }
      );
    }

    // Resolve the system prompt: custom prompt > agent lookup > fallback
    let systemPrompt: string;
    if (agentSystemPrompt) {
      systemPrompt = agentSystemPrompt;
    } else if (agentId) {
      const agent = getAgent(agentId);
      systemPrompt = agent?.systemPrompt || FALLBACK_SYSTEM_PROMPT;
    } else {
      systemPrompt = FALLBACK_SYSTEM_PROMPT;
    }

    if (chatMode) {
      systemPrompt += CHAT_MODE_ADDENDUM;
    }

    let rawResponse: string;

    if (provider === 'openai') {
      rawResponse = await callOpenAI({
        apiKey,
        model: model || 'gpt-4o',
        designData,
        screenshot,
        userPrompt: userPrompt || 'Do a comprehensive design review.',
        systemPrompt,
        conversationHistory,
      });
    } else {
      rawResponse = await callAnthropic({
        apiKey,
        model: model || 'claude-sonnet-4-20250514',
        designData,
        screenshot,
        userPrompt: userPrompt || 'Do a comprehensive design review.',
        systemPrompt,
        conversationHistory,
      });
    }

    const result = parseReviewResponse(rawResponse);

    return NextResponse.json({ items: result.items, text: result.text });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
