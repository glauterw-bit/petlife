'use client'

import { useEffect, useState } from 'react'
import { Check, Crown, Sparkles, Star, RefreshCw, Loader2 } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useToast } from '@/components/ui/ToastContext'
import { billing, type BillingCatalog, type BillingMe, type PlanTier } from '@/lib/api'
import { initIap, purchaseProduct, restorePurchases, iapAvailable } from '@/lib/iap'
import { track } from '@/lib/track'

type Cadence = 'monthly' | 'annual'

const TIER_META: Record<PlanTier, { name: string; tagline: string; icon: typeof Star; accent: string }> = {
  free: { name: 'Grátis', tagline: 'Pra começar a cuidar', icon: Star, accent: 'text-gray-500' },
  plus: { name: 'PetLife+', tagline: 'Pra famílias com mais pets', icon: Sparkles, accent: 'text-emerald-600' },
  pro: { name: 'PetLife Pro', tagline: 'IA sem limites', icon: Crown, accent: 'text-amber-500' },
}

const FEATURES: Record<PlanTier, string[]> = {
  free: [
    '1 pet',
    '10 mensagens com a Vyron IA / mês',
    '3 análises de IA / mês',
    'Carteira de vacinas + lembretes ilimitados',
    'Clínicas próximas e passeios ilimitados',
  ],
  plus: [
    'Até 5 pets',
    '100 mensagens com a Vyron IA / mês',
    '30 análises de IA / mês',
    'Tudo do plano Grátis',
    '30 dias grátis no mensal',
  ],
  pro: [
    'Pets ilimitados',
    'Vyron IA ilimitada',
    'Análises de IA ilimitadas (raça, triagem, fezes, dor, forecast)',
    'Tudo do PetLife+',
    '30 dias grátis no mensal',
  ],
}

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function PlansPage() {
  const { success, error } = useToast()
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null)
  const [me, setMe] = useState<BillingMe | null>(null)
  const [cadence, setCadence] = useState<Cadence>('monthly')
  const [loading, setLoading] = useState(true)
  const [busySku, setBusySku] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  const canBuy = iapAvailable()

  async function refresh() {
    try {
      const [cat, mine] = await Promise.all([billing.products(), billing.me().catch(() => null)])
      setCatalog(cat)
      setMe(mine)
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao carregar planos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    track('plans_view')
    refresh()
    // Inicializa IAP: quando uma compra é aprovada, valida no backend.
    initIap(async (proof) => {
      try {
        await billing.verifyIap(proof)
        success('Assinatura ativada! 🎉')
        await refresh()
      } catch (err) {
        error(err instanceof Error ? err.message : 'Não foi possível confirmar a assinatura.')
      }
    }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentTier = me?.tier ?? 'free'

  async function handleSubscribe(tier: PlanTier) {
    const product = catalog?.products.find(p => p.tier === tier && p.cadence === cadence)
    if (!product) return
    if (!canBuy) {
      error('Abra o app do PetLife no iPhone para assinar.')
      return
    }
    setBusySku(product.sku)
    try {
      await purchaseProduct(product.apple_product_id)
      // confirmação chega pelo callback do initIap
    } catch (err) {
      error(err instanceof Error ? err.message : 'Não foi possível iniciar a compra.')
    } finally {
      setBusySku(null)
    }
  }

  async function handleRestore() {
    if (!canBuy) {
      error('Restaurar compras só está disponível no app iOS.')
      return
    }
    setRestoring(true)
    try {
      await restorePurchases()
      success('Compras restauradas. Atualizando…')
      setTimeout(refresh, 2000)
    } catch (err) {
      error(err instanceof Error ? err.message : 'Erro ao restaurar compras.')
    } finally {
      setRestoring(false)
    }
  }

  const usage = me?.usage
  const tiers: PlanTier[] = ['free', 'plus', 'pro']

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Planos PetLife</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Desbloqueie a Vyron IA e os recursos de saúde por IA sem limites.
          </p>
        </div>

        {/* Uso atual */}
        {usage && (
          <div className="mb-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
              Seu uso este mês — plano <span className="font-bold capitalize">{TIER_META[currentTier].name}</span>
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <UsageStat label="Pets" used={usage.used.pets} limit={usage.limits.pets} />
              <UsageStat label="Vyron IA" used={usage.used.ai_chat} limit={usage.limits.ai_chat} />
              <UsageStat label="Análises IA" used={usage.used.ai_analysis} limit={usage.limits.ai_analysis} />
            </div>
          </div>
        )}

        {/* Toggle mensal/anual */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-full bg-gray-100 dark:bg-gray-700 p-1">
            <button
              onClick={() => setCadence('monthly')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${cadence === 'monthly' ? 'bg-white dark:bg-gray-900 text-emerald-600 shadow' : 'text-gray-500'}`}
            >
              Mensal
            </button>
            <button
              onClick={() => setCadence('annual')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${cadence === 'annual' ? 'bg-white dark:bg-gray-900 text-emerald-600 shadow' : 'text-gray-500'}`}
            >
              Anual <span className="text-emerald-500">·2 meses grátis</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
          </div>
        ) : (
          <div className="grid md:grid-cols-3 gap-4">
            {tiers.map(tier => {
              const meta = TIER_META[tier]
              const Icon = meta.icon
              const product = catalog?.products.find(p => p.tier === tier && p.cadence === cadence)
              const isCurrent = currentTier === tier
              const isFree = tier === 'free'
              const highlight = tier === 'pro'
              return (
                <div
                  key={tier}
                  className={`relative rounded-2xl border p-5 flex flex-col bg-white dark:bg-gray-800 ${highlight ? 'border-amber-400 ring-2 ring-amber-200 dark:ring-amber-500/30' : 'border-gray-200 dark:border-gray-700'}`}
                >
                  {highlight && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-400 text-white text-xs font-bold px-3 py-0.5 rounded-full">
                      Mais completo
                    </span>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-5 h-5 ${meta.accent}`} />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{meta.name}</h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{meta.tagline}</p>

                  <div className="mb-4">
                    {isFree ? (
                      <p className="text-2xl font-extrabold text-gray-900 dark:text-white">R$ 0</p>
                    ) : product ? (
                      <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
                        {brl(product.price_brl)}
                        <span className="text-sm font-medium text-gray-400">/{cadence === 'monthly' ? 'mês' : 'ano'}</span>
                      </p>
                    ) : null}
                  </div>

                  <ul className="space-y-2 mb-5 flex-1">
                    {FEATURES[tier].map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <button disabled className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 font-semibold text-sm">
                      Seu plano atual
                    </button>
                  ) : isFree ? (
                    <button disabled className="w-full py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-400 font-semibold text-sm">
                      Plano básico
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(tier)}
                      disabled={busySku === product?.sku}
                      className={`w-full py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 ${highlight ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'} disabled:opacity-60`}
                    >
                      {busySku === product?.sku && <Loader2 className="w-4 h-4 animate-spin" />}
                      {product?.has_trial ? 'Começar 30 dias grátis' : 'Assinar'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Restaurar compras (obrigatório Apple) + nota */}
        <div className="mt-6 text-center">
          <button
            onClick={handleRestore}
            disabled={restoring}
            className="inline-flex items-center gap-2 text-sm text-emerald-600 hover:underline disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${restoring ? 'animate-spin' : ''}`} />
            Restaurar compras
          </button>
          {!canBuy && (
            <p className="text-xs text-gray-400 mt-3 max-w-md mx-auto">
              As assinaturas são processadas pela App Store. Abra o PetLife no seu iPhone para assinar.
            </p>
          )}
          <p className="text-[11px] text-gray-400 mt-3 max-w-lg mx-auto">
            A assinatura renova automaticamente. Você pode cancelar a qualquer momento em
            Ajustes &gt; Apple ID &gt; Assinaturas. O período não usado do trial é perdido ao assinar.
          </p>
        </div>
      </div>
    </DashboardLayout>
  )
}

function UsageStat({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = limit === -1
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100))
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-sm font-bold text-gray-900 dark:text-white">
        {used}
        <span className="text-gray-400 font-normal">/{unlimited ? '∞' : limit}</span>
      </p>
      {!unlimited && (
        <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 mt-1 overflow-hidden">
          <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-400' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}
