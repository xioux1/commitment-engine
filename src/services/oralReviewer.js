'use strict';

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `Eres un examinador oral de IA inmersivo en un entorno de revisión en realidad virtual.
Tu rol es evaluar el dominio conceptual del estudiante a través de preguntas orales.

Características de tu estilo:
- Sé directo y claro en tus preguntas
- Evalúa la comprensión profunda, no la memorización
- Da feedback constructivo y específico
- Usa un tono profesional pero accesible
- Detecta si la respuesta es superficial, incorrecta o acertada

Cuando evalúas una respuesta, analiza:
1. Precisión técnica (¿es correcto?)
2. Profundidad conceptual (¿entiende el "por qué"?)
3. Claridad de comunicación (¿lo explica bien?)

Responde SIEMPRE en el idioma del usuario (español si habla en español, inglés si habla en inglés).`;

async function generateQuestions(topic, count = 3) {
  const stream = client.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Genera exactamente ${count} preguntas de examen oral sobre el tema: "${topic}".

Reglas:
- Las preguntas deben ir de menor a mayor dificultad
- Cada pregunta debe requerir una respuesta de 30-90 segundos hablados
- Las preguntas deben evaluar comprensión, no memorización

Responde ÚNICAMENTE con JSON válido en este formato exacto:
{
  "questions": [
    {"id": 1, "text": "pregunta aquí", "difficulty": "basico|intermedio|avanzado"},
    {"id": 2, "text": "pregunta aquí", "difficulty": "intermedio"},
    {"id": 3, "text": "pregunta aquí", "difficulty": "avanzado"}
  ]
}`,
      },
    ],
  });

  const message = await stream.finalMessage();
  const text = message.content.find((b) => b.type === 'text')?.text || '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse questions from AI response');

  return JSON.parse(jsonMatch[0]).questions;
}

async function evaluateAnswer(question, answer, topic) {
  const stream = client.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 1024,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'high' },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Tema del examen: "${topic}"

Pregunta: "${question}"

Respuesta del estudiante: "${answer}"

Evalúa esta respuesta oral. Responde ÚNICAMENTE con JSON válido:
{
  "score": <número entre 0 y 100>,
  "level": "insuficiente|basico|bueno|excelente",
  "feedback": "<feedback específico de 2-3 oraciones>",
  "correct_points": ["<punto correcto 1>", "<punto correcto 2>"],
  "missing_points": ["<concepto faltante 1>"],
  "model_answer_hint": "<pista de la respuesta ideal en 1 oración>"
}`,
      },
    ],
  });

  const message = await stream.finalMessage();
  const text = message.content.find((b) => b.type === 'text')?.text || '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Failed to parse evaluation from AI response');

  return JSON.parse(jsonMatch[0]);
}

async function generateSessionSummary(topic, questionsWithEvals) {
  const stream = client.messages.stream({
    model: 'claude-opus-4-7',
    max_tokens: 512,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: `Genera un resumen ejecutivo del examen oral sobre "${topic}".

Resultados por pregunta:
${questionsWithEvals
  .map(
    (q, i) =>
      `${i + 1}. "${q.question}" → Score: ${q.evaluation.score}/100 (${q.evaluation.level})`,
  )
  .join('\n')}

Promedio: ${Math.round(questionsWithEvals.reduce((s, q) => s + q.evaluation.score, 0) / questionsWithEvals.length)}/100

Responde con JSON válido:
{
  "overall_assessment": "<evaluación global en 2 oraciones>",
  "strongest_area": "<área más fuerte>",
  "improvement_area": "<área a mejorar>",
  "recommendation": "<recomendación de estudio específica>"
}`,
      },
    ],
  });

  const message = await stream.finalMessage();
  const text = message.content.find((b) => b.type === 'text')?.text || '';

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { overall_assessment: 'Sesión completada.', strongest_area: '', improvement_area: '', recommendation: '' };

  return JSON.parse(jsonMatch[0]);
}

module.exports = { generateQuestions, evaluateAnswer, generateSessionSummary };
