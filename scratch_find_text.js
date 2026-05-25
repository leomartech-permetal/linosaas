const fs = require('fs');
const path = require('path');

const targetText = 'routelead';

function removeAccents(str) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const cleanContent = removeAccents(content.toLowerCase());
      if (cleanContent.includes(targetText)) {
        console.log('Encontrado no arquivo:', fullPath);
      }
    }
  }
}

searchDir(path.join(__dirname, 'src'));
