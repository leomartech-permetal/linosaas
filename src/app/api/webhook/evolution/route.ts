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
          
          // ⚠️ DDD: SEMPRE extrair do número de telefone. A IA NÃO tem acesso ao número real.
          const rawPhone = remoteJid.replace(/\D/g, '');
          const systemDdd = rawPhone.length >= 12 && rawPhone.startsWith('55') ? rawPhone.substring(2, 4) : null;
          
          // Sanitizar ddd_regiao da IA: rejeitar placeholders e strings inválidas
          const aiDdd = aiResult.cliente?.ddd_regiao;
          const aiDddClean = aiDdd && /^\d{2}$/.test(String(aiDdd).trim()) ? String(aiDdd).trim() : null;
          
          // systemDdd tem prioridade máxima (extraído do número real)
          const dddToUse = systemDdd || aiDddClean || null;

          // Segmento normalizado da IA
          const segmentoNormalizado = aiResult.demanda?.segmento_normalizado || null;

          const variaveis = {
            produto: aiResult.demanda?.produto_normalizado || aiResult.demanda?.produto_familia || aiResult.demanda?.produto_modelo || null,
            ddd: dddToUse,
            quantidade: aiResult.demanda?.quantidade_metragem || null,
            aplicacao: aiResult.demanda?.segmento_aplicacao || segmentoNormalizado || null,
            nome_cliente: aiResult.cliente?.nome || null,
            empresa: aiResult.cliente?.empresa || null,
            cnpj: aiResult.cliente?.cnpj || null,
            email: aiResult.cliente?.email || null,
            segmento_detectado: segmentoNormalizado || aiResult.demanda?.segmento_aplicacao || null
          };

          console.log(`[Webhook] DDD → sistema: ${systemDdd} | IA: ${aiDdd} | usando: ${dddToUse}`);
          console.log(`[Webhook] Empresa: ${variaveis.empresa} | Email: ${variaveis.email} | CNPJ: ${variaveis.cnpj}`);
          
          const leadUpdate: any = { 
            updated_at: new Date().toISOString()
          };
          // Produto e DDD — sempre atualiza se disponível
          if (variaveis.produto) leadUpdate.detected_product = variaveis.produto;
          if (dddToUse) leadUpdate.detected_ddd = dddToUse;
          
          // Dados profissionais — atualiza APENAS se vier preenchido (não apaga existente)
          if (variaveis.empresa) leadUpdate.company = variaveis.empresa;
          if (variaveis.nome_cliente) leadUpdate.name = variaveis.nome_cliente;
          if (variaveis.cnpj) leadUpdate.cnpj = variaveis.cnpj;
          if (variaveis.email) leadUpdate.email_corporativo = variaveis.email;
          if (aiResult.cliente?.cargo) leadUpdate.cargo = aiResult.cliente.cargo;
          if (variaveis.quantidade) leadUpdate.quantidade = variaveis.quantidade;
          
          // Especificação técnica
          const especParts = [aiResult.demanda?.dimensoes, aiResult.demanda?.acabamento, aiResult.demanda?.material].filter(Boolean);
          if (especParts.length > 0) leadUpdate.especificacao = especParts.join(' | ');
          
          const intent = (aiResult.intent || '').toUpperCase();
          const isNonCommercialIntent = ['VAGAS', 'FORNECEDOR', 'LOGISTICA', 'FINANCEIRO', 'COMEX', 'MARKETING'].includes(intent);
          
          if (acao_executada.includes('outro_setor') || isNonCommercialIntent) {
            leadUpdate.status = 'OTHER_DEPARTMENT';
          }
          
          // Salvar com log de erro explícito
          const { error: updateError } = await supabase.from('leads').update(leadUpdate).eq('id', lead.id);
          if (updateError) {
            console.error('[Webhook] ❌ ERRO ao salvar lead:', updateError);
            await supabase.from('debug_logs').insert([{
              lead_id: lead.id, level: 'ERROR', module: 'WEBHOOK',
              action: 'LEAD_UPDATE_FAILED',
              details: { error: updateError, leadUpdate }
            }]);
          } else {
            console.log('[Webhook] ✅ Lead salvo:', Object.keys(leadUpdate).join(', '));
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
            // --- ROTEAMENTO ROBUSTO ---
            const acaoEhRoteamento = acao_executada.includes('roteamento') 
                                  || acao_executada.includes('encaminhar') 
                                  || acao_executada.includes('transfer');

            // Dados comerciais mínimos para rotear
            const temDadosComerciais = !!(variaveis.empresa || variaveis.email || variaveis.cnpj);

            // Contar tentativas de coleta já feitas (recuperar do banco)
            const { data: leadAtual } = await supabase.from('leads').select('tentativas_coleta').eq('id', lead.id).single();
            const tentativasColeta = leadAtual?.tentativas_coleta || 0;

            // Se ação é coleta_dados, incrementar contador
            if (acao_executada.includes('coleta')) {
              await supabase.from('leads').update({ tentativas_coleta: tentativasColeta + 1 }).eq('id', lead.id);
            }

            // Critérios para rotear:
            // 1. Tem produto + DDD (obrigatórios)
            // 2. IA marcou roteamento E tem dados comerciais OU já tentou 2+ vezes coletar
            const temMinimo = !!(variaveis.produto && dddToUse);
            const podeRotearComDados = acaoEhRoteamento && temDadosComerciais;
            const forcaRoteamentoPorTentativas = acaoEhRoteamento && tentativasColeta >= 2;
            const deveRotear = temMinimo && (podeRotearComDados || forcaRoteamentoPorTentativas);

            console.log(`[Webhook] Roteamento check — acao: ${acao_executada}, produto: ${variaveis?.produto}, ddd: ${dddToUse}, empresa: ${variaveis.empresa}, tentativas: ${tentativasColeta}, deveRotear: ${deveRotear}`);

            if (deveRotear) {
              console.log(`[Webhook] ✅ Roteando lead ${lead.id} — dados comerciais: ${temDadosComerciais}, tentativas: ${tentativasColeta}`);
              if (globalConfig?.evolution_url && globalConfig?.evolution_key) {
                await sendTextMessage(globalConfig.evolution_instance_name, globalConfig.evolution_url, globalConfig.evolution_key, remoteJid, "Estou te transferindo para o especialista agora...");
              }
              await routeLead(lead.id, lead.tenant_id, variaveis);
            } else {
              const motivo = !temMinimo ? `produto ou DDD ausente (produto=${variaveis?.produto}, ddd=${dddToUse})` 
                           : !acaoEhRoteamento ? `IA ainda coletando (tentativas=${tentativasColeta})`
                           : `aguardando dados comerciais (tentativas=${tentativasColeta}/2)`;
              console.log(`[Webhook] ⏳ Não rotear — motivo: ${motivo}`);
            }
          }

        }
      } else if (lead.status === 'WAITING_SELLER' || lead.status === 'SENT_TO_SELLER' || lead.status === 'SELLER_RECEIVED' || lead.status === 'ATTENDANCE_STARTED') {
        // LINO SUPORTE — só ativa APÓS vendedor estar realmente atribuído
        // Regra: current_owner_id deve existir. Se não, SDR ainda não concluiu o roteamento.
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

        // Vendedor confirmado — Lino Suporte assume a conversa
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
