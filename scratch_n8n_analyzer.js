const fs = require('fs');

const data = JSON.parse(fs.readFileSync('C:/Users/MARKETING1/Documents/Projeto_Lino/n8n/LINO.SDR.json', 'utf8'));

console.log('Total Nodes:', data.nodes.length);
console.log('\nNode Types & Names:');
const types = new Set();
data.nodes.forEach(n => {
    types.add(n.type);
    if(n.type.includes('webhook') || n.type.includes('if') || n.type.includes('switch') || n.type.includes('openAI') || n.name.toLowerCase().includes('prompt')) {
        console.log(`- [${n.type}] ${n.name}`);
    }
});

console.log('\nPrompt/Instructions excerpt:');
const promptNodes = data.nodes.filter(n => n.name.toLowerCase().includes('prompt') || n.type.includes('openAI'));
promptNodes.forEach(n => {
    const text = JSON.stringify(n.parameters).substring(0, 300);
    console.log(`\n--- ${n.name} ---\n${text}...`);
});

