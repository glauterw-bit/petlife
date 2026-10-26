'use client'

import { useEffect, useState, useRef } from 'react'
import { Check, Crown, Sparkles, Star, RefreshCw, Info, Gift, Minus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Skeleton } from '@/components/ui/Skeleton'
import { Stagger, StaggerItem } from '@/components/ui/Motion'
import { fieldClasses } from '@/components/auth/AuthUI'
import { hapticSuccess, hapticError } from '@/lib/feedback'
import { spring } from '@/lib/motion'
import { cn, localeTag } from '@/lib/utils'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { useToast } from '@/components/ui/ToastContext'
import { billing, type BillingCatalog, type BillingMe, type PlanTier } from '@/lib/api'
import { APPLE_PRODUCT_IDS, initIap, purchaseProduct, restorePurchases } from '@/lib/iap'
import { track } from '@/lib/track'
import { ReferralCard } from '@/components/growth/ReferralCard'
import { useLocale, useT } from '@/contexts/LocaleContext'

type Cadence = 'monthly' | 'annual'

/** Metadados visuais + chaves de tradução do nome/tagline de cada tier. */
const TIER_META: Record<PlanTier, { nameKey: string; taglineKey: string; icon: typeof Star; accent: string }> = {
  free: { nameKey: 'ac.plans.tier.free', taglineKey: 'ac.plans.tag.free', icon: Star, accent: 'text-surface-500 dark:text-surface-400' },
  plus: { nameKey: 'ac.plans.tier.plus', taglineKey: 'ac.plans.tag.plus', icon: Sparkles, accent: 'text-primary-700 dark:text-primary-300' },
  pro: { nameKey: 'ac.plans.tier.pro', taglineKey: 'ac.plans.tag.pro', icon: Crown, accent: 'text-amber-600 dark:text-amber-400' },
}

/**
 * Limites reais de cada plano — espelham QUOTAS em backend/pricing.py
 * (-1 = sem limite). Usados só na tabela de comparação.
 */
const LIMITS: Record<PlanTier, { pets: number; ai_chat: number; ai_analysis: number }> = {
  free: { pets: 3, ai_chat: 10, ai_analysis: 3 },
  plus: { pets: 5, ai_chat: 100, ai_analysis: 30 },
  pro: { pets: -1, ai_chat: -1, ai_analysis: -1 },
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
  ],
  pro: [
    'ac.plans.feat.pro1',
    'ac.plans.feat.pro2',
    'ac.plans.feat.pro3',
    'ac.plans.feat.pro4',
  ],
}

/** Preço do catálogo do servidor (sempre em reais), formatado no idioma do app. */
function brl(v: number) {
  try {
    const tag = localeTag()
    // Fora do pt-BR mostra o código (BRL), nunca "R$": em en-US o Intl escreveria "R$149.00".
    return v.toLocaleString(tag, { style: 'currency', currency: 'BRL', currencyDisplay: tag === 'pt-BR' ? 'symbol' : 'code', maximumFractionDigits: v === 0 ? 0 : 2 })
  } catch {
    return `R$ ${v.toFixed(2)}`
  }
}

/**
 * Preço da App Store para o produto, na moeda e no formato da conta Apple do
 * tutor (um iPhone no México vê pesos, não reais). É o preço que a Apple vai
 * cobrar, então no app nativo ele tem prioridade sobre o valor fixo do catálogo.
 */
type StorePrice = { label: string; micros: number; currency: string }

function readStorePrices(): Record<string, StorePrice> {
  const out: Record<string, StorePrice> = {}
  try {
    const w = window as typeof window & { CdvPurchase?: any }
    const cp = w.CdvPurchase
    if (!cp?.store) return out
    for (const id of APPLE_PRODUCT_IDS) {
      const pr = cp.store.get(id, cp.Platform?.APPLE_APPSTORE)?.pricing
      if (pr && typeof pr.price === 'string' && pr.price) {
        out[id] = { label: pr.price, micros: Number(pr.priceMicros) || 0, currency: String(pr.currency || '') }
      }
    }
  } catch {}
  return out
}

