import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const code = body.code || body.codigo || `LINO.${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const trackingData = {
      code: String(code).trim().toUpperCase(),
      url: body.url || null,
      page_title: body.page_title || body.pageTitle || null,
      page_path: body.page_path || body.pagePath || null,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
      utm_content: body.utm_content || null,
      utm_term: body.utm_term || null,
      gclid: body.gclid || null,
      gbraid: body.gbraid || null,
      wbraid: body.wbraid || null,
      fbclid: body.fbclid || null,
      gad_source: body.gad_source || null,
      gad_campaignid: body.gad_campaignid ? String(body.gad_campaignid) : null,
      origem: body.origem || null,
      ga4_client_id: body.ga4_client_id || null,
      ga4_client_id_short: body.ga4_client_id_short || null,
      referrer: body.referrer || null,
      script_version: body.script_version || 'lino_click_only_base36_v1',
      whatsapp_href: body.whatsapp_href || null,
      event: body.event || 'whatsapp_click',
      clicked_at: body.clicked_at_utc || new Date().toISOString()
    };

    const { data, error } = await supabase
      .from('lead_tracking_clicks')
      .insert([trackingData])
      .select()
      .single();

    if (error) {
      console.error('[Tracking Click Insert Error]', error);
      return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      status: 'success',
      code: trackingData.code,
      id: data?.id
    });
  } catch (error: any) {
    console.error('[Tracking Click API Error]', error);
    return NextResponse.json({ status: 'error', error: error.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Parâmetro code é obrigatório' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('lead_tracking_clicks')
    .select('*')
    .ilike('code', code.trim())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ found: false, code }, { status: 404 });
  }

  return NextResponse.json({ found: true, click: data });
}
