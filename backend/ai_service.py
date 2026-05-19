import anthropic
import json
from typing import Optional, List
from database import settings


def get_client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


# Modelo principal — usado nas análises e geração de conteúdo (mais qualidade)
MODEL = "claude-sonnet-4-6"

# Modelo rápido/barato — usado no chat conversacional do tutor (~5x mais barato)
CHAT_MODEL = "claude-haiku-4-5-20251001"


async def analyze_pet_anamnesis(pet_info: dict, anamnesis_data: dict) -> dict:
    """
    Analisa a anamnese de um pet e retorna análise com nível de urgência e recomendações.
    """
    client = get_client()

    pet_description = f"""
    Nome: {pet_info.get('name', 'Desconhecido')}
    Espécie: {'Cão' if pet_info.get('species') == 'dog' else 'Gato'}
    Raça: {pet_info.get('breed_name', 'Sem raça definida')}
    Idade: {pet_info.get('age', 'Desconhecida')}
    Peso: {pet_info.get('weight', 'Não informado')} kg
    Castrado: {'Sim' if pet_info.get('neutered') else 'Não'}
    Gênero: {'Macho' if pet_info.get('gender') == 'male' else 'Fêmea' if pet_info.get('gender') == 'female' else 'Não informado'}
    """

    anamnesis_description = f"""
    Sintomas: {anamnesis_data.get('symptoms', 'Não informado')}
    Duração dos sintomas: {anamnesis_data.get('duration', 'Não informado')}
    Apetite: {anamnesis_data.get('appetite', 'Não informado')}
    Consumo de água: {anamnesis_data.get('water_intake', 'Não informado')}
    Nível de energia: {anamnesis_data.get('energy_level', 'Não informado')}
    Mudanças de comportamento: {anamnesis_data.get('behavior_changes', 'Não informado')}
    Condições anteriores: {anamnesis_data.get('previous_conditions', 'Não informado')}
    Medicações atuais: {anamnesis_data.get('current_medications', 'Não informado')}
    Alergias: {anamnesis_data.get('allergies', 'Não informado')}
    Última visita ao veterinário: {anamnesis_data.get('last_vet_visit', 'Não informado')}
    """

    prompt = f"""Você é um veterinário experiente com mais de 20 anos de prática clínica. Analise a seguinte anamnese de um animal de estimação e forneça uma avaliação preliminar detalhada.

INFORMAÇÕES DO PET:
{pet_description}

ANAMNESE:
{anamnesis_description}

Por favor, forneça sua análise no seguinte formato JSON:
{{
  "urgency_level": "baixa|media|alta|emergencia",
  "urgency_explanation": "Explicação do nível de urgência",
  "possible_conditions": ["lista de possíveis condições"],
  "recommendations": ["lista de recomendações práticas"],
  "warning_signs": ["sinais que exigem atenção imediata"],
  "home_care": ["cuidados que podem ser feitos em casa"],
  "vet_visit_recommended": true/false,
  "vet_visit_timeframe": "imediatamente|nas próximas 24h|nos próximos 3 dias|na próxima semana|check-up de rotina",
  "full_analysis": "Análise completa e detalhada em texto"
}}

IMPORTANTE: Esta análise é apenas orientativa e NÃO substitui uma consulta veterinária presencial. Sempre recomende uma avaliação profissional quando necessário.

Responda APENAS com o JSON válido, sem texto adicional."""

    message = client.messages.create(
        model=MODEL,
        max_tokens=2000,
        messages=[{"role": "user", "content": prompt}],
    )

    response_text = message.content[0].text.strip()

    try:
        analysis = json.loads(response_text)
    except json.JSONDecodeError:
        import re
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            analysis = json.loads(json_match.group())
        else:
            analysis = {
                "urgency_level": "media",
                "urgency_explanation": "Não foi possível determinar automaticamente. Consulte um veterinário.",
                "possible_conditions": [],
                "recommendations": ["Consulte um veterinário para avaliação completa"],
                "warning_signs": [],
                "home_care": [],
                "vet_visit_recommended": True,
                "vet_visit_timeframe": "nos próximos 3 dias",
                "full_analysis": response_text,
            }

    return analysis


