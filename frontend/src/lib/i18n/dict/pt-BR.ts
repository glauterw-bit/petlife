import type { Dict } from '../types'
import { dict as core } from './modules/core/pt-BR'
import { dict as health } from './modules/health/pt-BR'
import { dict as petswalks } from './modules/petswalks/pt-BR'
import { dict as account } from './modules/account/pt-BR'
import { dict as social } from './modules/social/pt-BR'
import { dict as misc } from './modules/misc/pt-BR'

/**
 * Dicionário completo em pt-BR. Mesma ordem de módulos nos 3 idiomas
 * (um módulo posterior sobrescreve chave repetida de um anterior).
 */
export const dict: Dict = Object.assign({}, core, health, petswalks, account, social, misc)
