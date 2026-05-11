const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function validateDashboardData() {
  console.log('🚀 Iniciando teste de validação para Catalisa Farma...');

  const testData = {
    client_name: 'Drogacruz Farmácias Associadas',
    platform: 'Meta Ads',
    campaign_name: 'Grupo de Ofertas - Bairro Centro',
    campaign_type: 'Engajamento',
    period_start: new Date().toISOString().split('T')[0],
    spend: 450.00,
    results: 32, // Simulando 32 entradas no grupo
    impressions: 12500,
    reach: 9800,
    clicks: 450,
    profile_visits: 85,
    insights: 'Campanha de grupo performando 15% acima da meta. Custo por entrada está saudável em R$ 14,06.',
    next_steps: 'Escalar investimento em 10%;Testar novo criativo de vídeo'
  };

  const { data, error } = await supabase
    .from('ads_metrics_catalisa')
    .insert([testData])
    .select();

  if (error) {
    console.error('❌ Erro ao inserir dado de teste:', error.message);
    if (error.message.includes('relation "ads_metrics_catalisa" does not exist')) {
      console.log('👉 ATENÇÃO: Você esqueceu de rodar o SQL no console do Supabase!');
    }
  } else {
    console.log('✅ Sucesso! Dado da Drogacruz inserido com sucesso.');
    console.log('🔗 Agora acesse: http://localhost:3000/dashboard/catalisa');
    console.log('---');
    console.log('Dados inseridos:');
    console.table(data);
  }
}

validateDashboardData();
