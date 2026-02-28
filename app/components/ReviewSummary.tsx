'use client';

import { ReviewItem } from '../lib/types';

interface Props {
  items: ReviewItem[];
  annotationResult?: { written: number; skipped: number; annotationsSupported: boolean };
  highlightedIndex?: number | null;
  onFocusNode?: (nodeId: string) => void;
}

const SEVERITY_STYLES: Record<string, { dot: string; label: string }> = {
  issue: { dot: 'bg-[#F24822]', label: 'Issue' },
  warning: { dot: 'bg-[#F29912]', label: 'Warning' },
  suggestion: { dot: 'bg-[#7B61FF]', label: 'Suggestion' },
};

const CATEGORY_LABELS: Record<string, string> = {
  spacing: 'Spacing',
  typography: 'Typography',
  color: 'Color',
  hierarchy: 'Hierarchy',
  accessibility: 'Accessibility',
  layout: 'Layout',
  consistency: 'Consistency',
  interaction: 'Interaction',
  general: 'General',
};

export default function ReviewSummary({
  items,
  annotationResult,
  highlightedIndex,
  onFocusNode,
}: Props) {
  const issues = items.filter((i) => i.severity === 'issue').length;
  const warnings = items.filter((i) => i.severity === 'warning').length;
  const suggestions = items.filter((i) => i.severity === 'suggestion').length;

  // Sort same as markers: issues first, then warnings, then suggestions
  const sorted = [...items].sort((a, b) => {
    const order: Record<string, number> = { issue: 0, warning: 1, suggestion: 2 };
    return (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
  });

  return (
    <div className="text-12 text-figma-text-secondary">
      {annotationResult && annotationResult.annotationsSupported && (
        <p className="text-figma-success font-medium">
          {annotationResult.written} annotation{annotationResult.written !== 1 ? 's' : ''} added
          {annotationResult.skipped > 0 && (
            <span className="text-figma-text-tertiary">
              {' '}&middot; {annotationResult.skipped} skipped
            </span>
          )}
        </p>
      )}
      {/* Counts summary */}
      <p className="mt-0.5">
        {issues > 0 && (
          <span className="text-figma-error">{issues} issue{issues !== 1 ? 's' : ''}</span>
        )}
        {issues > 0 && (warnings > 0 || suggestions > 0) && ' \u00B7 '}
        {warnings > 0 && (
          <span className="text-figma-warning">{warnings} warning{warnings !== 1 ? 's' : ''}</span>
        )}
        {warnings > 0 && suggestions > 0 && ' \u00B7 '}
        {suggestions > 0 && (
          <span>{suggestions} suggestion{suggestions !== 1 ? 's' : ''}</span>
        )}
      </p>
      {/* Numbered item list — always shown */}
      {sorted.length > 0 && (
        <div className="mt-2 space-y-1">
          {sorted.map((item, i) => {
            const style = SEVERITY_STYLES[item.severity] || SEVERITY_STYLES.suggestion;
            const isHighlighted = highlightedIndex === i;

            return (
              <button
                key={i}
                onClick={() => onFocusNode?.(item.nodeId)}
                className={`w-full text-left rounded px-2 py-1.5 text-11 flex items-start gap-2 transition-colors
                  ${isHighlighted
                    ? 'bg-figma-accent/15 ring-1 ring-figma-accent'
                    : 'bg-figma-surface hover:bg-figma-surface-hover'
                  }`}
              >
                {/* Numbered dot matching canvas marker */}
                <span
                  className={`${style.dot} shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold leading-none mt-0.5`}
                >
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-figma-text">
                    {CATEGORY_LABELS[item.category] || item.category}
                  </span>
                  <span className="text-figma-text-tertiary ml-1">
                    {style.label}
                  </span>
                  <p className="text-figma-text mt-0.5 break-words whitespace-pre-wrap">
                    {item.feedback}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
