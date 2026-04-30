import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Extrai texto de PDF
async function extractPDF(buffer: Buffer): Promise<string> {
  const pdfParseModule = await import('pdf-parse');
  const pdfParse = (pdfParseModule as any).default || pdfParseModule;
  const data = await pdfParse(buffer);
  return data.text;
}

// Extrai texto de DOCX
async function extractDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

// Extrai texto de XLSX
async function extractXLSX(buffer: Buffer): Promise<string> {
  const XLSX = await import('xlsx');
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  let text = '';
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    text += `\n=== ${sheetName} ===\n`;
    text += XLSX.utils.sheet_to_csv(sheet);
  }
  return text;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const name = formData.get('name') as string || '';
    const manualText = formData.get('text') as string || '';

    // Se for texto manual (sem arquivo)
    if (!file && manualText) {
      const { data, error } = await supabase.from('rag_documents').insert([{
        name: name || 'Texto Manual',
        source_type: 'text',
        content: manualText,
        file_size: new TextEncoder().encode(manualText).length,
      }]).select().single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, document: data });
    }

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo ou texto fornecido' }, { status: 400 });
    }

    // Validar tamanho (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo: 10MB' }, { status: 400 });
    }

    // Detectar tipo
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const allowedTypes: Record<string, string> = {
      'pdf': 'pdf',
      'docx': 'docx',
      'doc': 'docx',
      'xlsx': 'xlsx',
      'xls': 'xlsx',
      'csv': 'xlsx',
      'txt': 'text',
    };

    const sourceType = allowedTypes[ext];
    if (!sourceType) {
      return NextResponse.json({ error: `Tipo de arquivo .${ext} não suportado. Use: PDF, DOCX, XLSX, CSV, TXT` }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let content = '';

    // Extrair texto conforme tipo
    switch (sourceType) {
      case 'pdf':
        content = await extractPDF(buffer);
        break;
      case 'docx':
        content = await extractDOCX(buffer);
        break;
      case 'xlsx':
        content = await extractXLSX(buffer);
        break;
      case 'text':
        content = buffer.toString('utf-8');
        break;
    }

    // Truncar se muito longo (max ~50k chars para caber no contexto)
    const MAX_CHARS = 50000;
    if (content.length > MAX_CHARS) {
      content = content.substring(0, MAX_CHARS) + '\n\n[... Conteúdo truncado por exceder o limite ...]';
    }

    // Upload do arquivo original para Supabase Storage
    const fileName = `rag/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('rag-files')
      .upload(fileName, buffer, { contentType: file.type });

    let fileUrl = '';
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('rag-files').getPublicUrl(fileName);
      fileUrl = urlData.publicUrl;
    }

    // Salvar no banco
    const { data, error } = await supabase.from('rag_documents').insert([{
      name: name || file.name,
      source_type: sourceType,
      content,
      file_url: fileUrl,
      file_size: file.size,
    }]).select().single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      document: data,
      extracted_chars: content.length,
    });

  } catch (error: any) {
    console.error('[RAG Upload Error]', error);
    return NextResponse.json({ error: error.message || 'Erro ao processar arquivo' }, { status: 500 });
  }
}
