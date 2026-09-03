'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, PawPrint, Footprints, Sparkles, Syringe, Camera, Wallet,
  TrendingUp, Activity, Crown, RefreshCw, ShieldCheck,
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import dynamic from 'next/dynamic'
import { adminStats, feedback as feedbackApi, type AdminStats, type AdminUser, type AdminLocations, type AppleDownloads, type ResetRequest, type FeedbackList, type AiTopicsReport } from '@/lib/api'

const AdminUserMap = dynamic(() => import('@/components/admin/AdminUserMap'), {
  ssr: false,
  loading: () => <div className="h-[380px] rounded-2xl bg-surface-100 dark:bg-surface-700 animate-pulse" />,
})
import { useChartTheme } from '@/lib/charts'

/**
 * Painel do administrador — KPIs de uso do PetLife.
 * O guard REAL é no servidor (403 pra não-admin); aqui só redirecionamos.
 */
/** BR -> 🇧🇷 : bandeira a partir do código ISO, sem dependência. */
function flagEmoji(cc: string): string {
  if (!cc || cc.length !== 2) return '🌐'
  return String.fromCodePoint(...cc.toUpperCase().split('').map(c => 0x1f1a5 + c.charCodeAt(0)))
}

export default function AdminPage() {
  const router = useRouter()
  const { palette, ink } = useChartTheme()
  const [data, setData] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [locations, setLocations] = useState<AdminLocations | null>(null)
  const [appleDl, setAppleDl] = useState<AppleDownloads | null>(null)
  const [resetReqs, setResetReqs] = useState<ResetRequest[]>([])
  const [fb, setFb] = useState<FeedbackList | null>(null)
  const [topics, setTopics] = useState<AiTopicsReport | null>(null)
  const [codeFor, setCodeFor] = useState<{ id: number; code: string; wa: string | null; msg: string } | null>(null)
  const [search, setSearch] = useState('')
  const [denied, setDenied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      setRefreshing(true)
      const [st, us, loc, rr, fbs, tps, apdl] = await Promise.all([
        adminStats.get(),
        adminStats.users().catch(() => ({ total: 0, users: [] })),
        adminStats.locations().catch(() => null),
        adminStats.resetRequests().catch(() => ({ pending: 0, requests: [] })),
        feedbackApi.list().catch(() => null),
        adminStats.aiTopics().catch(() => null),
        adminStats.appleDownloads().catch(() => null),
      ])
      setData(st)
      setUsers(us.users)
      setLocations(loc)
      setResetReqs(rr.requests)
      setFb(fbs)
      setTopics(tps)
      setAppleDl(apdl)
    } catch {
      setDenied(true)
      setTimeout(() => router.replace('/dashboard'), 1500)
    } finally { setRefreshing(false) }
  }
  useEffect(() => {
    load()
    // Recarrega a cada 60s: o painel ficava aberto envelhecendo em silêncio,
    // e quem olha um painel espera número de agora.
    const id = setInterval(load, 60_000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (denied) return (
    <DashboardLayout>
      <div className="text-center py-20 text-surface-500 dark:text-surface-400">
        Acesso restrito ao administrador. Redirecionando…
      </div>
    </DashboardLayout>
  )
  if (!data) return <DashboardLayout><PageLoader text="Carregando painel..." /></DashboardLayout>

  const u = data.users
  const maxSignup = Math.max(...data.signups_by_month.map(s => s.count), 1)
  const maxAct = Math.max(...data.activity_14d.map(a => a.events), 1)

  const kpis = [
    { Icon: Users, label: 'Usuários totais', value: u.total, sub: `+${u.new_7d} em 7d · +${u.new_30d} em 30d`, tint: 'text-primary-600 bg-primary-50 dark:text-primary-300 dark:bg-primary-500/15' },
    { Icon: Activity, label: 'Ativos (DAU / WAU / MAU)', value: `${u.dau} / ${u.wau} / ${u.mau}`, sub: `${u.active_30d_signals} com atividade em 30d`, tint: 'text-blue-600 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/15' },
    { Icon: Crown, label: 'Assinantes pagos', value: data.revenue.paying_users, sub: `${data.revenue.iap_transactions} transações IAP`, tint: 'text-amber-600 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/15' },
    { Icon: PawPrint, label: 'Pets cadastrados', value: data.content.pets, sub: Object.entries(data.content.pets_by_species).map(([k, v]) => `${k === 'dog' ? '🐶' : '🐱'} ${v}`).join('  ') || '—', tint: 'text-emerald-600 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/15' },
    { Icon: Footprints, label: 'Passeios', value: data.walks.total, sub: `${data.walks.last_30d} em 30d · ${data.walks.km_total} km total`, tint: 'text-teal-600 bg-teal-50 dark:text-teal-300 dark:bg-teal-500/15' },
    { Icon: Sparkles, label: `IA no mês (${data.ai.month.slice(5)}/${data.ai.month.slice(2, 4)})`, value: data.ai.chat_month + data.ai.analysis_month, sub: `${data.ai.chat_month} chats · ${data.ai.analysis_month} análises`, tint: 'text-purple-600 bg-purple-50 dark:text-purple-300 dark:bg-purple-500/15' },
    { Icon: Syringe, label: 'Registros de saúde', value: data.content.vaccines + data.content.exams, sub: `${data.content.vaccines} vacinas · ${data.content.exams} exames · ${data.content.anamneses} anamneses`, tint: 'text-rose-600 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/15' },
    { Icon: Camera, label: 'Momentos & gastos', value: data.content.stories + data.content.expenses_entries, sub: `${data.content.stories} fotos · ${data.content.expenses_entries} gastos`, tint: 'text-pink-600 bg-pink-50 dark:text-pink-300 dark:bg-pink-500/15' },
  ]

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-surface-900 dark:text-white leading-tight flex items-center gap-2">
            <ShieldCheck className="w-7 h-7 text-primary-500" /> Painel do Admin
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Uso do PetLife em tempo real · atualizado {new Date(data.generated_at + 'Z').toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button onClick={load} disabled={refreshing}
          className="pressable flex items-center gap-1.5 text-sm font-semibold text-primary-600 px-3 py-2 rounded-xl border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/20">
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Pedidos de redefinição de senha — ação imediata */}
      {resetReqs.length > 0 && (
        <div className="mb-6 rounded-2xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 p-5">
          <h3 className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2 mb-1">
            🔑 Pedidos de redefinição de senha ({resetReqs.length})
          </h3>
          <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mb-3">
            Tutores que esqueceram a senha. Clique em “Gerar código” e mande pelo WhatsApp — leva 5 segundos.
          </p>
          <div className="space-y-2">
            {resetReqs.map(r => (
              <div key={r.id} className="flex items-center gap-3 flex-wrap bg-white dark:bg-surface-800 rounded-xl p-3 border border-amber-200 dark:border-amber-800">
                <div className="flex-1 min-w-[180px]">
                  <div className="font-semibold text-sm text-surface-900 dark:text-white">{r.name || r.email}</div>
                  <div className="text-xs text-surface-500 dark:text-surface-400">
                    {r.email}{r.phone ? ` · ${r.phone}` : ' · sem telefone'} · {new Date(r.created_at + 'Z').toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                {codeFor?.id === r.id ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-lg tracking-widest text-surface-900 dark:text-white bg-surface-100 dark:bg-surface-700 rounded-lg px-3 py-1.5">{codeFor.code}</span>
                    {codeFor.wa && (
                      <a href={codeFor.wa} target="_blank" rel="noopener"
                        className="pressable bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl">
                        💬 Abrir WhatsApp
                      </a>
                    )}
                    <button onClick={() => { navigator.clipboard.writeText(codeFor.msg).catch(() => {}) }}
                      className="pressable text-xs font-semibold text-surface-600 dark:text-surface-300 px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-600">
                      Copiar mensagem
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={async () => {
                      try {
                        const k = await adminStats.generateResetCode(r.id)
                        setCodeFor({ id: r.id, code: k.code, wa: k.whatsapp_url, msg: k.message })
                      } catch {}
                    }}
                    className="pressable bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-xl"
                  >
                    Gerar código
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* O que perguntam à Vyron IA — só temas, sem o texto das perguntas */}
      {topics && (
        <div className="bg-white dark:bg-surface-800 border border-surface-100 dark:border-surface-700 rounded-2xl p-4 md:p-5 mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
            <h3 className="font-bold text-surface-900 dark:text-white flex items-center gap-2">
              🤖 O que perguntam à Vyron IA
              <span className="text-xs font-medium text-surface-500 dark:text-surface-400 tabular-nums">
                ({topics.total} pergunta{topics.total === 1 ? '' : 's'} · {topics.days}d)
              </span>
            </h3>
            {Object.keys(topics.by_species).length > 0 && (
              <div className="flex gap-1.5">
                {Object.entries(topics.by_species).map(([sp, n]) => (
                  <span key={sp} className="text-[11px] bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 rounded-full px-2.5 py-1 tabular-nums font-medium">
                    {sp === 'dog' ? '🐶' : '🐱'} {n}
                  </span>
                ))}
              </div>
            )}
          </div>
          <p className="text-[11px] text-surface-400 mb-3">
            Só o tema é registrado — o texto das perguntas nunca é armazenado.
          </p>

          {topics.total === 0 ? (
            <p className="text-xs text-surface-500 dark:text-surface-400 py-3 text-center">
              Ainda sem dados. O mapeamento começou agora — os temas aparecem conforme os tutores usarem a Vyron.
            </p>
          ) : (
            <div className="space-y-2">
              {topics.topics.map(t => (
                <div key={t.topic} className="flex items-center gap-3">
                  <span className="text-xs text-surface-700 dark:text-surface-200 w-[168px] shrink-0 truncate">
                    {t.label}
                  </span>
                  <div className="flex-1 h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(t.pct, 1.5)}%`,
                        background: palette[0],
                      }}
                    />
                  </div>
                  <span className="text-xs font-bold text-surface-900 dark:text-white tabular-nums w-16 text-right">
                    {t.count} <span className="text-surface-400 font-normal">({t.pct}%)</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feedback dos usuários — respostas do popup de pesquisa */}
      {fb && fb.total > 0 && (
        <div className="bg-white dark:bg-surface-800 border border-surface-100 dark:border-surface-700 rounded-2xl p-4 md:p-5 mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <h3 className="font-bold text-surface-900 dark:text-white flex items-center gap-2">
              💬 Feedback dos usuários
              <span className="text-xs font-medium text-surface-500 dark:text-surface-400 tabular-nums">
                ({fb.total} resposta{fb.total > 1 ? 's' : ''})
              </span>
            </h3>
            {fb.avg_rating != null && (
              <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 tabular-nums">
                ⭐ Nota média {fb.avg_rating.toFixed(1)}/5
              </span>
            )}
          </div>

          {/* distribuição das notas */}
          <div className="flex items-center gap-1.5 mb-4 flex-wrap">
            {[5, 4, 3, 2, 1].map(n => {
              const count = fb.items.filter(i => i.rating === n).length
              const emoji = ['😞', '😕', '🙂', '😃', '🤩'][n - 1]
              return (
                <span
                  key={n}
                  className="text-xs bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 rounded-full px-2.5 py-1 tabular-nums font-medium"
                >
                  {emoji} {count}
                </span>
              )
            })}
          </div>

          <div className="space-y-2.5 max-h-[520px] overflow-y-auto">
            {fb.items.map(f => (
              <div
                key={f.id}
                className="rounded-xl border border-surface-100 dark:border-surface-700 p-3 bg-surface-50/60 dark:bg-surface-900/30"
              >
                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                  {f.rating && (
                    <span className="text-base leading-none">{['😞', '😕', '🙂', '😃', '🤩'][f.rating - 1]}</span>
                  )}
                  <span className="text-sm font-semibold text-surface-900 dark:text-white">
                    {f.user_name || 'Usuário'}
                  </span>
                  {f.user_email && (
                    <a
                      href={`mailto:${f.user_email}?subject=${encodeURIComponent('Sobre seu feedback no PetLife 🐾')}`}
                      className="text-[11px] text-primary-600 dark:text-primary-400 hover:underline"
                    >
                      {f.user_email}
                    </a>
                  )}
                  {f.created_at && (
                    <span className="text-[10px] text-surface-400 ml-auto tabular-nums">
                      {new Date(f.created_at + 'Z').toLocaleString('pt-BR', {
                        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                {f.likes_most && (
                  <p className="text-xs text-surface-700 dark:text-surface-200 leading-snug">
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Gosta:</span> {f.likes_most}
                  </p>
                )}
                {f.suggestion && (
                  <p className="text-xs text-surface-700 dark:text-surface-200 leading-snug mt-1">
                    <span className="text-amber-600 dark:text-amber-400 font-semibold">Sugere:</span> {f.suggestion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {fb && fb.total === 0 && (
        <div className="bg-white dark:bg-surface-800 border border-surface-100 dark:border-surface-700 rounded-2xl p-5 mb-6 text-center">
          <h3 className="font-bold text-surface-900 dark:text-white mb-1">💬 Feedback dos usuários</h3>
          <p className="text-xs text-surface-500 dark:text-surface-400">
            O popup de pesquisa está no ar. As respostas aparecem aqui assim que chegarem.
          </p>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6">
        {kpis.map(({ Icon, label, value, sub, tint }, i) => (
          <div key={label} className="reveal bg-white dark:bg-surface-800 rounded-2xl p-4 border border-surface-100 dark:border-surface-700" style={{ ['--i' as string]: i }}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${tint}`}><Icon className="w-5 h-5" /></div>
            <div className="text-xl md:text-2xl font-bold text-surface-900 dark:text-white mt-2 tabular-nums leading-tight">{value}</div>
            <div className="text-xs font-medium text-surface-600 dark:text-surface-300 leading-tight mt-0.5">{label}</div>
            <div className="text-[11px] text-surface-400 dark:text-surface-500 mt-1 leading-tight">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Cadastros por mês */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
          <h3 className="font-bold text-surface-900 dark:text-white flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-primary-500" /> Novos usuários por mês
          </h3>
          <div className="flex items-end gap-3 h-36">
            {data.signups_by_month.map(s => (
              <div key={s.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[11px] font-bold text-surface-700 dark:text-surface-200 tabular-nums">{s.count || ''}</span>
                <div className="w-full max-w-[44px] rounded-t-md" style={{ height: `${Math.max((s.count / maxSignup) * 100, s.count ? 6 : 2)}px`, background: palette[0], opacity: 0.9 }} />
                <span className="text-[10px]" style={{ color: ink.axis }}>{s.month.slice(5)}/{s.month.slice(2, 4)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Atividade 14 dias */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
          <h3 className="font-bold text-surface-900 dark:text-white flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-blue-500" /> Eventos de uso — últimos 14 dias
          </h3>
          <div className="flex items-end gap-1.5 h-36">
            {data.activity_14d.map(a => (
              <div key={a.day} className="flex-1 flex flex-col items-center gap-1" title={`${a.day}: ${a.events}`}>
                <div className="w-full rounded-t" style={{ height: `${Math.max((a.events / maxAct) * 110, a.events ? 5 : 2)}px`, background: palette[1], opacity: 0.85 }} />
                <span className="text-[8.5px] rotate-0" style={{ color: ink.axis }}>{a.day.slice(0, 2)}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-surface-400 mt-2">passeios + ações registradas (peso, fotos, check-ins…)</p>
        </div>
      </div>

      {/* Aberturas + Funil */}
      <div className="grid lg:grid-cols-2 gap-4 mt-4">
        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
          <h3 className="font-bold text-surface-900 dark:text-white mb-1">📱 Aberturas do app</h3>
          <p className="text-[11px] text-surface-400 mb-3">rastreadas a partir de ago/2026 (1x por sessão)</p>
          <div className="grid grid-cols-4 gap-2 mb-4 text-center">
            <div><div className="text-xl font-bold text-surface-900 dark:text-white tabular-nums">{data.opens.total}</div><div className="text-[10px] text-surface-400">total</div></div>
            <div><div className="text-xl font-bold text-surface-900 dark:text-white tabular-nums">{data.opens.unique_users}</div><div className="text-[10px] text-surface-400">usuários</div></div>
            <div><div className="text-xl font-bold text-surface-900 dark:text-white tabular-nums">{data.opens.reopeners}</div><div className="text-[10px] text-surface-400">reabriram (2+ dias)</div></div>
            <div><div className="text-xl font-bold text-surface-900 dark:text-white tabular-nums">{data.opens.avg_per_user}</div><div className="text-[10px] text-surface-400">média/usuário</div></div>
          </div>
          {/* legenda — duas séries, mesma escala (contagem) */}
          <div className="flex items-center gap-4 mb-2">
            <span className="flex items-center gap-1.5 text-[11px] text-surface-600 dark:text-surface-300">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: palette[0] }} />
              Pessoas (únicas)
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-surface-600 dark:text-surface-300">
              <span className="w-2.5 h-2.5 rounded-sm" style={{ background: palette[2] }} />
              Aberturas (total)
            </span>
          </div>
          <div className="flex items-end gap-1.5 h-28">
            {data.opens.by_day.map(o => {
              const max = Math.max(...data.opens.by_day.map(x => Math.max(x.opens, x.users ?? 0)), 1)
              const h = (v: number) => Math.max((v / max) * 88, v ? 4 : 2)
              const users = o.users ?? 0
              return (
                <div
                  key={o.day}
                  className="flex-1 flex flex-col items-center gap-1 min-w-0"
                  title={`${o.day} — ${users} pessoa(s), ${o.opens} abertura(s)`}
                >
                  <div className="w-full flex items-end justify-center gap-[2px] h-[88px]">
                    <div className="flex-1 rounded-t" style={{ height: h(users), background: palette[0] }} />
                    <div className="flex-1 rounded-t" style={{ height: h(o.opens), background: palette[2], opacity: 0.85 }} />
                  </div>
                  <span className="text-[8px] tabular-nums" style={{ color: ink.axis }}>{o.day.slice(0, 2)}</span>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-surface-400 mt-2">
            Últimos 14 dias · passe o mouse pra ver os números do dia
          </p>
        </div>

        <div className="bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
          <h3 className="font-bold text-surface-900 dark:text-white mb-3">🎯 Ativação & retenção</h3>
          <div className="space-y-2.5">
            {[
              { label: 'Cadastraram', v: data.activation.signed_up, pct: 100 },
              { label: 'Criaram um pet (ativação)', v: data.activation.created_pet, pct: data.activation.created_pet_pct },
              { label: 'Ativos nos últimos 7 dias', v: data.activation.still_active_7d, pct: data.activation.signed_up ? Math.round(100 * data.activation.still_active_7d / data.activation.signed_up) : 0 },
              { label: 'Ativos nos últimos 30 dias', v: data.activation.still_active_30d, pct: data.activation.signed_up ? Math.round(100 * data.activation.still_active_30d / data.activation.signed_up) : 0 },
            ].map(row => (
              <div key={row.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-surface-600 dark:text-surface-300">{row.label}</span>
                  <span className="font-bold text-surface-900 dark:text-white tabular-nums">{row.v} <span className="text-surface-400 font-normal">({row.pct}%)</span></span>
                </div>
                <div className="h-2 rounded-full bg-surface-100 dark:bg-surface-700 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${row.pct}%`, background: palette[0] }} />
                </div>
              </div>
            ))}
            <p className="text-[11px] text-surface-400 pt-1">
              Retenção 7d (voltou depois da 1ª semana): <b className="text-surface-600 dark:text-surface-300">{data.activation.retained_7d}/{data.activation.retained_7d_base} ({data.activation.retained_7d_pct}%)</b>
            </p>
          </div>
        </div>
      </div>

      {/* Funções mais usadas */}
      <div className="mt-4 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
        <h3 className="font-bold text-surface-900 dark:text-white mb-3">🏆 Funções mais usadas — últimos 30 dias</h3>
        {data.top_features.length === 0 ? (
          <p className="text-sm text-surface-400">Sem uso registrado ainda.</p>
        ) : (
          <div className="space-y-2">
            {data.top_features.map((f, i) => (
              <div key={f.name} className="flex items-center gap-3">
                <span className="text-xs text-surface-500 dark:text-surface-400 w-40 shrink-0 truncate">{f.name}</span>
                <div className="flex-1 h-4 rounded-full bg-surface-100 dark:bg-surface-700 overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${Math.max((f.count / data.top_features[0].count) * 100, 3)}%`, background: palette[i % 5], opacity: 0.9 }} />
                </div>
                <span className="text-xs font-bold text-surface-900 dark:text-white tabular-nums w-10 text-right">{f.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mapa de usuários */}
      {locations && locations.points.length > 0 && (
        <div className="mt-4 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 className="font-bold text-surface-900 dark:text-white">🗺️ De onde são os usuários</h3>
            <span className="text-xs text-surface-400">{locations.located} de {locations.total_users} localizados</span>
          </div>
          <AdminUserMap points={locations.points} />
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="text-[11px] text-surface-500 dark:text-surface-400 flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-primary-600 inline-block border-2 border-white shadow" /> GPS (passeio)
            </span>
            <span className="text-[11px] text-surface-500 dark:text-surface-400 flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-blue-600 inline-block border-2 border-white shadow" /> Estado (DDD)
            </span>
            <span className="flex-1" />
            {locations.by_state.slice(0, 8).map(s => (
              <span key={s.state} className="text-[11px] bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 rounded-full px-2.5 py-1 tabular-nums font-medium">
                {s.state}: <b>{s.count}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Downloads oficiais da Apple — download sem cadastro só existe aqui */}
      {appleDl?.available && (appleDl.total ?? 0) >= 0 && (
        <div className="mt-4 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 className="font-bold text-surface-900 dark:text-white">⬇️ Downloads na App Store</h3>
            <span className="text-xs text-surface-400">últimos 14 dias fechados · fonte: Apple · atraso de 24–48h</span>
          </div>
          <div className="flex items-end gap-1 h-24 mb-2">
            {appleDl.days?.map(d => {
              const max = Math.max(1, ...(appleDl.days ?? []).map(x => x.total))
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.reported ? d.total : 'sem relatório'}`}>
                  <span className="text-[10px] text-surface-500 dark:text-surface-400 tabular-nums">{d.reported ? d.total : '·'}</span>
                  <div className={`w-full rounded-t ${d.reported ? 'bg-primary-500' : 'bg-surface-200 dark:bg-surface-700'}`}
                       style={{ height: `${d.reported ? Math.max(6, (d.total / max) * 70) : 4}px` }} />
                  <span className="text-[9px] text-surface-400">{d.date.slice(8)}</span>
                </div>
              )
            })}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-surface-700 dark:text-surface-200 tabular-nums">Total: {appleDl.total}</span>
            {appleDl.by_country?.map(c => (
              <span key={c.country} className={`text-xs rounded-full px-2.5 py-1 tabular-nums font-medium ${c.country === 'BR' ? 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold'}`}>
                {flagEmoji(c.country)} {c.country}: <b>{c.count}</b>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Países e cidades (IP do login; cresce conforme a base volta a abrir) */}
      {locations && (locations.by_country?.length ?? 0) > 0 && (
        <div className="mt-4 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
          <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
            <h3 className="font-bold text-surface-900 dark:text-white">🌍 Países e cidades</h3>
            <span className="text-xs text-surface-400">{locations.geo_located} com origem identificada · via IP do login</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {locations.by_country!.map(c => (
              <span key={c.country} className={`text-xs rounded-full px-2.5 py-1 tabular-nums font-medium ${c.country === 'BR' ? 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300' : 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-bold'}`}>
                {flagEmoji(c.country)} {c.country}: <b>{c.count}</b>
              </span>
            ))}
          </div>
          {(locations.by_city?.length ?? 0) > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {locations.by_city!.map(c => (
                <span key={`${c.city}-${c.country}`} className="text-[11px] bg-surface-50 dark:bg-surface-700/60 text-surface-500 dark:text-surface-400 rounded-full px-2 py-0.5 tabular-nums">
                  {c.city}{c.country !== 'BR' ? ` ${flagEmoji(c.country)}` : ''}: {c.count}
                </span>
              ))}
            </div>
          )}
          {(locations.foreign_users?.length ?? 0) > 0 && (
            <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1.5">Usuários fora do Brasil</p>
              <div className="space-y-1">
                {locations.foreign_users!.map(u => (
                  <p key={u.id} className="text-xs text-surface-600 dark:text-surface-300">
                    {flagEmoji(u.country)} <b>{u.name}</b> — {[u.city, u.region].filter(Boolean).join(', ') || u.country}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Usuários */}
      <div className="mt-4 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
        <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
          <h3 className="font-bold text-surface-900 dark:text-white">👥 Usuários ({users.length})</h3>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="buscar nome, e-mail ou telefone…"
            className="text-sm px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 dark:bg-surface-900 focus:outline-none focus:ring-2 focus:ring-primary-500 w-64"
          />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-[720px]">
            <thead>
              <tr className="text-left text-surface-400 border-b border-surface-100 dark:border-surface-700">
                <th className="py-2 pr-3 font-semibold">Nome</th>
                <th className="py-2 pr-3 font-semibold">E-mail</th>
                <th className="py-2 pr-3 font-semibold">Telefone</th>
                <th className="py-2 pr-3 font-semibold">Plano</th>
                <th className="py-2 pr-3 font-semibold text-right">Pets</th>
                <th className="py-2 pr-3 font-semibold text-right">Aberturas</th>
                <th className="py-2 pr-3 font-semibold text-right">Passeios</th>
                <th className="py-2 pr-3 font-semibold">Último acesso</th>
                <th className="py-2 font-semibold">Desde</th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter(u => !search || `${u.name} ${u.email} ${u.phone ?? ''}`.toLowerCase().includes(search.toLowerCase()))
                .map(u => (
                  <tr key={u.id} className="border-b border-surface-50 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/30">
                    <td className="py-2 pr-3 font-medium text-surface-900 dark:text-white whitespace-nowrap">{u.name}{u.is_vet ? ' 🩺' : ''}</td>
                    <td className="py-2 pr-3 text-surface-600 dark:text-surface-300">{u.email}</td>
                    <td className="py-2 pr-3 text-surface-600 dark:text-surface-300 whitespace-nowrap">{u.phone || '—'}</td>
                    <td className="py-2 pr-3">{u.tier === 'free' ? '🆓' : u.tier === 'plus' ? '✨' : '👑'}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{u.pets}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{u.opens}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{u.walks}</td>
                    <td className="py-2 pr-3 whitespace-nowrap text-surface-600 dark:text-surface-300">{u.last_seen_at ? new Date(u.last_seen_at + 'Z').toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'nunca'}</td>
                    <td className="py-2 whitespace-nowrap text-surface-500 dark:text-surface-400">{u.created_at ? new Date(u.created_at + 'Z').toLocaleDateString('pt-BR') : '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tiers + extras */}
      <div className="mt-4 bg-white dark:bg-surface-800 rounded-2xl border border-surface-100 dark:border-surface-700 p-5">
        <h3 className="font-bold text-surface-900 dark:text-white mb-3 flex items-center gap-2">
          <Crown className="w-4 h-4 text-amber-500" /> Planos & extras
        </h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(u.by_tier).map(([tier, c]) => (
            <span key={tier} className="text-xs bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 rounded-full px-3 py-1.5 font-medium tabular-nums">
              {tier === 'free' ? '🆓 Grátis' : tier === 'plus' ? '✨ PetLife+' : '👑 Pro'}: <b>{c}</b>
            </span>
          ))}
          <span className="text-xs bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 rounded-full px-3 py-1.5 font-medium tabular-nums">🩺 Vets: <b>{u.vets}</b></span>
          <span className="text-xs bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 rounded-full px-3 py-1.5 font-medium tabular-nums">⏰ Lembretes: <b>{data.content.reminders}</b></span>
          <span className="text-xs bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-200 rounded-full px-3 py-1.5 font-medium tabular-nums"><Wallet className="w-3 h-3 inline" /> Gastos registrados: <b>{data.content.expenses_entries}</b></span>
        </div>
        <p className="text-[11px] text-surface-400 mt-3">
          DAU/WAU/MAU baseados em atividade autenticada (rastreio iniciado em ago/2026 — números crescem conforme os usuários voltam).
        </p>
      </div>
    </DashboardLayout>
  )
}
