#!/usr/bin/env node
/**
 * Garante que cada módulo de tradução tem as mesmas chaves nos 3 idiomas
 * (src/lib/i18n/dict/modules/<modulo>/{pt-BR,en,es}.ts).
 * Chave faltando = usuário vê português no meio do inglês, silenciosamente.
 *
 * Uso: node scripts/check-i18n.mjs
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const MODULES_DIR = fileURLToPath(new URL('../src/lib/i18n/dict/modules/', import.meta.url))
const LOCALES = ['pt-BR', 'en', 'es']

/** Chaves de um arquivo de idioma (um `Dict` plano por arquivo). */
function keysOf(file) {
  if (!existsSync(file)) return null
  const src = readFileSync(file, 'utf8')
  // aceita chave com aspas simples ou duplas
  return new Set([...src.matchAll(/^\s*['"]([\w.]+)['"]\s*:/gm)].map(x => x[1]))
}

// Um módulo = uma pasta em modules/ com um arquivo por idioma (pt-BR.ts, en.ts, es.ts).
const modules = readdirSync(MODULES_DIR, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => d.name)
let failed = false
let total = 0

for (const mod of modules) {
  const k = Object.fromEntries(LOCALES.map(loc => [loc, keysOf(`${MODULES_DIR}${mod}/${loc}.ts`)]))
  const base = k['pt-BR']
  if (!base) {
    console.error(`✗ ${mod}: arquivo 'pt-BR.ts' não encontrado`)
    failed = true
    continue
  }
  total += base.size
  const problems = []
  for (const loc of LOCALES.slice(1)) {
    if (!k[loc]) { problems.push(`arquivo '${loc}.ts' ausente`); continue }
    const missing = [...base].filter(x => !k[loc].has(x))
    const extra = [...k[loc]].filter(x => !base.has(x))
    if (missing.length) problems.push(`${loc} faltando (${missing.length}): ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? '…' : ''}`)
    if (extra.length) problems.push(`${loc} sobrando (${extra.length}): ${extra.slice(0, 8).join(', ')}${extra.length > 8 ? '…' : ''}`)
  }
  if (problems.length) {
    failed = true
    console.error(`✗ ${mod}`)
    problems.forEach(p => console.error(`   ${p}`))
  } else {
    console.log(`✓ ${mod} — ${base.size} chaves × 3 idiomas`)
  }
}

// Os agregadores por idioma precisam importar todos os módulos.
for (const loc of LOCALES) {
  const agg = readFileSync(`${MODULES_DIR}../${loc}.ts`, 'utf8')
  const missing = modules.filter(mod => !agg.includes(`./modules/${mod}/${loc}'`))
  if (missing.length) {
    failed = true
    console.error(`✗ dict/${loc}.ts não importa: ${missing.join(', ')}`)
  }
}

if (failed) {
  console.error('\ni18n fora de sincronia. Corrija antes de subir.')
  process.exit(1)
}
console.log(`\ni18n OK — ${modules.length} módulo(s), ${total} chaves × 3 idiomas`)
