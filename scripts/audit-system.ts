import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log('=== LINO SYSTEM AUDIT: VARREDURA TÉCNICA ===\n');

  // 1. CONFIGURAÇÃO
  const { data: config } = await supabase.from('tenant_config').select('*').limit(1).single();
  console.log(config?.master_prompt ? '✅ Master Prompt: OK' : '❌ Master Prompt: VAZIO');

  // 2. REGRAS DE ROTEAMENTO (SCHEMA REAL)
  const { data: rules } = await supabase.from('routing_rules').select('*');
  const { data: teams } = await supabase.from('teams').select('*');
  const { data: products } = await supabase.from('products').select('id, name');
  
  console.log('\n--- REGRAS DE ROTEAMENTO ---');
  if (!rules || rules.length === 0) {
    console.log('❌ Nenhuma regra de roteamento ativa.');
  } else {
    rules.forEach((r, idx) => {
      const team = teams?.find(t => t.id === r.team_id);
      const productNames = products?.filter(p => r.product_ids?.includes(p.id)).map(p => p.name).join(', ');
      console.log(`Regra #${idx + 1}: Equipe [${team?.name || 'N/A'}] | Produtos: ${productNames || 'Todos'} | Express: ${r.is_express ? 'SIM' : 'NÃO'}`);
    });
  }

  // 3. VENDEDORES E INSTÂNCIAS
  const { data: sellers } = await supabase.from('admin_users').select('id, name');
  const { data: instances } = await supabase.from('instances').select('assigned_user_id, active');
  
  console.log('\n--- SAÚDE DOS VENDEDORES ---');
  sellers?.forEach(s => {
    const hasInstance = instances?.some(i => i.assigned_user_id === s.id && i.active);
    console.log(`${hasInstance ? '✅' : '⚠️'} ${s.name}: ${hasInstance ? 'WhatsApp Ativo' : 'SEM WHATSAPP'}`);
  });

  // 4. LEADS ÓRFÃOS
  const { data: orphans } = await supabase.from('leads').select('id, name').eq('status', 'WAITING_SELLER').is('current_owner_id', null);
  console.log('\n--- LEADS SEM ATRIBUIÇÃO ---');
  console.log(orphans && orphans.length > 0 ? `❌ ${orphans.length} Leads parados sem vendedor!` : '✅ Tudo OK.');

  console.log('\n=== AUDITORIA FINALIZADA ===');
}

runAudit();
