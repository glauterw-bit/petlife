# IA e Claude no PetLife

Novembro de 2026. Legenda: **[E]** evidência (documentação oficial ou o nosso código), **[H]** hipótese ou estimativa a validar.

## 1. Qual modelo em cada uso

Preços oficiais por milhão de tokens (entrada / saída) [E] ([preços](https://platform.claude.com/docs/en/about-claude/pricing), [modelos](https://platform.claude.com/docs/en/about-claude/models/overview)):

| Modelo | Entrada | Saída | Leitura de cache |
|---|---|---|---|
| Haiku 5.5 (`claude-haiku-5-5`) | US$ 0,10 | US$ 0,50 | 0,1x |
| Sonnet 5.5 (`claude-sonnet-5-5`) | US$ 2 | US$ 10 | US$ 0,20 |
| Opus 5.5 (`claude-opus-5-5`) | US$ 4 | US$ 20 | US$ 0,20 |
| Fable 5.1 (`claude-fable-5-1`) | US$ 10 | US$ 50 | US$ 0,25 |
| *Hoje:* Sonnet 4.6 / Haiku 4.5 | US$ 3 / 1 | US$ 15 / 5 | 0,1x |

O Haiku 5.5 custa um décimo do Haiku 4.5 nesse preço, que vale para prompts de até 100 mil tokens. O tokenizador novo, porém, conta cerca de 30% mais tokens para o mesmo texto [E].

Recomendação:

- **Vyron (chat):** Haiku 5.5, esforço `low`: rápido e volume alto [H].
- **Carteirinha por foto:** Sonnet 5.5, porque erro de data custa caro. Haiku só se passar nas fotos de teste (seção 4) [H].
- **Suporte** (`support_ai.py`, hoje Sonnet 4.6): Haiku 5.5; base fixa, respostas curtas [H].
- **Análises** (anamnese, plano comportamental, previsão de saúde, dor, fezes, triagem): Sonnet 5.5 [H].
- **Textos leves** (história de dormir, memorial, retrospectiva, legenda): Haiku 5.5 [H].
- Opus 5.5 e Fable 5.1: só no desenvolvimento, não no app [H].

**Custo mensal para ~200 usuários ativos [H].** Premissas:

- 15 perguntas à Vyron por usuário por mês (3.000 no total), com ~3.500 tokens de entrada e ~600 de saída, contando o raciocínio.
- 100 leituras de carteirinha, com ~2.500 tokens de entrada (a imagem dá ~1.600) e ~1.800 de saída.
- 300 respostas de suporte, com ~4.500 / 300 tokens.
- 400 análises, com ~2.000 / 2.000 tokens.

| Uso | Hoje | Proposto |
|---|---|---|
| Vyron | ~US$ 12 (Haiku 4.5) | ~US$ 2 (Haiku 5.5) |
| Carteirinha | ~US$ 3,5 | ~US$ 2,3 (Sonnet 5.5) |
| Suporte | ~US$ 5,4 | ~US$ 0,3 (Haiku 5.5 + cache) |
| Análises | ~US$ 14 | ~US$ 10, ou ~US$ 6 com batch e cache |
| **Total** | **~US$ 35** | **~US$ 10 a 15** |

Com 200 usuários o custo é irrelevante. A troca vale pela qualidade e pela margem futura. Confirme com `response.usage`.

## 2. Recursos da API que devemos usar

- **Cache de prompt** [E] ([docs](https://platform.claude.com/docs/en/build-with-claude/prompt-caching)):
  - Como funciona: o cache vale para o começo do pedido (o prefixo), na ordem ferramentas → sistema → mensagens. Ler do cache custa 0,1x a entrada. Gravar custa 1,25x, e a gravação fica 5 minutos. Nos modelos 5.5 o prefixo mínimo é de 512 tokens.
  - Onde usar: (a) no `KNOWLEDGE` do suporte, que é fixo e longo; (b) no prompt de sistema da Vyron. Hoje o contexto do pet vai colado na última mensagem a cada turno, o que impede o reuso. Mova-o para um bloco de sistema logo depois do prompt fixo, com `cache_control`. Nada de data ou hora antes do ponto de cache.
  - Como conferir: `usage.cache_read_input_tokens` precisa ficar acima de zero a partir da segunda chamada.
- **Visão para a carteirinha** [E] ([docs](https://platform.claude.com/docs/en/build-with-claude/vision)): mande a imagem antes do texto, como o código já faz. Reduza no aparelho para ~1.500 px no lado maior, o que corta tokens. O retorno `image_quality` com lista vazia para foto ruim já existe.
- **Saídas estruturadas** [E] ([docs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs)): troque o `json.loads` com regex e remoção de cercas de markdown por `output_config.format` com um esquema JSON, ou por `client.messages.parse()` com um modelo Pydantic `VaccineCard{vaccines:[{name, date_given, next_due, veterinarian, confidence}]}`. Atenção: no Sonnet 5.5, forçar ferramenta (`tool_choice` `any`/`tool`) devolve erro 400. Use saída estruturada ou `strict: true` com `auto`.
- **Batch** [E] ([docs](https://platform.claude.com/docs/en/build-with-claude/batch-processing)): custa 50% menos e entrega em até 24 h. Serve para a retrospectiva do ano, os guias de cuidado, a previsão de saúde semanal e as rodadas de avaliação. Nunca para o que o tutor espera na tela.
- **Raciocínio e esforço** [E]: nos modelos 5.5, `budget_tokens` e `temperature` devolvem 400. Controle com `output_config.effort`, que por padrão é `high` no Sonnet 5.5 e `medium` no Haiku 5.5. Use `low` no chat e `medium` nas análises.
- **Limites e erros** [E] ([erros](https://platform.claude.com/docs/en/api/errors), [limites](https://platform.claude.com/docs/en/api/rate-limits)):
  - Troque o cliente síncrono com `to_thread` por `AsyncAnthropic`.
  - O SDK já repete 2 vezes os erros 429, 5xx e de conexão. Capture `RateLimitError`, depois `APIStatusError`, depois `APIConnectionError`, nessa ordem, e mostre ao tutor uma mensagem amigável.
  - Cheque `stop_reason`. Com `max_tokens`, a resposta veio cortada. Com `refusal`, a recusa veio de um classificador de segurança. O Haiku 5.5 não tem troca automática de modelo quando recusa. No Sonnet 5.5, ative `fallbacks: "default"`.
  - Registre o `usage` de cada chamada para saber o custo por função.

## 3. Tendências 2025-2026 e o que cabe a 1 pessoa

- **Agentes** [E/H]: o mercado foi de chat para agentes que executam tarefas ([Anthropic, "Building effective agents"](https://www.anthropic.com/research/building-effective-agents)). Para o PetLife, o realista é um fluxo com poucas ferramentas: a Vyron cria um lembrete, registra um peso ou abre a carteirinha. Agente autônomo, não [H].
- **Voz** [H]: basta o ditado do iOS no campo de texto, sem pipeline de voz próprio.
- **IA no aparelho / Apple Foundation Models** [E] ([docs Apple](https://developer.apple.com/documentation/foundationmodels)): a partir do iOS 26, apps acessam o modelo local da Apple de graça, offline e com privacidade. Serve para resumos curtos, não para orientação de saúde. No Capacitor exige plugin em Swift: deixe para depois [H].
- **Multimodal** [H]: a foto já é o diferencial do app. Aprofunde a carteirinha em vez de abrir novas frentes de foto.
- **Para 1 pessoa** [H]: um provedor, dois modelos (Haiku e Sonnet), avaliações automáticas e nenhuma infraestrutura própria.

## 4. Segurança em saúde animal

- **Não diagnosticar** [E/H]: a telemedicina veterinária no Brasil segue regras do CFMV ([Resolução CFMV 1.465/2022](https://www.cfmv.gov.br)) [H: confirmar o texto vigente]. O prompt deve falar em "possibilidades a conversar com o veterinário", nunca em "seu pet tem X", e nunca prescrever dose de medicamento.
- **Triagem de urgência**:
  - Antes do modelo, uma lista fixa de sinais de alarme (convulsão, falta de ar, sangramento, envenenamento, gato que não urina) mostra um cartão "procure atendimento agora", sem depender do texto gerado.
  - Peça `urgency` (`emergencia`/`hoje`/`rotina`) em formato estruturado.
- **Avaliações (evals)**:
  - Mantenha um arquivo fixo `evals/` com ~50 perguntas (20 de emergência, 10 que pedem remédio, 20 comuns) e ~30 fotos de carteirinha reais e anonimizadas, com o gabarito digitado.
  - Métricas: (a) quantas emergências não foram sinalizadas, com meta zero; (b) quantos campos da carteirinha vieram exatos, com meta de 95% ou mais [H].
  - Rode por batch a cada troca de modelo ou prompt.
- **LGPD** [E] ([Lei 13.709](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)):
  - Não envie à API dados do tutor que não servem à resposta. Revise o `_context` do suporte.
  - Declare na política de privacidade a transferência internacional ao provedor de IA (art. 33).
  - A API não usa os dados para treinar modelos por padrão ([Anthropic](https://privacy.anthropic.com)) [E].

## 5. Claude Code e agentes no desenvolvimento

1. **CLAUDE.md curto**: como publicar, testar e o que nunca fazer ([docs](https://code.claude.com/docs/en/memory)).
2. **Subagentes para ler, não para decidir**: buscas amplas e pesquisas paralelas. A edição fica na conversa principal ([subagentes](https://code.claude.com/docs/en/sub-agents)). Para 1 pessoa, 13 agentes é muito: mantenha os que você chama toda semana [H].
3. **Skills para o que se repete**: publicar na App Store, migrar modelo (`/claude-api migrate`), criar avaliações (`/claude-api build-eval`) ([skills](https://code.claude.com/docs/en/skills)).
4. **Hooks para regras que não podem falhar**: rodar os testes do backend depois de editar `.py` e bloquear commit com chave de API ([hooks](https://code.claude.com/docs/en/hooks)).
5. **Revisão antes de publicar**: use `/code-review` no diff e `/security-review` em mudanças de autenticação, pagamento ou dados pessoais.
6. **Toda mudança de IA vem com medição**: custo (`usage`) e acerto (seção 4).

## Plano de troca

1. `backend/requirements.txt`: troque `anthropic>=0.40.0` por uma versão atual e fixa (saída estruturada e esforço exigem SDK recente), com `/claude-api upgrade python`.
2. `backend/ai_service.py`, linhas 20-23:
   - `MODEL = "claude-sonnet-5-5"` e `CHAT_MODEL = "claude-haiku-5-5"`.
   - Crie `EFFORT_CHAT = "low"` e `EFFORT_ANALYSIS = "medium"`.
3. `ai_service.py`, `get_client` e `_create`: passe a usar `anthropic.AsyncAnthropic` com `await client.messages.create(...)`. Centralize ali erros, `stop_reason` e registro de `usage`.
4. `ai_service.py`, `chat_with_vet_ai` (linha ~1000):
   - `system` vira uma lista com dois blocos: o prompt fixo da Vyron com `cache_control: {"type": "ephemeral"}` e, em seguida, o contexto do pet.
   - Tire o contexto de `user_message` e passe `output_config={"effort": "low"}`.
5. `ai_service.py`, `read_vaccine_card` (linha ~1185): use `client.messages.parse()` com um modelo Pydantic e apague o parse manual (linhas ~1243-1250). Mantenha o Sonnet 5.5.
6. `ai_service.py`, funções que hoje fazem `json.loads` com regex (fezes, triagem, SOAP, raça, enriquecimento): passe todas para `output_config.format`.
7. `backend/support_ai.py`, linha 181: use `ai_service.CHAT_MODEL` e coloque o `KNOWLEDGE` em bloco de sistema próprio com `cache_control`, separado do contexto da conta.
8. Crie `backend/evals/` com as perguntas e as fotos da seção 4 e um script em batch. Rode antes e depois dos passos 2, 4 e 5; publique só sem regressão.
9. `generate_petlife_wrapped`, `generate_care_guide` e a previsão semanal: avalie batch com aviso por notificação.