async def generate_care_guide(breed_info: dict, pet_info: dict) -> str:
    """
    Gera um guia de cuidados personalizado para a raça e características do pet.
    """
    client = get_client()

    prompt = f"""Você é um especialista em comportamento e saúde animal. Crie um guia de cuidados personalizado e detalhado para o seguinte animal de estimação.

INFORMAÇÕES DA RAÇA:
- Nome: {breed_info.get('name', 'Sem raça definida')}
- Espécie: {'Cão' if breed_info.get('species') == 'dog' else 'Gato'}
- Porte: {breed_info.get('size', 'Não informado')}
- Nível de energia: {breed_info.get('energy_level', 'Não informado')}/5
- Nível de grooming: {breed_info.get('grooming_level', 'Não informado')}/5
- Problemas de saúde comuns: {', '.join(breed_info.get('health_issues', []))}
- Necessidades de exercício: {breed_info.get('exercise_needs', 'Não informado')}
- Temperamento: {', '.join(breed_info.get('temperament', []))}

INFORMAÇÕES DO PET:
- Nome: {pet_info.get('name', 'Desconhecido')}
- Idade: {pet_info.get('age', 'Desconhecida')}
- Peso: {pet_info.get('weight', 'Não informado')} kg
- Castrado: {'Sim' if pet_info.get('neutered') else 'Não'}
- Gênero: {'Macho' if pet_info.get('gender') == 'male' else 'Fêmea' if pet_info.get('gender') == 'female' else 'Não informado'}

Crie um guia completo em português (Brasil) com as seguintes seções:

## 🐾 Guia de Cuidados para {pet_info.get('name', 'Seu Pet')}

### 🍽️ Alimentação
(guia alimentar detalhado para a raça, idade e peso)

### 🏃 Exercícios e Atividades
(rotina de exercícios recomendada)

### 🛁 Higiene e Grooming
(cuidados com pelagem, banho, escovas, etc.)

### 🏥 Saúde Preventiva
(vacinas, vermífugos, consultas, problemas comuns da raça)

### 🧠 Estimulação Mental
(dicas de enriquecimento ambiental)

### 🏠 Ambiente Ideal
(como preparar o ambiente para esse pet)

### 💡 Dicas Especiais
(dicas específicas para essa raça)

Seja específico, prático e use linguagem acessível para donos de pets."""

    message = client.messages.create(
        model=MODEL,
        max_tokens=3000,
        messages=[{"role": "user", "content": prompt}],
    )

    return message.content[0].text


async def generate_walk_routine(pet_info: dict, breed_info: dict) -> dict:
    """
    Gera uma rotina de caminhada estruturada baseada nas características do pet.
    """
    client = get_client()

    prompt = f"""Você é um especialista em comportamento e bem-estar animal. Crie uma rotina de caminhada ideal e personalizada para o seguinte pet.

INFORMAÇÕES DO PET:
- Nome: {pet_info.get('name', 'Desconhecido')}
- Espécie: {'Cão' if pet_info.get('species') == 'dog' else 'Gato'}
- Raça: {breed_info.get('name', 'Sem raça definida')}
- Porte: {breed_info.get('size', 'Médio')}
- Nível de energia: {breed_info.get('energy_level', 3)}/5
- Idade: {pet_info.get('age', 'Adulto')}
- Peso: {pet_info.get('weight', 'Não informado')} kg
- Castrado: {'Sim' if pet_info.get('neutered') else 'Não'}

Forneça a resposta no seguinte formato JSON:
{{
  "frequency_per_day": número de passeios por dia,
  "duration_minutes": duração em minutos de cada passeio,
  "time_slots": ["lista de horários recomendados", ex: "07:00", "17:00"],
  "intensity": "leve|moderada|intensa",
  "notes": "Notas e recomendações gerais sobre a rotina",
  "weekly_plan": {{
    "segunda": "descrição do passeio",
    "terca": "descrição do passeio",
    "quarta": "descrição do passeio",
    "quinta": "descrição do passeio",
    "sexta": "descrição do passeio",
    "sabado": "descrição do passeio (mais longo se possível)",
    "domingo": "descrição do passeio (descanso ou passeio leve)"
  }},
  "tips": ["dica 1", "dica 2", "dica 3"],
  "precautions": ["precaução 1", "precaução 2"],
  "equipment_needed": ["coleira", "guia", "etc"]
}}

Responda APENAS com o JSON válido, sem texto adicional."""

    message = client.messages.create(
        model=MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )

    response_text = message.content[0].text.strip()

    try:
        routine = json.loads(response_text)
    except json.JSONDecodeError:
        import re
        json_match = re.search(r'\{.*\}', response_text, re.DOTALL)
        if json_match:
            routine = json.loads(json_match.group())
        else:
            routine = {
                "frequency_per_day": 2,
                "duration_minutes": 30,
                "time_slots": ["08:00", "17:00"],
                "intensity": "moderada",
                "notes": "Rotina padrão. Ajuste conforme a energia e disposição do seu pet.",
                "weekly_plan": {
                    "segunda": "Passeio de 30 minutos",
                    "terca": "Passeio de 30 minutos",
                    "quarta": "Passeio de 30 minutos",
                    "quinta": "Passeio de 30 minutos",
                    "sexta": "Passeio de 30 minutos",
                    "sabado": "Passeio de 45-60 minutos",
                    "domingo": "Passeio leve de 20 minutos",
                },
                "tips": ["Mantenha sempre água disponível", "Evite horários de sol forte"],
                "precautions": ["Observe sinais de cansaço excessivo"],
                "equipment_needed": ["Coleira", "Guia", "Saquinhos para dejetos", "Água"],
            }

    return routine


