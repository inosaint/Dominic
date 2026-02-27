'use client';

import { ReviewItem } from '../lib/types';

interface Props {
  items: ReviewItem[];
  annotationResult?: { written: number; skipped: number; annotationsSupported: boolean };
}

const SEVERITY_ICON: Record<string, string> = {
  issue: '\u{1F534}',
  warning: '\u26A0\uFE0F',
  suggestion: '\u{1F4A1}',
};

export default function ReviewSummary({ items, annotationResult }: Props) {
  const issues = items.filter((i) => i.severity === 'issue').length;
  const warnings = items.filter((i) => i.severity === 'warning').length;
  const suggestions = items.filter((i) => i.severity === 'suggestion').length;

  const showInline = annotationResult && !annotationResult.annotationsSupported;

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
      {showInline && (
        <p className="text-figma-warning text-11 mb-1.5">
          Annotations require a paid Figma plan (Dev Mode). Showing feedback inline:
        </p>
      )}
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
      {/* Show inline feedback when annotations aren't supported */}
      {showInline && items.length > 0 && (
        <div className="mt-2 space-y-1.5">
          {items.map((item, i) => (
            <div
              key={i}
              className="bg-figma-surface rounded px-2 py-1.5 text-11"
            >
              <span>{SEVERITY_ICON[item.severity] || SEVERITY_ICON.suggestion}</span>
              {' '}
              <span className="font-medium text-figma-text">{item.category}</span>
              <span className="text-figma-text-tertiary"> &middot; {item.nodeId}</span>
              <p className="text-figma-text mt-0.5">{item.feedback}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
