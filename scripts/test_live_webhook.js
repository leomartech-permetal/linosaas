async function testWebhookLive() {
  const payload = {
    event: 'messages.upsert',
    instance: 'linooficial',
    data: {
      key: {
        remoteJid: '5516991415319@s.whatsapp.net',
        fromMe: false,
        id: 'TEST_LIVE_' + Date.now()
      },
      pushName: 'Leonardo Teste',
      message: {
        conversation: 'Olá, gostaria de cotação de gradil stadium para condomínio'
      }
    }
  };

  try {
    const res = await fetch('https://linosaas.vercel.app/api/webhook/evolution', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    console.log('Status HTTP:', res.status);
    const data = await res.json();
    console.log('Resposta do webhook:', data);
  } catch(e) {
    console.error('Erro na chamada do webhook:', e.message);
  }
}

testWebhookLive();
