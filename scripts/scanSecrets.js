const fs = require('node:fs');
const { execFileSync } = require('node:child_process');
const rules = [
  ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['github-token', /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ['embedded-bcrypt', /\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}/],
  ['inline-secret', /(?:JWT_SECRET|password|hashedPassword|clave)\s*[:=]\s*['"][^'"\r\n]{8,}['"]/i],
];
function scanText(text) { return rules.filter(([, pattern]) => pattern.test(text)).map(([name]) => name); }
function scanRepository() {
  const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const findings = [];
  for (const file of files) {
    if (file.startsWith('tests/') || file.endsWith('.test.js') || file.endsWith('.test.jsx') || file === '.env.example' || !/\.(js|json|yml|yaml|md|env)$/.test(file) || !fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, 'utf8');
    for (const rule of scanText(text)) findings.push({ file, rule });
  }
  return findings;
}
if (require.main === module) {
  const findings = scanRepository();
  console.log(JSON.stringify({ findings }));
  if (findings.length) process.exitCode = 1;
}
module.exports = { scanText, scanRepository };
