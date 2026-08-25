const fs = require('fs');
const https = require('https');

const envContent = fs.readFileSync('.env.local', 'utf-8');
let url = '', key = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = line.split('=')[1].trim().replace(/['"]/g, '');
  if (line.startsWith('SUPABASE_SERVICE_ROLE_KEY=')) key = line.split('=')[1].trim().replace(/['"]/g, '');
}

const reqData = JSON.stringify({
  evolution_instance_name: 'linooficial',
  evolution_key: 'DFF3C38E033C-4480-BABE-6521B3B50FB6'
});

const reqUrl = url + '/rest/v1/tenant_config?evolution_instance_name=eq.Li26';

const req = https.request(reqUrl, {
  method: 'PATCH',
  headers: {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  }
}, res => {
  let body = '';
  res.on('data', chunk => body += chunk);
  res.on('end', () => console.log('Update Result:', body));
});

req.on('error', e => console.error(e));
req.write(reqData);
req.end();
