// native fetch

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
    const res = await fetch('https://linosaas.vercel.app/api/webhook/evolution', {
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

sendWebhook("Ping do terminal!");
