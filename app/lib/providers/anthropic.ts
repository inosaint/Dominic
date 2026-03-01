// Anthropic API provider

import { ConversationTurn } from '../types';

export async function callAnthropic(params: {
  apiKey: string;
  model: string;
  designData: object;
  screenshot?: string;
  userPrompt: string;
  systemPrompt: string;
  conversationHistory?: ConversationTurn[];
}): Promise<string> {
  const { apiKey: rawKey, model, designData, screenshot, userPrompt, systemPrompt, conversationHistory } = params;

  // Strip invisible Unicode characters that break browser fetch headers
  const apiKey = rawKey.replace(/[^\x20-\x7E]/g, '').trim();

  const designContext = `DESIGN DATA:\n${JSON.stringify(designData)}`;

  // Build messages array
  const messages: any[] = [];

  if (conversationHistory && conversationHistory.length > 0) {
    // First message includes design data context
    const firstUserContent: any[] = [];
    if (screenshot) {
      firstUserContent.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: screenshot },
      });
    }
    firstUserContent.push({ type: 'text', text: `${designContext}\n\nUSER QUESTION:\n${conversationHistory[0].content}` });
    messages.push({ role: 'user', content: firstUserContent });

    // Add remaining history turns
    for (let i = 1; i < conversationHistory.length; i++) {
      messages.push({
        role: conversationHistory[i].role,
        content: conversationHistory[i].content,
      });
    }

    // Add current user message
    messages.push({ role: 'user', content: userPrompt });
  } else {
    // Single-turn: same as before
    const content: any[] = [];
    if (screenshot) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: 'image/png', data: screenshot },
      });
    }
    content.push({ type: 'text', text: `${designContext}\n\nUSER QUESTION:\n${userPrompt}` });
    messages.push({ role: 'user', content });
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) {
      throw new Error('Invalid API key. Check your Anthropic API key in settings.');
    }
    if (status === 429) {
      throw new Error('Rate limited. Try again in a moment.');
    }
    const body = await response.text();
    throw new Error(`Anthropic API error (${status}): ${body}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find((b: any) => b.type === 'text');
  if (!textBlock) {
    throw new Error('No text response from Anthropic API.');
  }

  return textBlock.text;
}
