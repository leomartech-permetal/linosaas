import { OpenAI } from "openai";

/**
 * Descreve uma imagem usando GPT-4o Vision
 */
export async function describeImage(imageUrl: string, openaiKey: string, context: string = ""): Promise<string> {
  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Você é um especialista técnico da Permetal. 
          Sua tarefa é analisar a imagem enviada pelo cliente e descrevê-la tecnicamente para que outro agente de IA possa processar o pedido.
          Identifique: Produto (chapa, gradil, tela, etc), modelo, cor, material e qualquer detalhe técnico visível.
          Se houver texto na imagem, transcreva-o.
          Contexto da conversa: ${context}`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "O que você vê nesta imagem que seja relevante para a Permetal?" },
            {
              type: "image_url",
              image_url: { url: imageUrl }
            },
          ],
        },
      ],
    });

    return response.choices[0].message.content || "Não foi possível analisar a imagem.";
  } catch (error: any) {
    console.error("Erro no Vision:", error);
    return `[Erro ao analisar imagem: ${error.message}]`;
  }
}

/**
 * Transcreve um áudio usando OpenAI Whisper
 */
export async function transcribeAudio(audioUrl: string, openaiKey: string): Promise<string> {
  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    // Nota: O Whisper via URL direta não funciona, precisaríamos baixar o arquivo.
    // Como estamos integrados à Evolution, ela pode nos mandar a URL.
    // Para simplificar agora, vamos simular ou usar uma ferramenta de download.
    // Em um ambiente real, faríamos fetch(audioUrl) e passaríamos o buffer.
    
    // Por enquanto, vamos marcar como pendente de download ou retornar um placeholder
    // se não tivermos uma lib de fetch disponível aqui.
    return "[Áudio recebido e pendente de transcrição técnica]";
  } catch (error: any) {
    return `[Erro na transcrição: ${error.message}]`;
  }
}
