import { NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase-server';

export async function GET() {
  try {
    const { data, error } = await supabase
      .from('admin_users')
      .select('id, name, whatsapp_number, role')
      .order('name', { ascending: true });

    if (error) {
      console.error('[API Admin Users Error]', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
