#!/usr/bin/env node
/**
 * Confere se o app e a API falam a mesma língua.
 *
 * POR QUE ISSO EXISTE
 * -------------------
 * No PetLife, seis bugs em produção tinham a mesma causa: o backend devolvia
 * um nome e o frontend lia outro. O TypeScript não pega — ele confia na
 * interface que você escreveu, não no que a API realmente manda. O resultado
 * aparece só em runtime, e quase sempre como `undefined.map()`, que no Next.js
 * apaga a tela inteira com "Application error: a client-side exception".
 *
 * Casos reais que este script teria pego no primeiro dia:
 *
 *   backend: time_slots        app: walk_times      -> tela de rotinas morta
 *   backend: badges            app: badges_earned   -> tela de desafios morta
 *   backend: /upcoming-reminders?days_ahead
 *            app: /upcoming?days                    -> 422, card sempre vazio
 *   backend: POST /vet/clinic/register
 *            app: POST /vet/register                -> 404, cadastro impossível
 *   backend: só POST em /exams
 *            app: GET /exams                        -> 405, lista sempre vazia
 *
 * Os dois últimos são especialmente traiçoeiros: a funcionalidade parece
 * existir, a tela abre, o formulário envia — e nada nunca funcionou.
 *
 * USO
 *   node scripts/check-api-contract.mjs [--api URL] [--client CAMINHO]
 *
 * Roda no CI. Falha o build quando o contrato quebra.
 */
import { readFileSync } from 'node:fs'

const args = Object.fromEntries(
  process.argv.slice(2).join(' ').split('--').filter(Boolean)
    .map(s => s.trim().split(/\s+/)).map(([k, ...v]) => [k, v.join(' ')])
)
const API = args.api ?? process.env.API_URL ?? 'http://localhost:8000'
const CLIENT = args.client ?? 'src/lib/api.ts'

const red = s => `\x1b[31m${s}\x1b[0m`
const yellow = s => `\x1b[33m${s}\x1b[0m`
const green = s => `\x1b[32m${s}\x1b[0m`
const dim = s => `\x1b[2m${s}\x1b[0m`

// ─── 1. o que a API realmente expõe ──────────────────────────────────────────
let spec
try {
  const res = await fetch(`${API}/openapi.json`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  spec = await res.json()
} catch (e) {
  console.error(red(`✗ não consegui ler ${API}/openapi.json — ${e.message}`))
  console.error(dim('  suba a API antes, ou passe --api <url>'))
  process.exit(2)
}

const routes = Object.entries(spec.paths).map(([path, ops]) => ({
  path,
  methods: Object.keys(ops).map(m => m.toUpperCase()),
  // /pets/{id} -> ^/pets/[^/]+$
  re: new RegExp('^' + path.replace(/\{[^}]+\}/g, '[^/]+') + '$'),
  // parâmetros de query que a rota aceita
  params: Object.values(ops).flatMap(o => (o.parameters ?? [])
    .filter(p => p.in === 'query').map(p => p.name)),
  // quantos segmentos são literais — quanto mais, mais específica é a rota
  peso: path.split('/').filter(s => s && !s.startsWith('{')).length,
}))
  // Segmento literal ganha de parâmetro, senão `/breeds/{breed_id}` captura
  // `/breeds/identify-from-photo` e o relatório acusa 405 onde não há erro.
  // Ordenamos da mais específica para a mais genérica antes de procurar.
  .sort((a, b) => b.peso - a.peso || a.path.length - b.path.length)

const schemas = Object.fromEntries(
  Object.entries(spec.components?.schemas ?? {})
    .filter(([, s]) => s.properties)
    .map(([n, s]) => [n, new Set(Object.keys(s.properties))])
)

// ─── 2. o que o app chama e o que ele espera ler ─────────────────────────────
let src
try {
  src = readFileSync(CLIENT, 'utf8')
} catch {
  console.error(red(`✗ não achei o client em ${CLIENT} — passe --client <caminho>`))
  process.exit(2)
}