async def generate_bedtime_story(pet_info: dict, mood: str = "carinhoso") -> dict:
    """História de 2 min de boa-noite personalizada — Toby tutor leu a noite toda."""
    client = get_client()

    species = "cachorro" if pet_info.get("species") == "dog" else "gato"
    pet_name = pet_info.get("name", "amigo")
    breed = pet_info.get("breed_name", "vira-lata")
    owner = pet_info.get("owner_name", "tutor")
    age_phrase = pet_info.get("age", "")

    mood_map = {
        "carinhoso": "afetuosa, calma, com tom de aconchego",
        "aventura": "cheia de aventuras leves, descobertas pequenas",
        "engraçado": "com humor leve e situações engraçadas próprias de pet",
        "calmo": "muito serena, sons da natureza, sussurros, indicada pra adormecer rápido",
    }
    tone = mood_map.get(mood, mood_map["carinhoso"])

    prompt = f"""Escreva uma história de boa noite curta (2-3 minutos de leitura, ~250-400 palavras) personalizada pra ler pro pet antes de dormir.

PERSONAGEM PRINCIPAL: {pet_name}, um {species} {breed} de {age_phrase}.
TUTOR: {owner}
TOM: {tone}
IDIOMA: Português brasileiro
FORMATO: 4-6 parágrafos curtos, frases simples, ritmo de quem lê em voz baixa.

REGRAS:
- {pet_name} é o herói absoluto da história
- Mencione características da raça {breed} quando natural
- Termine sempre com {pet_name} adormecendo aconchegado(a) e em segurança
- Sem rimas forçadas. Não use emoji
- Não diga "fim" ou "the end" no final — só feche com a imagem do pet dormindo

Apenas a história. Sem título, sem introdução."""

    msg = client.messages.create(
        model=CHAT_MODEL,
        max_tokens=900,
        messages=[{"role": "user", "content": prompt}],
    )
    text = msg.content[0].text.strip()
    return {"story": text, "pet_name": pet_name, "mood": mood}


async def generate_story_caption(image_b64: str, image_media_type: str, pet_info: dict) -> dict:
    """Gera caption tipo Instagram pra foto do pet + detecta emoção visível."""
    client = get_client()
    pet_name = pet_info.get("name", "pet")
    species = "cão" if pet_info.get("species") == "dog" else "gato"

    prompt = f"""Olhe esta foto de {pet_name}, um {species}, e gere uma caption curta e carismática em pt-BR (estilo Instagram pet, ~80-120 chars). NÃO use emojis no texto da caption — eles vão num campo separado.

Responda APENAS com JSON válido:
{{
  "caption": "Caption curta, divertida, em primeira pessoa do pet ou narrativa carinhosa do tutor.",
  "emotion": "alegre"|"curioso"|"sonolento"|"travesso"|"observador"|"relaxado"|"atento"|"brincalhao",
  "emoji_suggestions": ["3-4 emojis que combinam"],
  "hashtag_suggestions": ["3-5 hashtags pt-BR sem # — ex: vidadecachorro, gatospetlife"]
}}"""

    msg = client.messages.create(
        model=CHAT_MODEL,  # Haiku tem visão e é barato
        max_tokens=400,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": image_media_type, "data": image_b64}},
                {"type": "text", "text": prompt},
            ],
        }],
    )
    text = msg.content[0].text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        import re
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            return json.loads(m.group())
        return {"caption": f"{pet_name} aproveitando o dia!", "emotion": "alegre", "emoji_suggestions": ["🐾"], "hashtag_suggestions": []}


async def analyze_behavior_patterns(pet_info: dict, logs: list[dict]) -> dict:
    """Analisa N dias de behavior logs e detecta padrões + alerta sinais clínicos."""
    if not logs:
        return {"summary": "Sem dados suficientes ainda. Registre pelo menos 7 dias.", "patterns": [], "alerts": []}

    client = get_client()
    pet_name = pet_info.get("name", "Pet")
    species = "cão" if pet_info.get("species") == "dog" else "gato"

    logs_summary = "\n".join([
        f"{l.get('logged_at', '')}: humor={l.get('mood')}, energia={l.get('energy')}, "
        f"apetite={l.get('appetite')}, água={l.get('water_intake')}, fezes={l.get('stool_quality')}, "
        f"atividade={l.get('activity_minutes')}min"
        + (f", notas: {l.get('notes')}" if l.get('notes') else "")
        for l in logs[-30:]
    ])

    prompt = f"""Você é um veterinário analisando o diário de bem-estar de {pet_name}, um {species}.

LOGS ({len(logs)} dias):
{logs_summary}

Detecte padrões clinicamente relevantes (ex: apetite reduzido 5 dias seguidos, sede aumentada repetida — pode indicar diabetes, doença renal). Responda APENAS com JSON válido:
{{
  "summary": "Resumo geral em 2-3 frases pt-BR",
  "patterns": [
    {{"observation": "ex: Energia caiu nos últimos 7 dias", "significance": "Pode indicar fadiga, dor ou inicio de doença"}}
  ],
  "trends": {{
    "mood_trend": "estável|melhorando|piorando|variável",
    "energy_trend": "estável|melhorando|piorando|variável",
    "appetite_trend": "estável|melhorando|piorando|variável"
  }},
  "alerts": [
    {{"signal": "ex: Sede aumentada por 5+ dias", "concern": "Diabetes mellitus, insuficiência renal", "severity": "alta", "action": "Consulta veterinária esta semana"}}
  ],
  "recommendations": ["lista curta"],
  "disclaimer": "Padrões observados são orientativos. Diagnóstico médico requer avaliação presencial."
}}"""

    msg = client.messages.create(
        model=MODEL,
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )
    text = msg.content[0].text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        import re
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            return json.loads(m.group())
        return {"summary": "Análise indisponível.", "patterns": [], "alerts": []}


