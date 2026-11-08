import { useState } from 'react';
import { LanguageSelect } from './LanguageSelect';
import { ManageScreen } from './ManageScreen';
import { useI18n } from './i18n/useI18n';
import { ThemeToggle } from './ThemeToggle';
import { INITIAL_TIMELINE_MEMORY } from './timelineMemory';
import { TimelineView } from './TimelineView';
import { useThemeMode } from './useThemeMode';

const VIEWS = ['timeline', 'calendar', 'kanban'] as const;
type View = (typeof VIEWS)[number];

export function AppShell() {
  const { t } = useI18n();
  const { mode, setMode } = useThemeMode();
  const [view, setView] = useState<View>('timeline');
  const [managing, setManaging] = useState(false);
  // Kept here so the Timeline filters survive a trip to another tab or to Manage
  const [timelineMemory, setTimelineMemory] = useState(INITIAL_TIMELINE_MEMORY);

  return (
    <div className="shell">
      <header className="shell__header">
        <h1 className="shell__title">{t.appName}</h1>
        <div className="shell__controls">
          <button
            type="button"
            className="manage-button"
            aria-pressed={managing}
            onClick={() => setManaging((current) => !current)}
          >
            {t.manage.open}
          </button>
          <LanguageSelect />
          <ThemeToggle mode={mode} onChange={setMode} />
        </div>
      </header>

      {managing ? (
        <main className="shell__main">
          <ManageScreen />
        </main>
      ) : (
        <main
          className="shell__main"
          id={`panel-${view}`}
          role="tabpanel"
          aria-labelledby={`tab-${view}`}
        >
          {view === 'timeline' ? (
            <TimelineView memory={timelineMemory} onMemoryChange={setTimelineMemory} />
          ) : (
            <p className="placeholder">{t.placeholder[view]}</p>
          )}
        </main>
      )}

      <nav className="shell__nav" aria-label={t.nav.label}>
        <div role="tablist" className="tabs">
          {VIEWS.map((item) => (
            <button
              key={item}
              id={`tab-${item}`}
              type="button"
              role="tab"
              aria-selected={!managing && view === item}
              aria-controls={`panel-${item}`}
              className="tabs__tab"
              onClick={() => {
                setView(item);
                setManaging(false);
              }}
            >
              {t.nav[item]}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
