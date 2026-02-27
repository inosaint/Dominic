'use client';

import { ReviewItem } from '../lib/types';

interface Props {
  items: ReviewItem[];
  annotationResult?: { written: number; skipped: number };
}

export default function ReviewSummary({ items, annotationResult }: Props) {
  const issues = items.filter((i) => i.severity === 'issue').length;
  const warnings = items.filter((i) => i.severity === 'warning').length;
  const suggestions = items.filter((i) => i.severity === 'suggestion').length;

  return (
    <div className="text-12 text-figma-text-secondary">
      {annotationResult && (
        <p className="text-figma-success font-medium">
          {annotationResult.written} annotation{annotationResult.written !== 1 ? 's' : ''} added
          {annotationResult.skipped > 0 && (
            <span className="text-figma-text-tertiary">
              {' '}&middot; {annotationResult.skipped} skipped
            </span>
          )}
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
    </div>
  );
}
