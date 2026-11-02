---
name: time
description: Põe o time de agentes do PetLife para trabalhar num objetivo, do começo ao fim (produto → pesquisa → experiência e visual → engenharia → testes → revisão → publicação → medição). Use quando o dono pedir para melhorar, crescer, inovar ou resolver algo amplo no app, ou digitar /time <objetivo>.
---

# Time PetLife

Objetivo pedido: $ARGUMENTS (se vazio, pegue a próxima aposta de `docs/estrategia-2026-11.md`).

Siga as etapas em ordem. Cada etapa usa o agente de `.claude/agents/` com o nome indicado; se o tipo de agente não estiver disponível na sessão, use um agente general-purpose mandando ele ler o arquivo do papel primeiro.

1. **Decidir** — `petlife-produto`: transforma o objetivo em um problema, um número a mover, até 3 apostas e uma escolhida, com critério de pronto. Se precisar de dado, ele chama `petlife-aso-growth` (números da loja) ou `petlife-pesquisa` (mercado).
2. **Desenhar** — em paralelo, só leitura: `petlife-ux` (fluxo e textos nos 3 idiomas) e `petlife-design` + `petlife-motion` (visual e movimento). Dê a eles capturas reais quando existirem. Saída: lista de mudanças com arquivo.
3. **Construir** — um agente por camada, sem dois mexendo no mesmo arquivo: `petlife-frontend`, `petlife-backend`, `petlife-ios` (só se precisar de build nativo), `petlife-ia` (se tocar em prompt ou modelo), `petlife-monetizacao` (se tocar em plano ou preço). Cada um termina com commit e o resultado de `npx tsc --noEmit` ou do teste do servidor.
4. **Testar** — `petlife-qa`: roteiro mínimo do papel, um navegador por vez, conferindo o disco antes.
5. **Revisar** — `petlife-revisor` recebe o diff, não a conclusão de quem fez. BLOQUEIA → volta à etapa 3. AJUSTAR → corrige e revisa de novo.
6. **Publicar** — só com OK do revisor e pedido explícito do dono nesta conversa. Frontend: `railway up --detach` de dentro de `frontend/`. Backend: de dentro de `backend/`, depois `/health` e `railway logs`. Mudança nativa: build novo e envio pelo `petlife-ios`.
7. **Medir** — anote em `docs/estrategia-2026-11.md` a data, o número de partida e quando medir (7 dias). Na medição, `petlife-aso-growth` traz o número e `petlife-produto` decide se mantém, ajusta ou desfaz.

Regras do time:
- O Mac tem pouca memória: no máximo um navegador ou simulador por vez entre todos os agentes.
- Nada de número inventado, avaliação falsa ou dado de demonstração que pareça real.
- Informe o dono em português simples a cada etapa concluída, em uma ou duas frases.
