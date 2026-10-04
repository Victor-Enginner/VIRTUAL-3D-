// Atalho "Escritório Virtual": ícone válido, scripts presentes, nada com caminho do seu PC no git.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const ler = (f) => fs.readFileSync(path.join(RAIZ, f), 'utf8');

test('o ícone é um .ico de verdade, com os tamanhos que o Windows usa, e tem o PNG ao lado', () => {
  const ico = fs.readFileSync(path.join(RAIZ, 'public/icone/prospector.ico'));
  assert.deepEqual([ico.readUInt16LE(0), ico.readUInt16LE(2)], [0, 1], 'cabeçalho ICO');
  assert.ok(ico.readUInt16LE(4) >= 7, 'um quadro por tamanho (16 a 256), com versão grossa para os pequenos');
  assert.ok(fs.statSync(path.join(RAIZ, 'public/icone/prospector.png')).size > 5_000);
});

test('o atalho aponta para o início rápido e usa o ícone; o .lnk não vai para o git', () => {
  assert.match(ler('scripts/criar-atalhos.ps1'), /iniciar-escritorio\.bat/);
  assert.match(ler('scripts/criar-atalhos.ps1'), /prospector\.ico/);
  assert.match(ler('.gitignore'), /^\*\.lnk$/m);
});

test('o início rápido não reinicia o que já está ligado e abre a Sala', () => {
  const b = ler('iniciar-escritorio.bat');
  assert.match(b, /Get-NetTCPConnection -LocalPort %PORT% -State Listen/);
  assert.match(b, /\/sala\.html/);
  assert.ok(b.includes('node src' + String.fromCharCode(92) + 'server.mjs'), 'sobe o servidor');
});

test('a instalação oferece criar o atalho e o gerador do ícone existe', () => {
  assert.match(ler('instalacao.bat'), /criar-atalhos\.ps1/);
  assert.ok(fs.existsSync(path.join(RAIZ, 'scripts/gerar_icone.py')));
});
