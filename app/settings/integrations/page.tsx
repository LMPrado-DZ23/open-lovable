"use client";
import Link from 'next/link';
import SettingsLayout, {Card} from '@/components/settings/SettingsLayout';
import IntegrationsForm from '@/components/IntegrationsForm';
import {useAccount} from '@/components/account/client';

export default function IntegrationsSettingsPage() {
  const {account} = useAccount();
  return <SettingsLayout title="Integrações" description="Tokens do Supabase, GitHub e Vercel usados para dar backend, guardar o código e publicar seus apps na internet.">
    {account?.mode === 'supabase'
      ? <Card><p className="text-[14px] text-[#5f5c68]">No modo de equipe, os tokens são configurados pelo administrador do servidor.</p></Card>
      : <IntegrationsForm/>}
    <p className="mt-[12px] text-[13px] text-[#6a6772]">Veja o estado de todas as conexões em <Link href="/integrations" className="underline">Conectores e integrações</Link>.</p>
  </SettingsLayout>;
}
