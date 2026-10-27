import type { Dict } from '../types'
import { dict as core } from './modules/core/es'
import { dict as health } from './modules/health/es'
import { dict as petswalks } from './modules/petswalks/es'
import { dict as account } from './modules/account/es'
import { dict as social } from './modules/social/es'
import { dict as misc } from './modules/misc/es'

/**
 * Dicionário completo em es. Mesma ordem de módulos nos 3 idiomas
 * (um módulo posterior sobrescreve chave repetida de um anterior).
 */
export const dict: Dict = Object.assign({}, core, health, petswalks, account, social, misc)
