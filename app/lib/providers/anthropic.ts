// Anthropic API provider

export async function callAnthropic(params: {
  apiKey: string;
  model: string;
  designData: object;
  screenshot?: string;
  userPrompt: string;
  systemPrompt: string;
}): Promise<string> {
  const { apiKey, model, designData, screenshot, userPrompt, systemPrompt } = params;

  const userMessage = `DESIGN DATA:\n${JSON.stringify(designData)}\n\nUSER QUESTION:\n${userPrompt}`;

  const content: any[] = [];

  if (screenshot) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: screenshot,
      },
    });
  }

  content.push({
    type: 'text',
    text: userMessage,
  });

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content,
        },
      ],
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
