const http = require('http');

const data = JSON.stringify({
  event: "messages.upsert",
  data: {
    messages: [
      {
        key: {
          remoteJid: "5511999998888@s.whatsapp.net", // Número falso de teste
          fromMe: false
        },
        message: {
          conversation: "Olá Lino.A1B2C3, preciso de umas 2 chapas perfuradas pequenas, sem instalação."
        }
      }
    ]
  }
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/webhook/evolution',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': data.length
  }
};

const req = http.request(options, (res) => {
  console.log(`Status do Webhook: ${res.statusCode}`);
  res.on('data', d => process.stdout.write(d));
});

req.on('error', error => console.error(error));
req.write(data);
req.end();
