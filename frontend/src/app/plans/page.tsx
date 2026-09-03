'use client'

import { useEffect, useState } from 'react'
import { Check, Crown, Sparkles, Star, RefreshCw, Loader2 } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useToast } from '@/components/ui/ToastContext'
import { billing, type BillingCatalog, type BillingMe, type PlanTier } from '@/lib/api'
import { initIap, purchaseProduct, restorePurchases } from '@/lib/iap'
import { track } from '@/lib/track'
import { ReferralCard } from '@/components/growth/ReferralCard'
import { useT } from '@/contexts/LocaleContext'

type Cadence = 'monthly' | 'annual'

/** Metadados visuais + chaves de tradução do nome/tagline de cada tier. */
const TIER_META: Record<PlanTier, { nameKey: string; taglineKey: string; icon: typeof Star; accent: string }> = {
  free: { nameKey: 'ac.plans.tier.free', taglineKey: 'ac.plans.tag.free', icon: Star, accent: 'text-gray-500' },
  plus: { nameKey: 'ac.plans.tier.plus', taglineKey: 'ac.plans.tag.plus', icon: Sparkles, accent: 'text-emerald-600' },
  pro: { nameKey: 'ac.plans.tier.pro', taglineKey: 'ac.plans.tag.pro', icon: Crown, accent: 'text-amber-500' },
}

const FEATURES: Record<PlanTier, string[]> = {
  free: [
    'ac.plans.feat.free1',
    'ac.plans.feat.free2',
    'ac.plans.feat.free3',
    'ac.plans.feat.free4',
    'ac.plans.feat.free5',
  ],
  plus: [
    'ac.plans.feat.plus1',
    'ac.plans.feat.plus2',
    'ac.plans.feat.plus3',
    'ac.plans.feat.plus4',
    'ac.plans.feat.plus5',
  ],
  pro: [
    'ac.plans.feat.pro1',
    'ac.plans.feat.pro2',
    'ac.plans.feat.pro3',
    'ac.plans.feat.pro4',
    'ac.plans.feat.pro5',
  ],
}

