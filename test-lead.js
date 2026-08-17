const fs = require('fs');
const https = require('https');

const envContent = fs.readFileSync('.env.local', 'utf-8');
let url = '', key = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/['"]/g, '');
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim().replace(/['"]/g, '');
}

const reqUrl = url + '/rest/v1/interactions?lead_id=eq.0a97e3a3-7f63-40af-902b-a8a484be611e&select=id,created_at,message_content,sender_type&order=created_at.desc&limit=10';

const req = https.request(reqUrl, {
  method: 'GET',
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Interactions:', body));
});

req.on('error', e => console.error(e));
req.end();
