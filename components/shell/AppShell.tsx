"use client";
import {useEffect, useRef, useState} from 'react';
import Link from 'next/link';
import {usePathname, useRouter} from 'next/navigation';
import OpenLovableLogo from '@/components/brand/OpenLovableLogo';
import ThemeToggle from '@/components/ThemeToggle';
import {accountRequest, useAccount} from '@/components/account/client';

type Item = {href: string; label: string; icon: string};
const main: Item[] = [
  {href: '/', label: 'Novo', icon: 'M12 20h9M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z'},
  {href: '/projects?buscar=1', label: 'Pesquisar', icon: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14ZM21 21l-4.3-4.3'},
  {href: '/integrations', label: 'Conectores', icon: 'M6 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM18 21a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM6 9v3a3 3 0 0 0 3 3h6'},
];
const library: Item[] = [
  {href: '/projects', label: 'Projetos', icon: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'},
  {href: '/templates', label: 'Modelos', icon: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'},
  {href: '/clone', label: 'Importar um site', icon: 'M12 3v12M7 10l5 5 5-5M4 19h16'},
];
const workspaceItems: Item[] = [
  {href: '/settings/ai', label: 'Conexões de IA', icon: 'M12 3v3M12 18v3M3 12h3M18 12h3M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z'},
  {href: '/settings/connectors', label: 'Chaves de conectores', icon: 'M15 7a4 4 0 1 1-3.9 5H8v3H5v-3H3v-2h8.1A4 4 0 0 1 15 7z'},
  {href: '/settings/knowledge', label: 'Conhecimento', icon: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5'},
  {href: '/settings/usage', label: 'Uso', icon: 'M4 20V10M10 20V4M16 20v-7M22 20H2'},
  {href: '/settings/general', label: 'Configurações', icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z'},
];

function Icon({d}: {d: string}) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d}/></svg>;
}

/** Lovable-style frame: dark left navigation with workspace, main actions and a user menu. */
export default function AppShell({children}: {children: React.ReactNode}) {
  const pathname = usePathname();
  const router = useRouter();
  const {account} = useAccount();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menu) return;
    const close = (event: MouseEvent) => { if (!menuRef.current?.contains(event.target as Node)) setMenu(false); };
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(false); };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', escape); };
  }, [menu]);

  const workspaceName = account?.workspaces?.find(workspace => workspace.id === account.selectedWorkspaceId)?.name ?? 'Meu Open Lovable';
  const userName = account?.user?.email?.split('@')[0] ?? 'Operador';
  const active = (href: string) => {
    const path = href.split('?')[0];
    return path === '/' ? pathname === '/' : pathname === path || pathname.startsWith(path + '/');
  };
  const link = (item: Item) => <Link key={item.href} href={item.href} onClick={() => setOpen(false)} aria-current={active(item.href) && !item.href.includes('?') ? 'page' : undefined}
    className={`flex items-center gap-[10px] rounded-[10px] px-[10px] py-[8px] text-[14px] ${active(item.href) && !item.href.includes('?') ? 'bg-white/10 font-medium text-white' : 'text-[#c9c7d1] hover:bg-white/5 hover:text-white'}`}><Icon d={item.icon}/>{item.label}</Link>;

  const nav = <nav aria-label="Menu principal" className="flex h-full flex-col gap-[2px] overflow-y-auto p-[12px]">
    <Link href="/" className="mb-[10px] px-[6px] py-[6px]" aria-label="Open Lovable, início"><OpenLovableLogo size={26} withWordmark={false}/></Link>
    <Link href={account?.mode === 'supabase' ? '/workspaces' : '/projects'} className="mb-[10px] flex items-center gap-[10px] rounded-[10px] border border-white/10 bg-white/5 px-[10px] py-[8px] text-[14px] text-white hover:bg-white/10">
      <span aria-hidden="true" className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-gradient-to-br from-[#ff9a3c] to-[#7a3cf0] text-[11px] font-bold">{workspaceName.slice(0, 1).toUpperCase()}</span>
      <span className="min-w-0 flex-1 truncate">{workspaceName}</span><span aria-hidden="true" className="text-[#8f8d98]">⌄</span>
    </Link>
    {main.map(link)}
    <p className="mb-[4px] mt-[16px] px-[10px] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#77757f]">Biblioteca</p>
    {library.map(link)}
    <p className="mb-[4px] mt-[16px] px-[10px] text-[11px] font-semibold uppercase tracking-[0.12em] text-[#77757f]">Workspace</p>
    {workspaceItems.map(link)}
    <div ref={menuRef} className="relative mt-auto">
      {menu && <div role="menu" aria-label="Menu da conta" className="absolute bottom-[52px] left-0 z-50 w-[248px] overflow-hidden rounded-[14px] border border-white/10 bg-[#1d1d22] py-[6px] text-[14px] text-[#e7e5ee] shadow-[0_16px_40px_rgba(0,0,0,0.45)]">
        <p className="border-b border-white/10 px-[14px] pb-[10px] pt-[6px] font-semibold">{userName}</p>
        <Link role="menuitem" href="/settings/general" onClick={() => setMenu(false)} className="block px-[14px] py-[8px] hover:bg-white/5">Configurações</Link>
        <Link role="menuitem" href="/settings/ai" onClick={() => setMenu(false)} className="block px-[14px] py-[8px] hover:bg-white/5">Conexões de IA</Link>
        <Link role="menuitem" href="/settings/connectors" onClick={() => setMenu(false)} className="block px-[14px] py-[8px] hover:bg-white/5">Chaves de conectores</Link>
        <Link role="menuitem" href="/settings/integrations" onClick={() => setMenu(false)} className="block px-[14px] py-[8px] hover:bg-white/5">Integrações</Link>
        <Link role="menuitem" href="/settings/usage" onClick={() => setMenu(false)} className="block px-[14px] py-[8px] hover:bg-white/5">Uso</Link>
        <Link role="menuitem" href="/settings/data" onClick={() => setMenu(false)} className="block px-[14px] py-[8px] hover:bg-white/5">Dados e backup</Link>
        <div className="flex items-center justify-between px-[14px] py-[6px]"><span>Aparência</span><ThemeToggle/></div>
        <a role="menuitem" href="https://github.com/LMPrado-DZ23/open-lovable#readme" target="_blank" rel="noreferrer" className="block border-t border-white/10 px-[14px] py-[8px] hover:bg-white/5">Documentação</a>
        <Link role="menuitem" href="/" onClick={() => setMenu(false)} className="block px-[14px] py-[8px] hover:bg-white/5">Início</Link>
        {account?.mode === 'supabase' && <button role="menuitem" type="button" onClick={() => { void accountRequest('/api/auth', {action: 'logout'}).catch(() => undefined).finally(() => router.push('/login')); }} className="block w-full border-t border-white/10 px-[14px] py-[8px] text-left hover:bg-white/5">Sair</button>}
      </div>}
      <button type="button" onClick={() => setMenu(value => !value)} aria-haspopup="menu" aria-expanded={menu} className="flex w-full items-center gap-[10px] rounded-[10px] px-[8px] py-[8px] text-left text-[14px] text-[#e7e5ee] hover:bg-white/5">
        <span aria-hidden="true" className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-gradient-to-br from-[#f4583a] to-[#7a3cf0] text-[13px] font-semibold text-white">{userName.slice(0, 1).toUpperCase()}</span>
        <span className="min-w-0 flex-1 truncate">{userName}</span>
      </button>
    </div>
  </nav>;

  return <div className="min-h-screen bg-[#fbf9f7] text-[#1c1b22] md:flex">
    <aside data-keep-colors className="sticky top-0 hidden h-screen w-[248px] shrink-0 bg-[#141416] md:block">{nav}</aside>
    <div data-keep-colors className="flex items-center justify-between bg-[#141416] px-[16px] py-[10px] md:hidden">
      <Link href="/" aria-label="Open Lovable, início"><OpenLovableLogo size={24} withWordmark={false}/></Link>
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label="Abrir menu" className="rounded-md border border-white/20 px-[10px] py-[6px] text-[13px] text-white">Menu</button>
    </div>
    {open && <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-label="Menu"><button type="button" aria-label="Fechar menu" className="absolute inset-0 bg-black/50" onClick={() => setOpen(false)}/><aside data-keep-colors className="relative h-full w-[260px] bg-[#141416]">{nav}</aside></div>}
    <div className="min-w-0 flex-1">{children}</div>
  </div>;
}
