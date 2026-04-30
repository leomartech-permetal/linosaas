// fetch nativo

async function sendWebhook(messageText) {
  const data = {
    event: "messages.upsert",
    data: {
      messages: [
        {
          key: {
            remoteJid: "5516991415319@s.whatsapp.net",
            fromMe: false
          },
          message: {
            conversation: messageText
          }
        }
      ]
    }
  };

  try {
    const res = await fetch('http://localhost:3000/api/webhook/evolution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    const body = await res.text();
    console.log(`[Status: ${res.status}] -> ${body}`);
  } catch (error) {
    console.error('Error sending webhook:', error);
  }
}

async function runTests() {
  console.log('--- TESTE: Iniciando conversa ---');
  await sendWebhook("Olá! Quero ver orçamentos");
  
  console.log('\n--- TESTE: 10 Segundos depois, cliente responde o produto ---');
  await new Promise(r => setTimeout(r, 10000));
  await sendWebhook("Eu preciso de piso industrial pra minha fábrica.");
  
  console.log('\n--- TESTE: 10 Segundos depois, cliente diz a região ---');
  await new Promise(r => setTimeout(r, 10000));
  await sendWebhook("Sou de São Paulo capital, DDD 11.");
}

runTests();
