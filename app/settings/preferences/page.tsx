"use client";
import {useEffect, useState} from 'react';
import SettingsLayout, {Card} from '@/components/settings/SettingsLayout';
import ThemeToggle from '@/components/ThemeToggle';
import {autoApplyEnabled, favoriteProjects, setAutoApply} from '@/lib/projects/preferences';

/** Preferences that only change how this browser drives the builder; server checks are unchanged. */
export default function PreferencesSettingsPage() {
  const [autoApply, setAutoApplyState] = useState(true);
  const [favorites, setFavorites] = useState(0);
  const [message, setMessage] = useState('');
  useEffect(() => { setAutoApplyState(autoApplyEnabled()); setFavorites(favoriteProjects().length); }, []);
  function toggleAutoApply(value: boolean) { setAutoApply(value); setAutoApplyState(value); setMessage('Preferência salva neste navegador.'); }
  function clearFavorites() {
    if (!window.confirm('Remover todos os projetos dos favoritos neste navegador?')) return;
    try { localStorage.removeItem('open-lovable:favorites'); } catch { /* storage unavailable */ }
    setFavorites(0); setMessage('Favoritos removidos.');
  }
  function clearConsents() {
    if (!window.confirm('Pedir de novo a autorização de uso de tokens em cada projeto?')) return;
    try { Object.keys(localStorage).filter(key => key.startsWith('open-lovable:consent:')).forEach(key => localStorage.removeItem(key)); } catch { /* storage unavailable */ }
    setMessage('As autorizações lembradas foram apagadas.');
  }
  return <SettingsLayout title="Preferências" description="Como o editor se comporta neste navegador.">
    {message && <p role="status" className="mb-[12px] rounded-md border border-green-200 bg-green-50 p-[12px] text-[13px] text-green-900">{message}</p>}
    <Card title="Editor">
      <label className="flex items-start justify-between gap-[16px] text-[14px]">
        <span><span className="font-medium">Aplicar mudanças automaticamente</span><span className="mt-[2px] block text-[13px] text-[#6a6772]">Como no Lovable: quando a IA termina e o código compila, a mudança entra no projeto na hora. Desligado, você revisa e aceita cada mudança.</span></span>
        <input type="checkbox" checked={autoApply} onChange={event => toggleAutoApply(event.target.checked)} className="mt-[4px] h-[18px] w-[18px]"/>
      </label>
    </Card>
    <Card title="Aparência"><div className="flex items-center justify-between text-[14px]"><span>Tema claro ou escuro</span><ThemeToggle/></div></Card>
    <Card title="Dados deste navegador">
      <div className="flex flex-wrap gap-[10px]">
        <button type="button" onClick={clearFavorites} disabled={!favorites} className="rounded-[10px] border border-[#e3ded8] px-[12px] py-[8px] text-[13px] disabled:opacity-40">Limpar favoritos ({favorites})</button>
        <button type="button" onClick={clearConsents} className="rounded-[10px] border border-[#e3ded8] px-[12px] py-[8px] text-[13px]">Esquecer autorizações de uso de tokens</button>
      </div>
    </Card>
  </SettingsLayout>;
}
