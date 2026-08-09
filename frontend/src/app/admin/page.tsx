'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Users, PawPrint, Footprints, Sparkles, Syringe, Camera, Wallet,
  TrendingUp, Activity, Crown, RefreshCw, ShieldCheck,
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { PageLoader } from '@/components/ui/LoadingSpinner'
import { adminStats, type AdminStats } from '@/lib/api'
import { useChartTheme } from '@/lib/charts'

/**
 * Painel do administrador — KPIs de uso do PetLife.
 * O guard REAL é no servidor (403 pra não-admin); aqui só redirecionamos.
 */
export default function AdminPage() {
  const router = useRouter()
  const { palette, ink } = useChartTheme()
  const [data, setData] = useState<AdminStats | null>(null)
  const [denied, setDenied] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  async function load() {
    try {
      setRefreshing(true)
      setData(await adminStats.get())
    } catch {
      setDenied(true)
      setTimeout(() => router.replace('/dashboard'), 1500)
    } finally { setRefreshing(false) }
  }
  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
