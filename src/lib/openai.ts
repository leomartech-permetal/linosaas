import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'fake-key',
});

/**
 * Motor principal da Fase 4.
 * Extrai as variáveis críticas do cliente usando a IA, atuando como o "Extrator de Contexto".
 */
export async function processLeadWithSkills(message: string) {
  const prompt = `Você é um Extrator de Contexto SDR do Grupo Permetal.
Analise a mensagem do cliente: "${message}"

Extraia os dados em formato JSON com as chaves:
- produto (ex: chapa perfurada, fachada, gradil)
- quantidade (baixa, alta, media)
- instalacao (true ou false - se o cliente precisa de projeto/instalação)
- regiao (ex: SP, RJ, Sul)

Devolva apenas o JSON.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: prompt }],
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  } catch (error) {
    console.error('[OpenAI Error]', error);
    return null;
  }
}
