import type { Dict } from '../types'
import { dict as core } from './modules/core/en'
import { dict as health } from './modules/health/en'
import { dict as petswalks } from './modules/petswalks/en'
import { dict as account } from './modules/account/en'
import { dict as social } from './modules/social/en'
import { dict as misc } from './modules/misc/en'

/**
 * Dicionário completo em en. Mesma ordem de módulos nos 3 idiomas
 * (um módulo posterior sobrescreve chave repetida de um anterior).
 */
export const dict: Dict = Object.assign({}, core, health, petswalks, account, social, misc)
