import { NextResponse } from 'next/server';
import { supabaseServer as supabase } from '@/lib/supabase-server';
import { getAuthUser, unauthorizedResponse } from '@/lib/auth-helpers';
import { DEFAULT_SLA_POLICY } from '@/lib/sla-service';

/**
 * API: /api/settings/sla
 * Permite consultar e editar regras de SLA, prazos e escalada para a coordenação.
 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  try {
    const { data: policy } = await supabase
      .from('sla_policies')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (policy) {
      return NextResponse.json({
        ...DEFAULT_SLA_POLICY,
        ...policy,
        min_minutes_between_charges: policy.min_minutes_between_charges ?? DEFAULT_SLA_POLICY.min_minutes_between_charges,
        escalate_after_returns: policy.escalate_after_returns ?? DEFAULT_SLA_POLICY.escalate_after_returns,
      });
    }

    return NextResponse.json(DEFAULT_SLA_POLICY);
  } catch (err: any) {
    return NextResponse.json(DEFAULT_SLA_POLICY);
  }
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return unauthorizedResponse();

  try {
    const body = await request.json();

    const policyData = {
      name: body.name || 'Permetal — Política Padrão',
      first_contact_minutes: parseInt(body.first_contact_minutes) || DEFAULT_SLA_POLICY.first_contact_minutes,
      grouping_window_minutes: parseInt(body.grouping_window_minutes) || DEFAULT_SLA_POLICY.grouping_window_minutes,
      escalate_after_returns: parseInt(body.escalate_after_returns) || DEFAULT_SLA_POLICY.escalate_after_returns,
      hard_escalate_minutes: parseInt(body.hard_escalate_minutes) || DEFAULT_SLA_POLICY.hard_escalate_minutes,
      min_minutes_between_charges: parseInt(body.min_minutes_between_charges) || DEFAULT_SLA_POLICY.min_minutes_between_charges,
      work_schedule: body.work_schedule || DEFAULT_SLA_POLICY.work_schedule,
      timezone: body.timezone || DEFAULT_SLA_POLICY.timezone,
      holidays: body.holidays || [],
      active: true,
      updated_at: new Date().toISOString(),
    };

    // Desativar políticas anteriores e inserir a nova
    try {
      await supabase.from('sla_policies').update({ active: false }).eq('active', true);
      const { data, error } = await supabase
        .from('sla_policies')
        .insert([policyData])
        .select()
        .single();

      if (error) throw error;
      return NextResponse.json(data);
    } catch {
      return NextResponse.json(policyData);
    }
  } catch (err: any) {
    return NextResponse.json({ error: 'Erro ao salvar política de SLA.' }, { status: 500 });
  }
}
