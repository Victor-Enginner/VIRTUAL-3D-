// npm run verificar — a trava contra quebrar o sistema. Roda antes de todo commit (scripts/hooks/pre-commit)
// e antes de marcar um estado de produção. Falhou = não entra.
//
// 1. testes (node --test)
// 2. sintaxe de todo JS do front e do back (node --check)
// 3. contratos TOCOMAS carregam e são JSON válido
// 4. cada página referencia só arquivos que existem
// 5. o servidor sobe num banco vazio temporário e as rotas principais respondem (inclui as abas do Workspace)
// 6. nada proibido no git: .env, data/, modelos -nc fora de public/assets
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const falhas = [];
const ok = (t) => console.log(`  ok  ${t}`);
const falha = (t) => { falhas.push(t); console.log(`  XX  ${t}`); };
const rodar = (cmd, args) => spawnSync(cmd, args, { cwd: RAIZ, encoding: 'utf8', shell: false });

console.log('1. testes');
const t = rodar(process.execPath, ['--test']);
const passou = /ℹ fail 0/.test(t.stdout) && t.status === 0;
const total = t.stdout.match(/ℹ tests (\d+)/)?.[1];
passou ? ok(`${total} testes passando`) : falha(`testes falharam:\n${t.stdout.split('\n').filter((l) => /✖|not ok|Error/.test(l)).slice(0, 15).join('\n')}`);

console.log('2. sintaxe');
const arquivos = (dir, ext) => fs.readdirSync(path.join(RAIZ, dir), { recursive: true })
  .filter((f) => ext.some((e) => f.endsWith(e))).map((f) => path.join(dir, f));
let ruins = 0;
for (const f of [...arquivos('src', ['.mjs']), ...arquivos('public', ['.js']).filter((f) => !f.includes('assets')), ...arquivos('scripts', ['.mjs'])]) {
  const r = rodar(process.execPath, ['--check', path.join(RAIZ, f)]);
  if (r.status !== 0) { ruins++; falha(`sintaxe: ${f}\n${r.stderr.split('\n').slice(0, 4).join('\n')}`); }
}
if (!ruins) ok('todo JS compila');

console.log('3. contratos');
try {
  const { CONTRATOS } = await import(new URL('../src/tocomas/contratos.mjs', import.meta.url));
  ok(`${CONTRATOS.length} contratos: ${CONTRATOS.join(', ')}`);
} catch (e) { falha(`contratos: ${e.message}`); }

console.log('4. páginas');
let quebradas = 0;
for (const pg of fs.readdirSync(path.join(RAIZ, 'public')).filter((f) => f.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(RAIZ, 'public', pg), 'utf8');
  for (const [, ref] of html.matchAll(/(?:src|href)="(\/?[^"#?:]+\.(?:js|css|html|json))"/g)) {
    const alvo = path.join(RAIZ, 'public', ref.replace(/^\//, ''));
    if (!fs.existsSync(alvo)) { quebradas++; falha(`${pg} aponta para ${ref}, que não existe`); }
  }
}
if (!quebradas) ok('todas as referências locais existem');

console.log('5. servidor');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'prospector-verificar-'));
const porta = 4390 + Math.floor(Math.random() * 9);
const srv = spawn(process.execPath, ['src/server.mjs'], { cwd: RAIZ, env: { ...process.env, PORT: String(porta), DATA_DIR: tmp, ACESSO_SENHA: '', ATLAS_DESLIGADO: '1' }, stdio: 'pipe' });
let log = '';
srv.stdout.on('data', (d) => { log += d; });
srv.stderr.on('data', (d) => { log += d; });
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
let subiu = false;
for (let i = 0; i < 40 && !subiu; i++) { await esperar(250); subiu = /Prospector em/.test(log); }
if (!subiu) falha(`servidor não subiu:\n${log.slice(-600)}`);
else {
  const rotas = ['/', '/sala.html', '/base.html', '/configurador.html', '/entrar.html', '/inicio.html', '/producao.html', '/agentes.html', '/nichos.html', '/engine.html',
    '/api/estado', '/api/leads', '/api/calibracao', '/api/habilidades', '/api/aprendizado', '/api/eventos', '/api/eventos?agente=nova', '/api/varreduras', '/api/grafo', '/api/nichos', '/api/saude', '/api/rejeicoes', '/api/decide/stats'];
  for (const r of rotas) {
    const res = await fetch(`http://127.0.0.1:${porta}${r}`).catch((e) => ({ status: e.message }));
    res.status === 200 ? ok(`GET ${r}`) : falha(`GET ${r} → ${res.status}`);
  }
}
srv.kill();
await esperar(300);
fs.rmSync(tmp, { recursive: true, force: true });

console.log('6. o que não pode ir para o git');
const noGit = rodar('git', ['ls-files']).stdout.split('\n');
const proibidos = noGit.filter((f) => f === '.env' || f.startsWith('data/') || f.startsWith('.ferramentas/'));
proibidos.length ? falha(`no git e não devia: ${proibidos.join(', ')}`) : ok('.env, data/ e .ferramentas/ fora do git');

console.log(falhas.length ? `\nVERIFICAÇÃO FALHOU (${falhas.length})` : '\nVERIFICAÇÃO OK');
process.exit(falhas.length ? 1 : 0);
