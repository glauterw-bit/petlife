'use client'

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { adminLive, type AdminLive, type AdminInsights, type AdminJourney } from '@/lib/api'

/**
 * Painel admin ao vivo: quem está online, feed de atividade, funil da primeira
 * abertura, telas, erros, retenção, versões, compartilhamentos e sinais de
 * frustração. Tocar em um nome abre a jornada completa do usuário.
 *
 * O feed atualiza a cada 15s; os indicadores, a cada 60s.
 */

const card = 'bg-white dark:bg-surface-800 border border-surface-100 dark:border-surface-700 rounded-2xl p-4 md:p-5'
const h3 = 'font-bold text-surface-900 dark:text-white'
const muted = 'text-xs text-surface-500 dark:text-surface-400'

const SCREEN: Record<string, string> = {
  '/dashboard': 'Início', '/health/vaccines': 'Vacinas', '/health/vaccines/carteirinha/:id': 'Carteirinha',
  '/health/exams': 'Exames', '/pets': 'Meus pets', '/pets/:id': 'Perfil do pet', '/pets/new': 'Novo pet',
  '/walks': 'Passeios', '/walks/active': 'Passeio em andamento', '/walks/:id': 'Detalhe do passeio',
  '/plans': 'Planos', '/settings': 'Perfil / configurações', '/suporte': 'Suporte', '/challenges': 'Desafios',
  '/start': 'Boas-vindas', '/auth/register': 'Cadastro', '/auth/login': 'Login', '/': 'Página inicial',
  '/convites': 'Convites', '/nearby': 'Clínicas próximas', '/routines': 'Rotinas', '/momentos': 'Momentos',
  '/wrapped/:id': 'Retrospectiva', '/behavior': 'Comportamento', '/memorial': 'Memorial',
}
const screenName = (p: string | null) => (p ? SCREEN[p] ?? p : '—')

const EVENT: Record<string, [string, string]> = {
  app_open: ['📱', 'abriu o app'], plans_view: ['👀', 'viu os planos'], paywall_shown: ['🚧', 'bateu no limite do plano'],
  carteirinha_share: ['📤', 'compartilhou a carteirinha'], carteirinha_whatsapp: ['📤', 'enviou a carteirinha no WhatsApp'],
  carteirinha_send_hotel: ['🏨', 'enviou a carteirinha ao hotel/creche'], carteirinha_send_groomer: ['✂️', 'enviou a carteirinha ao banho e tosa'],
  carteirinha_send_vet: ['🩺', 'enviou a carteirinha ao veterinário'], lost_marked: ['🚨', 'marcou o pet como perdido'],
  lost_found: ['🏠', 'avisou que o pet voltou'], lost_share: ['📣', 'compartilhou o alerta de pet perdido'],
  lost_qr_print: ['🖨️', 'imprimiu o QR da coleira'], quickstart_saved: ['💉', 'registrou vacinas no cadastro rápido'],
  store_invite_cta: ['⭐', 'foi avaliar na App Store'], rate_prompt_store: ['⭐', 'foi avaliar na loja'],
  apple_signin_ok: ['🍎', 'entrou com a Apple'], web_checkout_start: ['💳', 'abriu o pagamento pela web'],
  recap_share: ['🎁', 'compartilhou a retrospectiva'], quickstart_invite: ['👥', 'abriu o convite de co-tutor'],
  signup: ['👤', 'criou a conta'], pet: ['🐾', 'cadastrou o pet'], vaccine: ['💉', 'registrou a vacina'],
  install: ['📲', 'Nova instalação'], support: ['💬', 'escreveu no suporte'], billing: ['💰', 'movimentou a assinatura'],
  page_view: ['➡️', 'abriu a tela'], ui_error: ['⚠️', 'viu um erro'], api_error: ['⚠️', 'ação falhou'], client_error: ['🐞', 'erro na tela'],
  signup_email: ['👤', 'cadastrou-se por e-mail'], signup_apple: ['🍎', 'cadastrou-se com a Apple'], support_open: ['💬', 'abriu o suporte'],
  support_sent: ['💬', 'enviou mensagem ao suporte'], apple_signin_start: ['🍎', 'tocou em Continuar com a Apple'],
  rate_prompt_shown: ['⭐', 'viu o pedido de avaliação'], rate_prompt_later: ['⭐', 'dispensou o pedido de avaliação'],
  rate_prompt_native: ['⭐', 'recebeu as estrelas da Apple'], store_invite_shown: ['⭐', 'viu o convite de avaliação'],
  store_invite_later: ['⭐', 'dispensou o convite de avaliação'], soft_upsell_shown: ['💎', 'viu o convite de plano'],
  soft_upsell_cta: ['💎', 'tocou em ver planos'], quickstart_shown: ['💉', 'viu o cadastro rápido de vacinas'],
  quickstart_skipped: ['💉', 'pulou o cadastro rápido'], species_fix: ['🐾', 'corrigiu a espécie do pet'],
  start_shown: ['👋', 'viu as boas-vindas'], start_step: ['👋', 'avançou nas boas-vindas'], start_pet_done: ['🐾', 'informou o pet'],
  register_view: ['📝', 'abriu o cadastro'], login_view: ['🔑', 'abriu o login'], apple_signin_error: ['⚠️', 'login com a Apple falhou'],
  announce_suporte_shown: ['📣', 'viu o aviso do suporte'], announce_suporte_cta: ['📣', 'abriu o suporte pelo aviso'],
}
const SHARE: Record<string, string> = {
  carteirinha_share: 'Carteirinha compartilhada', carteirinha_whatsapp: 'Carteirinha no WhatsApp',
  carteirinha_send_hotel: 'Enviada ao hotel/creche', carteirinha_send_groomer: 'Enviada ao banho e tosa',
  carteirinha_send_vet: 'Enviada ao veterinário', lost_qr_print: 'QR da coleira impresso',
  lost_marked: 'Pet marcado como perdido', lost_share: 'Alerta de perdido compartilhado',
  recap_share: 'Retrospectiva compartilhada', quickstart_invite: 'Convite de co-tutor aberto',
}

