# Tendências gráficas, motion e programação de interface (2025-2026)

Pesquisa de novembro de 2026. Complementa [design-ux-motion.md](design-ux-motion.md), que já cobre Liquid Glass, Material 3 Expressive, View Transitions básicas, hápticos e `prefers-reduced-motion`. Nada disso se repete aqui. **[E]** = evidência com fonte. **[H]** = hipótese ou leitura nossa. Estado do projeto: `framer-motion ^11.11` no frontend e nenhuma biblioteca de imagem ou de personagem.

## 1. Design gráfico e UI

- **Cansaço do "visual de template de IA".** O movimento é em direção a textura, calor e imperfeição: granulação, papel, traço feito à mão. [E, fontes de agência] [daisyUI: 18 tendências 2026](https://trends.daisyui.com/ui-design-trends-2026/) e [Bubble](https://bubble.io/blog/web-design-trends/). Para o PetLife, um grão leve sobre fundos chapados ajuda a fugir do genérico, desde que seja SVG ou CSS, nunca PNG grande. [H]
- **Bento grid continua, mas só quando o tamanho tem sentido.** Se todos os blocos pesam igual, a hierarquia some. Já há reação a isso (neobrutalismo). [E] [daisyUI](https://trends.daisyui.com/ui-design-trends-2026/). A tela do pet já é um bento natural: o bloco grande é "próxima vacina", os pequenos são peso, vermífugo e família. [H]
- **Vidro com moderação.** Ele voltou, mas usado só onde há camada, não em todo cartão. [E] [Line25](https://line25.com/articles/web-design-trends-2026/). Isso combina com o Liquid Glass (ver o arquivo anterior).
- **Claymorphism e 3D macio.** Volume suave dá personalidade a onboarding e a produto de consumo amigável. [E] [daisyUI](https://trends.daisyui.com/ui-design-trends-2026/). O custo é que exige ilustração própria, porque 3D de banco de imagens denuncia. [H]
- **Tipografia.** Fontes variáveis viraram padrão. Display arredondadas (Nunito, Quicksand, SF Rounded) ficam bem em títulos de app de pet, com texto corrido na fonte do sistema. [H] Uma fonte variável substitui 4 a 6 arquivos estáticos. [E] [web.dev: fontes variáveis](https://web.dev/articles/variable-fonts)
- **Cor.** Neutros quentes de base com um acento vivo saturado. Gradiente de malha em telas de celebração e cartões, nunca atrás de texto longo. [H] O que cansou: gradiente roxo-azul genérico, neumorfismo (contraste fraco) e glassmorphism em tudo. [H]
- **Modo escuro** é esperado. O caminho atual é escrever a paleta em OKLCH e trocar os tokens com `light-dark()`. [E] [MDN light-dark()](https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/light-dark)

## 2. Motion

- **Molas físicas e interrupção** são o padrão (Apple, Google, Motion). Em CSS puro, `linear()` aproxima uma mola sem JS, e funciona desde o Safari 17.2. [E] [MDN linear()](https://developer.mozilla.org/en-US/docs/Web/CSS/easing-function/linear)
- **Scroll-driven animations chegaram ao Safari 26.0.** São `scroll()` e `view()` com `animation-range`. O Safari 26.4 passou essas animações para o compositor, então ficam fluidas mesmo com o JS ocupado. [E] [WebKit: Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/), [guia WebKit](https://webkit.org/blog/17101/a-guide-to-scroll-driven-animations-with-just-css/) e [Interop 2026](https://webkit.org/blog/17818/announcing-interop-2026/). Quem está no iOS 18 não tem, então use `@supports`.
- **Shared element.** Para o mesmo elemento passar de uma tela à outra (foto do pet da lista para o detalhe), use `layoutId` do Motion dentro do app ou `view-transition-name` (ver o arquivo anterior). [E] [Motion: layout](https://motion.dev/docs/react-layout-animations)
- **Microinterações que marcaram:** confete curto ao concluir, número que "rola" ao mudar, botão que encolhe ao toque com mola, ícone que se desenha (traço SVG). [H]
- **Mascote ou personagem, por custo:**

| Opção | Tamanho do runtime | Observação na WebView do iOS |
|---|---|---|
| SVG + CSS/Motion | 0 kB extra | O mais leve. Bom para piscar, abanar o rabo, pulos. [H] |
| lottie-web light (só SVG) | ~38 kB gzip | Sem expressões. Cada JSON tem 20 a 200 kB. [E] [issue lottie-web](https://github.com/airbnb/lottie-web/issues/1184) |
| dotLottie web (WASM, ThorVG) | ~500 kB comprimido | O WASM pode atrasar a primeira pintura, então é preciso hospedar localmente e pré-carregar. [E, fonte secundária] [fórum LottieFiles](https://forum.lottiefiles.com/t/how-to-reduce-dotlottie-initial-rendering-time-due-to-wasm/6802) |
| Rive canvas-lite | 222 kB brotli | Máquina de estados interativa, ótima para um mascote que reage. O `canvas` completo tem 567 kB. [E] [Rive: tamanhos](https://rive.app/docs/runtimes/runtime-sizes) |

## 3. Programação de interface (suporte no Safari/iOS)

- **Motion v12** (pacote `motion`, import `motion/react`) é a continuação do framer-motion, com a mesma API. Com `LazyMotion` + `m`, a primeira renderização fica em ~5 kB. `domAnimation` soma +24 kB e `domMax` (drag e layout) soma +38 kB. Use `strict` para pegar `motion.` acidental. [E] [Motion: reduzir bundle](https://motion.dev/docs/react-reduce-bundle-size)
- **`@property`** (Safari 16.4) torna animável uma variável CSS, o que permite gradientes animados sem JS. [E] [MDN @property](https://developer.mozilla.org/en-US/docs/Web/CSS/@property)

```css
@property --ang { syntax: "<angle>"; inherits: false; initial-value: 0deg; }
.holo { background: conic-gradient(from var(--ang), oklch(85% .15 200), oklch(85% .15 320), oklch(85% .15 200));
        animation: gira 6s linear infinite; }
@keyframes gira { to { --ang: 360deg; } }
@media (prefers-reduced-motion: reduce) { .holo { animation: none; } }
```

- **OKLCH** (Safari 15.4), **`color-mix()`** (16.2; multicor no 27.0), **`contrast-color()`** (26.0, escolhe texto preto ou branco) e **`progress()`** (26.0). [E] [WebKit: Safari 27.0](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/) e [Safari 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/). Com isso dá para gerar tons por espécie a partir de uma cor só: `color-mix(in oklch, var(--acento) 20%, white)`.
- **Container queries** (16.0) e **`:has()`** (15.4) permitem que o cartão do pet se adapte ao espaço que tem e não à tela, e que um formulário com erro mude de estilo sem JS (`form:has(:invalid)`). [E] [MDN container queries](https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_containment/Container_queries)
- **Animação ligada ao scroll** em CSS puro:

```css
@supports (animation-timeline: view()) {
  .card { animation: entra linear both; animation-timeline: view(); animation-range: entry 0% cover 30%; }
}
@keyframes entra { from { opacity: 0; transform: translateY(16px); } }
```

- **Brilho holográfico de cartão.** O caminho barato é um `conic-gradient` com `mix-blend-mode: color-dodge` por cima da carteirinha, com a posição ligada à inclinação do dedo ou do aparelho via variável CSS. [H] WebGL ou WebGPU (WebGPU está no Safari 26.0) só valem para um efeito de vitrine, porque cada contexto custa memória na WebView. [E/H] [WebKit 26.0](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/). O sensor de movimento do iOS pede permissão (`DeviceOrientationEvent.requestPermission()`). [E] [MDN](https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent)

## 4. Imagem compartilhável no aparelho (Stories)

- **html-to-image e html2canvas** recriam o DOM num canvas. No iOS, os erros comuns são imagem em branco por limite de área do canvas (4096×4096 citado pelo mantenedor do html2canvas), fonte que ainda não carregou e SVG que "contamina" o canvas. [E, fonte secundária] [discussão html2canvas](https://lightrun.com/answers/niklasvh-html2canvas-not-working-on-ios-devices)
- **modern-screenshot** é um fork do html-to-image com muitos desses erros corrigidos (`domToBlob`). Ainda assim, teste em iPhone real. [E/H] [modern-screenshot](https://classic.yarnpkg.com/en/package/modern-screenshot)
- **Canvas 2D desenhado à mão** é o mais confiável e o mais leve: 1080×1920, fontes e imagens pré-carregadas, `roundRect()` nativo. Dá mais trabalho, mas o resultado é previsível. [H]
- **Satori/`@vercel/og`** roda no servidor (rota no backend ou no Next). No aparelho o WASM do resvg pesa demais. Faz sentido para links com prévia e não para o botão "compartilhar". [H]
- **Regras práticas:** esperar `await document.fonts.ready`, usar `pixelRatio` 2 (não 3), entregar o arquivo pelo `@capacitor/share` e não por download. [H]

## 5. Acessibilidade e desempenho

- **Reduzir movimento:** no Motion, `<MotionConfig reducedMotion="user">` troca deslocamento por fade de uma vez. [E] [Motion: MotionConfig](https://motion.dev/docs/react-motion-config). **Reduzir transparência:** `prefers-reduced-transparency` ainda não é Baseline [E] [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-transparency), então tenha uma variante opaca acionável pelo app.
- **Contraste:** escrever em OKLCH facilita manter o L (luminosidade) fixo entre tons. Verifique 4.5:1 em texto (WCAG 2.2). [E] [W3C WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- **GPU na WebView:** cada camada composta (`will-change`, `backdrop-filter`, `filter: blur`) ocupa memória de textura. Muitas camadas em iPhone antigo fazem a WebView ser descartada. [H] Use `will-change` só durante a animação e no máximo um `backdrop-filter` por tela.
- **Como medir:** Safari no Mac → Desenvolvedor → iPhone → aba Timelines (quadros por segundo, layout, pintura) e "Mostrar bordas de camadas compostas". [E] [WebKit: Web Inspector](https://webkit.org/web-inspector/timelines-tab/). Meta: 60 fps num iPhone de 3 a 4 anos, e o bundle medido com `next build` + `@next/bundle-analyzer`. [H]

## O que adotar no PetLife

Em ordem de valor por custo.

1. **Tokens de cor em OKLCH + `light-dark()` + `color-mix()`** para os tons por espécie e o modo escuro. 0 kB, só CSS.
2. **Migrar `framer-motion` 11 para `motion` 12 com `LazyMotion strict` + `domAnimation` e `MotionConfig reducedMotion="user"`.** ~5 kB + 24 kB carregados sob demanda, provavelmente menos do que hoje.
3. **Molas em CSS com `linear()` para microinterações simples** (toque em botão, check de vacina), deixando o JS livre. 0 kB.
4. **Brilho holográfico da carteirinha com `@property` + `conic-gradient` + `mix-blend-mode`**, desligado quando a pessoa reduz movimento. 0 kB. Nada de WebGL.
5. **Cartão de Stories com canvas 2D próprio** (ou `modern-screenshot`, ~15 a 20 kB gzip [H], se o layout for complexo), entregue pelo `@capacitor/share`.
6. **Entrada de cartões ligada ao scroll** com `animation-timeline: view()` dentro de `@supports`. 0 kB, só iOS 26+.
7. **Grão sutil em SVG (`feTurbulence`) e display arredondada variável só nos títulos.** Menos de 1 kB de SVG e ~30 a 50 kB de fonte woff2 com subset [H].
8. **Mascote animado: começar em SVG + Motion. Só ir para Rive canvas-lite (222 kB brotli, carregado sob demanda) se o mascote precisar reagir a estados.** Evitar dotLottie (~500 kB de WASM).
