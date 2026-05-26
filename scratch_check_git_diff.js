const fs = require('fs');
const { execSync } = require('child_process');

try {
  // Analisar skills/page.tsx fim
  const localSkills = fs.readFileSync('src/app/skills/page.tsx', 'utf8').split('\n');
  const gitSkills = execSync('git show HEAD:src/app/skills/page.tsx', { encoding: 'utf8' }).split('\n');
  console.log('=== SKILLS LOCAL FIM ===');
  console.log(localSkills.slice(-15).join('\n'));
  console.log('\n=== SKILLS HEAD FIM ===');
  console.log(gitSkills.slice(-15).join('\n'));

  // Analisar LeadDrawer.tsx inputCls
  const localDrawer = fs.readFileSync('src/app/components/LeadDrawer.tsx', 'utf8').split('\n');
  const gitDrawer = execSync('git show HEAD:src/app/components/LeadDrawer.tsx', { encoding: 'utf8' }).split('\n');
  console.log('\n=== DRAWER LOCAL INICIO ===');
  console.log(localDrawer.slice(10, 20).join('\n'));
  console.log('\n=== DRAWER HEAD INICIO ===');
  console.log(gitDrawer.slice(10, 20).join('\n'));

} catch (e) {
  console.error(e);
}
