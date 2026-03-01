// OpenAI API provider

import { ConversationTurn } from '../types';

export async function callOpenAI(params: {
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
  const messages: any[] = [
    { role: 'system', content: systemPrompt },
  ];

  if (conversationHistory && conversationHistory.length > 0) {
    // First message includes design data context
    const firstUserContent: any[] = [];
    if (screenshot) {
      firstUserContent.push({
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${screenshot}` },
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
        type: 'image_url',
        image_url: { url: `data:image/png;base64,${screenshot}` },
      });
    }
    content.push({ type: 'text', text: `${designContext}\n\nUSER QUESTION:\n${userPrompt}` });
    messages.push({ role: 'user', content });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages,
    }),
  });

  if (!response.ok) {
    const status = response.status;
    const body = await response.text();
    let parsed: any = null;
    try {
      parsed = JSON.parse(body);
    } catch {
      parsed = null;
    }
    if (status === 401 || status === 403) {
      throw new Error('Invalid API key. Check your OpenAI API key in settings.');
    }
    if (status === 429) {
      throw new Error('Rate limited. Try again in a moment.');
    }
    const isModelError =
      status === 404 ||
      parsed?.error?.code === 'model_not_found' ||
      (parsed?.error?.type === 'invalid_request_error' &&
        /model/i.test(parsed?.error?.message || ''));
    if (isModelError) {
      const message =
        parsed?.error?.message ||
        `Model "${model}" not found for this API key/account.`;
      throw new Error(
        `OpenAI model error: ${message} Use an exact model ID available to your account (for example: gpt-4o or gpt-4o-mini).`
      );
    }
    throw new Error(`OpenAI API error (${status}): ${body}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message?.content;
  if (!message) {
    throw new Error('No response from OpenAI API.');
  }

  return message;
}
