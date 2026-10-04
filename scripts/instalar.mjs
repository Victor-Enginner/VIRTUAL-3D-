// npm run instalar — confere o computador, cria o .env e mostra o que falta. Nada é baixado sem você dizer "s".
//   node scripts/instalar.mjs            interativo (pergunta antes de instalar qualquer coisa)
//   node scripts/instalar.mjs --checar   só relatório, nunca pergunta nem altera (exceto criar o .env a partir do exemplo)
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import readline from 'node:readline/promises';
import { CONFIG, ROOT } from '../src/config.mjs';

const SO_CHECAR = process.argv.includes('--checar') || !process.stdin.isTTY;
const linhas = [];
const marca = { ok: 'OK    ', aviso: 'AVISO ', falta: 'FALTA ', info: 'info  ' };
const reg = (nivel, titulo, detalhe = '') => {
  linhas.push({ nivel, titulo, detalhe });
  console.log(`  ${marca[nivel]} ${titulo}${detalhe ? `\n         ${detalhe.split('\n').join('\n         ')}` : ''}`);
};
const rodar = (cmd, args, o = {}) => spawnSync(cmd, args, { encoding: 'utf8', timeout: 120_000, ...o });
const rl = SO_CHECAR ? null : readline.createInterface({ input: process.stdin, output: process.stdout });
const perguntar = async (texto) => (SO_CHECAR ? false : /^s/i.test((await rl.question(`  ? ${texto} [s/N] `)).trim()));
const gb = (n) => (n / 1024 ** 3).toFixed(1);

console.log(`\nProspector — instalação e conferência  (${os.platform()} ${os.arch()}, ${gb(os.totalmem())} GB de RAM)\n`);

// 1. Node
const [maj, min] = process.versions.node.split('.').map(Number);
if (maj > 22 || (maj === 22 && min >= 5)) reg('ok', `Node ${process.versions.node}`, 'precisa de 22.5 ou mais (node:sqlite)');
else { reg('falta', `Node ${process.versions.node} é antigo`, 'instale o Node 22.5+ em https://nodejs.org (LTS)'); process.exit(1); }

// 2. .env
const envArq = path.join(ROOT, '.env');
if (fs.existsSync(envArq)) reg('ok', '.env existe');
else {
  const ex = path.join(ROOT, '.env.example');
  const base = fs.existsSync(ex) ? fs.readFileSync(ex, 'utf8') : '';
  fs.writeFileSync(envArq, base.replace(/^WEBHOOK_TOKEN=.*$/m, `WEBHOOK_TOKEN=${crypto.randomBytes(16).toString('hex')}`));
  reg('ok', '.env criado a partir do .env.example', 'WEBHOOK_TOKEN gerado ao acaso. O .env nunca vai para o git nem para o zip.');
}
if (!process.env.ACESSO_SENHA) reg('info', 'ACESSO_SENHA vazia', 'tudo bem no seu PC. Preencha no .env antes de abrir o painel para o celular ou para uma VPS.');

// 3. Disco (pasta de dados e pasta dos modelos)
const livre = (p) => { try { const s = fs.statfsSync(p); return s.bavail * s.bsize; } catch { return null; } };
const dataLivre = livre(fs.existsSync(CONFIG.dataDir) ? CONFIG.dataDir : ROOT);
if (dataLivre != null) reg(dataLivre < 2 * 1024 ** 3 ? 'aviso' : 'ok', `Disco dos dados: ${gb(dataLivre)} GB livres`, dataLivre < 2 * 1024 ** 3 ? 'pouco espaço para banco e backups' : '');
const pastaModelos = process.env.OLLAMA_MODELS || path.join(os.homedir(), '.ollama', 'models');
const modLivre = livre(fs.existsSync(pastaModelos) ? pastaModelos : os.homedir());
if (modLivre != null) {
  const pouco = modLivre < 5 * 1024 ** 3;
  reg(pouco ? 'aviso' : 'ok', `Disco dos modelos (${pastaModelos}): ${gb(modLivre)} GB livres`,
    pouco && !process.env.OLLAMA_MODELS ? 'aponte para outro disco:  setx OLLAMA_MODELS D:\\ollama\\modelos   (depois reinicie o Ollama)' : '');
}

// 4. Python + Playwright (só o coletor do Google Maps usa)
const py = CONFIG.python || 'python';
const pv = rodar(py, ['--version']);
if (pv.error || pv.status !== 0) reg('aviso', 'Python não encontrado', 'só o coletor do Google Maps precisa. Sem ele, a fonte OpenStreetMap continua funcionando. https://python.org');
else {
  reg('ok', (pv.stdout || pv.stderr).trim());
  const codigo = 'import os,sys\nfrom playwright.sync_api import sync_playwright as s\np=s().start()\nsys.exit(0 if os.path.exists(p.chromium.executable_path) else 3)\n';
  const testePw = () => rodar(py, ['-c', codigo]);
  const r = testePw();
  if (r.status === 0) reg('ok', 'Playwright + Chromium prontos');
  else {
    const semPacote = /ModuleNotFoundError|No module named/.test(r.stderr || '');
    reg('aviso', semPacote ? 'Playwright (Python) não instalado' : 'Chromium do Playwright não baixado', 'necessário para a fonte Google Maps (~150 MB)');
    if (await perguntar('Instalar agora (pip install playwright + baixar o Chromium)?')) {
      if (semPacote) rodar(py, ['-m', 'pip', 'install', 'playwright'], { timeout: 600_000, stdio: 'inherit' });
      rodar(py, ['-m', 'playwright', 'install', 'chromium'], { timeout: 900_000, stdio: 'inherit' });
      reg(testePw().status === 0 ? 'ok' : 'falta', 'Playwright depois da instalação');
    }
  }
}

