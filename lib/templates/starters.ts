/**
 * Ready-to-edit starter projects for the home gallery ("Comece com um modelo").
 * Each one compiles in the isolated preview: React + Tailwind + lucide-react only.
 */
export interface StarterTemplate {id: string; name: string; description: string; files: Record<string, string>}

const landing = `import { Check, Sparkles, Zap, Shield } from 'lucide-react';

const features = [
  { icon: Zap, title: 'Rápido de verdade', text: 'Carrega em menos de um segundo em qualquer aparelho.' },
  { icon: Shield, title: 'Seguro por padrão', text: 'Seus dados protegidos com as melhores práticas.' },
  { icon: Sparkles, title: 'Fácil de usar', text: 'Comece em minutos, sem precisar de treinamento.' },
];
const plans = [
  { name: 'Grátis', price: 'R$ 0', items: ['1 projeto', 'Suporte por e-mail'] },
  { name: 'Pro', price: 'R$ 49', items: ['Projetos ilimitados', 'Suporte prioritário', 'Relatórios'], highlight: true },
  { name: 'Empresa', price: 'Sob consulta', items: ['Tudo do Pro', 'SLA dedicado', 'SSO'] },
];

export default function App() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <span className="text-xl font-bold">Nuvem<span className="text-indigo-600">.</span></span>
        <nav className="hidden gap-8 text-sm text-slate-600 md:flex"><a href="#recursos">Recursos</a><a href="#planos">Planos</a></nav>
        <button className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white">Começar</button>
      </header>
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <p className="mb-4 inline-block rounded-full bg-indigo-50 px-4 py-1 text-sm font-medium text-indigo-700">Novo: relatórios automáticos</p>
        <h1 className="text-5xl font-extrabold tracking-tight md:text-6xl">Organize sua empresa em um só lugar</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">Clientes, tarefas e finanças integrados, para você focar no que importa.</p>
        <div className="mt-10 flex justify-center gap-4"><button className="rounded-full bg-indigo-600 px-7 py-3 font-medium text-white shadow-lg shadow-indigo-200">Teste grátis por 14 dias</button><button className="rounded-full border border-slate-300 px-7 py-3 font-medium">Ver demonstração</button></div>
      </section>
      <section id="recursos" className="bg-slate-50 py-20">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 md:grid-cols-3">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl bg-white p-8 shadow-sm"><Icon className="h-8 w-8 text-indigo-600" /><h3 className="mt-4 text-lg font-semibold">{title}</h3><p className="mt-2 text-slate-600">{text}</p></div>
          ))}
        </div>
      </section>
      <section id="planos" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold">Planos simples</h2>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {plans.map(plan => (
            <div key={plan.name} className={'rounded-2xl border p-8 ' + (plan.highlight ? 'border-indigo-600 shadow-xl' : 'border-slate-200')}>
              <h3 className="font-semibold">{plan.name}</h3><p className="mt-4 text-4xl font-bold">{plan.price}<span className="text-base font-normal text-slate-500">{plan.price.startsWith('R$') ? '/mês' : ''}</span></p>
              <ul className="mt-6 space-y-3">{plan.items.map(item => <li key={item} className="flex items-center gap-2 text-slate-600"><Check className="h-4 w-4 text-indigo-600" />{item}</li>)}</ul>
              <button className={'mt-8 w-full rounded-full py-3 font-medium ' + (plan.highlight ? 'bg-indigo-600 text-white' : 'border border-slate-300')}>Escolher</button>
            </div>
          ))}
        </div>
      </section>
      <footer className="border-t py-8 text-center text-sm text-slate-500">© {new Date().getFullYear()} Nuvem. Todos os direitos reservados.</footer>
    </div>
  );
}
`;

