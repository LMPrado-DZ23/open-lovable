"use client";
import Link from 'next/link';
import SettingsLayout, {Card, SETTINGS_SECTIONS} from '@/components/settings/SettingsLayout';
import ThemeToggle from '@/components/ThemeToggle';
import {useAccount} from '@/components/account/client';

export default function GeneralSettingsPage() {
  const {account} = useAccount();
  const workspace = account?.workspaces?.find(item => item.id === account.selectedWorkspaceId);
  return <SettingsLayout title="Geral" description="Informações do seu workspace e da aparência do Open Lovable.">
    <Card title="Workspace">
      <dl className="grid gap-[10px] text-[14px] sm:grid-cols-[180px_1fr]">
        <dt className="text-[#6a6772]">Nome</dt><dd className="font-medium">{workspace?.name ?? 'Meu Open Lovable'}</dd>
        <dt className="text-[#6a6772]">Modo da conta</dt><dd>{account?.mode === 'supabase' ? 'Contas de equipe (Supabase)' : 'Individual, neste computador'}</dd>
        {account?.user?.email && <><dt className="text-[#6a6772]">Usuário</dt><dd>{account.user.email}</dd></>}
        <dt className="text-[#6a6772]">Idioma</dt><dd>Português (Brasil)</dd>
      </dl>
      {account?.mode === 'supabase' && <Link href="/workspaces" className="mt-[14px] inline-block rounded-[10px] border border-[#e3ded8] px-[12px] py-[7px] text-[13px] hover:bg-[#f7f4f1]">Gerenciar workspaces e membros</Link>}
    </Card>
    <Card title="Aparência"><div className="flex items-center justify-between text-[14px]"><span>Tema claro ou escuro</span><ThemeToggle/></div></Card>
    <Card title="Todas as configurações">
      <ul className="grid gap-[8px] sm:grid-cols-2">{SETTINGS_SECTIONS.filter(section => section.href !== '/settings/general').map(section => <li key={section.href}><Link href={section.href} className="block rounded-[10px] border border-[#ece7e2] px-[12px] py-[10px] text-[14px] hover:bg-[#f7f4f1]">{section.label}<span className="block text-[12px] text-[#8a8792]">{section.group}</span></Link></li>)}</ul>
    </Card>
  </SettingsLayout>;
}
