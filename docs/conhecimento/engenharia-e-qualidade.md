# Engenharia e qualidade para o PetLife

Pesquisa de novembro de 2026. [E] = evidência com fonte. [H] = hipótese ou julgamento nosso, a confirmar. Boa parte das fontes sobre Capacitor é de fornecedores (Capgo, Capawesome), que vendem a solução que recomendam; trate como indício, não como regra da Apple.

## 1. Capacitor 8 e apps híbridos

- [E] O Capacitor 8 saiu em 8/12/2025. Exige Node 22+, Xcode 26+, iOS 15+ e Android Studio Otter; `adjustMarginsForEdgeToEdge` foi removido em favor do plugin nativo SystemBars, e as margens agora vêm de variáveis CSS (`env(safe-area-inset-*)`). A versão 8.4 trouxe três correções de SystemBars. ([Ionic](https://ionic.io/blog/announcing-capacitor-8), [guia de atualização](https://capacitorjs.com/docs/updating/8-0), [Capawesome 8.4](https://capawesome.io/blog/whats-new-in-capacitor-8-4-0/))
- [E] A própria documentação do Capacitor descreve `server.url` como opção de live reload, "não destinada a produção". Checklists de revisão tratam `server.url` remoto em build de loja como risco das diretrizes 4.2 (funcionalidade mínima) e 2.5.2. Há relato no fórum da Apple de app Capacitor recusado na 4.2 mesmo com recursos nativos. ([Ionic Forum](https://forum.ionicframework.com/t/capacitor-server-url/240196), [preflight Capgo](https://tanstack.com/intent/registry/%2540capgo%252Fcapgo-skills/capacitor-apple-review-preflight), [Apple Forums](https://developer.apple.com/forums/thread/812889))
- [H] O PetLife já passou na revisão carregando o site de produção, então o risco não é imediato. Ele aparece em três momentos: revisão nova com outro revisor, servidor fora do ar (tela branca, sem modo offline) e uma mudança de tela que o revisor veria como "app diferente do aprovado". Widget, Live Activity, notificações e câmera ajudam a defender a 4.2.
- [E] Atualização ao vivo de pacote web local (Capgo, Capawesome) se apoia na cláusula 3.3.1(B) do contrato da Apple: código interpretado baixado é permitido se não muda o propósito do app nem contorna a segurança do sistema. Mudança nativa, permissão ou SDK novo continua exigindo build. ([Capgo](https://capgo.app/blog/apple-remote-code-execution-capgo-live-updates/), [Capawesome](https://capawesome.io/blog/the-right-way-to-update-your-capacitor-app-remotely))
- [H] Caminho do meio: manter `server.url`, mas embutir no pacote uma tela local de "sem conexão" com a carteirinha guardada em cache, para o app nunca abrir em branco.
- Plugins essenciais [E/H]: Push Notifications, Local Notifications (lembrete de reforço sem depender do servidor), Camera, Share, App (botão voltar e deep links), Preferences só para coisas que não são segredo, e um plugin de armazenamento seguro para tokens (ver seção 5).

## 2. Next.js atual

- [E] O Next.js 16 tornou o Turbopack o empacotador padrão para dev e build; config com função `webpack` sem equivalente `turbopack` dá erro. `output: 'export'` gera site estático, mas o `next/image` padrão não funciona nele sem um loader próprio. ([heise](https://heise.de/-10794114), [docs de export estático](https://nextjs.org/docs/pages/guides/static-exports))
- [E] Desde março de 2024 o INP substituiu o FID nas Core Web Vitals; as metas são LCP ≤ 2,5 s, INP ≤ 200 ms e CLS ≤ 0,1. ([web.dev](https://web.dev/articles/vitals))
- [H] Dentro do WebView, o que mais pesa é INP (toques que demoram a responder) e JavaScript da primeira tela. Práticas: `next/dynamic` para telas pesadas (leitor de carteirinha, gráficos), importar ícones um a um, medir com `@next/bundle-analyzer` e enviar as métricas reais com `useReportWebVitals` para o backend ou Sentry, separando por plataforma (iOS, Android, web).
- [H] Cache: arquivos `/_next/static` com hash podem ter cache longo; o HTML não. Com `server.url`, um HTML em cache velho apontando para JS que não existe mais é causa clássica de tela branca depois de publicar.

## 3. Testes enxutos para uma pessoa

Ordem sugerida [H], do que mais evita prejuízo para o que menos:

1. **Testes de API com pytest + httpx `AsyncClient`** nas rotas que mexem com dinheiro e dados: login, limite de 3 pets, webhook da Apple, link público da carteirinha. Rodam em segundos com SQLite.
2. **Contrato**: o FastAPI já gera OpenAPI. Gerar os tipos do frontend a partir dele (`openapi-typescript`) e falhar o CI quando o esquema mudar sem querer é um teste de contrato barato. Schemathesis acha erros 500 a partir do mesmo esquema. ([Schemathesis](https://schemathesis.readthedocs.io/))
3. **Playwright** com 3 a 5 fluxos de ponta a ponta (cadastro, adicionar vacina, abrir link público), só Chromium, contra o ambiente local. `toHaveScreenshot` cobre teste visual sem serviço pago; poucas telas, em viewport de celular. ([Playwright](https://playwright.dev/docs/test-snapshots))
4. **CI no GitHub Actions**: [E] repositório público tem minutos ilimitados; privado tem 2.000 minutos/mês no plano grátis. A cobrança anunciada para runners próprios (março de 2026) foi adiada após reação, segundo a imprensa. ([devclass](https://www.devclass.com/development/2025/12/17/github-to-charge-for-self-hosted-runners-from-march-2026/1734518), [Techzine](https://www.techzine.eu/news/devops/137396/github-bends-to-criticism-and-delays-paid-self-hosting-of-runners/)) [H] Rodar pytest e `next build` em Linux a cada push; Playwright só no PR; nunca runner macOS (custa 10× mais).
5. **Erros e disponibilidade**: Sentry no FastAPI e no frontend. [E] O SDK `@sentry/capacitor` ganhou suporte ao Capacitor 8 na linha 3.x, e o changelog da v4 diz que ela remove Session Replay e Profiling. ([releases](https://github.com/getsentry/sentry-capacitor/releases/tag/3.0.0-beta.2), [changelog](https://cdn.jsdelivr.net/npm/@sentry/capacitor@4.0.0/CHANGELOG.md)) [H] Como o app carrega o site, o SDK web do Next.js já pega a maioria dos erros de tela. Para disponibilidade, um monitor grátis (UptimeRobot, Better Stack) batendo em `/health` e na página inicial a cada 5 minutos, com alerta no celular.

## 4. Android

- [E] Contas pessoais criadas depois de 13/11/2023 precisam de teste fechado com pelo menos 12 testadores inscritos por 14 dias seguidos antes de pedir produção. Contas de organização (exigem D-U-N-S) ficam de fora. Não achamos mudança em 2026. ([Google Play Console](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB), [Choicely](https://www.choicely.com/blog/google-play-12-tester-rule))
- [H] Formas legítimas: amigos, família e tutores reais em lista de e-mails ou Grupo do Google; pedir que abram o app de verdade e deem retorno (o Google pergunta sobre o teste no pedido). Comprar "testadores" contraria a política. Alternativa: publicar com o CNPJ (ARKA ou Nexa) como conta de organização.
- O que costuma quebrar [E/H]: margens com edge-to-edge obrigatório (Android 15/16, SDK 35/36); botão voltar do sistema fechando o app em vez de voltar a tela; links (`assetlinks.json` para App Links); permissões de câmera e notificação (Android 13+ pede `POST_NOTIFICATIONS`); WebView desatualizado em aparelhos antigos; teclado cobrindo campos; push exige Firebase (`google-services.json`); compra precisa do Google Play Billing, não do StoreKit.

## 5. Segurança e privacidade

- [E] OWASP Mobile Top 10, versão final 2024: M1 uso indevido de credenciais, M2 cadeia de suprimentos, M3 autenticação/autorização, M4 validação de entrada/saída, M5 comunicação insegura, M6 controles de privacidade, M7 proteção do binário, M8 configuração, M9 armazenamento inseguro, M10 criptografia. Ele complementa o MASVS 2.1. ([OWASP](https://owasp.org/www-project-mobile-top-10/))
- [E] Tokens: Preferences, localStorage e IndexedDB guardam em texto puro, e o sistema pode limpar o armazenamento do WebView. Usar Keychain/Keystore via plugin de armazenamento seguro. ([Capgo](https://capgo.app/blog/secure-token-storage-best-practices-for-mobile-developers/), [Capawesome](https://capawesome.io/docs/blog/exploring-the-capacitor-secure-preferences-api/)) [H] Com `server.url`, um cookie `HttpOnly; Secure; SameSite` do próprio domínio é alternativa razoável ao token em JavaScript.
- [E] Links públicos com token são "capability URLs": valem como senha, devem ser impossíveis de adivinhar, revogáveis e com validade; usar `Referrer-Policy: no-referrer` e evitar links de terceiros na página. ([W3C TAG](https://www.w3.org/2001/tag/doc/capability-urls))
- [E] LGPD: a Resolução CD/ANPD 2/2022 dá regras mais leves a agentes de pequeno porte, mas não para tratamento de alto risco; o ciclo de fiscalização 2026–2027 inclui definir parâmetros de alto risco. ([Felsberg](https://www.felsberg.com.br/no-dia-internacional-da-protecao-de-dados-anpd-publica-nova-resolucao-que-regulamenta-a-aplicacao-da-lgpd-para-agentes-de-tratamento-de-pequeno-porte/), [Turivius](https://turivius.com/portal/anpd-2026-fiscalizacao-lgpd/)) [H] Dado de saúde do animal não é "dado sensível" da LGPD (que trata da pessoa), mas nome, telefone, endereço e localização do tutor são dados pessoais, e foto de carteirinha pode trazer CPF e endereço. Link público: só nome do pet, espécie e vacinas; nada do tutor. Pedir consentimento antes de compartilhar com clínica e registrar quando foi dado.

## 6. Mac com pouca memória

[H, a partir da prática]: uma coisa pesada por vez (simulador, `next dev`, Playwright ou Xcode); Playwright com `workers: 1` e só Chromium; testar no iPhone físico em vez do simulador; rodar o CI no GitHub em vez de localmente; `next build` com `NODE_OPTIONS=--max-old-space-size=2048`; limpar `~/Library/Developer/Xcode/DerivedData` e simuladores antigos (`xcrun simctl delete unavailable`) quando `df -h /` passar de 85%; usar SQLite local em vez de Postgres em Docker; fechar o navegador com muitas abas antes de builds.

## O que isso muda para o PetLife

1. **Tela de "sem conexão" embutida no app**, com a carteirinha em cache. Evita tela branca quando o Railway cai e enfraquece o argumento de "site embrulhado" na revisão da Apple.
2. **Monitor de disponibilidade + Sentry** no backend e no frontend, com alerta no celular. É barato e hoje uma queda só aparece quando algum usuário reclama.
3. **pytest nas 4 rotas críticas** (login, limite de pets, webhook da Apple, link público) rodando no GitHub Actions a cada push, antes de qualquer Playwright.
4. **Endurecer o link público**: token longo e aleatório, validade, botão para revogar, `Referrer-Policy: no-referrer`, e só dado do pet na página.
5. **Tokens fora do localStorage**: Keychain/Keystore pelo plugin seguro, ou cookie HttpOnly do domínio.
6. **Android**: começar já a juntar 12 testadores reais para os 14 dias, ou decidir publicar pelo CNPJ, e testar edge-to-edge, botão voltar e notificações num aparelho de verdade.
