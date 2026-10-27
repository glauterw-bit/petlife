/**
 * Recursos do framer-motion carregados sob demanda pelo <MotionProvider>.
 * domMax (e não domAnimation) porque o app usa `layout`/`layoutId`
 * (pílulas de filtro, abas, listas) e `drag` (Sheet, cards).
 */
import { domMax } from 'framer-motion'

export default domMax
