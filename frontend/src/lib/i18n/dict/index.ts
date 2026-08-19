import { mergeBundles } from '../bundle'
import type { Dict, Locale } from '../types'

// ── Registro de módulos ───────────────────────────────────────────────
// Cada frente de tradução tem seu próprio arquivo em ./modules/ para que
// várias pessoas (ou agentes) trabalhem em paralelo sem colidir.
// Para adicionar um módulo: importe aqui e inclua na lista abaixo.
import { core } from './modules/core'
import { health } from './modules/health'
import { petswalks } from './modules/petswalks'
import { account } from './modules/account'

export const DICTS: Record<Locale, Dict> = mergeBundles([
  core,
  health,
  petswalks,
  account,
])