async def generate_memorial_text(pet_info: dict, owner_message: str = "") -> dict:
    """Gera texto carinhoso pra memorial — feature sensível, tom respeitoso."""
    client = get_client()
    pet_name = pet_info.get("name", "amigo")
    species = "cão" if pet_info.get("species") == "dog" else "gato"
    age = pet_info.get("age", "")

    prompt = f"""Você está ajudando um tutor a homenagear um pet querido que faleceu.

PET: {pet_name}, um {species} {age}
MENSAGEM DO TUTOR (opcional): {owner_message or "Não forneceu"}

Gere um texto de memorial em pt-BR, curto (~80-120 palavras), em tom carinhoso e respeitoso, celebrando a vida do pet. Não use clichés como "ponte do arco-íris" a menos que o tutor mencione. Foque no amor compartilhado.

Responda APENAS com JSON válido:
{{
  "memorial_text": "Texto de memorial em pt-BR",
  "epitaph": "Frase curta (~10-15 palavras) pra placa/QR memorial",
  "comfort_message": "Mensagem curta de apoio ao tutor, em 2-3 frases"
}}"""

    msg = client.messages.create(
        model=CHAT_MODEL,
        max_tokens=800,
        messages=[{"role": "user", "content": prompt}],
    )
    text = msg.content[0].text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        import re
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            return json.loads(m.group())
        return {"memorial_text": f"Em memória de {pet_name}, sempre presente em nossos corações.", "epitaph": f"Em memória de {pet_name}", "comfort_message": ""}


async def generate_behavior_plan(pet_info: dict, issue_type: str, intensity: str, context: str = "") -> dict:
    """Gera plano comportamental 6 semanas em pt-BR, baseado em etologia veterinária."""
    client = get_client()
    species = "cão" if pet_info.get("species") == "dog" else "gato"
    pet_name = pet_info.get("name", "Pet")
    age = pet_info.get("age", "adulto")
    breed = pet_info.get("breed_name", "SRD")

    issue_label = {
        "separation_anxiety": "ansiedade de separação",
        "fear": "medo (barulhos, estranhos, objetos)",
        "reactivity": "reatividade (latir, atacar outros pets)",
        "aggression": "agressividade",
        "destruction": "comportamento destrutivo (morder móveis)",
        "barking": "latidos excessivos",
        "cat_litter": "problemas com caixa de areia",
    }.get(issue_type, issue_type)

    prompt = f"""Você é um etólogo veterinário criando um plano comportamental progressivo de 6 semanas pra {pet_name}, um {species} {breed} {age}.

PROBLEMA: {issue_label}
INTENSIDADE: {intensity}
CONTEXTO DO TUTOR:
{context or "Não informado"}

Crie um plano em pt-BR baseado em técnicas de dessensibilização, contracondicionamento e reforço positivo. Princípios: nunca punição, sempre reforço positivo, ritmo respeitando o pet, micro-progressos diários.

Responda APENAS com JSON válido:
{{
  "issue_label": "{issue_label}",
  "summary": "2-3 frases explicando a abordagem do plano em pt-BR",
  "core_principles": ["lista de 4-5 princípios chave (sem punição, reforço positivo, etc)"],
  "warning_signs": ["sinais de que o plano não está funcionando ou pet está pior"],
  "weeks": [
    {{
      "week": 1,
      "focus": "objetivo da semana em 1 frase",
      "daily_exercises": [
        {{"day": 1, "title": "...", "duration_min": 10, "description": "instrução clara em pt-BR"}},
        {{"day": 2, "title": "...", "duration_min": 10, "description": "..."}},
        ...7 dias
      ],
      "milestone": "Sinal de progresso esperado ao final da semana"
    }},
    ...6 semanas no total
  ],
  "tools_needed": ["lista de itens necessários (clicker, snack, brinquedos especificos, etc)"],
  "when_to_seek_help": "Quando o tutor deve procurar etólogo/vet presencial",
  "disclaimer": "Este plano é orientativo. Casos severos requerem acompanhamento de etólogo veterinário presencial."
}}

REGRAS:
- Cada exercício diário deve ser realista (5-20 min)
- Progressão gradual semana a semana
- Use linguagem clara, sem jargão técnico desnecessário
- Adapte a intensidade {intensity}: leve = passos pequenos, alta = passos muito pequenos com mais paciência
- Para gatos, lembre que técnicas são diferentes de cães"""

    msg = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        messages=[{"role": "user", "content": prompt}],
    )
    text = msg.content[0].text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        import re
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            return json.loads(m.group())
        return {"summary": "Erro ao gerar plano.", "weeks": []}


