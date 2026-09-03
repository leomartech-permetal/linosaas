import { NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase-server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-helpers';

/**
 * API: /api/tracking/attribution
 * Consulta completa de rastreabilidade e atribuição de campanha de marketing por código LINO.
 *
 * Utilizado para identificar a campanha (Google Ads, Meta, LinkedIn, etc.), página navegada
 * e termos buscados quando um vendedor fecha a venda no Protheus/TOTVS.
 */
export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  try {
    const { searchParams } = new URL(request.url);
    const rawCode = searchParams.get('code') || searchParams.get('codigo') || searchParams.get('q');
    const leadId = searchParams.get('lead_id');

    if (!rawCode && !leadId) {
      return NextResponse.json({ error: 'Informe code ou lead_id para consulta.' }, { status: 400 });
    }

    let lead: any = null;
    let clickData: any = null;

    if (leadId) {
      const { data: leadData } = await supabase
        .from('leads')
        .select('*, seller:current_owner_id(id, name, whatsapp_number)')
        .eq('id', leadId)
        .maybeSingle();

      lead = leadData;
    }

    // Normalizar o código para buscar com ou sem prefixo "LINO."
    let cleanCode = (rawCode || lead?.tracking_code || '').trim();
    if (cleanCode.startsWith('LINO.')) {
      cleanCode = cleanCode.slice(5);
    }
    const variations = [
      cleanCode,
      `LINO.${cleanCode}`,
      cleanCode.toUpperCase(),
      `LINO.${cleanCode.toUpperCase()}`,
    ].filter(Boolean);

    // 1. Buscar lead caso ainda não tenha sido encontrado
    if (!lead && variations.length > 0) {
      for (const variant of variations) {
        const { data: l } = await supabase
          .from('leads')
          .select('*, seller:current_owner_id(id, name, whatsapp_number)')
          .ilike('tracking_code', variant)
          .maybeSingle();

        if (l) {
          lead = l;
          break;
        }
      }
    }

    // 2. Buscar click na tabela lead_tracking_clicks
    if (lead?.tracking_id) {
      const { data: c } = await supabase
        .from('lead_tracking_clicks')
        .select('*')
        .eq('id', lead.tracking_id)
        .maybeSingle();
      clickData = c;
    }

    if (!clickData && variations.length > 0) {
      for (const variant of variations) {
        const { data: c } = await supabase
          .from('lead_tracking_clicks')
          .select('*')
          .ilike('code', variant)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (c) {
          clickData = c;
          break;
        }
      }
    }

    // 3. Se achou click mas não o lead, tenta achar o lead pelo código do click
    if (!lead && clickData?.code) {
      const { data: l } = await supabase
        .from('leads')
        .select('*, seller:current_owner_id(id, name, whatsapp_number)')
        .ilike('tracking_code', clickData.code)
        .maybeSingle();
      lead = l;
    }

    if (!lead && !clickData) {
      return NextResponse.json({
        found: false,
        searched_code: rawCode,
        message: 'Nenhum lead ou registro de campanha encontrado com este código.',
      }, { status: 404 });
    }

    const codeFound = lead?.tracking_code || clickData?.code || rawCode;

    return NextResponse.json({
      found: true,
      code: codeFound,
      lead: lead
        ? {
            id: lead.id,
            name: lead.name,
            company: lead.company || lead.empresa,
            cnpj: lead.cnpj,
            whatsapp_number: lead.whatsapp_number,
            status: lead.status,
            detected_product: lead.detected_product || lead.produto,
            quantidade: lead.quantidade,
            especificacao: lead.especificacao,
            current_owner_id: lead.current_owner_id,
            seller: lead.seller,
            created_at: lead.created_at,
            qualified_at: lead.qualified_at,
            sent_to_seller_at: lead.sent_to_seller_at,
            sla_breached: lead.sla_breached,
          }
        : null,
      campaign: clickData
        ? {
            id: clickData.id,
            origem: clickData.origem || clickData.utm_source || 'Site Direto',
            utm_source: clickData.utm_source || null,
            utm_medium: clickData.utm_medium || null,
            utm_campaign: clickData.utm_campaign || null,
            utm_content: clickData.utm_content || null,
            utm_term: clickData.utm_term || null,
            gclid: clickData.gclid || null,
            fbclid: clickData.fbclid || null,
            gad_campaignid: clickData.gad_campaignid || null,
            gad_source: clickData.gad_source || null,
            url: clickData.url || null,
            page_title: clickData.page_title || null,
            page_path: clickData.page_path || null,
            referrer: clickData.referrer || null,
            clicked_at: clickData.clicked_at || clickData.created_at,
            ga4_client_id: clickData.ga4_client_id || null,
          }
        : {
            origem: lead?.context_source || 'Direto WhatsApp',
            page_title: lead?.context_interest || 'WhatsApp',
            utm_source: null,
            utm_medium: null,
            utm_campaign: null,
          },
    });
  } catch (err: any) {
    console.error('[API Attribution Error]', err);
    return NextResponse.json({ error: 'Erro interno ao consultar atribuição.' }, { status: 500 });
  }
}
