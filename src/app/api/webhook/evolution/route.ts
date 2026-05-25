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
    // Captura nome real do WhatsApp (pushName)
    const pushName: string | null = messageData?.pushName || body.data?.pushName || null;

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

      // 1.5 IGNORAR SE O REMETENTE FOR UM FUNCIONÁRIO/VENDEDOR INTERNO
      const senderPhone = remoteJid.replace(/\D/g, '');
      const { data: internalUser } = await supabase
        .from('admin_users')
        .select('id, name')
        .or(`whatsapp_number.ilike.%${senderPhone}%,whatsapp_number.ilike.%${senderPhone.substring(2)}%`)
        .limit(1)
        .maybeSingle();

      if (internalUser) {
        console.log(`[Webhook] Mensagem ignorada: remetente é funcionário interno (${internalUser.name} - ${senderPhone})`);
        return NextResponse.json({ status: 'ignored', reason: 'sender_is_internal_user', name: internalUser.name });
      }

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
        console.log('[Webhook] Criando novo lead para:', remoteJid, '| pushName:', pushName);
        const { data: newLead, error: insertError } = await supabase.from('leads').insert([{ 
          whatsapp_number: remoteJid, 
          name: pushName || null,  // salva nome real do WhatsApp
          status: 'SDR_QUALIFICATION', 
          tenant_id: actualTenantId,
          bot_active: true
        }]).select().single();
        
        if (insertError) {
          console.error('[Webhook] Erro ao inserir lead:', insertError);
          return NextResponse.json({ status: 'error', reason: 'LEAD_INSERT_FAILED', detail: insertError });
        }
        lead = newLead;
      } else if (!lead.name && pushName) {
        // Lead já existe mas ainda sem nome — atualiza com pushName
        await supabase.from('leads').update({ name: pushName }).eq('id', lead.id);
        lead.name = pushName;
        console.log('[Webhook] pushName atualizado para lead existente:', pushName);
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

      // Buffer Wait
      const { data: previousMessages } = await supabase
        .from('conversation_buffers')
        .select('id')
        .eq('lead_id', lead.id)
        .lt('created_at', bufferEntry.created_at)
        .eq('processed', false);

      const isPrimeiraMensagem = !previousMessages || previousMessages.length === 0;
      const waitTime = isPrimeiraMensagem ? 4000 : 10000; 
      console.log(`[Webhook] Aguardando ${waitTime}ms (Primeira: ${isPrimeiraMensagem})`);
      
      await new Promise(resolve => setTimeout(resolve, waitTime));

      const { data: newerMessages } = await supabase
        .from('conversation_buffers')
        .select('id')
        .eq('lead_id', lead.id)
        .gt('created_at', bufferEntry.created_at)
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

      // 6. SALVAR INTERAÇÃO
      await supabase.from('interactions').insert([{ lead_id: lead.id, sender_type: 'lead', message_content: fullContext }]);

      // 7. LÓGICA DE RESPOSTA (SDR OU ESPERA)
      if (lead.status === 'SDR_QUALIFICATION') {
        const { data: historyData } = await supabase.from('interactions').select('sender_type, message_content').eq('lead_id', lead.id).order('created_at', { ascending: false }).limit(15);
        const history = (historyData || []).reverse();

        const aiResult = await processLeadWithSkills(history || [], lead.id);
        
        if (aiResult && !aiResult.erro_openai) {
          const resposta_whatsapp = aiResult.resposta_whatsapp;
          const acao_executada = (aiResult.acao_executada || '').toLowerCase();

          // Log de Auditoria
          await supabase.from('debug_logs').insert([{
            lead_id: lead.id,
            level: 'DEBUG',
            module: 'AI_SDR',
            action: `Qualificacao_Schemas`,
            details: {
              intent: aiResult.intent,
              acao: acao_executada,
              campo_solicitado: aiResult.campo_solicitado_nesta_rodada,
              dados_coletados: aiResult.cliente,
              demanda: aiResult.demanda,
              observacoes: aiResult.observacoes
            }
          }]);
          
          // DDD
          const rawPhone = remoteJid.replace(/\D/g, '');
          const systemDdd = rawPhone.length >= 12 && rawPhone.startsWith('55') ? rawPhone.substring(2, 4) : null;
          const aiDdd = aiResult.cliente?.ddd_regiao;
          const aiDddClean = aiDdd && /^\d{2}$/.test(String(aiDdd).trim()) ? String(aiDdd).trim() : null;
          const dddToUse = systemDdd || aiDddClean || null;

          // Roteamento e qualificação baseada em schemas
          const { data: leadAtual } = await supabase.from('leads').select('*').eq('id', lead.id).single();
          const qState = leadAtual?.qualification_state || { valores: {}, tentativas: {} };
          if (!qState.valores) qState.valores = {};
          if (!qState.tentativas) qState.tentativas = {};

          // 1. Atualizar valores extraídos pela IA no estado estruturado
          const camposCliente = ['nome', 'empresa', 'cnpj', 'email'];
          camposCliente.forEach(c => {
            const key = c === 'nome' ? 'nome_cliente' : c;
            if (aiResult.cliente?.[c]) {
              qState.valores[key] = aiResult.cliente[c];
            }
          });

          const camposDemanda = ['produto_normalizado', 'quantidade_metragem', 'material', 'acabamento', 'dimensoes', 'ec', 'segmento_normalizado'];
          camposDemanda.forEach(c => {
            const key = c === 'quantidade_metragem' ? 'quantidade' : (c === 'produto_normalizado' ? 'produto' : c);
            if (aiResult.demanda?.[c]) {
              qState.valores[key] = aiResult.demanda[c];
            }
          });

          // 2. Incrementar contador de tentativas da variável que a IA acabou de tentar perguntar
          const campoSolicitado = aiResult.campo_solicitado_nesta_rodada;
          if (campoSolicitado && campoSolicitado !== 'null' && campoSolicitado !== 'none') {
            qState.tentativas[campoSolicitado] = (qState.tentativas[campoSolicitado] || 0) + 1;
          }

          // 3. Atualizar o banco de dados
          const leadUpdate: any = { 
            updated_at: new Date().toISOString(),
            qualification_state: qState
          };

          // Sincronizar com as colunas nativas da tabela leads para compatibilidade
          if (qState.valores.produto) {
            leadUpdate.detected_product = qState.valores.produto;
            leadUpdate.produto = qState.valores.produto;
          }
          if (dddToUse) leadUpdate.detected_ddd = dddToUse;
          if (qState.valores.empresa) {
            leadUpdate.company = qState.valores.empresa;
            leadUpdate.empresa = qState.valores.empresa;
          }
          if (qState.valores.nome_cliente) leadUpdate.name = qState.valores.nome_cliente;
          if (qState.valores.cnpj) leadUpdate.cnpj = qState.valores.cnpj;
          if (qState.valores.email) leadUpdate.email_corporativo = qState.valores.email;
          if (qState.valores.quantidade) leadUpdate.quantidade = qState.valores.quantidade;

          const especParts = [qState.valores.dimensoes, qState.valores.acabamento, qState.valores.material].filter(Boolean);
          if (especParts.length > 0) leadUpdate.especificacao = especParts.join(' | ');

          const intent = (aiResult.intent || '').toUpperCase();
          const isNonCommercialIntent = ['VAGAS', 'FORNECEDOR', 'LOGISTICA', 'FINANCEIRO', 'COMEX', 'MARKETING'].includes(intent);
          
          if (acao_executada.includes('outro_setor') || isNonCommercialIntent) {
            leadUpdate.status = 'OTHER_DEPARTMENT';
          }
          
          const { error: updateError } = await supabase.from('leads').update(leadUpdate).eq('id', lead.id);
          if (updateError) {
            console.error('[Webhook] ❌ ERRO ao salvar lead:', updateError);
          }

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
            // --- ROTEAMENTO BASEADO EM SCHEMAS ---
            let schema: any = null;
            const prodNome = qState.valores.produto || leadUpdate.produto || leadAtual?.produto;
            if (prodNome) {
              const { data: productData } = await supabase
                .from('products')
                .select('qualification_schema')
                .ilike('name', `%${prodNome}%`)
                .limit(1)
                .maybeSingle();
              if (productData?.qualification_schema) {
                schema = productData.qualification_schema;
              }
            }

            if (!schema) {
              schema = {
                obrigatorias: ["nome_cliente", "empresa", "email", "quantidade"],
                opcionais: []
              };
            }

            // Mesclar para checagem determinística
            const todasVariaveis = {
              nome_cliente: leadUpdate.name || leadAtual?.name || null,
              empresa: leadUpdate.company || leadAtual?.company || null,
              email: leadUpdate.email_corporativo || leadAtual?.email_corporativo || null,
              cnpj: leadUpdate.cnpj || leadAtual?.cnpj || null,
              produto: prodNome || null,
              quantidade: leadUpdate.quantidade || leadAtual?.quantidade || null,
              ...qState.valores
            };

            const dddValido = !!(dddToUse || leadAtual?.detected_ddd);
            const temTodasObrigatorias = schema.obrigatorias.every((f: string) => !!todasVariaveis[f]) && dddValido;

            const acaoEhRoteamento = acao_executada.includes('roteamento') 
                                  || acao_executada.includes('encaminhar') 
                                  || acao_executada.includes('transfer');

            const deveRotear = temTodasObrigatorias && acaoEhRoteamento;

            console.log(`[Webhook] Roteamento check — produto: ${prodNome}, ddd: ${dddValido}, obrigatórias satisfeitas: ${temTodasObrigatorias}, acao: ${acao_executada}, deveRotear: ${deveRotear}`);

            if (deveRotear) {
              console.log(`[Webhook] ✅ Roteando lead ${lead.id} deterministicamente.`);
              if (globalConfig?.evolution_url && globalConfig?.evolution_key) {
                await sendTextMessage(globalConfig.evolution_instance_name, globalConfig.evolution_url, globalConfig.evolution_key, remoteJid, "Estou te transferindo para o especialista agora...");
              }
              const variaveisRoteamento = {
                produto: prodNome || null,
                ddd: dddToUse || leadAtual?.detected_ddd || null,
                quantidade: todasVariaveis.quantidade,
                aplicacao: todasVariaveis.segmento_normalizado || todasVariaveis.segmento_aplicacao || null,
                nome_cliente: todasVariaveis.nome_cliente,
                empresa: todasVariaveis.empresa,
                cnpj: todasVariaveis.cnpj,
                email: todasVariaveis.email,
                segmento_detectado: todasVariaveis.segmento_normalizado || null
              };
              await routeLead(lead.id, lead.tenant_id, variaveisRoteamento);
            } else {
              const motivo = !temTodasObrigatorias ? 'faltam dados obrigatorios do schema' 
                           : !acaoEhRoteamento ? 'IA ainda no fluxo conversacional'
                           : 'aguardando confirmacao final do lead';
              console.log(`[Webhook] ⏳ Não rotear ainda — motivo: ${motivo}`);
            }
          }

        }
      } else if (lead.status === 'WAITING_SELLER' || lead.status === 'SENT_TO_SELLER' || lead.status === 'SELLER_RECEIVED' || lead.status === 'ATTENDANCE_STARTED') {
        // LINO SUPORTE
        if (!lead.current_owner_id) {
          console.log(`[Webhook] Lead ${lead.id} em status de suporte mas SEM vendedor atribuído. Retornando ao SDR.`);
          await supabase.from('leads').update({ status: 'SDR_QUALIFICATION', updated_at: new Date().toISOString() }).eq('id', lead.id);
          
          const msgSemVendedor = "Desculpe a demora! Vou verificar qual especialista está disponível agora e te aviso em breve.";
          await supabase.from('interactions').insert([{ lead_id: lead.id, sender_type: 'sdr_ai', message_content: msgSemVendedor }]);
          if (globalConfig?.evolution_url && globalConfig?.evolution_key) {
            await sendTextMessage(globalConfig.evolution_instance_name, globalConfig.evolution_url, globalConfig.evolution_key, remoteJid, msgSemVendedor);
          }
          return NextResponse.json({ status: 'success', reason: 'REDIRECTED_TO_SDR_NO_SELLER' });
        }

        const result = await handleClientReturn(remoteJid, fullContext);
        console.log(`[Webhook] Lino Suporte ação: ${result.action}`);
        
        await supabase.from('interactions').insert([{ 
          lead_id: lead.id, 
          sender_type: 'sdr_ai', 
          message_content: result.message 
        }]);
        
        if (globalConfig?.evolution_url && globalConfig?.evolution_key) {
          await sendTextMessage(
            globalConfig.evolution_instance_name, 
            globalConfig.evolution_url, 
            globalConfig.evolution_key, 
            remoteJid, 
            result.message
          );
        }

        if (result.action === 'NOTIFY_SELLER' || result.action === 'NOTIFY_SELLER_URGENT') {
          console.log(`[Webhook] Notificação ao vendedor acionada`);
        } else if (result.action === 'ESCALATE_SUPERVISOR') {
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