const store = `import { useState } from 'react';
import { ShoppingBag, Plus, Minus, X } from 'lucide-react';

const products = [
  { id: 1, name: 'Camiseta Básica', price: 59.9, color: 'bg-rose-200' },
  { id: 2, name: 'Moletom Conforto', price: 159.9, color: 'bg-amber-200' },
  { id: 3, name: 'Calça Jeans', price: 189.9, color: 'bg-sky-200' },
  { id: 4, name: 'Tênis Casual', price: 249.9, color: 'bg-emerald-200' },
  { id: 5, name: 'Boné Clássico', price: 49.9, color: 'bg-violet-200' },
  { id: 6, name: 'Jaqueta Leve', price: 219.9, color: 'bg-orange-200' },
];
const money = value => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function App() {
  const [cart, setCart] = useState({});
  const [open, setOpen] = useState(false);
  const count = Object.values(cart).reduce((sum, qty) => sum + qty, 0);
  const total = products.reduce((sum, product) => sum + (cart[product.id] || 0) * product.price, 0);
  const change = (id, delta) => setCart(current => { const next = { ...current, [id]: Math.max(0, (current[id] || 0) + delta) }; if (!next[id]) delete next[id]; return next; });

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-white/90 px-6 py-4 backdrop-blur">
        <span className="text-xl font-bold tracking-tight">Loja da Ana</span>
        <button onClick={() => setOpen(true)} className="relative rounded-full p-2 hover:bg-stone-100" aria-label="Abrir carrinho"><ShoppingBag />{count > 0 && <span className="absolute -right-1 -top-1 rounded-full bg-stone-900 px-1.5 text-xs text-white">{count}</span>}</button>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-10">
        <h1 className="text-3xl font-bold">Coleção nova</h1>
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {products.map(product => (
            <div key={product.id} className="overflow-hidden rounded-2xl bg-white shadow-sm">
              <div className={'h-56 ' + product.color} />
              <div className="flex items-center justify-between p-5"><div><h3 className="font-medium">{product.name}</h3><p className="text-stone-500">{money(product.price)}</p></div>
                <button onClick={() => change(product.id, 1)} className="rounded-full bg-stone-900 px-4 py-2 text-sm text-white">Adicionar</button></div>
            </div>
          ))}
        </div>
      </main>
      {open && (
        <div className="fixed inset-0 z-20 flex justify-end bg-black/30" onClick={() => setOpen(false)}>
          <aside className="flex h-full w-full max-w-sm flex-col bg-white p-6" onClick={event => event.stopPropagation()}>
            <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Carrinho</h2><button onClick={() => setOpen(false)} aria-label="Fechar"><X /></button></div>
            <div className="mt-6 flex-1 space-y-4 overflow-y-auto">
              {count === 0 && <p className="text-stone-500">Seu carrinho está vazio.</p>}
              {products.filter(product => cart[product.id]).map(product => (
                <div key={product.id} className="flex items-center justify-between"><div><p className="font-medium">{product.name}</p><p className="text-sm text-stone-500">{money(product.price)}</p></div>
                  <div className="flex items-center gap-2"><button onClick={() => change(product.id, -1)} aria-label="Menos"><Minus className="h-4 w-4" /></button><span>{cart[product.id]}</span><button onClick={() => change(product.id, 1)} aria-label="Mais"><Plus className="h-4 w-4" /></button></div></div>
              ))}
            </div>
            <div className="border-t pt-4"><p className="flex justify-between font-semibold"><span>Total</span><span>{money(total)}</span></p><button disabled={!count} className="mt-4 w-full rounded-full bg-stone-900 py-3 text-white disabled:opacity-40">Finalizar compra</button></div>
          </aside>
        </div>
      )}
    </div>
  );
}
`;

