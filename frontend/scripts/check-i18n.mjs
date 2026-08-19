#!/usr/bin/env node
/**
 * Garante que todo idioma tem exatamente as mesmas chaves do pt-BR.
 * Chave faltando = usuário vê português no meio do inglês, silenciosamente.
 *
 * Uso: node scripts/check-i18n.mjs   (roda junto do build/CI)
 */
import { readFileSync } from 'node:fs'

const DIR = new URL('../src/lib/i18n/dict/', import.meta.url)
const keysOf = f => {
  const src = readFileSync(new URL(f, DIR), 'utf8')
  return new Set([...src.matchAll(/^\s*'([\w.]+)':/gm)].map(m => m[1]))
}

const base = keysOf('pt-BR.ts')
let failed = false

for (const loc of ['en.ts', 'es.ts']) {
  const k = keysOf(loc)
  const missing = [...base].filter(x => !k.has(x))
  const extra = [...k].filter(x => !base.has(x))
  if (missing.length || extra.length) {
    failed = true
    console.error(`✗ ${loc}`)
    if (missing.length) console.error(`   faltando (${missing.length}): ${missing.join(', ')}`)
    if (extra.length) console.error(`   sobrando (${extra.length}): ${extra.join(', ')}`)
  } else {
    console.log(`✓ ${loc} — ${k.size} chaves em dia`)
  }
}

if (failed) {
  console.error('\ni18n fora de sincronia. Atualize os dicionários antes de subir.')
  process.exit(1)
}
console.log(`\ni18n OK — ${base.size} chaves × 3 idiomas`)
