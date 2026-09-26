"use client";
import { useEffect } from 'react';
import { useModelCatalog } from '@/hooks/useModelCatalog';

interface Props {value:string; onValueChange:(value:string)=>void; className?:string; disabled?:boolean; label?:string;projectId?:string;}
export default function AIModelSelect({value,onValueChange,className,disabled,projectId,label='AI model'}:Props) {
  const {catalog,models,loading,error}=useModelCatalog(projectId);
  // A retired or unconfigured default must not stay selected once the live catalog is known.
  useEffect(()=>{
    if(loading||!catalog||models.some(model=>model.id===value&&model.configured))return;
    const usable=models.find(model=>model.configured);
    if(usable)onValueChange(usable.id);
  },[loading,catalog,models,value,onValueChange]);
  return <select aria-label={label} aria-busy={loading} value={value} onChange={event=>onValueChange(event.target.value)}
    disabled={disabled || loading} title={error || 'Credencial configurada não garante um teste bem-sucedido do modelo'}
    className={className ?? 'min-w-0 w-full rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-900'}>
    {!models.some(model=>model.id===value) && <option value={value} disabled>{value} - indisponível</option>}
    {models.map(model=><option key={model.id} value={model.id}>{model.label}{!loading && !model.configured ? ' - configurar' : ''}</option>)}
  </select>;
}
