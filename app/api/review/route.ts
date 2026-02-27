// Server route for LLM design review calls

import { NextRequest, NextResponse } from 'next/server';
import { callAnthropic } from '../../lib/providers/anthropic';
import { callOpenAI } from '../../lib/providers/openai';
import { parseReviewResponse } from '../../lib/parseResponse';
import { ReviewRequest } from '../../lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: ReviewRequest = await request.json();
    const { designData, screenshot, userPrompt, provider, apiKey, model } = body;

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

    let rawResponse: string;

    if (provider === 'openai') {
      rawResponse = await callOpenAI({
        apiKey,
        model: model || 'gpt-4o',
        designData,
        screenshot,
        userPrompt: userPrompt || 'Do a comprehensive design review.',
      });
    } else {
      rawResponse = await callAnthropic({
        apiKey,
        model: model || 'claude-sonnet-4-20250514',
        designData,
        screenshot,
        userPrompt: userPrompt || 'Do a comprehensive design review.',
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
