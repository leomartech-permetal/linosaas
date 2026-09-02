import { NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase-server';

// GET: Lista todos os leads com dados de vendedor e ordenação
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('leads')
      .select('*, seller:current_owner_id(name, whatsapp_number)')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('[API Leads GET Error]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// POST: Cria um novo lead
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, error } = await supabase
      .from('leads')
      .insert([body])
      .select()
      .single();

    if (error) {
      console.error('[API Leads POST Error]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH: Atualiza campos de um lead (ex: status, current_owner_id, dados cadastrais)
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID do lead é obrigatório' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('leads')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('[API Leads PATCH Error]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Remove um lead
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'ID do lead é obrigatório' }, { status: 400 });
    }

    // Remover interações vinculadas primeiro
    await supabase.from('interactions').delete().eq('lead_id', id);

    const { error } = await supabase
      .from('leads')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('[API Leads DELETE Error]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