function brl(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function PlansPage() {
  const { success, error } = useToast()
  const t = useT()
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null)
  const [me, setMe] = useState<BillingMe | null>(null)
  const [cadence, setCadence] = useState<Cadence>('monthly')
  const [loading, setLoading] = useState(true)
  const [busySku, setBusySku] = useState<string | null>(null)
  const [restoring, setRestoring] = useState(false)
  // Estado, não cálculo de render: `window.CdvPurchase` aparece de forma
  // assíncrona (deviceready). Como valor de render, `canBuy` era avaliado
  // antes do plugin subir e só voltava a ser verdadeiro por acaso, se algum
  // outro setState provocasse re-render na hora certa.
  const [canBuy, setCanBuy] = useState(false)

  async function refresh() {
    try {
      const [cat, mine] = await Promise.all([billing.products(), billing.me().catch(() => null)])
      setCatalog(cat)
      setMe(mine)
    } catch (err) {
      error(err instanceof Error ? err.message : t('ac.plans.errLoad'))
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
        success(t('ac.plans.activated'))
        await refresh()
      } catch (err) {
        error(err instanceof Error ? err.message : t('ac.plans.errConfirm'))
      }
    })
      .then((ok) => setCanBuy(ok))
      .catch(() => setCanBuy(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentTier = me?.tier ?? 'free'

  async function handleSubscribe(tier: PlanTier) {
    const product = catalog?.products.find(p => p.tier === tier && p.cadence === cadence)
    if (!product) return
    if (!canBuy) {
      error(t('ac.plans.errIosOnly'))
      return
    }
    setBusySku(product.sku)
    try {
      await purchaseProduct(product.apple_product_id)
      // confirmação chega pelo callback do initIap
    } catch (err) {
      error(err instanceof Error ? err.message : t('ac.plans.errPurchase'))
    } finally {
      setBusySku(null)
    }
  }

  async function handleRestore() {
    if (!canBuy) {
      error(t('ac.plans.errRestoreIos'))
      return
    }
    setRestoring(true)
    try {
      await restorePurchases()
      success(t('ac.plans.restored'))
      setTimeout(refresh, 2000)
    } catch (err) {
      error(err instanceof Error ? err.message : t('ac.plans.errRestore'))
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{t('ac.plans.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('ac.plans.subtitle')}
          </p>
        </div>

        {/* Uso atual */}
        {usage && (
          <div className="mb-6 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
            <p className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-3">
              {t('ac.plans.usagePre')}<span className="font-bold capitalize">{t(TIER_META[currentTier].nameKey)}</span>{t('ac.plans.usagePost')}
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <UsageStat label={t('nav.pets')} used={usage.used.pets} limit={usage.limits.pets} />
              <UsageStat label={t('ac.plans.usageAi')} used={usage.used.ai_chat} limit={usage.limits.ai_chat} />
              <UsageStat label={t('ac.plans.usageAnalysis')} used={usage.used.ai_analysis} limit={usage.limits.ai_analysis} />
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
              {t('ac.plans.monthly')}
            </button>
            <button
              onClick={() => setCadence('annual')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition ${cadence === 'annual' ? 'bg-white dark:bg-gray-900 text-emerald-600 shadow' : 'text-gray-500'}`}
            >
              {t('ac.plans.annual')} <span className="text-emerald-500">{t('ac.plans.annualBonus')}</span>
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
                      {t('ac.plans.mostComplete')}
                    </span>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <Icon className={`w-5 h-5 ${meta.accent}`} />
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white">{t(meta.nameKey)}</h3>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{t(meta.taglineKey)}</p>

                  <div className="mb-4">
                    {isFree ? (
                      <p className="text-2xl font-extrabold text-gray-900 dark:text-white">R$ 0</p>
                    ) : product ? (
                      <>
                        <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
                          {brl(product.price_brl)}
                          <span className="text-sm font-medium text-gray-400">/{cadence === 'monthly' ? t('ac.plans.perMonth') : t('ac.plans.perYear')}</span>
                        </p>
                        {/* O trial de 30 dias é o maior argumento de venda (o
                            mercado dá 3–7) e ficava invisível até o clique. */}
                        {product.has_trial && (
                          <span className="inline-block mt-1 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 text-xs font-bold px-2.5 py-0.5 rounded-full">
                            {t('ac.plans.trialBadge')}
                          </span>
                        )}
                      </>
                    ) : null}
                  </div>

                  <ul className="space-y-2 mb-5 flex-1">
                    {FEATURES[tier].map((f, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-300">
                        <Check className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{t(f)}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <button disabled className="w-full py-2.5 rounded-xl bg-gray-100 dark:bg-gray-700 text-gray-500 font-semibold text-sm">
                      {t('ac.plans.currentPlan')}
                    </button>
                  ) : isFree ? (
                    <button disabled className="w-full py-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 text-gray-400 font-semibold text-sm">
                      {t('ac.plans.basicPlan')}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleSubscribe(tier)}
                      disabled={busySku === product?.sku}
                      className={`w-full py-2.5 rounded-xl font-semibold text-sm text-white flex items-center justify-center gap-2 ${highlight ? 'bg-amber-500 hover:bg-amber-600' : 'bg-emerald-500 hover:bg-emerald-600'} disabled:opacity-60`}
                    >
                      {busySku === product?.sku && <Loader2 className="w-4 h-4 animate-spin" />}
                      {product?.has_trial ? t('ac.plans.startTrial') : t('ac.plans.subscribe')}
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
            {t('ac.plans.restore')}
          </button>
          {!canBuy && (
            <p className="text-xs text-gray-400 mt-3 max-w-md mx-auto">
              {t('ac.plans.iosOnly')}
            </p>
          )}
          <p className="text-[11px] text-gray-400 mt-3 max-w-lg mx-auto">
            {t('ac.plans.renewNote')}
          </p>
          <p className="text-[11px] mt-2">
            <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noopener" className="text-emerald-600 hover:underline">{t('ac.plans.eula')}</a>
            <span className="text-gray-300 mx-2">·</span>
            <a href="/privacy" className="text-emerald-600 hover:underline">{t('ac.plans.privacy')}</a>
          </p>
        </div>

        {/* Prefere não pagar? Indique e ganhe */}
        <div className="max-w-md mx-auto mt-8">
          <ReferralCard />
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
