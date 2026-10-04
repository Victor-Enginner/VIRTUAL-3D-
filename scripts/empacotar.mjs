// npm run empacotar — gera um .zip para levar no pendrive/Drive/VPS.
//   node scripts/empacotar.mjs                 só código e assets (o que o git versiona)
//   node scripts/empacotar.mjs --com-banco     inclui o banco CRIPTOGRAFADO (AES-256-GCM, senha pedida na hora)
//   node scripts/empacotar.mjs --abrir ARQ.enc [SAIDA.db]   descriptografa um banco levado no pacote
//
// Segurança por construção: a lista de arquivos vem de `git ls-files`, então .env, data/, .ferramentas/ e chaves
// nunca entram. Mesmo assim há uma segunda trava por nome. Para abrir no outro PC: descompactar → instalacao.bat.
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { CONFIG, ROOT } from '../src/config.mjs';

const MAGIA = Buffer.from('PROSPECTOR-DB1');
const PROIBIDOS = [/(^|\/)\.env($|\.)/, /(^|\/)data\//, /(^|\/)\.ferramentas\//, /\.(db|sqlite|enc|pem|key)$/i, /\.api-key$/, /id_(rsa|ed25519)/, /(^|\/)\.netlify\//];
const permitido = (f) => !PROIBIDOS.some((r) => r.test(f)) || /(^|\/)\.env\.example$/.test(f);

// senha sem eco no terminal (ou PROSPECTOR_SENHA_BANCO para uso automático)
function pedirSenha(texto) {
  if (process.env.PROSPECTOR_SENHA_BANCO) return Promise.resolve(process.env.PROSPECTOR_SENHA_BANCO);
  return new Promise((ok) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(texto)) process.stdout.write(s); };
    rl.question(texto, (r) => { rl.close(); process.stdout.write('\n'); ok(r); });
  });
}
const chave = (senha, sal) => crypto.scryptSync(senha, sal, 32, { N: 2 ** 15, r: 8, p: 1, maxmem: 128 * 1024 * 1024 });

export function cifrar(buf, senha) {
  const sal = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', chave(senha, sal), iv);
  const dados = Buffer.concat([c.update(buf), c.final()]);
  return Buffer.concat([MAGIA, sal, iv, c.getAuthTag(), dados]);
}
export function decifrar(buf, senha) {
  if (!buf.subarray(0, MAGIA.length).equals(MAGIA)) throw new Error('arquivo não é um banco do Prospector');
  let o = MAGIA.length;
  const sal = buf.subarray(o, o += 16), iv = buf.subarray(o, o += 12), tag = buf.subarray(o, o += 16);
  const d = crypto.createDecipheriv('aes-256-gcm', chave(senha, sal), iv);
  d.setAuthTag(tag);
  try { return Buffer.concat([d.update(buf.subarray(o)), d.final()]); } catch { throw new Error('senha errada ou arquivo corrompido'); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--abrir') {
    const [, arq, saida = 'prospector.db'] = args;
    const buf = decifrar(fs.readFileSync(arq), await pedirSenha('Senha do banco: '));
    fs.writeFileSync(saida, buf);
    console.log(`Banco aberto em ${saida}. Copie para data/prospector.db com o servidor desligado.`);
    return;
  }
  const comBanco = args.includes('--com-banco');
  const git = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (git.status !== 0) throw new Error('git ls-files falhou (o empacotador precisa do repositório git)');
  const todos = git.stdout.split('\0').filter(Boolean);
  const arquivos = todos.filter(permitido).filter((f) => fs.existsSync(path.join(ROOT, f)));
  const barrados = todos.filter((f) => !permitido(f));
  if (barrados.length) console.log(`  barrados por segurança (estão no git, mas não vão no pacote): ${barrados.join(', ')}`);

  const stamp = new Date().toISOString().slice(0, 10);
  const pasta = path.join(CONFIG.dataDir, 'pacotes');
  fs.mkdirSync(pasta, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prospector-pacote-'));
  const lista = [...arquivos];

  if (comBanco) {
    const origem = path.join(CONFIG.dataDir, 'prospector.db');
    if (!fs.existsSync(origem)) throw new Error('não há banco em data/prospector.db para incluir');
    const senha = await pedirSenha('Senha para proteger o banco (guarde-a, não há recuperação): ');
    if (senha.length < 8) throw new Error('use uma senha de 8+ caracteres');
    if (!process.env.PROSPECTOR_SENHA_BANCO && senha !== await pedirSenha('Repita a senha: ')) throw new Error('as senhas não conferem');
    const copia = path.join(tmp, 'copia.db');
    const db = new DatabaseSync(origem); db.exec(`VACUUM INTO '${copia.replace(/'/g, "''")}'`); db.close(); // cópia consistente com o servidor ligado
    const enc = 'banco-protegido.enc';
    fs.writeFileSync(path.join(tmp, enc), cifrar(fs.readFileSync(copia), senha));
    fs.rmSync(copia);
    lista.push(`@${enc}`);
  }

  const saida = path.join(pasta, `prospector-${stamp}${comBanco ? '-com-banco' : ''}.zip`);
  fs.rmSync(saida, { force: true });
  // bsdtar (vem no Windows 10+, macOS e a maioria dos Linux): -a escolhe zip pela extensão
  const normais = lista.filter((f) => !f.startsWith('@'));
  fs.writeFileSync(path.join(tmp, 'lista.txt'), normais.join('\n'));
  const bsdtar = process.platform === 'win32' && process.env.SystemRoot && fs.existsSync(path.join(process.env.SystemRoot, 'System32', 'tar.exe'))
    ? path.join(process.env.SystemRoot, 'System32', 'tar.exe') : 'tar'; // o tar do Git Bash (GNU) confunde "C:" com máquina remota
  const r = spawnSync(bsdtar, ['-a', '-c', '-f', saida, '-C', ROOT, '-T', path.join(tmp, 'lista.txt'),
    ...(comBanco ? ['-C', tmp, 'banco-protegido.enc'] : [])], { encoding: 'utf8' });
  fs.rmSync(tmp, { recursive: true, force: true });
  if (r.status !== 0) throw new Error(`tar falhou: ${r.stderr}`);
  console.log(`\nPacote: ${saida}\n  ${arquivos.length} arquivos${comBanco ? ' + banco criptografado' : ''}, ${(fs.statSync(saida).size / 1024 / 1024).toFixed(1)} MB`
    + '\n  No outro computador: descompactar e rodar instalacao.bat'
    + (comBanco ? '\n  Para abrir o banco:  node scripts/empacotar.mjs --abrir banco-protegido.enc data/prospector.db' : '') + '\n');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`Erro: ${e.message}`); process.exit(1); });
}
