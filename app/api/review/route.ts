// Server route for LLM design review calls

import { NextRequest, NextResponse } from 'next/server';
import { callAnthropic } from '../../lib/providers/anthropic';
import { callOpenAI } from '../../lib/providers/openai';
import { parseReviewResponse } from '../../lib/parseResponse';
import { ReviewRequest } from '../../lib/types';
import { getAgent, BUILT_IN_AGENTS } from '../../lib/agents';

// Fallback system prompt when no agent is specified
const FALLBACK_SYSTEM_PROMPT = BUILT_IN_AGENTS[0].systemPrompt;

export async function POST(request: NextRequest) {
  try {
    const body: ReviewRequest = await request.json();
    const { designData, screenshot, userPrompt, provider, apiKey, model, agentId, agentSystemPrompt } = body;

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

    let rawResponse: string;

    if (provider === 'openai') {
      rawResponse = await callOpenAI({
        apiKey,
        model: model || 'gpt-4o',
        designData,
        screenshot,
        userPrompt: userPrompt || 'Do a comprehensive design review.',
        systemPrompt,
      });
    } else {
      rawResponse = await callAnthropic({
        apiKey,
        model: model || 'claude-sonnet-4-20250514',
        designData,
        screenshot,
        userPrompt: userPrompt || 'Do a comprehensive design review.',
        systemPrompt,
      });
    }

    const items = parseReviewResponse(rawResponse);

    return NextResponse.json({ items });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