const dashboard = `import { TrendingUp, TrendingDown, Users, DollarSign, ShoppingCart, LayoutDashboard, Settings, BarChart3 } from 'lucide-react';

const stats = [
  { label: 'Receita do mês', value: 'R$ 84.320', change: 12.5, icon: DollarSign },
  { label: 'Novos clientes', value: '1.284', change: 8.1, icon: Users },
  { label: 'Pedidos', value: '3.912', change: -2.4, icon: ShoppingCart },
];
const months = [['Jan', 40], ['Fev', 55], ['Mar', 48], ['Abr', 70], ['Mai', 64], ['Jun', 82], ['Jul', 90]];
const orders = [['#1042', 'Mariana Souza', 'R$ 320,00', 'Pago'], ['#1041', 'Carlos Lima', 'R$ 89,90', 'Pendente'], ['#1040', 'Fernanda Alves', 'R$ 1.250,00', 'Pago'], ['#1039', 'João Pedro', 'R$ 45,00', 'Cancelado']];
const tone = { Pago: 'bg-emerald-100 text-emerald-700', Pendente: 'bg-amber-100 text-amber-700', Cancelado: 'bg-rose-100 text-rose-700' };

export default function App() {
  return (
    <div className="flex min-h-screen bg-slate-100 text-slate-900">
      <aside className="hidden w-60 flex-col bg-slate-900 p-6 text-slate-300 md:flex">
        <span className="mb-10 text-lg font-bold text-white">Painel</span>
        {[[LayoutDashboard, 'Visão geral'], [BarChart3, 'Relatórios'], [Users, 'Clientes'], [Settings, 'Configurações']].map(([Icon, label], index) => (
          <a key={label} href="#" className={'mb-1 flex items-center gap-3 rounded-lg px-3 py-2 ' + (index === 0 ? 'bg-slate-800 text-white' : 'hover:bg-slate-800')}><Icon className="h-4 w-4" />{label}</a>
        ))}
      </aside>
      <main className="flex-1 p-6 md:p-10">
        <h1 className="text-2xl font-bold">Visão geral</h1>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {stats.map(({ label, value, change, icon: Icon }) => (
            <div key={label} className="rounded-2xl bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between text-slate-500"><span className="text-sm">{label}</span><Icon className="h-5 w-5" /></div>
              <p className="mt-3 text-3xl font-bold">{value}</p>
              <p className={'mt-2 flex items-center gap-1 text-sm ' + (change >= 0 ? 'text-emerald-600' : 'text-rose-600')}>{change >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{Math.abs(change)}% vs. mês anterior</p>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
          <h2 className="font-semibold">Vendas por mês</h2>
          <div className="mt-6 flex h-48 items-end gap-3">{months.map(([month, value]) => (<div key={month} className="flex flex-1 flex-col items-center gap-2"><div className="w-full rounded-t-lg bg-indigo-500" style={{ height: value * 2 }} /><span className="text-xs text-slate-500">{month}</span></div>))}</div>
        </div>
        <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
          <table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="p-4">Pedido</th><th className="p-4">Cliente</th><th className="p-4">Valor</th><th className="p-4">Status</th></tr></thead>
            <tbody>{orders.map(([id, name, value, status]) => (<tr key={id} className="border-t"><td className="p-4 font-medium">{id}</td><td className="p-4">{name}</td><td className="p-4">{value}</td><td className="p-4"><span className={'rounded-full px-3 py-1 text-xs font-medium ' + tone[status]}>{status}</span></td></tr>))}</tbody></table>
        </div>
      </main>
    </div>
  );
}
`;

const portfolio = `import { Mail, Github, Linkedin, ArrowUpRight } from 'lucide-react';

const projects = [
  { title: 'App de finanças', tag: 'Produto · 2026', color: 'from-emerald-400 to-teal-600' },
  { title: 'Identidade visual Café Norte', tag: 'Branding · 2025', color: 'from-amber-400 to-orange-600' },
  { title: 'Site da Clínica Viva', tag: 'Web · 2025', color: 'from-sky-400 to-indigo-600' },
  { title: 'Painel de logística', tag: 'Dashboard · 2024', color: 'from-fuchsia-400 to-purple-600' },
];

export default function App() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <main className="mx-auto max-w-5xl px-6 py-20">
        <p className="text-neutral-400">Olá, eu sou</p>
        <h1 className="mt-2 text-5xl font-bold md:text-7xl">Ana Martins</h1>
        <p className="mt-6 max-w-2xl text-xl text-neutral-400">Designer de produto e desenvolvedora. Crio experiências digitais simples, bonitas e que resolvem problemas reais.</p>
        <div className="mt-8 flex gap-4">
          {[[Mail, 'E-mail'], [Github, 'GitHub'], [Linkedin, 'LinkedIn']].map(([Icon, label]) => (<a key={label} href="#" className="flex items-center gap-2 rounded-full border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"><Icon className="h-4 w-4" />{label}</a>))}
        </div>
        <h2 className="mt-24 text-sm uppercase tracking-widest text-neutral-500">Trabalhos selecionados</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {projects.map(project => (
            <a key={project.title} href="#" className="group overflow-hidden rounded-3xl bg-neutral-900">
              <div className={'h-56 bg-gradient-to-br ' + project.color} />
              <div className="flex items-center justify-between p-6"><div><h3 className="text-lg font-semibold">{project.title}</h3><p className="text-sm text-neutral-500">{project.tag}</p></div><ArrowUpRight className="transition group-hover:translate-x-1 group-hover:-translate-y-1" /></div>
            </a>
          ))}
        </div>
      </main>
    </div>
  );
}
`;

