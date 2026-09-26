"use client";
import {useEffect, useState} from 'react';

const KEY = 'open-lovable:theme';
/** Mounted once in the root layout: applies the saved theme on every page after hydration. */
export function ThemeBoot() {
  useEffect(() => {
    try { if (localStorage.getItem(KEY) === 'dark') document.documentElement.classList.add('dark'); } catch { /* storage unavailable */ }
  }, []);
  return null;
}

export default function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains('dark')); }, []);
  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem(KEY, next ? 'dark' : 'light'); } catch { /* storage unavailable */ }
    setDark(next);
  }
  return <button type="button" onClick={toggle} aria-pressed={dark} title={dark ? 'Usar tema claro' : 'Usar tema escuro'}
    className="inline-flex h-[34px] items-center gap-[6px] rounded-md border border-[#d2d2c8] bg-white px-[10px] text-[12px]">
    <span aria-hidden="true">{dark ? '☀' : '☾'}</span>{dark ? 'Tema claro' : 'Tema escuro'}
  </button>;
}
