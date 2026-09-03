/**
 * Helpers de autenticação para rotas administrativas.
 * Valida o cookie de sessão e retorna o usuário autenticado.
 * Em caso de falha, retorna null — o handler deve responder 401.
 *
 * Nunca confia em tenant_id vindo do body: sempre deriva da sessão.
 */

import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/supabase-server';

export interface AuthUser {
  id: string;
  name: string;
  role: string;
  tenant_id: string | null;
}

/**
 * Valida o cookie lino_admin_auth e retorna o usuário autenticado.
 * Retorna null se não autenticado ou sessão inválida.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const authCookie = cookieStore.get('lino_admin_auth')?.value;
    if (!authCookie) return null;

    // O cookie contém o user_id codificado em base64 simples
    // (compatibilidade com o sistema de login atual)
    let userId: string;
    try {
      userId = Buffer.from(authCookie, 'base64').toString('utf-8');
    } catch {
      return null;
    }

    const { data: user, error } = await supabaseServer
      .from('admin_users')
      .select('id, name, role, tenant_id')
      .eq('id', userId)
      .single();

    if (error || !user) return null;

    return {
      id: user.id,
      name: user.name,
      role: user.role || 'viewer',
      tenant_id: user.tenant_id,
    };
  } catch {
    return null;
  }
}

/**
 * Resposta 401 padronizada sem dados internos.
 */
export function unauthorizedResponse() {
  return Response.json(
    { error: 'Não autorizado. Faça login para continuar.' },
    { status: 401 }
  );
}

/**
 * Resposta 403 padronizada.
 */
export function forbiddenResponse() {
  return Response.json(
    { error: 'Acesso negado. Permissão insuficiente.' },
    { status: 403 }
  );
}

/**
 * Campos permitidos para PATCH em leads.
 * Nunca atualizar campos sensíveis ou de sistema via API.
 */
export const LEAD_PATCH_ALLOWLIST = new Set([
  'name',
  'company',
  'empresa',
  'cnpj',
  'email_corporativo',
  'cidade_empresa',
  'estado_empresa',
  'cargo',
  'produto',
  'quantidade',
  'especificacao',
  'observacao',
  'status',
  'current_owner_id',
  'bot_active',
  'sla_breached',
  'qualification_completed',
  'qualification_state',
  'intent_type',
  'return_intent',
]);
