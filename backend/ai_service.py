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