async def generate_petlife_wrapped(pet_info: dict, year_data: dict) -> dict:
    """Recap anual estilo Spotify Wrapped — historia narrativa do ano do pet."""
    client = get_client()
    pet_name = pet_info.get("name", "Pet")

    prompt = f"""Crie um "PetLife Wrapped" estilo Spotify Wrapped pra {pet_name} em {year_data.get('year', 2026)}.

DADOS DO ANO:
- Vacinas tomadas: {year_data.get('vaccines_count', 0)}
- Exames realizados: {year_data.get('exams_count', 0)}
- Anamneses registradas: {year_data.get('anamneses_count', 0)}
- Conversas com IA Vyron: {year_data.get('ai_chats_count', 0)}
- Lembretes configurados: {year_data.get('reminders_count', 0)}
- Desafios completados: {year_data.get('challenges_count', 0)}
- Pontos ganhos: {year_data.get('total_points', 0)}
- Peso registrado: {year_data.get('weights_count', 0)} vezes
- Análises por foto (raça/triagem/dor/fezes): {year_data.get('photo_analyses_count', 0)}
- Mês de mais atividade: {year_data.get('busiest_month', 'desconhecido')}

Responda APENAS com JSON válido:
{{
  "title": "O ano de {pet_name} em {year_data.get('year')}",
  "subtitle": "Frase curta carinhosa de abertura",
  "highlights": [
    {{"emoji": "🎉", "stat": "valor numérico ou label", "label": "descrição curta", "narrative": "frase divertida"}},
    ...5-6 highlights
  ],
  "milestone_of_the_year": "Conquista mais especial do ano em 1-2 frases",
  "personality_tag": "Tag divertida pro pet baseado nos dados (ex: 'O explorador', 'A diva', 'O esportista')",
  "narrative": "Texto narrativo de 3-4 frases contando a história do ano do pet, calorosa e em pt-BR",
  "next_year_wish": "Desejo carinhoso pro próximo ano",
  "share_text": "Texto pronto pra compartilhar no WhatsApp/Instagram, ~120 chars, com emojis"
}}

Tom: caloroso, festivo, divertido, em pt-BR. Trate {pet_name} como protagonista querido."""

    msg = client.messages.create(
        model=CHAT_MODEL,  # Haiku é suficiente, charme não precisa do Sonnet
        max_tokens=1500,
        messages=[{"role": "user", "content": prompt}],
    )
    text = msg.content[0].text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        import re
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            return json.loads(m.group())
        return {"title": f"O ano de {pet_name}", "highlights": [], "narrative": "Wrapped indisponível agora."}