const kanban = `import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';

const columns = [['todo', 'A fazer'], ['doing', 'Fazendo'], ['done', 'Feito']];
const initial = [
  { id: 1, title: 'Definir as metas do trimestre', column: 'todo' },
  { id: 2, title: 'Revisar o site novo', column: 'doing' },
  { id: 3, title: 'Enviar proposta ao cliente', column: 'done' },
];

export default function App() {
  const [tasks, setTasks] = useState(initial);
  const [title, setTitle] = useState('');
  const add = event => { event.preventDefault(); if (!title.trim()) return; setTasks(current => [...current, { id: Date.now(), title: title.trim(), column: 'todo' }]); setTitle(''); };
  const move = (id, column) => setTasks(current => current.map(task => task.id === id ? { ...task, column } : task));
  const remove = id => setTasks(current => current.filter(task => task.id !== id));

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-sky-50 p-6 text-slate-900 md:p-10">
      <h1 className="text-3xl font-bold">Quadro da equipe</h1>
      <form onSubmit={add} className="mt-6 flex max-w-xl gap-2"><input value={title} onChange={event => setTitle(event.target.value)} placeholder="Nova tarefa…" className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3" /><button className="flex items-center gap-1 rounded-xl bg-violet-600 px-5 text-white"><Plus className="h-4 w-4" />Adicionar</button></form>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {columns.map(([key, label]) => (
          <section key={key} className="rounded-2xl bg-white/70 p-4 shadow-sm">
            <h2 className="mb-4 flex items-center justify-between font-semibold">{label}<span className="rounded-full bg-slate-100 px-2 text-sm text-slate-500">{tasks.filter(task => task.column === key).length}</span></h2>
            <div className="space-y-3">
              {tasks.filter(task => task.column === key).map(task => (
                <div key={task.id} className="rounded-xl bg-white p-4 shadow-sm">
                  <p>{task.title}</p>
                  <div className="mt-3 flex items-center gap-2 text-xs">
                    {columns.filter(([other]) => other !== key).map(([other, otherLabel]) => (<button key={other} onClick={() => move(task.id, other)} className="rounded-full bg-slate-100 px-3 py-1 hover:bg-slate-200">→ {otherLabel}</button>))}
                    <button onClick={() => remove(task.id)} className="ml-auto text-slate-400 hover:text-rose-500" aria-label="Excluir"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
`;

const css = '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n';
const main = "import React from 'react';\nimport { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\nimport './index.css';\n\ncreateRoot(document.getElementById('root')).render(<App />);\n";
const project = (app: string) => ({'src/App.jsx': app, 'src/main.jsx': main, 'src/index.css': css});

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {id: 'landing-saas', name: 'Landing page SaaS', description: 'Página de produto com recursos, planos e chamada para ação.', files: project(landing)},
  {id: 'loja', name: 'Loja virtual', description: 'Vitrine de produtos com carrinho funcionando.', files: project(store)},
  {id: 'dashboard', name: 'Painel administrativo', description: 'Indicadores, gráfico de vendas e tabela de pedidos.', files: project(dashboard)},
  {id: 'portfolio', name: 'Portfólio', description: 'Apresentação pessoal com trabalhos em destaque.', files: project(portfolio)},
  {id: 'kanban', name: 'Quadro de tarefas', description: 'Kanban da equipe: criar, mover e excluir tarefas.', files: project(kanban)},
];

export function starterTemplate(id: string): StarterTemplate | undefined {
  return STARTER_TEMPLATES.find(template => template.id === id);
}
