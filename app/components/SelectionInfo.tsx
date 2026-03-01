'use client';

import { SelectionInfo as SelectionInfoType } from '../lib/types';

interface Props {
  selection: SelectionInfoType | null;
  onOpenSettings?: () => void;
}

export default function SelectionInfo({ selection, onOpenSettings }: Props) {
  if (!selection) {
    return (
      <div className="px-3 py-3 border-b border-figma-border flex items-center justify-between">
        <p className="text-12 text-figma-text-tertiary">
          Select a frame to start reviewing
        </p>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="text-figma-text-secondary hover:text-figma-text text-[16px] leading-none p-0.5 shrink-0"
            title="Settings"
          >
            &#9881;
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="px-3 py-3 border-b border-figma-border flex items-center gap-3">
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
      {onOpenSettings && (
        <button
          onClick={onOpenSettings}
          className="text-figma-text-secondary hover:text-figma-text text-[16px] leading-none p-0.5 shrink-0"
          title="Settings"
        >
          &#9881;
        </button>
      )}
    </div>
  );
}
