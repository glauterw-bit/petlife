# Crescimento e receita: estado da arte (novembro de 2026)

Pesquisa de 02/11/2026. Complementa `docs/estrategia-2026-11.md` sem repetir o que já está lá. [E] = evidência com fonte; [H] = hipótese ou leitura nossa. Dados de ASO vêm quase todos de fornecedores (AppTweak, Mobile Action): indicam direção, não são medições independentes.

## 1. ASO: o que mudou e o que move ranking

| Mudança | Data | O que é | Fonte |
|---|---|---|---|
| Custom Product Pages (CPP) na busca orgânica | WWDC25 (jun/2025) | [E] Você liga palavras-chave a uma CPP e, quando o app aparece na busca por elas, a loja mostra essa página em vez da padrão. Segundo fornecedores, a ligação não passa por revisão | [Mobile Action](https://www.mobileaction.co/blog/wwdc-2025-updates/), [Adapty](https://adapty.io/blog/custom-product-pages-app-store/) |
| Limite de CPP sobe de 35 para 70 | 29/10/2025 | [E] | [Mobile Action](https://www.mobileaction.co/blog/apple-doubles-the-custom-product-page-limit/) |
| Tags geradas por IA na App Store | WWDC25 | [E] A Apple gera as tags com um modelo de linguagem e editores revisam. O desenvolvedor só pode desmarcar. Não se sabe se o texto das capturas entra no cálculo | [AppTweak](https://www.apptweak.com/en/aso-blog/apple-wwdc-2025-recap) |
| Mais anúncios na busca (Apple Ads) | 03/03/2026, iOS 26.2+ | [E] Anúncios novos aparecem misturados aos resultados orgânicos, além do anúncio do topo. A Apple diz que ~65% dos downloads vêm logo depois de uma busca | [Search Engine Land](https://searchengineland.com/apple-will-add-more-app-store-search-ads-466424), [AppleInsider](https://appleinsider.com/articles/25/12/18/more-ads-are-coming-to-the-app-store-in-2026) |
| Resumo das avaliações por IA | iOS 18.4 (mar/2025), começou só em inglês nos EUA | [E] Só aparece quando o app tem avaliações suficientes. O Google Play teria lançado algo igual em out/2025 | [TechCrunch](https://techcrunch.com/2025/03/05/apple-adds-ai-powered-app-review-summaries-with-ios-18-4/), [Inventiv](https://inventiv.io/apples-ai-review-summaries-put-your-worst-bugs-on-display/) |
| Google Play: "Ask Play" (Gemini) na página do app | dez/2025 em diante | [E] A IA responde perguntas com base na descrição da loja e no site do app | [AppTweak](https://www.apptweak.com/en/aso-blog/google-i-o-2026-aso-updates) |

**O que mais move ranking hoje**
- [E] App Store: palavras no título, subtítulo e campo de palavras-chave, mais o volume e a conversão de downloads. Segundo relatório da AppTweak, apps com nota abaixo de 3,5 aparecem pior nas buscas ([AppTweak via FoxData](https://foxdata.com/en/blogs/app-store-ratings-reviews-complete-aso-guide-2026/)).
- [E] Google Play: a descrição curta e a longa contam como texto de busca. O Google diz que a qualidade do app pesa no ranking, e fornecedores afirmam que retenção e Android Vitals (travamentos, ANR) pesam cada vez mais ([AppRadar](https://appradar.com/academy/aso-basics/app-store-ranking-factors), [Moburst](https://www.moburst.com/blog/aso-for-google-play-the-complete-ranking-strategy-guide/)).
- [E] Página da loja personalizada por palavra-chave no Google Play: +26% de conversão orgânica num caso publicado ([M&C Saatchi](https://www.mcsaatchiperformance.com/news/apple-changed-aso-wwdc25/)). É um caso só.
- [E] Eventos no app (in-app events): num caso de 2021, impressões e primeiros downloads subiram mais de 50% enquanto o evento durou e voltaram ao normal depois ([Phiture](https://phiture.com/asostack/in-app-events/)). O nome e a descrição curta do evento parecem entrar na busca ([AppTweak](https://www.apptweak.com/en/aso-blog/what-are-in-app-events-how-do-they-impact-aso)).

## 2. Viralidade e indicação

| Referência | Número | Fonte |
|---|---|---|
| Coeficiente viral (K: quantos novos usuários cada usuário traz) em produto de consumo | [E] 0,15–0,25 é bom; 0,4, ótimo; ~0,7, excepcional (regra prática) | [Clarity.fm](https://clarity.fm/questions/1830/answers/25859/share) |
| Apps móveis com K mensurável | [E] Só 30% da amostra tinha K; entre eles, a mediana foi 0,45 (estudo antigo, data não confirmada) | [Saxifrage](https://www.saxifrage.xyz/post/k-factor-benchmarks) |
| Dropbox: recompensa para os dois lados | [E] 500 MB para quem convida e para quem entra; de 100 mil para 4 milhões de usuários em 15 meses | [SaaSquatch](https://www.referralsaasquatch.com/dropbox-customer-referral-program-by-the-numbers) |

- [H] Para um app utilitário de saúde do pet, um K realista fica entre 0,1 e 0,3. O que mais rende é o compartilhamento que já faz parte do uso (enviar a carteirinha ao hotel, ao veterinário ou ao adotante).
- [E] Não achamos dado público de 2025-2026 que compare prévia de link (imagem e título no WhatsApp) com recompensa para os dois lados em apps de assinatura.

## 3. Assinaturas: números de referência

| Métrica | Saúde e fitness | Geral / América Latina | Fonte |
|---|---|---|---|
| Teste grátis → pagante | [E] 37,7% (mediana); quartil superior acima de 51,4% | [E] Geral 25,5%–42,5% conforme a duração do teste; América Latina ~20–23% | [RevenueCat 2026](https://www.revenuecat.com/state-of-subscription-apps) |
| Teste grátis → pagante (outra base) | [E] 35,0%, a maior entre as categorias | [E] Geral 25,6% | [Adapty 2026](https://adapty.io/state-of-in-app-subscriptions-2026) |
| Download → pagante em 35 dias | [E] 2,9% (mediana) | [E] América Latina 1,5% | [RevenueCat 2026](https://www.revenuecat.com/state-of-subscription-apps) |
| Duração do teste | [E] 54% dos testes da categoria têm 5–9 dias | [E] Mediana: 25,5% (≤4 dias), 37,4% (5–9 dias), 42,5% (17–32 dias) | [RevenueCat 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026) |
| Cancelamento no dia 0 | — | [E] 55,4% nos testes de 3 dias; 39,8% nos de 7 dias | [RevenueCat 2026](https://www.revenuecat.com/state-of-subscription-apps) |
| Anual vs. mensal | [E] Plano anual = 60,6% da receita da categoria (a única em que o anual domina); preço típico ~US$ 9,99/mês e ~US$ 39,94/ano | [E] América Latina: o plano semanal é o mais comum (29%) | [Adapty](https://adapty.io/state-of-in-app-subscriptions-2026), [RevenueCat](https://www.revenuecat.com/state-of-subscription-apps) |
| Paywall obrigatório vs. freemium | — | [E] Conversão em 35 dias: 10,7% vs. 2,1%. Receita por instalação em 60 dias: US$ 3,09 vs. 0,38. Retenção anual parecida (27% vs. 28%) | [RevenueCat 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026) |
| Quando o teste começa | [E] 82,1% no dia 0 | [E] 89,4% no dia 0 | [RevenueCat](https://www.revenuecat.com/state-of-subscription-apps), [Adapty](https://adapty.io/state-of-in-app-subscriptions-2026) |
| Falha de cobrança | — | [E] 31% dos cancelamentos no Google Play vs. 14% na App Store | [RevenueCat 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026) |

- [E] Nenhum relatório separa o Brasil.
- [H] O teste de 7 dias do PetLife está na faixa mais comum da categoria. Como quase todo teste começa no dia 0, o paywall no primeiro uso é o momento que decide a receita.

## 4. Regras de Apple e Google (2025-2026)

| Regra | Situação em nov/2026 | Fonte |
|---|---|---|
| **Apple no Brasil** (acordo com o CADE) | [E] Em vigor desde 18/06/2026, no iOS 26.5+. Com a compra da Apple: 21% de comissão + 5% de processamento. Com processador de pagamento de terceiros: 21%, e a compra pela Apple tem de ser oferecida junto. Com link para compra fora do app: 15% sobre compras feitas até 7 dias depois do toque. A taxa cai para 10% no Small Business Program e nas assinaturas a partir do 2º ano. Lojas alternativas pagam 5% (Core Technology Commission). Menores de 18 anos precisam de trava para os pais. Apps da categoria infantil não podem ter link de compra | [9to5Mac](https://9to5mac.com/2026/06/18/apple-announces-major-app-store-changes-for-brazil-including-alternative-app-marketplaces/) |
| Google Play: pagamentos e links externos (acordo com a Epic) | [E] Valem para EUA, Europa e Reino Unido, não para o Brasil. Taxa de 10% em assinaturas. Desde 22/07/2026 é obrigatório declarar as transações | [Google](https://support.google.com/googleplay/android-developer/answer/15582165?hl=en), [TechCrunch](https://techcrunch.com/2026/03/04/google-settles-with-epic-games-drops-its-Play-Store-commissions-to-20/) |
| Teste fechado para conta pessoal nova | [E] Vale para contas pessoais criadas depois de 13/11/2023: no mínimo 12 testadores inscritos sem interrupção por 14 dias, e quem sai e volta reinicia a contagem. A análise leva ~7 dias e pode negar por "engajamento insuficiente". A página oficial não fala em flexibilização. Fontes de terceiros dizem que contas de organização (com D-U-N-S) ficam fora da regra | [Google](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), [Choicely](https://www.choicely.com/blog/google-play-12-tester-rule) |

## O que isso muda para o PetLife

1. **CPP por palavra-chave**: criar 2 a 3 páginas personalizadas ("carteirinha de vacinação", "caderneta do pet", "viagem com pet / PDF") e ligar cada palavra a uma só página. Não precisa de build. Número: conversão de impressão em download por página.
2. **Evento no app mensal** com palavra de busca no nome (ex.: "Campanha antirrábica 2026"). Número: impressões no período do evento contra a base de 91/dia.
3. **Antes de pagar Apple Ads**: com os anúncios novos no meio da busca, os primeiros resultados orgânicos ficam mais disputados. Testar US$ 5–10/dia só nos termos exatos de marca e de categoria, e medir o custo por teste iniciado. [H]
4. **Manter o teste de 7 dias e o plano anual em destaque**: é o padrão de saúde, e o anual responde por 60,6% da receita da categoria. Medir teste → pagante contra 37,7%, sabendo que a América Latina fica perto de 20–23%.
5. **Android: pensar em migrar para conta de organização (CNPJ com D-U-N-S)**, que segundo terceiros dispensa os 12 testadores. Confirmar no Play Console antes de mudar. [H]
6. **Link de compra fora do app no Brasil**: no Small Business Program, a diferença é pequena (10% vs. 15% com a compra pela Apple), e o link puxa trava para menores e exige que a compra pela Apple continue no app. Não vale construir agora. Rever quando a receita justificar. [H]
