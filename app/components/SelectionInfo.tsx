'use client';

import { SelectionInfo as SelectionInfoType } from '../lib/types';

interface Props {
  selection: SelectionInfoType | null;
}

export default function SelectionInfo({ selection }: Props) {
  if (!selection) {
    return (
      <div className="px-3 py-3 border-b border-figma-border">
        <p className="text-12 text-figma-text-tertiary">
          Select a frame to start reviewing
        </p>
      </div>
    );
  }

  return (
    <div className="px-3 py-3 border-b border-figma-border">
      <p className="text-12 text-figma-text font-medium truncate">
        Selected: &ldquo;{selection.name}&rdquo;
      </p>
      <p className="text-11 text-figma-text-secondary mt-0.5">
        {selection.type} &middot; {selection.childCount} layers &middot;{' '}
        {selection.width}&times;{selection.height}px
      </p>
    </div>
  );
}