async def assess_pet_pain(image_b64: str, image_media_type: str, pet_info: dict) -> dict:
    """Avaliação de dor por foto facial. Para gatos usa Feline Grimace Scale
    (FGS): 5 unidades de ação (orelhas, órbitas, focinho, bigodes, cabeça).
    Para cães usa Glasgow Composite Measure Pain Scale (canine, adaptado pra foto).
    """
    client = get_client()
    species = pet_info.get("species", "dog")
    is_cat = species == "cat"

    if is_cat:
        prompt = """Você é um veterinário aplicando a Feline Grimace Scale (FGS) nesta foto frontal do gato.

A FGS avalia 5 unidades de ação. Para cada uma, dê nota 0/1/2:
- 0: ausente (sem dor)
- 1: moderadamente presente
- 2: marcadamente presente (dor)
- null: não visível na foto

Responda APENAS com JSON válido:
{
  "image_quality": "ok"|"ruim",
  "image_quality_notes": "Se ruim, explique e pare",
  "scale": "FGS (Feline Grimace Scale)",
  "ears": {"score": 0|1|2|null, "notes": "Posição das orelhas — abertas/laterais/dobradas"},
  "orbitals": {"score": 0|1|2|null, "notes": "Apertura ocular — abertos/semi-fechados/fechados"},
  "muzzle": {"score": 0|1|2|null, "notes": "Tensão do focinho — relaxado/oval/elíptico"},
  "whiskers": {"score": 0|1|2|null, "notes": "Posição dos bigodes — relaxados/curvados/retos"},
  "head_position": {"score": 0|1|2|null, "notes": "Cabeça — acima/em linha/abaixo dos ombros"},
  "total_score": "soma das notas visíveis",
  "max_possible": "número de unidades visíveis × 2",
  "pain_level": "sem dor"|"leve"|"moderada"|"severa",
  "interpretation": "Score ≥4/10 sugere necessidade de analgesia. Explique o achado em 2-3 frases pt-BR.",
  "recommendations": ["lista curta"],
  "disclaimer": "FGS é validada em gatos a partir de fotos frontais. Esta análise é orientativa."
}"""
    else:
        prompt = """Você é um veterinário avaliando sinais de dor em um cão a partir da foto.

Use elementos da Glasgow Composite Measure Pain Scale (canine) adaptados ao que é visível na foto:
- Expressão facial (olhos, focinho, orelhas)
- Postura (relaxada, tensa, encurvada)
- Sinais de proteção corporal (lambendo ou olhando região específica)

Responda APENAS com JSON válido:
{
  "image_quality": "ok"|"ruim",
  "image_quality_notes": "Se ruim, explique e pare",
  "scale": "Glasgow Composite (adaptado de foto)",
  "facial_expression": {"score": 0|1|2|3|null, "notes": "Relaxado a tenso/angustiado"},
  "posture": {"score": 0|1|2|3|null, "notes": "Relaxada a rígida/encurvada"},
  "attention_to_body": {"score": 0|1|2|3|null, "notes": "Sem foco ou olhando/lambendo região"},
  "total_score": "soma",
  "max_possible": "número de itens × 3",
  "pain_level": "sem dor"|"leve"|"moderada"|"severa",
  "interpretation": "Explique o achado em 2-3 frases pt-BR",
  "recommendations": ["lista curta"],
  "disclaimer": "Avaliação por foto é limitada. Apenas orientativa — exame presencial é obrigatório se há suspeita de dor."
}"""

    msg = client.messages.create(
        model=MODEL,
        max_tokens=1200,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": image_media_type, "data": image_b64}},
                {"type": "text", "text": prompt},
            ],
        }],
    )
    text = msg.content[0].text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        import re
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            return json.loads(m.group())
        return {
            "image_quality": "ruim",
            "image_quality_notes": "Não foi possível processar.",
            "pain_level": "sem dor",
            "interpretation": "Análise indisponível.",
            "recommendations": [],
            "disclaimer": "Erro temporário.",
        }


async def analyze_stool_from_image(image_b64: str, image_media_type: str, pet_info: dict) -> dict:
    """Análise de fezes por foto — Bristol-equivalent veterinário (1-7),
    cor, consistência, sinais de alerta visíveis (sangue, muco, parasitas
    macroscópicos).
    """
    client = get_client()
    species = "cão" if pet_info.get("species") == "dog" else "gato"

    prompt = f"""Você é um veterinário avaliando uma foto de fezes de um {species}. Use a escala fecal Purina/Nestlé (1-7) ou WSAVA (1-7).

Responda APENAS com JSON válido:
{{
  "image_quality": "ok"|"ruim",
  "image_quality_notes": "Se ruim, explique e pare",
  "fecal_score": 1-7|null,
  "score_descriptions": {{
    "1": "Fezes duras, secas, em bolinhas — constipação",
    "2": "Cilíndricas mas duras — desidratação leve",
    "3": "Cilíndricas, segmentadas, fáceis de coletar — IDEAL",
    "4": "Cilíndricas, mais úmidas, mas mantêm formato — IDEAL",
    "5": "Muito moles, perdem formato ao coletar",
    "6": "Sem formato, em pilhas",
    "7": "Líquidas, sem forma — diarreia"
  }},
  "ideal_range": "3-4",
  "color": "marrom_claro"|"marrom_escuro"|"amarelo"|"verde"|"preto_alcatrao"|"avermelhado"|"cinza"|"outro",
  "color_notes": "1 frase sobre o que essa cor sugere",
  "alerts": [],
  "alert_examples": "sangue visível, muco, partes brancas (parasitas), corpos estranhos — só inclua se realmente visível",
  "consistency_notes": "1-2 frases sobre o que vê",
  "urgency": "rotina"|"acompanhar"|"vet_agendar"|"vet_urgente",
  "summary": "2-3 frases em pt-BR pro tutor",
  "recommendations": ["lista curta"],
  "disclaimer": "Análise visual por foto não substitui exame parasitológico. Suspeita de sangue, muco persistente ou diarreia > 24h: procure vet."
}}

NUNCA invente o que não está claramente visível. Se imagem ruim, pare em image_quality."""

    msg = client.messages.create(
        model=MODEL,
        max_tokens=1500,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": image_media_type, "data": image_b64}},
                {"type": "text", "text": prompt},
            ],
        }],
    )
    text = msg.content[0].text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        import re
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            return json.loads(m.group())
        return {"image_quality": "ruim", "urgency": "rotina", "summary": "Erro."}


