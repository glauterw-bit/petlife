# Política de Privacidade — PetLife

**Última atualização:** 10 de maio de 2026

Esta Política de Privacidade explica como o PetLife ("nós", "nosso") coleta, usa, armazena e compartilha dados pessoais quando você usa o aplicativo (iOS, Android e Web). Em conformidade com a Lei Geral de Proteção de Dados (LGPD — Lei 13.709/2018) e diretrizes da Apple App Store.

---

## 1. Dados que coletamos

### 1.1 Dados de cadastro
- Nome completo
- E-mail
- Telefone (opcional)
- Senha (armazenada como hash bcrypt — nunca em texto claro)

### 1.2 Dados sobre o pet
- Nome, espécie, raça, data de nascimento, peso, cor, gênero, castração, microchip
- Histórico de vacinação, exames, anamneses
- Fotos do pet (você decide se anexa)

### 1.3 Dados de localização
- Apenas quando você abre a tela "Buscar clínicas próximas"
- Coletada via API do navegador / iOS apenas em primeiro plano
- Não armazenamos seu histórico de localização — usado em tempo real e descartado

### 1.4 Dados de uso e diagnóstico
- Logs anonimizados de uso para identificar erros e melhorar o app
- Identificador único do dispositivo (Apple IDFV) para análise agregada

### 1.5 O que NÃO coletamos
- Dados bancários
- Conteúdo de mensagens fora do app
- Localização em background
- Contatos do seu celular (a menos que você expressamente queira convidar família como co-tutor)

---

## 2. Como usamos seus dados

- Prover funcionalidades do app (cadastro de pets, lembretes, IA)
- Personalizar análises da IA Vyron com base nas características do seu pet
- Enviar lembretes de vacinação e check-up (push notification)
- Mostrar clínicas próximas via OpenStreetMap (a localização não sai do app)
- Diagnosticar problemas técnicos

---

## 3. Inteligência Artificial

A funcionalidade "Vyron IA" e "Identificar raça por foto" usam o modelo Claude da Anthropic. Quando você usa esses recursos:

- O conteúdo da sua pergunta e/ou foto é enviado para a Anthropic via API criptografada
- A Anthropic processa e retorna a resposta, sem usar seus dados para treinar modelos
- Não anexamos seu nome ou e-mail à requisição — apenas contexto do pet

Mais informações: https://www.anthropic.com/legal/privacy

---

## 4. Compartilhamento de dados

- **Nunca vendemos seus dados.**
- Compartilhamos com Anthropic apenas o estritamente necessário para a funcionalidade de IA.
- Não compartilhamos com anunciantes.
- Quando você compartilha sua carteirinha de vacinação (botão WhatsApp/link), apenas o pet específico fica acessível via URL pública verificável — o restante da sua conta permanece privado.

---

## 5. Seus direitos (LGPD)

Você pode:
- Solicitar uma cópia de todos os seus dados
- Corrigir dados incorretos
- Solicitar exclusão da sua conta e de todos os dados associados
- Revogar consentimento a qualquer momento

Como exercer: envie e-mail para **glauterw@gmail.com** com assunto "Direitos LGPD". Respondemos em até 15 dias.

---

## 6. Retenção e segurança

- Dados armazenados em banco Postgres com backup automático (Railway)
- Comunicação 100% HTTPS/TLS
- Senhas armazenadas como hash bcrypt
- Tokens JWT com expiração de 7 dias
- Acesso administrativo restrito ao desenvolvedor responsável

Se você apagar a conta, todos os dados são removidos em até 30 dias.

---

## 7. Crianças

O PetLife não é destinado a menores de 13 anos. Se você é responsável legal e identificou que uma criança usa o app, entre em contato para exclusão.

---

## 8. Alterações nesta política

Pequenas alterações: aviso no app. Alterações materiais: notificação por e-mail + tela de aceite no próximo login.

---

## 9. Contato

**Responsável pelos dados (DPO informal):** Glauter Wanderson Ferreira Correia
**E-mail:** glauterw@gmail.com
**País:** Brasil

---

Ao usar o PetLife, você concorda com esta Política de Privacidade.