// 5. Ollama: programa, servidor e modelos (lidos da pasta, funciona com o Ollama desligado)
const exeOllama = [process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'Ollama', 'ollama.exe'), 'ollama'].filter(Boolean)
  .find((c) => (path.isAbsolute(c) ? fs.existsSync(c) : !rodar(c, ['--version']).error));
if (!exeOllama) reg('aviso', 'Ollama não instalado', 'opcional: sem ele a Nova decide por regra e a Maia não escreve. https://ollama.com/download');
else {
  reg('ok', 'Ollama instalado');
  const no = await fetch(`${CONFIG.ollamaUrl}/api/version`, { signal: AbortSignal.timeout(2500) }).then((r) => r.json()).catch(() => null);
  reg(no ? 'ok' : 'info', no ? `Ollama ligado (v${no.version})` : 'Ollama desligado', no ? '' : 'o Prospector funciona sem ele; ligue só quando for gerar mensagens.');
  const ger = path.join(pastaModelos, 'manifests');
  const inst = [];
  if (fs.existsSync(ger)) {
    const andar = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? andar(path.join(d, e.name)) : [path.join(d, e.name)]));
    for (const f of andar(ger)) {
      const partes = path.relative(ger, f).split(path.sep).slice(1); // tira registry.ollama.ai
      if (partes[0] === 'library') partes.shift();
      const tag = partes.pop();
      const nome = `${partes.join('/')}:${tag}`;
      let completo = true, bytes = 0;
      try {
        const m = JSON.parse(fs.readFileSync(f, 'utf8'));
        for (const l of [m.config, ...m.layers]) {
          if (fs.existsSync(path.join(pastaModelos, 'blobs', l.digest.replace(':', '-')))) bytes += l.size; else completo = false;
        }
      } catch { completo = false; }
      inst.push({ nome, completo, bytes });
    }
  }
  const bons = inst.filter((m) => m.completo), cascas = inst.filter((m) => !m.completo);
  reg(bons.length ? 'ok' : 'aviso', `Modelos baixados: ${bons.length ? bons.map((m) => `${m.nome} (${gb(m.bytes)} GB)`).join(', ') : 'nenhum'}`);
  if (cascas.length) reg('info', `${cascas.length} registro(s) sem os arquivos do modelo (ocupam ~0 de disco): ${cascas.map((m) => m.nome).join(', ')}`, 'sem lixo para limpar. Para tirar da lista:  ollama rm <nome>');
  const norm = (n) => (n.includes(':') ? n : `${n}:latest`);
  for (const [papel, nome] of [['decisão (Nova)', CONFIG.modelos.decisao.modelo], ['escrita (Maia)', CONFIG.modelos.escrita.modelo], ['comando (Alva)', CONFIG.modelos.comando.modelo]]) {
    if (!nome) { reg('info', `Modelo de ${papel}: desligado (modelos.json) — a regra assume`); continue; }
    const tem = bons.some((m) => norm(m.nome) === norm(nome));
    reg(tem ? 'ok' : 'aviso', `Modelo de ${papel}: ${nome}`, tem ? '' : `não está baixado. Baixe com:  ollama pull ${nome}   — ou ajuste modelos.json para um que você já tem.`);
  }
}

// 6. Trava de commit (git hooks)
if (fs.existsSync(path.join(ROOT, '.git'))) {
  const hp = rodar('git', ['config', 'core.hooksPath'], { cwd: ROOT }).stdout.trim();
  if (hp === 'scripts/hooks') reg('ok', 'Trava de commit ligada (git hooks)');
  else {
    reg('aviso', 'Trava de commit desligada', 'sem ela um commit pode quebrar o sistema (docs/ESTADOS.md)');
    if (await perguntar('Ligar agora (git config core.hooksPath scripts/hooks)?')) { rodar('git', ['config', 'core.hooksPath', 'scripts/hooks'], { cwd: ROOT }); reg('ok', 'Trava de commit ligada'); }
  }
}

// 7. WhatsApp (pausado de propósito)
reg('info', 'WhatsApp (OpenWA) pausado', 'você conversa com os clientes na mão; o painel entrega o texto e o botão wa.me.');

rl?.close();
const faltas = linhas.filter((l) => l.nivel === 'falta').length, avisos = linhas.filter((l) => l.nivel === 'aviso').length;
console.log(`\n${faltas ? `${faltas} item(ns) faltando.` : 'Nada impede de iniciar.'}${avisos ? ` ${avisos} aviso(s): são opcionais.` : ''}\nIniciar:  npm start  →  http://127.0.0.1:${CONFIG.port}\n`);
process.exit(faltas ? 1 : 0);
