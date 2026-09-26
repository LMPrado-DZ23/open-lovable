"use client";
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import AppShell from '@/components/shell/AppShell';

type Section = {href: string; label: string; group: string};
export const SETTINGS_SECTIONS: Section[] = [
  {href: '/settings/general', label: 'Geral', group: 'Workspace'},
  {href: '/settings/knowledge', label: 'Conhecimento', group: 'Workspace'},
  {href: '/settings/usage', label: 'Uso', group: 'Workspace'},
  {href: '/settings/preferences', label: 'Preferências', group: 'Workspace'},
  {href: '/settings/ai', label: 'Conexões de IA', group: 'Conexões'},
  {href: '/settings/connectors', label: 'Conectores', group: 'Conexões'},
  {href: '/settings/integrations', label: 'Integrações', group: 'Conexões'},
  {href: '/settings/templates', label: 'Modelos privados', group: 'Conteúdo'},
  {href: '/settings/data', label: 'Dados e backup', group: 'Conteúdo'},
  {href: '/settings/security', label: 'Segurança', group: 'Conteúdo'},
];

/** Lovable-style settings: the app menu on the left, a settings sub-menu, then the page. */
export default function SettingsLayout({title, description, children}: {title: string; description?: string; children: React.ReactNode}) {
  const pathname = usePathname();
  const groups = [...new Set(SETTINGS_SECTIONS.map(section => section.group))];
  return <AppShell>
    <div className="mx-auto flex max-w-[1240px] flex-col gap-[20px] px-[16px] py-[24px] md:flex-row md:px-[28px]">
      <nav aria-label="Configurações" className="md:sticky md:top-[24px] md:h-fit md:w-[220px] md:shrink-0">
        <p className="mb-[10px] px-[10px] text-[20px] font-semibold">Configurações</p>
        <div className="flex gap-[4px] overflow-x-auto pb-[4px] md:block md:overflow-visible">
          {groups.map(group => <div key={group} className="contents md:mb-[14px] md:block">
            <p className="hidden px-[10px] pb-[4px] pt-[8px] text-[11px] font-semibold uppercase tracking-[0.1em] text-[#8a8792] md:block">{group}</p>
            {SETTINGS_SECTIONS.filter(section => section.group === group).map(section => {
              const current = pathname === section.href;
              return <Link key={section.href} href={section.href} aria-current={current ? 'page' : undefined} className={`block shrink-0 whitespace-nowrap rounded-[8px] px-[10px] py-[7px] text-[14px] ${current ? 'bg-[#ece8e3] font-medium text-[#1c1b22]' : 'text-[#4a4852] hover:bg-[#f2eeea]'}`}>{section.label}</Link>;
            })}
          </div>)}
        </div>
      </nav>
      <main className="min-w-0 flex-1">
        <h1 className="text-[28px] font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-[6px] max-w-[720px] text-[14px] leading-relaxed text-[#5f5c68]">{description}</p>}
        <div className="mt-[20px]">{children}</div>
      </main>
    </div>
  </AppShell>;
}

export function Card({title, children}: {title?: string; children: React.ReactNode}) {
  return <section className="mb-[16px] rounded-[14px] border border-[#ece7e2] bg-white p-[18px]">{title && <h2 className="mb-[10px] text-[16px] font-semibold">{title}</h2>}{children}</section>;
}
