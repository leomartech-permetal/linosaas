const { processLeadWithSkills } = require('./src/lib/openai');

async function run() {
  const history = [
    { sender_type: 'lead', message_content: 'Olá' }
  ];
  await processLeadWithSkills(history);
}

run();
