# PetLife

App de saúde de cães e gatos para tutores no Brasil (também en e es). O centro do produto é a carteirinha de vacinação digital: ler a carteirinha de papel por foto, avisar antes de cada reforço e mandar o documento para quem pede (veterinário, hotel, creche, tosador, viagem).

## Onde fica cada coisa

- `backend/`: FastAPI + SQLAlchemy async. Postgres no Railway, SQLite local. IA em `ai_service.py` e `support_ai.py`.
- `frontend/`: Next.js + Tailwind + Capacitor 8. Textos em `src/lib/i18n/dict/modules/<área>/{pt-BR,en,es}.ts`.
- `frontend/ios/App/`: app iOS. `PetLifeBridgeViewController.swift` e `PetLifeNativePlugin.swift` são o código nativo próprio; o alvo `PetLifeWidget` traz o widget e a Live Activity.
- O app iOS carrega o site de produção (`server.url` em `capacitor.config.json`). Mudança de tela vai ao ar com a publicação do frontend, sem precisar de versão nova na loja. Mudança nativa precisa de build novo.
- App Store Connect: helpers em `~/.cache/petlife_asc/asc_api.py` (`get`, `post`, `patch`, `APP`).

## Publicar

- Backend: `railway up --service petlife-backend --detach`, rodado DE DENTRO de `backend/` (da raiz falha).
- Frontend: `railway up --detach` de dentro de `frontend/` (pasta ligada ao projeto `petlife-frontend`).
- Atalho para os dois: `~/.cache/petlife_asc/publicar.sh`.
- Depois de publicar o backend, confira `/health` e `railway logs` antes de dar por concluído.
- Migração de banco: acrescente o `ALTER TABLE` à lista em `backend/database.py`. Não existe Alembic.

## iOS

- Archive com `xcodebuild -project App.xcodeproj` (não `-workspace`; o projeto usa SPM).
- O Mac tem pouca memória. Não rode simulador, vários `next dev` e Playwright ao mesmo tempo, e confira `df -h /` antes de builds. Tela preta no simulador costuma ser falta de memória, não defeito.
- O macOS não tem `timeout`. Use `perl -e 'alarm shift; exec @ARGV' 60 comando`.
- Envio de build: `xcrun altool --upload-app -f App.ipa -t ios --apiKey JCWF67DX77 --apiIssuer 4cdf3f57-b5df-42f8-b327-779b8a2c5318`.

## Dados e números

- Os relatórios de analytics da Apple vêm com linhas duplicadas. Deduplique antes de somar.
- Os downloads diários vêm do `salesReports` (vendor 94306945), com dia fechado no horário do Pacífico.
- Nunca invente números, depoimentos ou avaliações. Em texto de loja, só afirme o que o app faz hoje.

## Regras de produto

- Nunca cobrar para registrar dados nem apagar dados de quem deixa de pagar.
- O grátis vai até 3 pets (`backend/pricing.py`).
- Conteúdo de saúde segue WSAVA e cita a fonte. O app não diagnostica; manda ao veterinário quando houver sinal de urgência.
- LGPD: dado mínimo em link público e consentimento para compartilhar com clínica.
- Texto em português do Brasil simples, como se fala com tutor. Nada de jargão técnico na interface.

## Time de agentes

Os agentes ficam em `.claude/agents/`. Comece pelo `petlife-produto`, que decide a prioridade e distribui o trabalho. Antes de qualquer envio à Apple ou publicação, passe a mudança pelo `petlife-revisor`.