async def generate_soap_note(transcript: str, pet_info: dict, vet_name: str) -> dict:
    """Recebe notas/transcrição de consulta vet e estrutura no formato SOAP
    (Subjetivo, Objetivo, Avaliação, Plano). Acelera prontuário pra B2B vet portal.
    """
    client = get_client()
    species = "cão" if pet_info.get("species") == "dog" else "gato"
    pet_name = pet_info.get("name", "Pet")

    prompt = f"""Você é um veterinário(a) escrevendo prontuário no formato SOAP a partir de notas brutas de consulta.

CONSULTA:
Paciente: {pet_name} ({species}, raça {pet_info.get('breed_name', 'SRD')}, {pet_info.get('age', '')}, {pet_info.get('weight', '')} kg)
Veterinário: {vet_name}
Notas/transcrição:
\"\"\"
{transcript}
\"\"\"

Estruture em SOAP. Responda APENAS com JSON válido:
{{
  "subjective": "Relato do tutor: queixa principal, histórico, evolução, sintomas relatados. Use frases completas em terceira pessoa.",
  "objective": "Achados do exame físico: TPC, mucosas, FC, FR, temperatura se mencionado; palpação; achados visíveis. Use bullets se houver múltiplos achados.",
  "assessment": "Hipóteses diagnósticas ordenadas por probabilidade. Inclua diagnósticos diferenciais.",
  "plan": {{
    "diagnostic": ["exames complementares solicitados"],
    "therapeutic": ["medicações com dose, via, frequência, duração"],
    "preventive": ["vacinas, vermífugos, antipulgas"],
    "recommendations": ["orientações ao tutor"],
    "follow_up": "Retorno em X dias OU se piora"
  }},
  "icd_codes": ["códigos veterinários SNOMED-Vet ou CID quando aplicável"],
  "prescription_summary": "Resumo das medicações em texto curto pra etiqueta de impressão",
  "owner_friendly_summary": "Versão simplificada em 3-4 frases pra mandar pro tutor no WhatsApp"
}}

IMPORTANTE:
- NÃO invente informações que não estão nas notas
- Se um campo está faltando nas notas, deixe vazio ou null
- Mantenha linguagem técnica em S/O/A/P
- owner_friendly_summary deve ser carinhoso e em pt-BR coloquial"""

    msg = client.messages.create(
        model=MODEL,
        max_tokens=2500,
        messages=[{"role": "user", "content": prompt}],
    )
    text = msg.content[0].text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        import re
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            return json.loads(m.group())
        return {"subjective": "", "objective": "", "assessment": "", "plan": {}, "owner_friendly_summary": ""}


async def snapshot_triage_from_image(image_b64: str, image_media_type: str, pet_info: dict) -> dict:
    """Análise rápida (5s) de saúde com foto — BCS, olhos, dental, sinais visíveis.
    NÃO substitui consulta vet — só triagem orientativa.
    """
    client = get_client()
    species = "cão" if pet_info.get("species") == "dog" else "gato"

    prompt = f"""Você é um veterinário fazendo triagem visual rápida de um {species} a partir desta foto.

Avalie SOMENTE o que está visível na imagem. Não invente informações que não dá pra ver.

Responda APENAS com JSON válido:
{{
  "image_quality": "ok" ou "ruim",
  "image_quality_notes": "Se ruim, explique (foto escura, pet parcial, etc) e pare aqui",
  "body_condition_score": null ou número de 1-9 (escala WSAVA),
  "body_condition_notes": "magro/ideal/sobrepeso/obeso + 1 frase",
  "eyes": {{
    "visible": true/false,
    "concerns": ["vermelhidão", "secreção", "opacidade", "etc"] ou [],
    "severity": "nenhuma"|"leve"|"moderada"|"alta"
  }},
  "dental": {{
    "visible": true/false,
    "tartar_level": "nenhum"|"leve"|"moderado"|"grave"|"nao_visivel",
    "concerns": [] ou ["lista"]
  }},
  "skin_coat": {{
    "concerns": [] ou ["queda de pelo", "lesão", "vermelhidão", "etc"],
    "severity": "nenhuma"|"leve"|"moderada"|"alta"
  }},
  "posture_behavior": "Observações visíveis (ex: parece alerta, parece prostrado, lambendo região X)",
  "urgency_tier": "rotina"|"acompanhar"|"agendar_vet"|"vet_urgente",
  "summary": "2-3 frases em pt-BR explicando para o tutor o que vê",
  "recommendations": ["lista curta de ações sugeridas"],
  "disclaimer": "Esta análise é orientativa e baseada apenas na foto. Não substitui exame veterinário presencial."
}}

NÃO invente. NÃO diagnostique doenças específicas. Se imagem ruim, image_quality:"ruim" + pare."""

    msg = client.messages.create(
        model=MODEL,  # Sonnet (vision) — Haiku não tem vision atualmente
        max_tokens=1500,
        messages=[{
            "role": "user",
            "content": [
                {"type": "image", "source": {"type": "base64", "media_type": image_media_type, "data": image_b64}},
                {"type": "text", "text": prompt},
            ],
        }],
    )
    text = msg.content[0].text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        import re
        m = re.search(r'\{.*\}', text, re.DOTALL)
        if m:
            return json.loads(m.group())
        return {
            "image_quality": "ruim",
            "image_quality_notes": "Não foi possível processar a resposta. Tente outra foto.",
            "urgency_tier": "rotina",
            "summary": "Análise não disponível no momento.",
            "recommendations": [],
            "disclaimer": "Esta análise é orientativa.",
        }


