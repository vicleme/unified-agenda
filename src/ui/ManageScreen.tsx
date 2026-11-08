import { useState } from 'react';
import { AgendaGroupsSection } from './AgendaGroupsSection';
import { AgendasSection } from './AgendasSection';
import { BackupSection } from './BackupSection';
import { useAgendaGroups, useAgendas, useItems, useTags } from './data/useEntityList';
import { formatCount } from './format';
import { ItemsSection } from './ItemsSection';
import { useI18n } from './i18n/useI18n';
import { SettingsSection } from './SettingsSection';
import { TagsSection } from './TagsSection';

const SECTIONS = ['agendas', 'groups', 'tags', 'items', 'settings', 'backup'] as const;
type Section = (typeof SECTIONS)[number];

/** Where agendas, items, settings and backups are managed. */
export function ManageScreen() {
  const { t, locale } = useI18n();
  const [section, setSection] = useState<Section>('agendas');
  const agendas = useAgendas();
  const items = useItems();
  const tags = useTags();
  const groups = useAgendaGroups();

  let summary = '';
  if (section === 'agendas' && !agendas.loading) {
    summary = formatCount(locale, agendas.data.length, t.counts.agendas);
  } else if (section === 'groups' && !groups.loading) {
    summary = formatCount(locale, groups.data.length, t.counts.groups);
  } else if (section === 'tags' && !tags.loading) {
    summary = formatCount(locale, tags.data.length, t.counts.tags);
  } else if (section === 'items' && !items.loading) {
    summary = formatCount(locale, items.data.length, t.counts.items);
  }

  return (
    <section>
      <div role="tablist" aria-label={t.manage.label} className="subtabs">
        {SECTIONS.map((item) => (
          <button
            key={item}
            id={`manage-tab-${item}`}
            type="button"
            role="tab"
            aria-selected={section === item}
            aria-controls={`manage-panel-${item}`}
            className="subtabs__tab"
            onClick={() => setSection(item)}
          >
            {t.manage.sections[item]}
          </button>
        ))}
      </div>

      <div id={`manage-panel-${section}`} role="tabpanel" aria-labelledby={`manage-tab-${section}`}>
        <h2 className="manage__title">{t.manage.sections[section]}</h2>
        {summary && <p className="manage__summary">{summary}</p>}
        {section === 'agendas' && <AgendasSection />}
        {section === 'groups' && <AgendaGroupsSection />}
        {section === 'tags' && <TagsSection />}
        {section === 'items' && <ItemsSection />}
        {section === 'settings' && <SettingsSection />}
        {section === 'backup' && <BackupSection />}
      </div>
    </section>
  );
}
