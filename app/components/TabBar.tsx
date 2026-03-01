'use client';

export type TabId = 'chat' | 'tokens' | 'components';

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hasCache: boolean;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'components', label: 'Components' },
];

export default function TabBar({ activeTab, onTabChange, hasCache }: Props) {
  return (
    <div className="shrink-0 flex border-b border-figma-border">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 py-1.5 text-11 font-medium transition-colors relative
              ${isActive
                ? 'text-figma-text'
                : 'text-figma-text-tertiary hover:text-figma-text-secondary'
              }`}
          >
            {tab.label}
            {/* Dot indicator for tokens/components when no cache */}
            {!hasCache && tab.id !== 'chat' && (
              <span className="inline-block w-1 h-1 rounded-full bg-figma-accent ml-1 align-middle" />
            )}
            {/* Active underline */}
            {isActive && (
              <span className="absolute bottom-0 left-2 right-2 h-[2px] bg-figma-accent rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}
