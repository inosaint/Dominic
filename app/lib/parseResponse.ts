// Parse and validate LLM response into ReviewItem[]

import { ReviewItem } from './types';

const VALID_CATEGORIES = new Set([
  'spacing',
  'typography',
  'color',
  'hierarchy',
  'accessibility',
  'layout',
  'consistency',
  'interaction',
  'general',
]);

const VALID_SEVERITIES = new Set(['suggestion', 'warning', 'issue']);

function extractJSON(text: string): string {
  // Try to find JSON array in markdown code fences
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();

  // Try to find a raw JSON array
  const arrayMatch = text.match(/\[[\s\S]*\]/);
  if (arrayMatch) return arrayMatch[0];

  // Try to find a JSON object with an items/feedback array
  const objMatch = text.match(/\{[\s\S]*\}/);
  if (objMatch) {
    try {
      const obj = JSON.parse(objMatch[0]);
      if (Array.isArray(obj.items)) return JSON.stringify(obj.items);
      if (Array.isArray(obj.feedback)) return JSON.stringify(obj.feedback);
      if (Array.isArray(obj.reviews)) return JSON.stringify(obj.reviews);
    } catch {
      // Not valid JSON object
    }
  }

  return text;
}

function validateItem(item: any): ReviewItem | null {
  if (!item || typeof item !== 'object') return null;
  if (typeof item.nodeId !== 'string' || !item.nodeId) return null;
  if (typeof item.feedback !== 'string' || !item.feedback) return null;

  const category = VALID_CATEGORIES.has(item.category) ? item.category : 'general';
  const severity = VALID_SEVERITIES.has(item.severity) ? item.severity : 'suggestion';

  return {
    nodeId: item.nodeId,
    feedback: item.feedback.slice(0, 500),
    category,
    severity,
  };
}

export function parseReviewResponse(rawText: string): ReviewItem[] {
  const jsonStr = extractJSON(rawText);

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error(
      'Failed to parse LLM response as JSON. The model returned an unexpected format.'
    );
  }

  const items = Array.isArray(parsed) ? parsed : [];

  const validated = items
    .map(validateItem)
    .filter((item): item is ReviewItem => item !== null);

  if (validated.length === 0 && items.length > 0) {
    throw new Error(
      'LLM returned feedback items but none had the required fields (nodeId, feedback).'
    );
  }

  return validated;
}
