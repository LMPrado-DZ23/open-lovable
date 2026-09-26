"use client";
import {useEffect, useState} from 'react';
import SettingsLayout, {Card} from '@/components/settings/SettingsLayout';
import type {UsageSummary} from '@/lib/usage/summary';

const number = new Intl.NumberFormat('pt-BR');
const short = (value: number) => value >= 1_000_000 ? `${(value / 1_000_000).toFixed(1).replace('.', ',')} mi` : value >= 1000 ? `${number.format(Math.round(value / 1000))} mil` : number.format(value);
const brDate = (value?: string) => value ? value.split('-').reverse().join('/') : '';

export default function UsageSettingsPage() {
  const [days, setDays] = useState(14);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setUsage(null); setError('');
    void fetch('/api/projects?' + new URLSearchParams({action: 'usage', days: String(days)}), {cache: 'no-store', signal: controller.signal}).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Não foi possível carregar o uso.'); setUsage(data.usage);
    }).catch(caught => { if (!controller.signal.aborted) setError(caught.message); });
    return () => controller.abort();
  }, [days]);
  const max = Math.max(1, ...(usage?.days ?? []).map(day => day.runs));
  const stats: Array<[string, string]> = usage ? [['Gerações', number.format(usage.totals.runs)], ['Tokens', short(usage.totals.tokens)], ['Concluídas', number.format(usage.totals.applied)], ['Com falha ou canceladas', number.format(usage.totals.failed)]] : [];
  return <SettingsLayout title="Uso" description="Quantas gerações a IA fez e quantos tokens foram gastos neste workspace. O custo é cobrado pelo provedor de cada chave de IA.">
    <div role="tablist" aria-label="Período" className="mb-[14px] flex gap-[6px]">{[7, 14, 30, 90].map(value => <button key={value} type="button" role="tab" aria-selected={days === value} onClick={() => setDays(value)} className={`rounded-full px-[12px] py-[6px] text-[13px] ${days === value ? 'bg-[#1c1b22] text-white' : 'border border-[#e3ded8] bg-white'}`}>{value} dias</button>)}</div>
    {error && <p role="alert" className="mb-[12px] rounded-md border border-red-200 bg-red-50 p-[12px] text-[13px] text-red-800">{error}</p>}
    {!usage ? !error && <p role="status" className="text-[14px] text-[#6a6772]">Carregando…</p> : <>
      <div className="mb-[16px] grid gap-[12px] sm:grid-cols-4">{stats.map(([label, value]) => <div key={label} className="rounded-[14px] border border-[#ece7e2] bg-white p-[16px]"><p className="text-[12px] text-[#6a6772]">{label}</p><p className="mt-[4px] text-[24px] font-semibold">{value}</p></div>)}</div>
      <Card title="Gerações por dia">
        <div className="flex h-[180px] items-end gap-[4px]" role="img" aria-label={`Gerações por dia nos últimos ${days} dias`}>
          {usage.days.map(day => <div key={day.date} className="flex h-full flex-1 flex-col justify-end" title={`${brDate(day.date)}: ${day.runs} geração(ões), ${short(day.tokens)} tokens`}>
            <div className="rounded-t-[4px] bg-gradient-to-t from-[#f4583a] to-[#a855f7]" style={{height: `${Math.max(day.runs ? 4 : 1, (day.runs / max) * 100)}%`, opacity: day.runs ? 1 : 0.25}}/>
          </div>)}
        </div>
        <div className="mt-[6px] flex justify-between text-[11px] text-[#8a8792]"><span>{brDate(usage.days[0]?.date)}</span><span>Hoje</span></div>
      </Card>
      <Card title="Por modelo">{usage.byModel.length === 0 ? <p className="text-[14px] text-[#6a6772]">Nenhuma geração no período.</p>
        : <table className="w-full text-left text-[13px]"><thead><tr className="text-[#6a6772]"><th className="py-[6px] font-medium">Modelo</th><th className="py-[6px] font-medium">Gerações</th><th className="py-[6px] font-medium">Tokens</th></tr></thead>
          <tbody>{usage.byModel.map(row => <tr key={row.model} className="border-t border-[#f0ece7]"><td className="break-all py-[6px] pr-[10px]">{row.model}</td><td className="py-[6px]">{number.format(row.runs)}</td><td className="py-[6px]">{short(row.tokens)}</td></tr>)}</tbody></table>}</Card>
    </>}
  </SettingsLayout>;
}
