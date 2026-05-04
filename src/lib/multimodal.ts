import { OpenAI } from "openai";

/**
 * Obtém o Base64 de uma mídia da Evolution API
 */
async function getBase64FromEvolution(baseUrl: string, instance: string, apiKey: string, messageId: string, remoteJid: string): Promise<string> {
  const url = `${baseUrl.endsWith('/') ? baseUrl : baseUrl + '/'}chat/getBase64FromMediaMessage/${instance}`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'apikey': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        key: {
          remoteJid: remoteJid,
          fromMe: false,
          id: messageId
        }
      },
      convertToMp4: false
    })
  });

  if (!response.ok) throw new Error(`Falha ao obter base64: ${response.statusText}`);
  const data = await response.json();
  return data.base64; // Evolution retorna { base64: "..." }
}

/**
 * Descreve uma imagem usando GPT-4o Vision com as regras técnicas da Permetal
 */
export async function describeImage(
  baseUrl: string, 
  instance: string, 
  apiKey: string, 
  messageId: string, 
  remoteJid: string, 
  openaiKey: string, 
  context: string = "",
  mediaBase64: string | null = null
): Promise<string> {
  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const base64 = mediaBase64 || await getBase64FromEvolution(baseUrl, instance, apiKey, messageId, remoteJid);
    const cleanBase64 = base64.replace(/^data:.*;base64,/, '');

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content: `Você é LINO, assistente comercial do Grupo Permetal. 
          Objetivo: extrair dados para COTAÇÃO técnicos da imagem.
          
          REGRAS DE MARCA:
          - Se for piso/degrau/grade de piso => MARCA: "METALGRADE"
          - Se for fachada/brise/forro/painel => MARCA: "PSA"
          - Se for chapas perfurada/expandida/recalcada/moeda => MARCA: "PERMETAL"
          - Se tipo_cliente=pessoa física e baixa quantidade => MARCA: "PERMETAL EXPRESS"
          
          DADOS A EXTRAIR: produto, padrão (oblongo/redondo/moeda), medidas, material, espessura, quantidade e empresa.
          
          Contexto da conversa: ${context}`
        },
        {
          role: "user",
          content: [
            { type: "text", text: "Descreva tecnicamente os produtos nesta imagem seguindo as regras de marca da Permetal." },
            {
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${cleanBase64}` }
            },
          ],
        },
      ],
    });

    return response.choices[0].message.content || "Imagem analisada.";
  } catch (error: any) {
    console.error("Erro Vision:", error);
    return `[Erro ao processar imagem: ${error.message}]`;
  }
}

/**
 * Transcreve áudio usando Whisper
 */
export async function transcribeAudio(
  baseUrl: string, 
  instance: string, 
  apiKey: string, 
  messageId: string, 
  remoteJid: string, 
  openaiKey: string,
  mediaBase64: string | null = null
): Promise<string> {
  const openai = new OpenAI({ apiKey: openaiKey });

  try {
    const base64 = mediaBase64 || await getBase64FromEvolution(baseUrl, instance, apiKey, messageId, remoteJid);
    const cleanBase64 = base64.replace(/^data:.*;base64,/, '');
    const audioBuffer = Buffer.from(cleanBase64, 'base64');
    
    const file = new File([audioBuffer], "audio.ogg", { type: "audio/ogg" });

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "pt"
    });

    return transcription.text;
  } catch (error: any) {
    console.error("Erro Whisper:", error);
    return "[Áudio recebido, erro na transcrição]";
  }
}
