import { processLeadWithSkills } from './src/lib/openai';

async function test() {
  console.log('Testando IA localmente...');
  const history = [
    { sender_type: 'lead', message_content: 'Oi' }
  ];
  
  try {
    const result = await processLeadWithSkills(history);
    console.log('Resultado da IA:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Erro no teste de IA:', error);
  }
}

test();
