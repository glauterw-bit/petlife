#!/usr/bin/env node
/**
 * Garante que cada módulo de tradução tem as mesmas chaves nos 3 idiomas.
 * Chave faltando = usuário vê português no meio do inglês, silenciosamente.
 *
 * Uso: node scripts/check-i18n.mjs
 */
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MODULES_DIR = fileURLToPath(new URL('../src/lib/i18n/dict/modules/', import.meta.url))
const LOCALES = ['pt-BR', 'en', 'es']

/** Extrai as chaves de cada bloco de idioma do módulo. */
function keysByLocale(src) {
  const out = {}
  for (const loc of LOCALES) {
    // encontra o início do bloco do idioma e lê até o fechamento no mesmo nível
    const re = new RegExp(`['"]?${loc.replace('-', '-')}['"]?\\s*:\\s*\\{`)
    const m = re.exec(src)
    if (!m) { out[loc] = null; continue }
    let i = m.index + m[0].length, depth = 1
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') depth--
      i++
    }
    const block = src.slice(m.index + m[0].length, i - 1)
    out[loc] = new Set([...block.matchAll(/^\s*'([\w.]+)':/gm)].map(x => x[1]))
  }
  return out
}

const files = readdirSync(MODULES_DIR).filter(f => f.endsWith('.ts'))
let failed = false
let total = 0

for (const f of files) {
  const src = readFileSync(MODULES_DIR + f, 'utf8')
  const k = keysByLocale(src)
  const base = k['pt-BR']
  if (!base) {
    console.error(`✗ ${f}: bloco 'pt-BR' não encontrado`)
    failed = true
    continue
  }
  total += base.size
  const problems = []
  for (const loc of LOCALES.slice(1)) {
    if (!k[loc]) { problems.push(`bloco '${loc}' ausente`); continue }
    const missing = [...base].filter(x => !k[loc].has(x))
    const extra = [...k[loc]].filter(x => !base.has(x))
    if (missing.length) problems.push(`${loc} faltando (${missing.length}): ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`)
    if (extra.length) problems.push(`${loc} sobrando (${extra.length}): ${extra.slice(0, 8).join(', ')}${extra.length > 8 ? '…' : ''}`)
  }
  if (problems.length) {
    failed = true
    console.error(`✗ ${f}`)
    problems.forEach(p => console.error(`   ${p}`))
  } else {
    console.log(`✓ ${f} — ${base.size} chaves × 3 idiomas`)
  }
}

if (failed) {
  console.error('\ni18n fora de sincronia. Corrija antes de subir.')
  process.exit(1)
}
console.log(`\ni18n OK — ${files.length} módulo(s), ${total} chaves × 3 idiomas`)