const problems = []

// 2a. chamadas: método + caminho + query
const CALL = /fetch\(\s*[`'"]\$\{[A-Z_]+\}([^`'"]*)[`'"]\s*,?\s*(\{[^)]*)?\)/g
for (const m of src.matchAll(CALL)) {
  const raw = m[1]
  const [rawPath, rawQuery = ''] = raw.split('?')
  // ${id} vira placeholder; ${qs} no fim é query montada em variável
  // Distinguir os dois usos de interpolacao no caminho:
  //   /pets/${id}      -> barra antes  = parametro de rota  -> vira X
  //   /vaccines${qs}   -> colado       = query montada fora -> some
  const path = (rawPath
    .replace(/(?<=\/)\$\{[^}]*\}/g, 'X')   // parametro de rota
    .replace(/\$\{[^}]*\}/g, '')            // sufixo colado (query)
    .replace(/\/+$/, '')) || '/'
  const method = (m[2]?.match(/method:\s*['"](\w+)['"]/) ?? [, 'GET'])[1].toUpperCase()

  const hit = routes.find(r => r.re.test(path))
  if (!hit) {
    problems.push({ lvl: 'erro', msg: `${method} ${path}`, why: 'rota não existe na API (404 em produção)' })
    continue
  }
  if (!hit.methods.includes(method)) {
    problems.push({
      lvl: 'erro', msg: `${method} ${path}`,
      why: `a API só aceita ${hit.methods.join(', ')} aqui (405 em produção)`,
    })
    continue
  }
  // query params escritos direto na string
  for (const q of rawQuery.matchAll(/[?&]?(\w+)=/g)) {
    const name = q[1]
    if (hit.params.length && !hit.params.includes(name)) {
      problems.push({
        lvl: 'erro', msg: `${method} ${path}?${name}=`,
        why: `parâmetro desconhecido; a rota aceita: ${hit.params.join(', ') || '(nenhum)'}`,
      })
    }
  }
}

// 2b. interfaces: campos que o app lê e a API não manda
const norm = s => s.toLowerCase().replace(/(response|request|create|update|out|in)$/g, '')
const byNorm = {}
for (const name of Object.keys(schemas)) (byNorm[norm(name)] ??= []).push(name)

for (const m of src.matchAll(/export interface (\w+)\s*\{([^}]*)\}/g)) {
  const [, tsName, block] = m
  const cands = byNorm[norm(tsName)]
  if (!cands) continue
  const beName = cands.find(c => /Response$/.test(c)) ?? cands[0]
  const beProps = schemas[beName]

  for (const p of block.matchAll(/^\s*(\w+)(\??)\s*:/gm)) {
    const [, field, optional] = p
    if (beProps.has(field)) continue
    problems.push({
      lvl: optional ? 'aviso' : 'erro',
      msg: `${tsName}.${field}`,
      why: `a API (${beName}) não devolve este campo -> undefined em runtime`,
    })
  }
}

// ─── 3. relatório ────────────────────────────────────────────────────────────
const erros = problems.filter(p => p.lvl === 'erro')
const avisos = problems.filter(p => p.lvl === 'aviso')

for (const p of erros) console.log(`${red('✗')} ${p.msg}\n  ${dim(p.why)}`)
for (const p of avisos) console.log(`${yellow('!')} ${p.msg}\n  ${dim(p.why)}`)

console.log()
if (erros.length) {
  console.log(red(`✗ ${erros.length} quebra(s) de contrato` + (avisos.length ? `, ${avisos.length} aviso(s)` : '')))
  console.log(dim('  Campo obrigatório ausente vira undefined. Se o app fizer .map() nele, a tela toda apaga.'))
  process.exit(1)
}
console.log(green(`✓ contrato OK`) + (avisos.length ? yellow(` — ${avisos.length} campo(s) opcional(is) ausente(s)`) : ''))
