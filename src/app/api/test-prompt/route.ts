import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    const { prompt_teste, mensagem_cliente } = await request.json();

    const { data: config } = await supabase.from('tenant_config').select('openai_key').limit(1).single();
    const apiKey = config?.openai_key || process.env.OPENAI_API_KEY;

    if (!apiKey || apiKey === 'fake-key') {
      return NextResponse.json({ error: 'Chave da OpenAI não configurada.' }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: prompt_teste || 'Você é o Lino, assistente comercial B2B.' },
        { role: 'user', content: mensagem_cliente || 'Olá, quanto custa chapa perfurada?' }
      ],
      temperature: 0.2
    });

    const resposta = completion.choices[0]?.message?.content || 'Sem resposta.';
    return NextResponse.json({ resposta });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
