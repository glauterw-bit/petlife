# Estratégia do PetLife — novembro de 2026

Base: diagnóstico de agosto (gargalo é distribuição) e pesquisa de mercado de 02/11/2026. [E] = evidência com fonte; [H] = hipótese.

## Onde estamos

- Cerca de 7 downloads por dia, 98% pela busca da App Store no Brasil. Só 5 avaliações.
- Queda de 33% nas impressões desde 26/10, provavelmente pela troca de palavra-chave da 1.2.11. A 1.2.12 (enviada em 02/11) devolve "caderneta". Medir 7 dias após ir ao ar contra 91 impressões/dia.
- Android, a maior parte do mercado, segue travado no teste fechado do Google.

## O mercado

- [E] Mais de 10 apps novos de carteirinha de pet entraram na loja em 2026. Os maiores: Flockr (4,87, 1.093 avaliações, 10 mil+ no Android) e Petzillas (4,91, 100 mil+ no Android).
- [E] O que os tutores mais reclamam nos concorrentes: limite de registros, paywall em dados de saúde e falta de PDF para viagem. O PetLife já resolve os três; isso precisa aparecer na loja.
- [E] Nenhum app de pet publica dado de viralidade. O único canal com escala comprovada é o B2B2C (PetDesk: clínica paga, tutor usa grátis).
- [E] Hotéis e creches exigem carteirinha no check-in (antirrábica dentro do prazo, V8/V10).
- [H] Apps novos juntam as primeiras 5 a 7 avaliações em poucos dias pedindo à própria rede.

## Apostas, em ordem

| # | Aposta | Número que deve mudar | Quem faz | Precisa de build? |
|---|---|---|---|---|
| 1 | Medir a 1.2.12 e ajustar palavras-chave | Impressões/dia (base 91) | aso-growth | Não |
| 2 | **"Apto para hospedagem"**: o hotel ou a creche cadastra as exigências uma vez, o tutor manda o link e o estabelecimento vê verde ou vermelho por item, sem instalar nada. Página pública com "baixe o PetLife" e origem rastreada. | Instalações vindas de link público | produto → ux, design, backend, frontend, qa, revisor | Não |
| 3 | Avaliações reais: pedir a tutores ativos (convite que já existe no app + mensagem no suporte). Sem incentivo, que a Apple proíbe. | Nº de avaliações (base 5) | aso-growth, ux | Não |
| 4 | Kit adoção: a ONG fotografa a carteirinha, gera link de transferência e o adotante recebe o pet com as vacinas. Funciona pela web também no Android. | Pets criados por transferência | produto → backend, frontend | Não |
| 5 | IA atual: trocar para a família Claude atual e ligar cache de prompt | Custo/mês e acerto da leitura | ia | Não |
| 6 | Android: completar 12 testadores por 14 dias e pedir produção | Testadores ativos | dono + aso-growth | Não |
| 7 | Carteirinha pelo WhatsApp (foto → link e lembretes) para quem não tem o app. Checar custo da API antes. | Cadastros sem app | pesquisa → backend, ia | Não |

Regra: uma aposta por vez em produção, medida em 7 dias, antes de abrir a próxima.

## Atualização com a base de conhecimento (02/11/2026)

Fontes: `docs/conhecimento/` (mercado-global, crescimento-e-receita, design-ux-motion, ia-e-claude, engenharia-e-qualidade).

O que muda nas apostas:

- **Novo, risco alto (engenharia):** a documentação do Capacitor diz que `server.url` (o app carregar o site remoto) não é para produção; há relatos de recusa da Apple pela regra 4.2 e o app abre em branco se o servidor cair. Primeiro passo barato: tela local de "sem conexão" com a carteirinha guardada no aparelho. Depois avaliar empacotar o frontend no app.
- **Android pode destravar por outro caminho:** conta de organização no Google Play (com D-U-N-S) fica fora da regra dos 12 testadores, segundo fontes de terceiros — confirmar no Play Console. O dono tem CNPJ (ver memória de financiamento), então isso pode valer mais que juntar testadores.
- **"Apto para hospedagem" ganha reforço:** o Boop (Reino Unido, 2025) faz o veterinário confirmar a vacina e o tutor enviar o certificado. Juntar as duas ideias: o hotel vê verde/vermelho e, quando a clínica confirmou, um selo "confirmada pela clínica".
- **Viagem:** regras oficiais pedindo documento digital cresceram (UE desde 22/04/2026, CDC nos EUA). Um checklist de viagem com o pet é aposta nova e barata no frontend.
- **ASO:** páginas personalizadas (CPP) já aparecem na busca orgânica ligadas a palavras-chave (até 70). Criar CPPs para "caderneta", "antirrábica" e "viagem".
- **IA:** trocar para Haiku 5.5 (Vyron e suporte) e Sonnet 5.5 (carteirinha e análises), com cache; custo estimado cai de ~US$ 35 para US$ 10–15/mês para 200 usuários (estimativa, não medido). Plano passo a passo em `ia-e-claude.md`.
- **Receita:** em saúde, ~38% dos testes grátis viram assinatura no mundo, mas ~20–23% na América Latina; teste de 7 dias está na faixa comum. Pagamento fora da Apple no Brasil (desde 18/06/2026) não compensa agora com o Small Business Program.
- **Não fazer:** coleira inteligente e marketplace (capital e operação que um time de 1 pessoa não sustenta).
