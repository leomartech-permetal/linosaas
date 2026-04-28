import { supabase } from './supabase';

export interface ExtractedVariables {
  produto?: string;
  quantidade?: 'baixa' | 'media' | 'alta';
  instalacao?: boolean;
  regiao?: string;
}

/**
 * Roteador Comercial: Cruza as variáveis da IA com as regras de negócio
 * e atribui o Lead a um Vendedor.
 */
export async function routeLead(leadId: string, tenantId: string, variables: ExtractedVariables) {
  let targetTeamName = 'Construção'; // Fallback padrão
  let targetBrandName = 'Permetal';

  const prod = variables.produto?.toLowerCase() || '';

  // ---------------------------------------------------------
  // 1. MOTOR DE EXCEÇÕES (LÓGICA DE NEGÓCIO)
  // ---------------------------------------------------------
  
  // Exceção 1: Projetos/Instalação vão para a PSA
  if (variables.instalacao === true || prod.includes('fachada') || prod.includes('forro')) {
    targetTeamName = 'PSA PERMETAL';
    targetBrandName = 'PSA PERMETAL';
  } 
  // Exceção 2: Pouca quantidade vai para Permetal Express
  else if (variables.quantidade === 'baixa' && (prod.includes('perfurada') || prod.includes('expandida'))) {
    targetTeamName = 'PERMETAL EXPRESS';
    targetBrandName = 'PERMETAL EXPRESS';
  }
  // Exceção 3: Revenda / Indústria / etc baseados no produto (Pode ser expandido depois)

  console.log(`[Roteador] Roteando para: Equipe ${targetTeamName} | Marca ${targetBrandName}`);

  // ---------------------------------------------------------
  // 2. BUSCA DO VENDEDOR NO BANCO (REGRA)
  // ---------------------------------------------------------
  
  // Como as tabelas usam UUID, primeiro buscamos os IDs da equipe
  const { data: team } = await supabase
    .from('teams')
    .select('id')
    .eq('tenant_id', tenantId)
    .ilike('name', targetTeamName)
    .single();

  let assignedUserId = null;

  if (team) {
    // Busca a regra de roteamento para esta equipe e região
    const { data: rule } = await supabase
      .from('routing_rules')
      .select('assigned_user_id')
      .eq('tenant_id', tenantId)
      .eq('team_id', team.id)
      .or(`region.ilike.%${variables.regiao || 'TODAS'}%,region.eq.*`) // Busca região exata ou regra coringa '*'
      .order('priority', { ascending: true })
      .limit(1)
      .single();

    if (rule?.assigned_user_id) {
      assignedUserId = rule.assigned_user_id;
    } else {
      // Fallback: Pega qualquer vendedor daquela equipe se não houver regra de região específica
      const { data: fallbackUser } = await supabase
        .from('users')
        .select('id')
        .eq('team_id', team.id)
        .limit(1)
        .single();
      
      assignedUserId = fallbackUser?.id;
    }
  }

  // ---------------------------------------------------------
  // 3. ATUALIZAR O LEAD COM O VENDEDOR E STATUS
  // ---------------------------------------------------------
  if (assignedUserId) {
    await supabase
      .from('leads')
      .update({ 
        current_owner_id: assignedUserId,
        status: 'WAITING_SELLER' // Entrou na fila do vendedor (SLA conta a partir daqui)
      })
      .eq('id', leadId);

    console.log(`[Roteador] Lead ${leadId} atribuído ao vendedor ${assignedUserId}`);
    // TODO: Enviar notificação pelo webhook da Evolution API para o número do Vendedor
  } else {
    console.log(`[Roteador] Nenhum vendedor encontrado para a equipe ${targetTeamName}. Caiu no Limbo/Suporte.`);
  }

  return assignedUserId;
}