const ts = (iso: string) => new Date(iso + (iso.endsWith('Z') ? '' : 'Z'))
function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - ts(iso).getTime()) / 1000)
  if (s < 60) return 'agora'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  return `há ${Math.floor(s / 86400)} d`
}
const dt = (iso: string) => ts(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const pct = (a: number, b: number) => (b > 0 ? `${Math.round((100 * a) / b)}%` : '—')
const first = (n?: string | null) => (n || 'Alguém').split(' ')[0]

function NameBtn({ id, name, onOpen }: { id?: number; name?: string | null; onOpen: (id: number) => void }) {
  if (!id) return <span className="font-semibold">{first(name)}</span>
  return (
    <button onClick={() => onOpen(id)} className="font-semibold text-primary-700 dark:text-primary-300 hover:underline">
      {first(name)}
    </button>
  )
}

export function LivePanels() {
  const [live, setLive] = useState<AdminLive | null>(null)
  const [ins, setIns] = useState<AdminInsights | null>(null)
  const [days, setDays] = useState(14)
  const [journeyId, setJourneyId] = useState<number | null>(null)

  useEffect(() => {
    const load = () => adminLive.live().then(setLive).catch(() => {})
    load()
    const id = setInterval(load, 15_000)
    const onVisible = () => { if (document.visibilityState === 'visible') load() }
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [])

  useEffect(() => {
    const load = () => adminLive.insights(days).then(setIns).catch(() => {})
    load()
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, [days])

  // qualquer lista do painel pode pedir a jornada de um usuário
  useEffect(() => {
    const open = (e: Event) => { const id = (e as CustomEvent).detail; if (typeof id === 'number') setJourneyId(id) }
    window.addEventListener('petlife:admin-journey', open)
    return () => window.removeEventListener('petlife:admin-journey', open)
  }, [])

  const f = ins?.funnel
  const funnelSteps = f ? [
    ['📲 Instalaram', f.installs], ['👋 Viram as boas-vindas', f.start_shown], ['🐾 Informaram o pet', f.start_pet_done],
    ['📝 Abriram o cadastro', f.register_view], ['👤 Criaram a conta', f.signups], ['🐶 Cadastraram um pet', f.with_pet],
    ['💉 Registraram vacina', f.with_vaccine], ['🔁 Voltaram outro dia', f.returned],
  ] as Array<[string, number]> : []
  const funnelMax = Math.max(1, ...funnelSteps.map(s => s[1]))
  const errors24 = ins?.errors.reduce((a, e) => a + e.last_24h, 0) ?? 0

  return (
    <div className="mb-6 space-y-4">
      {/* Online agora + feed */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className={card}>
          <div className="flex items-center gap-2 mb-2">
            <span className="relative flex h-2.5 w-2.5"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" /><span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" /></span>
            <h3 className={h3}>Online agora</h3>
          </div>
          <p className="text-4xl font-bold text-surface-900 dark:text-white tabular-nums">{live ? live.online.length + live.online_anonymous : '—'}</p>
          <p className={muted}>
            {live ? `${live.online.length} com login · ${live.online_anonymous} ainda sem conta · últimos 5 min` : 'carregando…'}
          </p>
          <div className="mt-3 space-y-1.5 max-h-56 overflow-y-auto">
            {live?.online.map(o => (
              <div key={o.user_id} className="flex items-center justify-between gap-2 text-sm">
                <NameBtn id={o.user_id} name={o.name} onOpen={setJourneyId} />
                <span className={`${muted} truncate`}>{screenName(o.path)} · {o.platform === 'ios' ? 'iPhone' : o.platform === 'android' ? 'Android' : 'web'}</span>
              </div>
            ))}
            {live && live.online.length === 0 && <p className={muted}>Ninguém com login aberto neste momento.</p>}
          </div>
        </div>

        <div className={`${card} md:col-span-2`}>
          <div className="flex items-center justify-between mb-2">
            <h3 className={h3}>⚡ Atividade ao vivo</h3>
            <span className={muted}>últimas 24h · atualiza a cada 15s</span>
          </div>
          <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
            {live?.feed.map((e, i) => {
              const [icon, verb] = EVENT[e.kind] ?? ['•', e.kind]
              return (
                <div key={i} className="flex items-baseline gap-2 text-sm text-surface-700 dark:text-surface-200">
                  <span className="w-5 shrink-0 text-center">{icon}</span>
                  <span className="flex-1 min-w-0">
                    {e.kind === 'install'
                      ? <><span className="font-semibold">Nova instalação</span> no {e.platform === 'ios' ? 'iPhone' : 'Android'}</>
                      : <><NameBtn id={e.user_id} name={e.name} onOpen={setJourneyId} /> {verb}{e.detail ? <span className="text-surface-500 dark:text-surface-400"> — {e.detail}</span> : null}</>}
                  </span>
                  <span className={`${muted} shrink-0 tabular-nums`}>{ago(e.at)}</span>
                </div>
              )
            })}
            {live && live.feed.length === 0 && <p className={muted}>Sem atividade nas últimas 24 horas.</p>}
          </div>
        </div>
      </div>

      {ins && f && (
        <>
          {/* Funil da primeira abertura */}
          <div className={card}>
            <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
              <h3 className={h3}>🚪 Funil da primeira abertura</h3>
              <div className="flex gap-1.5">
                {[7, 14, 30].map(d => (
                  <button key={d} onClick={() => setDays(d)}
                    className={`text-xs font-semibold px-2.5 py-1 rounded-full ${days === d ? 'bg-primary-500 text-white' : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300'}`}>
                    {d} dias
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              {funnelSteps.map(([label, n], i) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <span className="w-48 shrink-0 text-surface-700 dark:text-surface-200">{label}</span>
                  <div className="flex-1 h-5 bg-surface-100 dark:bg-surface-700 rounded-md overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-md" style={{ width: `${Math.max(2, (100 * n) / funnelMax)}%` }} />
                  </div>
                  <span className="w-10 text-right font-bold tabular-nums text-surface-900 dark:text-white">{n}</span>
                  <span className={`${muted} w-12 text-right tabular-nums`}>{i === 0 ? '' : pct(n, funnelSteps[i - 1][1])}</span>
                </div>
              ))}
            </div>
            <p className={`${muted} mt-3`}>
              Contas criadas com a Apple: <b>{f.signups_apple}</b> de {f.signups} ({pct(f.signups_apple, f.signups)}). A porcentagem compara cada passo com o anterior.
              Os três passos antes do cadastro só contam aparelhos com a versão nova do app.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Erros */}
            <div className={card}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={h3}>🐞 Erros</h3>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full tabular-nums ${errors24 > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                  {errors24} nas últimas 24h
                </span>
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {ins.errors.map((e, i) => (
                  <div key={i} className="text-sm border-b border-surface-100 dark:border-surface-700 pb-2 last:border-0">
                    <p className="text-surface-800 dark:text-surface-100 leading-snug">{e.meta}</p>
                    <p className={muted}>
                      {screenName(e.path)} · {e.event === 'ui_error' ? 'mensagem ao tutor' : e.event === 'api_error' ? 'resposta do servidor' : e.event === 'client_error' ? 'erro na tela' : 'login Apple'} ·{' '}
                      <b className="tabular-nums">{e.last_24h}</b> em 24h · <span className="tabular-nums">{e.last_7d}</span> em 7d · {e.people} pessoa{e.people === 1 ? '' : 's'} · {ago(e.last_at)}
                    </p>
                  </div>
                ))}
                {ins.errors.length === 0 && <p className={muted}>Nenhum erro registrado nos últimos 7 dias.</p>}
              </div>
            </div>

            {/* Telas */}
            <div className={card}>
              <div className="flex items-center justify-between mb-2">
                <h3 className={h3}>🗺️ Telas mais usadas</h3>
                <span className={muted}>7 dias</span>
              </div>
              <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
                {ins.screens.map(s => (
                  <div key={s.path} className="flex items-center gap-3 text-sm">
                    <span className="flex-1 min-w-0 truncate text-surface-700 dark:text-surface-200">{screenName(s.path)}</span>
                    <div className="w-24 h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500" style={{ width: `${(100 * s.views) / Math.max(1, ins.screens[0]?.views ?? 1)}%` }} />
                    </div>
                    <span className="w-10 text-right font-semibold tabular-nums text-surface-900 dark:text-white">{s.views}</span>
                    <span className={`${muted} w-16 text-right tabular-nums`}>{s.people} pessoas</span>
                  </div>
                ))}
                {ins.screens.length === 0 && <p className={muted}>Os dados começam a aparecer conforme as pessoas abrem o app.</p>}
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Retenção */}
            <div className={card}>
              <h3 className={`${h3} mb-1`}>🔁 Retenção por semana de cadastro</h3>
              <p className={`${muted} mb-3`}>De quem se cadastrou em cada semana, quantos voltaram depois de 1, 7 e 30 dias.</p>
              <table className="w-full text-sm">
                <thead><tr className={`${muted} text-left`}><th className="font-medium pb-1">Semana de</th><th className="font-medium text-right">Cadastros</th><th className="font-medium text-right">1 dia+</th><th className="font-medium text-right">7 dias+</th><th className="font-medium text-right">30 dias+</th></tr></thead>
                <tbody>
                  {ins.cohorts.map(c => {
                    const age = (Date.now() - new Date(c.wk + 'T00:00:00Z').getTime()) / 86400000
                    return (
                      <tr key={c.wk} className="border-t border-surface-100 dark:border-surface-700 tabular-nums text-surface-800 dark:text-surface-100">
                        <td className="py-1.5">{c.wk.slice(8, 10)}/{c.wk.slice(5, 7)}</td>
                        <td className="text-right font-semibold">{c.size}</td>
                        <td className="text-right">{pct(c.d1, c.size)}</td>
                        <td className="text-right">{age >= 7 ? pct(c.d7, c.size) : '…'}</td>
                        <td className="text-right">{age >= 30 ? pct(c.d30, c.size) : '…'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Versões + compartilhamentos */}
            <div className={card}>
              <h3 className={`${h3} mb-2`}>📦 Versão do app em uso</h3>
              <div className="flex flex-wrap gap-1.5 mb-4">
                {ins.versions.map(v => (
                  <span key={v.platform + v.version} className="text-xs bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 rounded-full px-2.5 py-1 tabular-nums">
                    {v.platform === 'ios' ? 'iPhone' : 'Android'} {v.version}: <b>{v.users}</b>
                  </span>
                ))}
                {ins.versions.length === 0 && <span className={muted}>Sem dados ainda.</span>}
              </div>
              <h3 className={`${h3} mb-2`}>📤 Compartilhamentos e QR</h3>
              <div className="space-y-1 text-sm">
                {ins.shares.map(s => (
                  <div key={s.event} className="flex justify-between gap-2 text-surface-700 dark:text-surface-200">
                    <span>{SHARE[s.event] ?? s.event}</span>
                    <span className="tabular-nums"><b>{s.d7}</b> em 7d · {s.d30} em 30d</span>
                  </div>
                ))}
                <div className="flex justify-between gap-2 text-surface-700 dark:text-surface-200">
                  <span>Avisos de “Encontrei este pet”</span><span className="tabular-nums"><b>{ins.found_reports}</b> no total</span>
                </div>
                {ins.shares.length === 0 && <p className={muted}>Nenhum compartilhamento nos últimos 30 dias.</p>}
              </div>
            </div>
          </div>

          {/* Sinais de frustração */}
          <div className={card}>
            <h3 className={`${h3} mb-1`}>😣 Sinais de frustração</h3>
            <p className={`${muted} mb-3`}>Últimos 7 dias. Toque no nome para ver a jornada da pessoa.</p>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-semibold text-surface-800 dark:text-surface-100 mb-1">Mesmo erro 3 vezes ou mais</p>
                {ins.frustration.repeated_errors.map((r, i) => (
                  <p key={i} className="text-surface-700 dark:text-surface-200"><NameBtn id={r.id} name={r.name} onOpen={setJourneyId} /> · {r.n}× <span className="text-surface-500 dark:text-surface-400">{r.meta}</span></p>
                ))}
                {ins.frustration.repeated_errors.length === 0 && <p className={muted}>Ninguém.</p>}
              </div>
              <div>
                <p className="font-semibold text-surface-800 dark:text-surface-100 mb-1">Bateram no limite do plano grátis</p>
                {ins.frustration.paywall.map(r => (
                  <p key={r.id} className="text-surface-700 dark:text-surface-200"><NameBtn id={r.id} name={r.name} onOpen={setJourneyId} /> · {r.n}× · {ago(r.last_at)}</p>
                ))}
                {ins.frustration.paywall.length === 0 && <p className={muted}>Ninguém.</p>}
              </div>
              <div>
                <p className="font-semibold text-surface-800 dark:text-surface-100 mb-1">Criaram a conta e não cadastraram pet</p>
                {ins.frustration.no_pet.map(r => (
                  <p key={r.id} className="text-surface-700 dark:text-surface-200"><NameBtn id={r.id} name={r.name} onOpen={setJourneyId} /> · {ago(r.created_at)}</p>
                ))}
                {ins.frustration.no_pet.length === 0 && <p className={muted}>Ninguém.</p>}
              </div>
            </div>
          </div>
        </>
      )}

      {journeyId !== null && <JourneyModal userId={journeyId} onClose={() => setJourneyId(null)} />}
    </div>
  )
}

function JourneyModal({ userId, onClose }: { userId: number; onClose: () => void }) {
  const [j, setJ] = useState<AdminJourney | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => { setJ(null); setErr(false); adminLive.journey(userId).then(setJ).catch(() => setErr(true)) }, [userId])

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl max-h-[90dvh] overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white dark:bg-surface-800 border-b border-surface-100 dark:border-surface-700 px-5 py-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-bold text-lg text-surface-900 dark:text-white truncate">{j ? j.user.name : 'Carregando…'}</h2>
            {j && <p className={`${muted} truncate`}>{j.user.email} · conta de {dt(j.user.created_at)}{j.user.apple ? ' · entrou com a Apple' : ''}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="p-2 rounded-xl hover:bg-surface-100 dark:hover:bg-surface-700"><X className="w-4 h-4 text-surface-500" /></button>
        </div>
        {err && <p className="p-5 text-sm text-red-600">Não consegui carregar a jornada.</p>}
        {j && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
              {([
                ['Aberturas', j.totals.opens], ['Dias ativos', j.totals.active_days],
                ['Erros vistos', j.totals.errors], ['Mensagens ao suporte', j.support_messages],
              ] as Array<[string, number]>).map(([l, v]) => (
                <div key={l} className="bg-surface-50 dark:bg-surface-700/50 rounded-xl p-3">
                  <p className="text-xl font-bold text-surface-900 dark:text-white tabular-nums">{v ?? 0}</p>
                  <p className={muted}>{l}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-1.5 text-xs">
              <span className="bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 rounded-full px-2.5 py-1 font-semibold">
                Plano {j.user.premium_tier}{j.user.active_product_sku ? ` · ${j.user.active_product_sku}` : ''}{j.user.premium_expires_at ? ` · até ${dt(j.user.premium_expires_at).slice(0, 5)}` : ''}
              </span>
              {j.totals.platform && <span className="bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 rounded-full px-2.5 py-1">{j.totals.platform === 'ios' ? 'iPhone' : 'Android'}{j.totals.app_version ? ` ${j.totals.app_version}` : ''}</span>}
              {j.user.geo_city && <span className="bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 rounded-full px-2.5 py-1">{j.user.geo_city}{j.user.geo_region ? `, ${j.user.geo_region}` : ''}</span>}
              {j.totals.paywalls > 0 && <span className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 rounded-full px-2.5 py-1">bateu no limite {j.totals.paywalls}×</span>}
              {j.feedback[0]?.rating != null && <span className="bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 rounded-full px-2.5 py-1">nota {j.feedback[0].rating}/5 na pesquisa</span>}
            </div>
            <div>
              <p className="font-semibold text-sm text-surface-800 dark:text-surface-100 mb-1">Pets</p>
              {j.pets.map(p => (
                <p key={p.id} className="text-sm text-surface-700 dark:text-surface-200">{p.species === 'dog' ? '🐶' : '🐱'} {p.name} · {p.vaccines} vacina{p.vaccines === 1 ? '' : 's'} · cadastrado em {dt(p.at)}</p>
              ))}
              {j.pets.length === 0 && <p className={muted}>Nenhum pet cadastrado.</p>}
            </div>
            <div>
              <p className="font-semibold text-sm text-surface-800 dark:text-surface-100 mb-1">Linha do tempo (mais recente primeiro)</p>
              <div className="space-y-1">
                {j.events.map((e, i) => {
                  const [icon, verb] = EVENT[e.event] ?? ['•', e.event]
                  const bad = e.event.endsWith('_error')
                  return (
                    <div key={i} className={`flex items-baseline gap-2 text-sm ${bad ? 'text-red-700 dark:text-red-300' : 'text-surface-700 dark:text-surface-200'}`}>
                      <span className={`${muted} w-24 shrink-0 tabular-nums`}>{dt(e.at)}</span>
                      <span className="w-5 shrink-0 text-center">{icon}</span>
                      <span className="flex-1 min-w-0">{verb}{e.event === 'page_view' ? ` ${screenName(e.path)}` : e.path && e.event !== 'app_open' ? ` · ${screenName(e.path)}` : ''}{e.meta ? ` — ${e.meta}` : ''}</span>
                    </div>
                  )
                })}
                {j.events.length === 0 && <p className={muted}>Sem eventos registrados.</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
