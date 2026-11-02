# Design, UX e motion em apps móveis: tendências 2025-2026

Pesquisa de novembro de 2026. **[E]** = evidência com fonte (documento oficial, artigo ou dado publicado). **[H]** = hipótese ou leitura nossa, sem estudo que a prove. Onde a fonte é secundária, isso está dito.

## 1. Apple: iOS 26 e depois

- **Liquid Glass é o novo material do sistema.** É um vidro translúcido que reflete e refrata o que está atrás dele, e vale para iOS, iPadOS, macOS, watchOS e tvOS. [E] [Apple Newsroom, jun/2025](https://www.apple.com/newsroom/2025/06/apple-introduces-a-delightful-and-elegant-new-software-design/)
- **O vidro fica na camada de navegação e controles, e o conteúdo continua opaco.** Fundos opacos próprios em barras anulam o efeito. [E/H] Isso aparece em [WWDC25 sessão 219](https://developer.apple.com/videos/play/wwdc2025/219/) e no [HIG Materials](https://developer.apple.com/design/human-interface-guidelines/materials); a frase "conteúdo opaco" vem de resumos de terceiros.
- **A barra de abas no iPhone flutua sobre o conteúdo e pode encolher ao rolar** (`tabBarMinimizeBehavior = .onScrollDown`). Ela volta ao tamanho normal quando a pessoa rola para cima, e aceita um acessório inferior que se recolhe junto. [E] [WWDC25 sessão 284](https://developer.apple.com/videos/play/wwdc2025/284/) e [sessão 323](https://developer.apple.com/videos/play/wwdc2025/323/)
- **Ícones em camadas, feitos no Icon Composer**, com variantes clara, escura, tingida e transparente. [E] [Apple Icon Composer](https://developer.apple.com/icon-composer/)
- **Acessibilidade do vidro.** "Reduzir transparência" deixa os painéis opacos. Desde o iOS 26.1 há também a opção Transparente/Tingido em Tela e Brilho. [E] [TidBITS](https://tidbits.com/2025/10/09/how-to-turn-liquid-glass-into-a-solid-interface/) e [Six Colors](https://sixcolors.com/post/2025/11/soaping-up-liquid-glass-less-transparency-more-contrast/). A recepção de legibilidade foi mista no começo. [E] [heise](https://heise.de/-10445465)
- **Widgets e Live Activities ganharam mais lugares para aparecer.** Os widgets do iPhone e as Live Activities passam a aparecer no CarPlay (sem toque, só o estado mais importante) e no Mac pelo macOS Tahoe. Os widgets usam renderização "accented" (tingida). [E] [WWDC25 sessão 278](https://developer.apple.com/videos/play/wwdc2025/278/) e [sessão 216](https://developer.apple.com/videos/play/wwdc2025/216/)
- **App Intents.** Agora há "snippets interativos": cartões com botões que aparecem por cima de Siri, Atalhos e Spotlight. Os resultados de busca do app também entram na busca do sistema. [E] [WWDC25 sessão 275](https://developer.apple.com/videos/play/wwdc2025/275/). Os Controles (Central de Controle e tela bloqueada, desde o iOS 18) continuam sendo feitos com App Intents. [E] [WidgetKit](https://developer.apple.com/documentation/widgetkit)
- **Apple Intelligence para apps de terceiros.** O framework Foundation Models dá acesso ao modelo que roda no próprio aparelho. Funciona sem internet, sem custo por chamada, e só em aparelhos compatíveis com Apple Intelligence ligada. [E] [Apple Newsroom, set/2025](https://www.apple.com/newsroom/2025/09/apples-foundation-models-framework-unlocks-new-intelligent-app-experiences/)

**O que dá para imitar no Capacitor e o que exige Swift:**

- **Dá para fazer com CSS** [H]:
  - barra flutuante com `backdrop-filter: blur() saturate()`, borda clara de 1px e sombra suave;
  - encolher a barra ao rolar;
  - folhas de baixo arredondadas;
  - versão opaca quando a pessoa pede menos transparência (o suporte do Safari a `prefers-reduced-transparency` não está confirmado; conferir no [caniuse](https://caniuse.com/?search=prefers-reduced-transparency)).
- **Não dá para fazer com CSS:** a refração real (a lente que distorce o fundo) e a reação do vidro ao toque. Também exigem nativo os ícones em camadas, os widgets, as Live Activities, os Controles, os snippets de Siri e Atalhos e o Foundation Models.
- **Cuidado de desempenho:** muitos `backdrop-filter` empilhados pesam na WebView. Melhor usar um só, na barra. [H]

## 2. Material 3 Expressive (para o Android)

- **O que muda:** formas mais variadas (35 novas formas e morphing entre elas), cores e tipografia mais fortes, e um sistema de movimento por molas físicas no lugar de curvas de duração fixa. As molas são de dois tipos: espaciais (posição) e de efeito (cor e opacidade). [E] [M3 blog](https://m3.material.io/blog/building-with-m3-expressive) e [Google Design: pesquisa](https://design.google/library/expressive-material-design-google-research)
- **Base de pesquisa:** o Google relata 46 estudos com mais de 18 mil participantes. Segundo o Google, a interface "expressiva" ajudou as pessoas a achar elementos importantes mais rápido. [E] O número vem da própria Google, citado por [Dezeen](https://www.dezeen.com/2025/05/28/google-ushers-in-age-of-expressive-interfaces-with-material-design-update/).
- **Para o PetLife:** quando houver Android, um tema de tokens separado (barra inferior Material, botão voltar do sistema, molas). Não serve copiar o vidro da Apple. [H]

## 3. UX que move ativação e retenção (saúde e família)

- **Mostrar valor antes do cadastro.** O Duolingo dá a primeira lição antes de pedir conta. [E] Fonte secundária: [Appcues](https://www.appcues.com/blog/the-10-best-user-onboarding-experiences). Números atribuídos ao Headspace (queda de 38%, +10% de teste grátis) não têm fonte primária. Não usar. [E: sem fonte]
- **Progresso que já começa andado.** No estudo clássico, um cartão fidelidade que já vinha com 2 selos foi completado por cerca de 34% dos clientes, contra 19% do cartão vazio. [E] [Nunes & Drèze, 2006](https://doi.org/10.1086/500480). É um estudo de lava-rápido, não de app, então vale como analogia. Um checklist de "Carteirinha completa" que já marca o que a pessoa fez (pet criado) aplica o mesmo efeito. [H]
- **Medir o passo que prende, não o checklist.** A taxa de conclusão do checklist pode subir sem a ativação subir junto. [E/H] [The Decision Lab](https://thedecisionlab.com/guides/how-behavioral-science-can-improve-customer-onboarding)
- **Notificações.** O Duolingo otimizou o lembrete com um algoritmo de bandit e ganhou +2% de retenção de novos usuários e +0,5% de usuários ativos por dia. [E] [Yancey & Settles, KDD 2020](https://research.duolingo.com/papers/yancey.kdd20.pdf). A taxa mediana de quem aceita notificações no iOS foi cerca de 49% em 2025 e no Android 53%. [E] [Airship 2026](https://www.airship.com/resources/mobile-app-push-notification-benchmarks-2026/), via resumo. Conclusão: pedir permissão no momento de valor ("avisar 7 dias antes da V10?") e não na abertura. [H]
- **Estado vazio que ensina.** Um estado vazio deve trazer uma ação clara e um exemplo do resultado, nunca só "nada aqui". [E] [Nielsen Norman Group](https://www.nngroup.com/articles/empty-state-interface-design/)

## 4. Motion e microinteração

- **Princípio atual:** movimento com função (de onde veio, o que mudou, confirmação), por molas e interrompível. Apple e Google convergem nisso. [E] [WWDC23 "Animate with springs"](https://developer.apple.com/videos/play/wwdc2023/10158/) e o [M3 blog](https://m3.material.io/blog/building-with-m3-expressive)
- **View Transitions API.** A versão dentro da mesma página existe desde o Safari 18. A versão entre páginas (`@view-transition { navigation: auto }`) chegou no Safari 18.2, incluindo iOS. [E] [Chrome Developers](https://developer.chrome.com/docs/web-platform/view-transitions) e [caniuse](https://caniuse.com/cross-document-view-transitions). Combina com as transições do Next.js no app (lista do pet → detalhe com `view-transition-name`). Fica ruim em aparelho velho, então precisa de alternativa. [H]
- **Desempenho na WebView:** animar só `transform` e `opacity`, porque o resto força o navegador a recalcular layout e redesenhar. [E] [web.dev](https://web.dev/articles/animations-guide)
- **Hápticos:** no iOS são nativos, via [Capacitor Haptics](https://capacitorjs.com/docs/apis/haptics) (impacto, notificação, seleção). A Apple pede consistência e moderação. [E] [HIG Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics)
- **Acessibilidade.** `prefers-reduced-motion` troca o movimento por um fade, e a Apple recomenda exatamente isso. [E] [HIG Motion](https://developer.apple.com/design/human-interface-guidelines/motion). Para a WebView acompanhar o Dynamic Type, usar `font: -apple-system-body` com tamanhos em `rem`/`em`. [E] [WebKit blog](https://webkit.org/blog/3709/using-the-system-font-in-web-content/)

## 5. Três referências e o que copiar

1. **Apple Saúde (Medicamentos)** [H, observação de uso]
   - Copiar: um estado por item ("tomado/pendente") com cor semântica, a linha do tempo do dia e o registro com um toque.
   - Para o PetLife: o modelo para "vacina em dia/vence em".
2. **Watch Duty** (Apple Design Award 2025, Impacto Social [E] [Apple Newsroom](https://www.apple.com/newsroom/2025/06/apple-unveils-winners-and-finalists-of-the-2025-apple-design-awards/))
   - Copiar: informação crítica sem alarmismo, alertas com contexto e um tom de confiança.
   - Para o PetLife: o tom para lembretes de saúde. [H]
3. **Monzo (finanças)** [H, observação de uso]
   - Copiar: a notificação que confirma uma ação em menos de 1 s, os cartões grandes com um número e uma frase, e a celebração rara e curta.
   - Para o PetLife: a carteirinha no estilo Wallet já segue essa linha.

## O que isso muda para o PetLife

1. **Barra flutuante "vidro" com uma variante opaca (CSS/frontend).** Um único `backdrop-filter` na barra e nas folhas, encolhendo ao rolar, com versão opaca quando a pessoa ativa menos transparência ou aumentar contraste. O conteúdo fica opaco.
2. **Ícone em camadas no Icon Composer (nativo/Xcode).** Variantes clara, escura e tingida, para não destoar na tela inicial do iOS 26.
3. **Checklist "Carteirinha completa" que já começa com um passo feito, medido pelo passo que prende (frontend + medição).** O passo que prende é a primeira vacina registrada, não a conclusão do checklist.
4. **Pedir permissão de notificação depois da primeira vacina, com uma frase de valor (frontend + nativo para a permissão).** Nunca na abertura.
5. **Transição lista → detalhe do pet com View Transitions e fade quando a pessoa reduz movimento (CSS/frontend).** Duração de até 300 ms, só `transform` e `opacity`.
6. **Widget com renderização tingida e Live Activity pronta para CarPlay e Mac (nativo/Swift).** Revisar o widget para o modo "accented" e expor "registrar vacina" como App Intent, que serve para Atalhos, Siri e Controles.
