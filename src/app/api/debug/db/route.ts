import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'não definida';
  const maskedUrl = url.substring(0, 15) + '...';
  
  return NextResponse.json({
    supabase_url_detectada: maskedUrl,
    aviso: "Esta rota é apenas para debug e deve ser apagada após o teste."
  });
}