async def identify_breed_from_image(image_b64: str, image_media_type: str) -> dict:
    """Recebe imagem em base64 e retorna top 3 candidatos de raça com confiança."""
    client = get_client()

    prompt = """Analise esta foto e identifique a raça do pet (cão ou gato).

Responda APENAS com JSON válido neste formato:
{
  "species": "dog" ou "cat" ou "unknown",
  "candidates": [
    {"breed": "Nome da raça em português brasileiro", "name_en": "English name", "confidence": 0.85, "reasoning": "Por que acredita ser esta raça (1 frase curta)"},
    {"breed": "Segunda opção", "name_en": "...", "confidence": 0.10, "reasoning": "..."},
    {"breed": "Terceira opção", "name_en": "...", "confidence": 0.05, "reasoning": "..."}
  ],
  "is_mixed_likely": true/false,
  "notes": "Observações úteis sobre características visíveis (porte, pelagem, etc)"
}

REGRAS:
- Se não houver pet visível: species="unknown" e candidates=[]
- Use nomes de raça padrão FCI/CFA em português brasileiro (ex.: "Labrador Retriever", "Golden Retriever", "SRD")
- Se for vira-lata/SRD evidente, indique "SRD (Sem Raça Definida)" como primeiro candidato
- Confidence soma ~1.0 nos top 3
- NÃO inclua texto fora do JSON"""

    message = client.messages.create(
        model=MODEL,  # Sonnet 4.6 tem visão e é melhor que Haiku para identificação visual
        max_tokens=800,
        messages=[{
            "role": "user",
            "content": [
                {
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": image_media_type,
                        "data": image_b64,
                    },
                },
                {"type": "text", "text": prompt},
            ],
        }],
    )

    response_text = message.content[0].text.strip()
    try:
        return json.loads(response_text)
    except json.JSONDecodeError:
        import re
        m = re.search(r'\{.*\}', response_text, re.DOTALL)
        if m:
            return json.loads(m.group())
        return {
            "species": "unknown",
            "candidates": [],
            "is_mixed_likely": False,
            "notes": "Não foi possível processar a resposta da IA. Tente outra foto.",
        }


async def chat_with_vet_ai(
    pet_info: Optional[dict],
    question: str,
    conversation_history: Optional[List[dict]] = None,
) -> str:
    """
    Assistente veterinário de IA para responder dúvidas dos tutores.
    """
    client = get_client()

    system_prompt = """Você é o Dr. PetLife, um assistente veterinário virtual especializado em cuidados com cães e gatos.

Suas características:
- Você fala em português brasileiro (pt-BR)
- É empático, paciente e usa linguagem acessível
- Fornece orientações práticas e baseadas em evidências científicas
- SEMPRE lembra que suas orientações não substituem uma consulta veterinária presencial
- Para emergências, sempre recomenda buscar atendimento imediato
- Conhece profundamente medicina veterinária, comportamento animal, nutrição, prevenção e bem-estar

Quando relevante, mencione:
- Sinais de alerta que exigem atenção veterinária imediata
- Cuidados preventivos
- Dicas práticas para o dia a dia
- A importância do acompanhamento veterinário regular"""

    messages = []

    if conversation_history:
        for msg in conversation_history:
            if msg.get("role") in ["user", "assistant"]:
                messages.append({"role": msg["role"], "content": msg["content"]})

    user_message = question
    if pet_info:
        pet_context = f"""[Contexto do pet: {pet_info.get('name', 'Não informado')},
        {'Cão' if pet_info.get('species') == 'dog' else 'Gato'},
        raça {pet_info.get('breed_name', 'Sem raça definida')},
        {pet_info.get('age', 'idade não informada')},
        {pet_info.get('weight', 'peso não informado')} kg,
        {'castrado' if pet_info.get('neutered') else 'não castrado'}]

"""
        user_message = pet_context + question

    messages.append({"role": "user", "content": user_message})

    response = client.messages.create(
        model=CHAT_MODEL,
        max_tokens=1500,
        system=system_prompt,
        messages=messages,
    )

    return response.content[0].text
