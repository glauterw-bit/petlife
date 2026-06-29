/**
 * Apple IAP via cordova-plugin-purchase (CdvPurchase v13).
 *
 * O app Capacitor carrega a web remota (server.url no Railway), mas o plugin
 * nativo injeta `window.CdvPurchase` no WebView mesmo assim — então a compra
 * funciona em iOS nativo. Em browser/web, isNativeIos() = false e a UI deve
 * esconder os botões de compra (Apple G3.1.1).
 *
 * Fluxo:
 *   1. initIap() registra os 4 produtos no boot da tela de planos.
 *   2. purchaseProduct(appleProductId) dispara o prompt nativo da Apple.
 *   3. No callback `approved`, pegamos o receipt e mandamos pro backend
 *      validar (billing.verifyIap). Depois transaction.finish().
 */

export const APPLE_PRODUCT_IDS = [
  'app.petlife.plus.monthly',
  'app.petlife.plus.yearly',
  'app.petlife.pro.monthly',
  'app.petlife.pro.yearly',
] as const

type AnyWindow = typeof window & { CdvPurchase?: any; Capacitor?: any }

export function isNativeIos(): boolean {
  if (typeof window === 'undefined') return false
  const w = window as AnyWindow
  return !!(
    w.Capacitor?.isNativePlatform?.() &&
    w.Capacitor?.getPlatform?.() === 'ios'
  )
}

export function iapAvailable(): boolean {
  if (typeof window === 'undefined') return false
  return isNativeIos() && !!(window as AnyWindow).CdvPurchase
}

export interface PurchaseProof {
  transactionId?: string
  receipt?: string
  appleProductId: string
}

let initialized = false
let onProofCb: ((proof: PurchaseProof) => Promise<void> | void) | null = null

/**
 * Inicializa o store e registra produtos. `onProof` é chamado quando uma
 * compra é aprovada — manda transactionId (preferido) + receipt pro backend.
 */
export async function initIap(
  onProof: (proof: PurchaseProof) => Promise<void> | void,
): Promise<boolean> {
  onProofCb = onProof
  if (initialized) return true
  if (!iapAvailable()) return false

  const w = window as AnyWindow
  const { store, ProductType, Platform } = w.CdvPurchase

  for (const id of APPLE_PRODUCT_IDS) {
    store.register({
      id,
      type: ProductType.PAID_SUBSCRIPTION,
      platform: Platform.APPLE_APPSTORE,
    })
  }

  store.when().approved(async (transaction: any) => {
    try {
      const transactionId =
        transaction?.transactionId ||
        transaction?.nativePurchase?.transactionId ||
        transaction?.purchaseId
      const receipt =
        transaction?.transactionReceipt ||
        transaction?.parentReceipt?.nativeData?.appStoreReceipt ||
        w.CdvPurchase?.store?.localReceipts?.[0]?.nativeData?.appStoreReceipt
      const productId = transaction?.products?.[0]?.id || transaction?.productId
      if ((transactionId || receipt) && productId && onProofCb) {
        await onProofCb({ transactionId, receipt, appleProductId: productId })
      }
    } catch (e) {
      // erro de validação é tratado na UI via billing.me()
    } finally {
      try { transaction.finish() } catch {}
    }
  })

  await store.initialize([Platform.APPLE_APPSTORE])
  initialized = true
  return true
}

/** Dispara a compra do produto. Lança Error se indisponível ou sem oferta. */
export async function purchaseProduct(appleProductId: string): Promise<void> {
  if (!iapAvailable()) throw new Error('Compras só estão disponíveis no app iOS.')
  const w = window as AnyWindow
  const product = w.CdvPurchase.store.get(appleProductId, w.CdvPurchase.Platform.APPLE_APPSTORE)
  if (!product) throw new Error('Produto indisponível. Tente novamente em instantes.')
  const offer = product.getOffer()
  if (!offer) throw new Error('Oferta indisponível para este plano.')
  await offer.order()
}

/** Restaura compras anteriores (obrigatório p/ apps com IAP — Apple). */
export async function restorePurchases(): Promise<void> {
  if (!iapAvailable()) throw new Error('Compras só estão disponíveis no app iOS.')
  const w = window as AnyWindow
  await w.CdvPurchase.store.restorePurchases()
}
