"use client";
import Link from 'next/link';
import SettingsLayout, {Card} from '@/components/settings/SettingsLayout';

const protections: Array<[string, string]> = [
  ['Chaves criptografadas', 'Chaves de IA, integrações e conectores são guardadas com AES-256-GCM e nunca voltam para o navegador.'],
  ['Segredos fora do código', 'Antes de enviar algo para a IA, o Open Lovable bloqueia textos que parecem senhas ou chaves. Conectores secretos rodam só em funções do Supabase.'],
  ['Prévia isolada', 'O app gerado roda numa moldura isolada, sem acesso aos seus dados, cookies ou chaves.'],
  ['Publicação protegida', 'Páginas publicadas saem com política de segurança de conteúdo (CSP) e em modo sandbox.'],
  ['Rede controlada', 'Chamadas para provedores passam por um transporte que bloqueia endereços internos da rede (proteção SSRF).'],
  ['Histórico com desfazer', 'Toda mudança vira uma revisão. Dá para voltar a qualquer versão pela aba Histórico.'],
];

export default function SecuritySettingsPage() {
  return <SettingsLayout title="Segurança" description="Como o Open Lovable protege seus projetos e chaves, e onde verificar a segurança de cada app.">
    <Card title="Proteções ativas">
      <ul className="grid gap-[12px] sm:grid-cols-2">{protections.map(([title, text]) => <li key={title} className="rounded-[10px] border border-[#f0ece7] p-[12px]"><p className="flex items-center gap-[6px] text-[14px] font-medium"><span aria-hidden="true" className="text-green-700">✓</span>{title}</p><p className="mt-[4px] text-[13px] leading-relaxed text-[#5f5c68]">{text}</p></li>)}</ul>
    </Card>
    <Card title="Verificar um app">
      <p className="text-[13px] leading-relaxed text-[#5f5c68]">Abra um projeto e use a aba <strong>Segurança</strong> para procurar chaves expostas, links inseguros e outros problemas no código. Se encontrar algo, dá para pedir a correção à IA com um clique.</p>
      <Link href="/projects" className="mt-[12px] inline-block rounded-[10px] border border-[#e3ded8] px-[12px] py-[7px] text-[13px] hover:bg-[#f7f4f1]">Ver projetos</Link>
    </Card>
    <Card title="Chaves">
      <div className="flex flex-wrap gap-[10px] text-[13px]">
        <Link href="/settings/ai" className="rounded-[10px] border border-[#e3ded8] px-[12px] py-[7px] hover:bg-[#f7f4f1]">Chaves de IA</Link>
        <Link href="/settings/connectors" className="rounded-[10px] border border-[#e3ded8] px-[12px] py-[7px] hover:bg-[#f7f4f1]">Chaves de conectores</Link>
        <Link href="/settings/integrations" className="rounded-[10px] border border-[#e3ded8] px-[12px] py-[7px] hover:bg-[#f7f4f1]">Tokens de integrações</Link>
      </div>
    </Card>
  </SettingsLayout>;
}
