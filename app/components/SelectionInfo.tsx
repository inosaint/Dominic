'use client';

import { SelectionInfo as SelectionInfoType } from '../lib/types';

interface Props {
  selection: SelectionInfoType | null;
}

export default function SelectionInfo({ selection }: Props) {
  if (!selection) {
    return (
      <div className="px-3 py-2.5 border-b border-figma-border">
        <p className="text-12 text-figma-text-tertiary">
          Select a frame to start reviewing
        </p>
      </div>
    );
  }

  return (
    <div className="px-3 py-2.5 border-b border-figma-border flex items-center gap-3">
      {selection.thumbnail && (
        <img
          src={selection.thumbnail}
          alt=""
          className="w-10 h-10 rounded-lg object-cover bg-figma-surface shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-12 text-figma-text font-medium truncate">
          Selected: &ldquo;{selection.name}&rdquo;
        </p>
        <p className="text-11 text-figma-text-secondary mt-0.5">
          {selection.type} &middot; {selection.childCount} layer{selection.childCount !== 1 ? 's' : ''} &middot;{' '}
          {selection.width}&times;{selection.height}px
        </p>
      </div>
    </div>
  );
}
