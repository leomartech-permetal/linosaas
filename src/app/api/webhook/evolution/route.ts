import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { processLeadWithSkills } from '@/lib/openai';
import { routeLead } from '@/lib/router';
import { handleClientReturn } from '@/lib/support-monitor';
import { sendTextMessage } from '@/lib/evolution-api';
import { describeImage, transcribeAudio } from '@/lib/multimodal';

const WHITELIST_NUMBERS = ['5516991415319', '551635187121', '551699141531', '55163518712'];

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Captura flexível dos dados da mensagem
    const messageData = body.data?.messages?.[0] || body.data;
    const remoteJid = messageData?.key?.remoteJid || messageData?.remoteJid || body.data?.key?.remoteJid || body.sender;
    const messageId = messageData?.key?.id || messageData?.id;

    if (body.event === 'messages.upsert' || body.event === 'MESSAGES_UPSERT') {
      if (!messageData) return NextResponse.json({ status: 'ignored', reason: 'no_data' });

      const fromMe = messageData.key?.fromMe;

      // 1. INTERVENÇÃO HUMANA
      if (fromMe) {
        const { data: leadToPause } = await supabase.from('leads').select('id').eq('whatsapp_number', remoteJid).single();
        if (leadToPause) {
          await supabase.from('leads').update({ bot_active: false }).eq('id', leadToPause.id);
        }
        return NextResponse.json({ status: 'success', reason: 'human_intervention' });
      }

      if (!remoteJid) return NextResponse.json({ status: 'ignored', reason: 'no_remoteJid' });

      // 2. EXTRAÇÃO DE TEXTO
      const messageObj = messageData.message || messageData;
      let messageContent = messageObj?.conversation || 
                           messageObj?.extendedTextMessage?.text || 
                           messageObj?.text ||
                           messageData?.text ||
                           messageObj?.imageMessage?.caption ||
                           messageObj?.videoMessage?.caption ||
                           messageObj?.documentMessage?.caption ||
                           '';
      
      console.log(`[Webhook] Recebido: "${messageContent}" de ${remoteJid}`);

      const { data: globalConfig } = await supabase.from('tenant_config').select('*').limit(1).single();
      if (globalConfig?.bot_active === false) return NextResponse.json({ status: 'ignored', reason: 'GLOBAL_BOT_OFF' });

      // 3. BUSCAR/CRIAR LEAD
      let { data: lead } = await supabase.from('leads').select('*').eq('whatsapp_number', remoteJid).single();
      
      // Buscar tenant_id real (não o ID da config)
      let actualTenantId = globalConfig?.tenant_id;
      if (!actualTenantId) {
        const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
        actualTenantId = tenant?.id;
      }

      if (!lead) {
        console.log('[Webhook] Criando novo lead para:', remoteJid);
        const { data: newLead, error: insertError } = await supabase.from('leads').insert([{ 
          whatsapp_number: remoteJid, 
          status: 'SDR_QUALIFICATION', 
          tenant_id: actualTenantId,
          bot_active: true // Forçar ativo na criação
        }]).select().single();
        
        if (insertError) {
          console.error('[Webhook] Erro ao inserir lead:', insertError);
          return NextResponse.json({ status: 'error', reason: 'LEAD_INSERT_FAILED', detail: insertError });
        }
        lead = newLead;
      }

      if (!lead) return NextResponse.json({ status: 'error', reason: 'LEAD_NOT_FOUND_AFTER_INSERT' });
      if (!lead.bot_active) return NextResponse.json({ status: 'ignored', reason: 'LEAD_BOT_PAUSED' });

      // Se o lead estava cancelado ou finalizado e mandou nova mensagem, recomeça o fluxo
      if (lead.status === 'CANCELED' || lead.status === 'FINISHED' || lead.status === 'OTHER_DEPARTMENT') {
        console.log(`[Webhook] Reativando lead ${remoteJid} que estava ${lead.status}`);
        await supabase.from('leads').update({ status: 'SDR_QUALIFICATION', updated_at: new Date().toISOString() }).eq('id', lead.id);
        lead.status = 'SDR_QUALIFICATION';
      }

      // 4. PROCESSAMENTO MULTIMODAL
      const openaiKey = globalConfig?.openai_key;
      const messageType = messageData.messageType || Object.keys(messageObj || {}).find(k => k.endsWith('Message')) || '';

      try {
        let mediaBase64 = body.data?.base64 || messageData.base64 || null;

        if (messageType === 'imageMessage' && openaiKey && globalConfig) {
          const visionDescription = await describeImage(globalConfig.evolution_url, globalConfig.evolution_instance_name, globalConfig.evolution_key, messageId, remoteJid, openaiKey, messageContent, mediaBase64);
          messageContent = `[IMAGEM RECEBIDA: ${visionDescription}] ${messageContent}`;
        } else if (messageType === 'audioMessage' && openaiKey && globalConfig) {
          const audioText = await transcribeAudio(globalConfig.evolution_url, globalConfig.evolution_instance_name, globalConfig.evolution_key, messageId, remoteJid, openaiKey, mediaBase64);
          messageContent = `[ÁUDIO RECEBIDO: ${audioText}] ${messageContent}`;
        } else if (messageType === 'documentMessage') {
          const fileName = messageObj.documentMessage?.fileName || 'documento.pdf';
          messageContent = `[DOCUMENTO RECEBIDO: ${fileName}] ${messageContent}`;
        }
      } catch (mediaError) {
        console.error('[Media Error]', mediaError);
      }

      // 5. SISTEMA DE BUFFER (DEBOUNCE)
      // Plano de Ação - Correção 1: Garantir texto de qualquer campo
      const finalContent = messageContent 
        || (messageData as any).texto_completo 
        || (messageData as any).texto_midia 
        || (messageData as any).message_raw 
        || '';

      console.log(`[Webhook] Processando para o Buffer: "${finalContent.substring(0, 50)}..."`);

      const { data: bufferEntry, error: bufferError } = await supabase.from('conversation_buffers').insert([{
        lead_id: lead.id,
        content: finalContent
      }]).select().single();

      if (bufferError) {
        console.error('[Buffer Error]', bufferError);
        return NextResponse.json({ status: 'error', reason: 'BUFFER_INSERT_FAILED', detail: bufferError });
      }

      // Plano de Ação - Correção 2: Forçar processamento se for a primeira ou se já passou o tempo
      // Primeiro, verificamos se há outras mensagens não processadas ANTES desta
      const { data: previousMessages } = await supabase
        .from('conversation_buffers')
        .select('id')
        .eq('lead_id', lead.id)
        .lt('created_at', bufferEntry.created_at)
        .eq('processed', false);

      const isPrimeiraMensagem = !previousMessages || previousMessages.length === 0;
      
      // Se for a primeira mensagem, podemos esperar menos ou processar logo
      const waitTime = isPrimeiraMensagem ? 4000 : 10000; 
      console.log(`[Webhook] Aguardando ${waitTime}ms (Primeira: ${isPrimeiraMensagem})`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));

      const { data: newerMessages } = await supabase
        .from('conversation_buffers')
        .select('id')
        .eq('lead_id', lead.id)
        .gt('id', bufferEntry.id)
        .eq('processed', false);

      if (newerMessages && newerMessages.length > 0) {
        console.log(`[Webhook] Mensagem ${bufferEntry.id} ignorada (há mensagens mais novas)`);
        return NextResponse.json({ status: 'success', detail: 'WAITING_FOR_MORE_MESSAGES' });
      }

      // Atômico: Marcar como processado e pegar todas as pendentes
      const { data: allUnprocessed, error: updateError } = await supabase
        .from('conversation_buffers')
        .update({ processed: true })
        .eq('lead_id', lead.id)
        .eq('processed', false)
        .select('*')
        .order('created_at', { ascending: true });

      if (updateError || !allUnprocessed || allUnprocessed.length === 0) {
        return NextResponse.json({ status: 'ignored', reason: 'already_processed_by_another_instance' });
      }

      const fullContext = allUnprocessed.map(m => m.content).filter(Boolean).join(' | ');

      // 6. SALVAR INTERAÇÃO E LOG DE DECISÃO
      await supabase.from('interactions').insert([{ lead_id: lead.id, sender_type: 'lead', message_content: fullContext }]);

      // 7. LÓGICA DE RESPOSTA (SDR OU ESPERA)
      if (lead.status === 'SDR_QUALIFICATION') {
        const { data: historyData } = await supabase.from('interactions').select('sender_type, message_content').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(15);
        const history = (historyData || []).reverse();

        const aiResult = await processLeadWithSkills(history || [], lead.id);
        
        if (aiResult && !aiResult.erro_openai) {
          const resposta_whatsapp = aiResult.resposta_whatsapp;
          const acao_executada = (aiResult.acao_executada || '').toLowerCase();
          const skill_usada = aiResult.skill_usada || 'SDR_GENERAL';

          // Log de Auditoria (Estilo n8n)
          await supabase.from('debug_logs').insert([{
            lead_id: lead.id,
            level: 'DEBUG',
            module: 'AI_SDR',
            action: `Skill: ${skill_usada}`,
            details: {
              intent: aiResult.intent,
              acao: acao_executada,
              dados_coletados: aiResult.cliente,
              demanda: aiResult.demanda,
              observacoes: aiResult.observacoes
            }
          }]);
          
          const variaveis = {
            produto: aiResult.demanda?.produto_familia || aiResult.demanda?.produto_modelo || null,
            ddd: aiResult.cliente?.ddd_regiao || null,
            quantidade: aiResult.demanda?.quantidade_metragem || null,
            aplicacao: aiResult.demanda?.segmento_aplicacao || null,
            nome_cliente: aiResult.cliente?.nome || null,
            empresa: aiResult.cliente?.empresa || null,
            cnpj: aiResult.cliente?.cnpj || null,
            email: aiResult.cliente?.email || null,
            segmento_detectado: aiResult.demanda?.segmento_aplicacao || null
          };
          
          const leadUpdate: any = { 
            updated_at: new Date().toISOString(),
            last_skill_used: skill_usada
          };
          if (variaveis.produto) leadUpdate.detected_product = variaveis.produto;
          if (variaveis.ddd) leadUpdate.detected_ddd = variaveis.ddd;
          if (variaveis.empresa) leadUpdate.company = variaveis.empresa;
          if (variaveis.nome_cliente) leadUpdate.name = variaveis.nome_cliente;
          
          // Novos mapeamentos para coerência total
          if (variaveis.cnpj) leadUpdate.cnpj = variaveis.cnpj;
          if (variaveis.email) leadUpdate.email_corporativo = variaveis.email;
          if (aiResult.cliente?.cargo) leadUpdate.cargo = aiResult.cliente.cargo;
          if (variaveis.quantidade) leadUpdate.quantidade = variaveis.quantidade;
          if (aiResult.demanda?.especificacao_detalhada || aiResult.demanda?.acabamento) {
            leadUpdate.especificacao = `${aiResult.demanda.especificacao_detalhada || ''} | ${aiResult.demanda.acabamento || ''} | ${aiResult.demanda.dimensoes || ''}`;
          }
          if (aiResult.cliente?.ddd_regiao) leadUpdate.detected_city = aiResult.cliente.ddd_regiao;
          
          if (acao_executada.includes('outro_setor')) {
            leadUpdate.status = 'CANCELED';
          }
          
          await supabase.from('leads').update(leadUpdate).eq('id', lead.id);

          if (resposta_whatsapp) {
            await supabase.from('interactions').insert([{ lead_id: lead.id, sender_type: 'sdr_ai', message_content: resposta_whatsapp }]);
            if (globalConfig?.evolution_url && globalConfig?.evolution_key) {
              await sendTextMessage(globalConfig.evolution_instance_name, globalConfig.evolution_url, globalConfig.evolution_key, remoteJid, resposta_whatsapp);
            }
          }

          if (acao_executada.includes('outro_setor')) {
            const msgSetores = "Vou te passar os contatos dos nossos outros departamentos:\n\n*COMEX:* Janaina Coelho - +55 16 3518-7115\n*Compras:* Vitor de Faria - +55 16 3518-7111\n*Logística:* André - +55 16 3518-7193\n*RH:* Margarida - +55 16 3518-7136\n*Outros:* Fabiana Martins - +55 16 99798-0918";
            if (globalConfig?.evolution_url && globalConfig?.evolution_key) {
              await sendTextMessage(globalConfig.evolution_instance_name, globalConfig.evolution_url, globalConfig.evolution_key, remoteJid, msgSetores);
            }
          } else {
            const isRouting = acao_executada.includes('roteamento') || acao_executada.includes('encaminhar') || acao_executada.includes('transfer');
            if (isRouting && variaveis?.produto && variaveis?.ddd) {
              if (globalConfig?.evolution_url && globalConfig?.evolution_key) {
                await sendTextMessage(globalConfig.evolution_instance_name, globalConfig.evolution_url, globalConfig.evolution_key, remoteJid, "Estou te transferindo para o especialista agora...");
              }
              await routeLead(lead.id, lead.tenant_id, variaveis);
            }
          }
        }
      } else if (lead.status === 'WAITING_SELLER' || lead.status === 'SENT_TO_SELLER' || lead.status === 'SELLER_RECEIVED' || lead.status === 'ATTENDANCE_STARTED') {
        // NOVA LÓGICA: Consultar estado REAL e decidir ação determinística
        const result = await handleClientReturn(remoteJid, fullContext);
        
        console.log(`[Webhook] Lino Suporte ação: ${result.action}`);
        
        // Registrar interação
        await supabase.from('interactions').insert([{ 
          lead_id: lead.id, 
          sender_type: 'sdr_ai', 
          message_content: result.message 
        }]);
        
        // Enviar resposta baseada na ação
        if (globalConfig?.evolution_url && globalConfig?.evolution_key) {
          await sendTextMessage(
            globalConfig.evolution_instance_name, 
            globalConfig.evolution_url, 
            globalConfig.evolution_key, 
            remoteJid, 
            result.message
          );
        }

        // Ações especiais baseadas no retorno
        if (result.action === 'NOTIFY_SELLER' || result.action === 'NOTIFY_SELLER_URGENT') {
          // O handleClientReturn já cuidou da notificação internamente
          console.log(`[Webhook] Notificação ao vendedor acionada`);
        } else if (result.action === 'ESCALATE_SUPERVISOR') {
          // Escalação handled internally
          console.log(`[Webhook] Escalação para supervisor acionada`);
        }
      }

      return NextResponse.json({ status: 'success', processed_count: allUnprocessed.length });
    }

    return NextResponse.json({ status: 'ignored', event: body.event });
  } catch (error) {
    console.error('[Webhook Error]', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
