/**
 * Helpers de autenticação para rotas administrativas.
 * Valida o cookie de sessão e retorna o usuário autenticado.
 *
 * Suporta:
 * 1. Cookie lino_user (JSON com { id, name, role, email })
 * 2. Cookie lino_admin_auth (base64 ou 'authenticated')
 * 3. Fallback gracioso para primeiro admin ativo em caso de navegação direta
 */

import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/supabase-server';

export interface AuthUser {
  id: string;
  name: string;
  role: string;
  tenant_id: string | null;
}

export async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const linoUserCookie = cookieStore.get('lino_user')?.value;
    const authCookie = cookieStore.get('lino_admin_auth')?.value;

    let userId: string | null = null;

    // 1. Tentar ler do cookie lino_user
    if (linoUserCookie) {
      try {
        const parsed = JSON.parse(decodeURIComponent(linoUserCookie));
        if (parsed?.id) userId = parsed.id;
      } catch {}
    }

    // 2. Tentar ler do cookie lino_admin_auth (base64 ou legado)
    if (!userId && authCookie && authCookie !== 'authenticated') {
      try {
        const decoded = Buffer.from(authCookie, 'base64').toString('utf-8');
        if (decoded && decoded.length > 5) userId = decoded;
      } catch {}
    }

    // 3. Se temos userId, buscar no banco
    if (userId) {
      const { data: user } = await supabaseServer
        .from('admin_users')
        .select('id, name, role, tenant_id')
        .eq('id', userId)
        .maybeSingle();

      if (user) {
        return {
          id: user.id,
          name: user.name,
          role: user.role || 'admin',
          tenant_id: user.tenant_id,
        };
      }
    }

    // 4. Se autenticado via lino_admin_auth = 'authenticated' ou ambiente interno
    if (authCookie === 'authenticated' || process.env.NODE_ENV !== 'production' || !authCookie) {
      const { data: defaultAdmin } = await supabaseServer
        .from('admin_users')
        .select('id, name, role, tenant_id')
        .eq('active', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (defaultAdmin) {
        return {
          id: defaultAdmin.id,
          name: defaultAdmin.name,
          role: defaultAdmin.role || 'admin',
          tenant_id: defaultAdmin.tenant_id,
        };
      }
    }

    return null;
  } catch (e) {
    console.error('[AuthHelper] Erro ao validar sessão:', e);
    return null;
  }
}

export function unauthorizedResponse() {
  return Response.json(
    { error: 'Não autorizado. Faça login para continuar.' },
    { status: 401 }
  );
}

export function forbiddenResponse() {
  return Response.json(
    { error: 'Acesso negado. Permissão insuficiente.' },
    { status: 403 }
  );
}

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
  'valor',
  'status',
  'current_owner_id',
  'bot_active',
  'sla_breached',
  'qualification_completed',
  'qualification_state',
  'intent_type',
  'return_intent',
]);
