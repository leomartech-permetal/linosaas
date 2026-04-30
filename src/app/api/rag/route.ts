import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET: Lista todos os documentos RAG
export async function GET() {
  const { data, error } = await supabase
    .from('rag_documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// DELETE: Remove um documento RAG
export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'ID obrigatório' }, { status: 400 });

  // Buscar file_url antes de deletar
  const { data: doc } = await supabase.from('rag_documents').select('file_url').eq('id', id).single();

  // Remover links de skill
  await supabase.from('skill_rag_links').delete().eq('rag_document_id', id);

  // Remover documento
  const { error } = await supabase.from('rag_documents').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Remover arquivo do Storage (se existir)
  if (doc?.file_url) {
    const path = doc.file_url.split('/rag-files/')[1];
    if (path) await supabase.storage.from('rag-files').remove([path]);
  }

  return NextResponse.json({ success: true });
}