function fmtMoney(amount: number, currency: string, maxDigits?: number): string | null {
  try {
    return amount.toLocaleString(localeTag(), { style: 'currency', currency, ...(maxDigits != null ? { minimumFractionDigits: maxDigits, maximumFractionDigits: maxDigits } : {}) })
  } catch {
    return null
  }
}

export default function PlansPage() {
  const { success, error } = useToast()
  const t = useT()
  const { locale } = useLocale()
  const [storePrices, setStorePrices] = useState<Record<string, StorePrice>>({})
  const [catalog, setCatalog] = useState<BillingCatalog | null>(null)
  const [me, setMe] = useState<BillingMe | null>(null)
  const [cadence, setCadence] = useState<Cadence>('annual')
  const [loading, setLoading] = useState(true)
  const [busySku, setBusySku] = useState<string | null>(null)
  const userActionRef = useRef(false)
  const [restoring, setRestoring] = useState(false)
  // Estado, não cálculo de render: `window.CdvPurchase` aparece de forma
  // assíncrona (deviceready). Como valor de render, `canBuy` era avaliado
  // antes do plugin subir e só voltava a ser verdadeiro por acaso, se algum
  // outro setState provocasse re-render na hora certa.
  const [canBuy, setCanBuy] = useState(false)
  const [plat, setPlat] = useState<'ios' | 'android' | 'web'>('web')
  const [webSku, setWebSku] = useState<string | null>(null)
  const [cpf, setCpf] = useState('')
  const [webBusy, setWebBusy] = useState(false)

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
    try {
      const p = (window as typeof window & { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.()
      setPlat(p === 'ios' || p === 'android' ? p : 'web')
    } catch {}
    refresh()
    // Inicializa IAP: quando uma compra é aprovada, valida no backend.
    initIap(async (proof) => {
      try {
        await billing.verifyIap(proof)
        void hapticSuccess()
        success(t('ac.plans.activated'))
        await refresh()
      } catch (err) {
        // A loja também reenvia compras antigas sozinha ao abrir a tela: erro
        // só aparece pro tutor se ele acabou de tocar em assinar ou restaurar.
        if (userActionRef.current) error(err instanceof Error ? err.message : t('ac.plans.errConfirm'))
      }
    })
      .then((ok) => {
        setCanBuy(ok)
        if (!ok) return
        // Os produtos da loja chegam logo depois do initialize; relê algumas vezes.
        const load = () => setStorePrices(prev => {
          const next = readStorePrices()
          return Object.keys(next).length ? next : prev
        })
        load()
        setTimeout(load, 1500)
        setTimeout(load, 4000)
      })
      .catch(() => setCanBuy(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const currentTier = me?.tier ?? 'free'

  async function handleSubscribe(tier: PlanTier) {
    const product = catalog?.products.find(p => p.tier === tier && p.cadence === cadence)
    if (!product) return
    if (!canBuy) {
      // Checkout web só no navegador: dentro dos apps a Apple e o Google exigem a loja deles.
      if (plat === 'web' && catalog?.web_checkout) { setWebSku(product.sku); return }
      error(plat === 'android' ? t('ac.plans.androidSoon') : t('ac.plans.errIosOnly'))
      return
    }
    setBusySku(product.sku)
    userActionRef.current = true
    try {
      await purchaseProduct(product.apple_product_id)
      // confirmação chega pelo callback do initIap
    } catch (err) {
      error(err instanceof Error ? err.message : t('ac.plans.errPurchase'))
    } finally {
      setBusySku(null)
    }
  }

  async function startWebCheckout() {
    if (!webSku || webBusy) return
    const digits = cpf.replace(/\D/g, '')
    if (digits.length !== 11) { void hapticError(); error(t('ac.plans.cpfInvalid')); return }
    setWebBusy(true)
    try {
      track('web_checkout_start')
      const { invoice_url } = await billing.webCheckout(webSku, digits)
      window.location.href = invoice_url
    } catch {
      error(t('ac.plans.webError'))
      setWebBusy(false)
    }
  }

  async function handleRestore() {
    if (!canBuy) {
      error(t('ac.plans.errRestoreIos'))
      return
    }
    setRestoring(true)
    userActionRef.current = true
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
  const monthlyTrial = !!catalog?.products.some(p => p.cadence === 'monthly' && p.has_trial)
  // O teste grátis é uma oferta da App Store: no checkout web não existe.
  const showTrial = cadence === 'monthly' && monthlyTrial && (canBuy || plat === 'ios')
  const webProduct = catalog?.products.find(p => p.sku === webSku)
  // Na web o checkout é em reais (Asaas). Para quem usa o app em inglês ou
  // espanhol, avisar a moeda evita a surpresa no pagamento.
  const showBrlNote = plat === 'web' && locale !== 'pt-BR'
  const storeCurrency = Object.values(storePrices)[0]?.currency || ''

  /** Preço exibido: o da App Store quando disponível, senão o do catálogo. */
  function priceOf(product: { apple_product_id: string; price_brl: number }) {
    const sp = storePrices[product.apple_product_id]
    if (sp) {
      const monthly = sp.micros > 0 && sp.currency ? fmtMoney(sp.micros / 1e6 / 12, sp.currency) : null
      return { full: sp.label, perMonthOfYear: monthly }
    }
    return { full: brl(product.price_brl), perMonthOfYear: brl(product.price_brl / 12) }
  }
  const zeroPrice = (storeCurrency && fmtMoney(0, storeCurrency, 0)) || brl(0)

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto">
        <PageHeader title={t('ac.plans.title')} subtitle={t('ac.plans.subtitle')} />

        <div className="flex items-start gap-2.5 rounded-xl border tone-brand-bg p-3 mb-5 text-[13px] leading-snug text-primary-900 dark:text-primary-100">
          <Info className="w-4 h-4 mt-0.5 shrink-0 text-primary-700 dark:text-primary-300" aria-hidden />
          <p>{t('ac.plans.notInsurance')}</p>
        </div>

        {/* Status de quem já assina: sem isso, quem acabou de comprar não sabe se deu certo */}
        {me?.is_premium && me.premium_expires_at && (
          <Card tone="success" className="mb-5">
            <p className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
              {t('ac.plans.statusActive', {
                plan: t(TIER_META[currentTier].nameKey),
                date: new Date(me.premium_expires_at + (me.premium_expires_at.endsWith('Z') ? '' : 'Z')).toLocaleDateString(localeTag(), { day: '2-digit', month: '2-digit', year: 'numeric' }),
              })}
            </p>
            <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1 leading-relaxed">
              {t('ac.plans.statusTrialHint')}
            </p>
          </Card>
        )}

        {showBrlNote && (
          <p className="text-[13px] text-surface-600 dark:text-surface-300 mb-4 text-center">{t('ac2.plans.brlNote')}</p>
        )}

        {/* Uso atual */}
        {usage && (
          <Card className="mb-5">
            <p className="text-sm font-medium text-surface-700 dark:text-surface-200 mb-3">
              {t('ac.plans.usagePre')}<span className="font-bold">{t(TIER_META[currentTier].nameKey)}</span>{t('ac.plans.usagePost')}
            </p>
            <div className="grid grid-cols-3 gap-3 text-center">
              <UsageStat label={t('nav.pets')} used={usage.used.pets} limit={usage.limits.pets} />
              <UsageStat label={t('ac.plans.usageAi')} used={usage.used.ai_chat} limit={usage.limits.ai_chat} />
              <UsageStat label={t('ac.plans.usageAnalysis')} used={usage.used.ai_analysis} limit={usage.limits.ai_analysis} />
            </div>
          </Card>
        )}

        {/* Mensal / Anual + oferta de cada cadência, junto do seletor */}
        <div className="max-w-sm mx-auto mb-6">
          <SegmentedControl
            ariaLabel={t('acct.plans.cadenceAria')}
            value={cadence}
            onChange={setCadence}
            options={[
              { value: 'monthly', label: t('ac.plans.monthly') },
              { value: 'annual', label: t('ac.plans.annual') },
            ]}
          />
          <div className="h-8 mt-2 flex justify-center items-center" aria-live="polite">
            <AnimatePresence mode="wait" initial={false}>
              {cadence === 'monthly' && showTrial ? (
                <motion.span key="trial" className="chip chip-success" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={spring.snappy}>
                  <Gift className="w-3.5 h-3.5" aria-hidden />
                  {t('acct.plans.trialMonthly')}
                </motion.span>
              ) : cadence === 'annual' ? (
                <motion.span key="annual" className="chip chip-success" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={spring.snappy}>
                  <Check className="w-3.5 h-3.5" aria-hidden />
                  {t('acct.plans.annualChip')}
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        {loading ? (
          <div className="grid md:grid-cols-3 gap-4" aria-busy="true">
            {[0, 1, 2].map(i => (
              <div key={i} className="rounded-2xl border border-surface-200/70 dark:border-surface-800 bg-white dark:bg-surface-900 p-5 space-y-3">
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
                <Skeleton className="h-11 w-full rounded-xl" />
              </div>
            ))}
          </div>
        ) : (
          <Stagger className="grid md:grid-cols-3 gap-4" gap={0.06}>
            {tiers.map(tier => {
              const meta = TIER_META[tier]
              const Icon = meta.icon
              const product = catalog?.products.find(p => p.tier === tier && p.cadence === cadence)
              const isCurrent = currentTier === tier
              const isFree = tier === 'free'
              const highlight = tier === 'pro'
              return (
                <StaggerItem key={tier}>
                  <div
                    className={cn(
                      'relative h-full rounded-2xl border p-5 flex flex-col bg-white dark:bg-surface-900',
                      highlight
                        ? 'border-amber-400 ring-2 ring-amber-200 dark:border-amber-500/60 dark:ring-amber-500/20'
                        : 'border-surface-200/70 dark:border-surface-800',
                    )}
                  >
                    {highlight && (
                      <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/40 text-xs font-bold px-3 py-0.5 rounded-full whitespace-nowrap">
                        {t('ac.plans.mostComplete')}
                      </span>
                    )}
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={cn('w-5 h-5', meta.accent)} aria-hidden />
                      <h3 className="text-lg font-display font-bold text-surface-900 dark:text-white">{t(meta.nameKey)}</h3>
                    </div>
                    <p className="text-[13px] text-surface-500 dark:text-surface-400 mb-3">{t(meta.taglineKey)}</p>

                    <div className="mb-4 min-h-[56px]">
                      {isFree ? (
                        <p className="text-[28px] font-display font-extrabold text-surface-900 dark:text-white tabular-nums">{zeroPrice}</p>
                      ) : product ? (
                        <>
                          <p className="text-[28px] font-display font-extrabold text-surface-900 dark:text-white leading-tight">
                            {priceOf(product).full}
                            <span className="text-sm font-medium text-surface-500 dark:text-surface-400">/{cadence === 'monthly' ? t('ac.plans.perMonth') : t('ac.plans.perYear')}</span>
                          </p>
                          {cadence === 'annual' && priceOf(product).perMonthOfYear && (
                            <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 mt-0.5">
                              {t('ac.plans.annualEquiv', { v: priceOf(product).perMonthOfYear ?? '' })}
                            </p>
                          )}
                          {product.has_trial && canBuy && (
                            <p className="text-[12px] text-surface-500 dark:text-surface-400 mt-1 leading-snug">
                              {t('ac.plans.trialNote', { price: priceOf(product).full })}
                            </p>
                          )}
                        </>
                      ) : null}
                    </div>

                    <ul className="space-y-2 mb-5 flex-1">
                      {FEATURES[tier].map(f => (
                        <li key={f} className="flex items-start gap-2 text-sm text-surface-700 dark:text-surface-300">
                          <Check className="w-4 h-4 text-primary-700 dark:text-primary-300 mt-0.5 shrink-0" aria-hidden />
                          <span>{t(f)}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      <Button variant="secondary" fullWidth disabled>
                        {t('ac.plans.currentPlan')}
                      </Button>
                    ) : isFree ? (
                      <Button variant="ghost" fullWidth disabled>
                        {t('ac.plans.basicPlan')}
                      </Button>
                    ) : (
                      <Button
                        fullWidth
                        variant={highlight ? 'primary' : 'soft'}
                        onClick={() => handleSubscribe(tier)}
                        loading={busySku === product?.sku}
                      >
                        {!canBuy && plat === 'web' && catalog?.web_checkout ? t('ac.plans.webCta') : product?.has_trial && canBuy ? t('ac.plans.startTrial') : t('ac.plans.subscribe')}
                      </Button>
                    )}
                  </div>
                </StaggerItem>
              )
            })}
          </Stagger>
        )}

        {/* O que muda de um plano para o outro (valores reais dos limites) */}
        <section aria-labelledby="plans-compare" className="mt-8">
          <h2 id="plans-compare" className="text-base font-display font-bold text-surface-900 dark:text-white mb-1">
            {t('acct.plans.compareTitle')}
          </h2>
          <p className="text-[13px] text-surface-500 dark:text-surface-400 mb-3">{t('acct.plans.compareSub')}</p>
          <Card padding="none" className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-surface-500 dark:text-surface-400">
                  <th scope="col" className="font-medium py-3 pl-4 pr-2"><span className="sr-only">{t('acct.plans.featureCol')}</span></th>
                  {tiers.map(tier => (
                    <th key={tier} scope="col" className={cn('font-semibold py-3 px-2 text-center whitespace-nowrap', tier === 'plus' ? 'text-primary-700 dark:text-primary-300' : 'text-surface-700 dark:text-surface-200')}>
                      {t(TIER_META[tier].nameKey)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-200/70 dark:divide-surface-800 border-t border-surface-200/70 dark:border-surface-800">
                <CompareRow label={t('acct.plans.rowPets')} values={tiers.map(x => LIMITS[x].pets)} unlimited={t('acct.plans.unlimited')} included={t('acct.plans.included')} />
                <CompareRow label={t('acct.plans.rowChat')} values={tiers.map(x => LIMITS[x].ai_chat)} unlimited={t('acct.plans.unlimited')} included={t('acct.plans.included')} />
                <CompareRow label={t('acct.plans.rowAnalysis')} values={tiers.map(x => LIMITS[x].ai_analysis)} unlimited={t('acct.plans.unlimited')} included={t('acct.plans.included')} />
                <CompareRow label={t('acct.plans.rowCard')} values={[true, true, true]} unlimited={t('acct.plans.unlimited')} included={t('acct.plans.included')} />
              </tbody>
            </table>
          </Card>
        </section>

        {/* Restaurar compras (obrigatório Apple) + nota */}
        <div className="mt-6 text-center">
          <Button variant="ghost" onClick={handleRestore} disabled={restoring} leftIcon={RefreshCw} className={restoring ? '[&_svg]:animate-spin' : ''}>
            {t('ac.plans.restore')}
          </Button>
          {!canBuy && (
            <p className="text-xs text-surface-500 dark:text-surface-400 mt-3 max-w-md mx-auto">
              {t(plat === 'web' && catalog?.web_checkout ? 'ac.plans.webNote' : plat === 'android' ? 'ac.plans.androidSoon' : 'ac.plans.iosOnly')}
            </p>
          )}
          <p className="text-[12px] text-surface-500 dark:text-surface-400 mt-3 max-w-lg mx-auto">
            {t('ac.plans.renewNote')}
          </p>
          <p className="text-[12px] mt-1 flex justify-center items-center gap-1">
            <a href="https://www.apple.com/legal/internet-services/itunes/dev/stdeula/" target="_blank" rel="noopener" className="inline-flex items-center min-h-[44px] px-1 font-semibold text-primary-700 dark:text-primary-300 hover:underline">{t('ac.plans.eula')}</a>
            <span className="text-surface-300 dark:text-surface-600" aria-hidden>·</span>
            <a href="/privacy" className="inline-flex items-center min-h-[44px] px-1 font-semibold text-primary-700 dark:text-primary-300 hover:underline">{t('ac.plans.privacy')}</a>
          </p>
        </div>

        <Sheet
          open={!!webSku}
          onClose={() => { if (!webBusy) setWebSku(null) }}
          dismissible={!webBusy}
          title={t('ac.plans.webTitle', { plan: webProduct?.name ?? '' })}
          description={t('ac.plans.webBody')}
          footer={
            <div className="space-y-2">
              <Button size="lg" fullWidth onClick={startWebCheckout} loading={webBusy}>
                {t('ac.plans.webGo')}
              </Button>
              <Button variant="ghost" fullWidth onClick={() => setWebSku(null)} disabled={webBusy}>
                {t('ac.plans.webCancel')}
              </Button>
            </div>
          }
        >
          <label htmlFor="plans-cpf" className="block text-sm font-semibold text-surface-700 dark:text-surface-200 mb-1.5">{t('ac.plans.cpfLabel')}</label>
          <input
            id="plans-cpf"
            inputMode="numeric"
            autoComplete="off"
            value={cpf}
            onChange={e => setCpf(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void startWebCheckout() }}
            placeholder="000.000.000-00"
            className={cn(fieldClasses, 'px-4')}
          />
        </Sheet>

        {/* Prefere não pagar? Indique e ganhe (o Início linka para #indicacao) */}
        <section id="indicacao" className="max-w-md mx-auto mt-8 scroll-mt-24">
          <ReferralCard />
        </section>
      </div>
    </DashboardLayout>
  )
}

function CompareRow({ label, values, unlimited, included }: { label: string; values: (number | boolean)[]; unlimited: string; included: string }) {
  return (
    <tr>
      <th scope="row" className="text-left font-medium text-surface-700 dark:text-surface-200 py-3 pl-4 pr-2">{label}</th>
      {values.map((v, i) => (
        <td key={i} className={cn('py-3 px-2 text-center tabular-nums', i === 1 ? 'font-bold text-primary-800 dark:text-primary-200' : 'text-surface-700 dark:text-surface-300')}>
          {v === true ? (
            <><Check className="w-4 h-4 mx-auto text-primary-700 dark:text-primary-300" aria-hidden /><span className="sr-only">{included}</span></>
          ) : v === false ? (
            <Minus className="w-4 h-4 mx-auto text-surface-400" aria-hidden />
          ) : v === -1 ? (
            unlimited
          ) : (
            v
          )}
        </td>
      ))}
    </tr>
  )
}

function UsageStat({ label, used, limit }: { label: string; used: number; limit: number }) {
  const unlimited = limit === -1
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100))
  return (
    <div>
      <p className="text-xs text-surface-500 dark:text-surface-400">{label}</p>
      <p className="text-sm font-bold text-surface-900 dark:text-white tabular-nums">
        {used}
        <span className="text-surface-400 font-normal">/{unlimited ? '∞' : limit}</span>
      </p>
      {!unlimited && (
        <div className="h-1.5 rounded-full bg-surface-100 dark:bg-surface-800 mt-1 overflow-hidden">
          <div className={`h-full rounded-full ${pct >= 100 ? 'bg-red-500' : 'bg-primary-500'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  )
}
