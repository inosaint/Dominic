'use client';

export type TabId = 'chat' | 'tokens' | 'components' | 'settings';

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hasCache: boolean;
}

const TABS: { id: TabId; label: string; icon?: string }[] = [
  { id: 'chat', label: 'Chat' },
  { id: 'tokens', label: 'Tokens' },
  { id: 'components', label: 'Components' },
  { id: 'settings', label: '', icon: '\u2699' },
];

export default function TabBar({ activeTab, onTabChange, hasCache }: Props) {
  return (
    <div className="shrink-0 flex border-b border-figma-border">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const isSettings = tab.id === 'settings';
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`${isSettings ? 'w-9 shrink-0' : 'flex-1'} py-1.5 text-11 font-medium transition-colors relative
              ${isActive
                ? 'text-figma-text'
                : 'text-figma-text-tertiary hover:text-figma-text-secondary'
              }`}
            title={isSettings ? 'Settings' : undefined}
          >
            {tab.icon ? (
              <span className="text-[14px]">{tab.icon}</span>
            ) : (
              tab.label
            )}
            {/* Dot indicator for tokens/components when no cache */}
            {!hasCache && (tab.id === 'tokens' || tab.id === 'components') && (
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
