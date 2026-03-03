'use client';

export type TabId = 'mascot' | 'chat' | 'tokens' | 'components' | 'settings';

interface Props {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
  hasCache: boolean;
}

const MASCOT_SVG = `<svg width="16" height="16" viewBox="0 0 128 128" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M100 60C100 79.88 83.88 96 64 96C54.78 96 28 96 28 96C28 96 28 70.66 28 60C28 40.12 44.12 24 64 24C83.88 24 100 40.12 100 60Z" fill="currentColor"/><circle cx="55.14" cy="60.14" r="5.14" fill="white"/><circle cx="72.29" cy="60.14" r="5.14" fill="white"/></svg>`;

const TABS: { id: TabId; label: string; icon?: string; svgIcon?: string }[] = [
  { id: 'mascot', label: '', svgIcon: MASCOT_SVG },
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
        const isCompact = tab.id === 'settings' || tab.id === 'mascot';
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`${isCompact ? 'w-9 shrink-0' : 'flex-1'} py-1.5 text-11 font-medium transition-colors relative flex items-center justify-center
              ${isActive
                ? tab.id === 'mascot' ? 'text-figma-accent' : 'text-figma-text'
                : 'text-figma-text-tertiary hover:text-figma-text-secondary'
              }`}
            title={tab.id === 'settings' ? 'Settings' : tab.id === 'mascot' ? 'Dominic' : undefined}
          >
            {tab.svgIcon ? (
              <span
                className="inline-block w-4 h-4"
                dangerouslySetInnerHTML={{ __html: tab.svgIcon }}
              />
            ) : tab.icon ? (
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
