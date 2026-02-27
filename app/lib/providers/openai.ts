// OpenAI API provider

import { SYSTEM_PROMPT } from '../prompts';

export async function callOpenAI(params: {
  apiKey: string;
  model: string;
  designData: object;
  screenshot?: string;
  userPrompt: string;
}): Promise<string> {
  const { apiKey, model, designData, screenshot, userPrompt } = params;

  const userMessage = `DESIGN DATA:\n${JSON.stringify(designData, null, 2)}\n\nUSER QUESTION:\n${userPrompt}`;

  const content: any[] = [];

  if (screenshot) {
    content.push({
      type: 'image_url',
      image_url: { url: `data:image/png;base64,${screenshot}` },
    });
  }

  content.push({
    type: 'text',
    text: userMessage,
  });

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content },
      ],
    }),
  });

  if (!response.ok) {
    const status = response.status;
    if (status === 401 || status === 403) {
      throw new Error('Invalid API key. Check your OpenAI API key in settings.');
    }
    if (status === 429) {
      throw new Error('Rate limited. Try again in a moment.');
    }
    const body = await response.text();
    throw new Error(`OpenAI API error (${status}): ${body}`);
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message?.content;
  if (!message) {
    throw new Error('No response from OpenAI API.');
  }

  return message;
}
