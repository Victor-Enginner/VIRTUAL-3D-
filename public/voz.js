// Voz e conforto — escolher a voz da Alva de ouvido e ligar o modo calmo. Nada aqui fala sozinho:
// cada voz só toca quando você aperta "Ouvir". As regras de verdade ficam em ui/audio.js.
import { montarShell } from './ui/shell.js';
import { esc } from './ui/util.js';
import { falar, modoCalmo, parar, preferencias, salvar, suportaVoz, vozesPtBR } from './ui/audio.js';
import { chamarMascote } from './ui/mascotes.js';

montarShell('voz', { fundoNeural: false });
const $ = (s) => document.querySelector(s);
const FRASE = 'Bom dia, Victor. Você tem doze mensagens esperando aprovação e um lead novo em Franca.';

const tipoDaVoz = (v) => (/natural|neural/i.test(v.name) ? 'natural (rede neural)' : /online/i.test(v.name) ? 'online' : v.localService ? 'do Windows, offline' : 'online');

async function desenhar() {
  const p = preferencias();
  const vozes = await vozesPtBR();
  const temNatural = vozes.some((v) => /natural|neural/i.test(v.name));
  const escolhida = vozes.find((v) => v.name === p.voz)?.name || vozes[0]?.name || null;

  $('#pagina').innerHTML = `
    <section class="voz-bloco" aria-labelledby="h-calmo">
      <h2 id="h-calmo">Modo calmo</h2>
      <label class="check"><input type="checkbox" id="calmo" ${p.calmo ? 'checked' : ''}> Ligar o modo calmo neste navegador</label>
      <ul>
        <li>Sem animação decorativa (o fundo de rede neural, transições, confete).</li>
        <li>Agentes na Sala 3D vão direto aos lugares, sem multidão andando.</li>
        <li>Sem som da sala (digitação e envelopes) e sem voz automática.</li>
        <li>A voz continua disponível, mas só quando você aperta "Ouvir".</li>
      </ul>
      <p class="sub">${matchMedia('(prefers-reduced-motion: reduce)').matches ? 'Seu sistema já pede "reduzir movimento": as animações já estão reduzidas, com ou sem o modo calmo.' : 'Se o seu sistema tiver "reduzir movimento" ligado, isso já vale sozinho.'}</p>
    </section>

    <section class="voz-bloco" aria-labelledby="h-voz">
      <h2 id="h-voz">Voz da Alva</h2>
      ${!suportaVoz() ? '<p>Este navegador não tem voz de leitura. Use o Chrome ou o Edge.</p>' : !vozes.length ? '<p>Nenhuma voz em português do Brasil foi encontrada neste navegador. No Windows: Configurações → Hora e idioma → Fala → Adicionar vozes → Português (Brasil).</p>' : `
      <p class="sub">Ouça cada uma e escolha. A frase de teste: “${esc(FRASE)}”</p>
      ${!temNatural ? '<p class="sub"><b>Dica:</b> as vozes mais naturais (“Natural”) aparecem no <b>Microsoft Edge</b>. Abra esta mesma página nele e compare.</p>' : ''}
      <div class="voz-lista" role="radiogroup" aria-label="Voz da Alva">
        ${vozes.map((v, i) => `<div class="voz-linha ${v.name === escolhida ? 'voz-escolhida' : ''}">
          <label class="nome"><input type="radio" name="voz" value="${esc(v.name)}" ${v.name === escolhida ? 'checked' : ''}><span><b>${esc(v.name.replace(/^Microsoft /, '').replace(/ - Portuguese \(Brazil\)$/, ''))}</b><small>${esc(tipoDaVoz(v))} · ${esc(v.lang)}</small></span></label>
          <button class="btn" type="button" data-ouvir="${i}">Ouvir</button>
        </div>`).join('')}
      </div>
      <div class="voz-controle"><label for="vel">Velocidade</label><input id="vel" type="range" min="0.7" max="1.2" step="0.05" value="${p.velocidade}"><output id="vel-v">${p.velocidade.toFixed(2)}×</output></div>
      <div class="voz-controle"><label for="vol">Volume</label><input id="vol" type="range" min="0.1" max="1" step="0.05" value="${p.volume}"><output id="vol-v">${Math.round(p.volume * 100)}%</output></div>
      <p><button class="btn primario" type="button" id="ouvir-escolhida">Ouvir a voz escolhida</button> <button class="btn fantasma" type="button" id="parar">Parar</button></p>`}
    </section>

    <section class="voz-bloco" aria-labelledby="h-mascotes">
      <h2 id="h-mascotes">Mascotes</h2>
      <label class="check"><input type="checkbox" id="mascotes" ${p.mascotes ? 'checked' : ''} ${p.calmo ? 'disabled' : ''}> Deixar os mascotes dos agentes visitarem a tela (desligado por padrão)</label>
      <ul>
        <li>Ficam mais ausentes que presentes: somem por 2 a 6 minutos e ficam só 10 a 24 segundos.</li>
        <li>São pequenos (64 px), ficam nas bordas, olham para você, às vezes brincam em dupla e somem “como mágica”.</li>
        <li>Nunca bloqueiam um clique, não fazem som e não aparecem no modo calmo, quando a Alva fala ou na Sala 3D.</li>
      </ul>
      <label class="check"><input type="checkbox" id="mascotes-sistema" ${p.mascotesApesarDoSistema ? 'checked' : ''} ${p.calmo ? 'disabled' : ''}> Mostrar mesmo com “reduzir movimento” do sistema</label>
      <p class="sub">${matchMedia('(prefers-reduced-motion: reduce)').matches ? 'O seu computador está com as animações do Windows desligadas (comum para ganhar velocidade), então os mascotes só aparecem se você marcar esta opção.' : 'O seu sistema não pede menos movimento; esta opção só faz diferença se isso mudar.'}</p>
      <p><button class="btn" type="button" id="chamar-mascote" ${p.mascotes && !p.calmo ? '' : 'disabled'}>Chamar um agora</button></p>
    </section>

    <section class="voz-bloco" aria-labelledby="h-resp">
      <h2 id="h-resp">Quando a Alva fala</h2>
      <label class="check"><input type="checkbox" id="respostas" ${p.respostas ? 'checked' : ''}> Ler em voz alta a resposta dos comandos que eu falo (desligado por padrão)</label>
      <ul>
        <li>A Alva nunca fala sozinha: só quando você aperta “Ouvir” ou, se você ligar a opção acima, como resposta a um comando seu.</li>
        <li>Uma voz por vez. Se a TV ou o som da sala estiverem tocando, eles pausam enquanto ela fala e voltam depois.</li>
        <li>O texto sempre aparece na tela, com botão Parar. A tecla Esc também para, e trocar de aba também.</li>
        <li>O que ela diz vem de regras com dados reais (resumo, confirmação do comando), nunca de um modelo inventando frase.</li>
      </ul>
    </section>`;
  $('#pagina').setAttribute('aria-busy', 'false');

  $('#calmo').addEventListener('change', (e) => { salvar({ calmo: e.target.checked }); if (e.target.checked) $('#respostas').checked = false; $('#mascotes').disabled = e.target.checked; $('#mascotes-sistema').disabled = e.target.checked; $('#chamar-mascote').disabled = e.target.checked || !$('#mascotes').checked; });
  $('#respostas').addEventListener('change', (e) => salvar({ respostas: e.target.checked }));
  $('#mascotes').addEventListener('change', (e) => { salvar({ mascotes: e.target.checked }); $('#chamar-mascote').disabled = !e.target.checked || preferencias().calmo; });
  $('#mascotes-sistema').addEventListener('change', (e) => salvar({ mascotesApesarDoSistema: e.target.checked }));
  $('#chamar-mascote').addEventListener('click', () => chamarMascote());
  if (!vozes.length) return;
  document.querySelectorAll('[name=voz]').forEach((r) => r.addEventListener('change', () => {
    salvar({ voz: r.value });
    document.querySelectorAll('.voz-linha').forEach((l) => l.classList.toggle('voz-escolhida', l.contains(r) && r.checked));
  }));
  document.querySelectorAll('[data-ouvir]').forEach((b) => b.addEventListener('click', () => {
    const v = vozes[Number(b.dataset.ouvir)];
    salvar({ voz: v.name });
    document.querySelectorAll('[name=voz]').forEach((r) => { r.checked = r.value === v.name; r.closest('.voz-linha').classList.toggle('voz-escolhida', r.checked); });
    falar(FRASE, { origem: 'clique' });
  }));
  $('#ouvir-escolhida').addEventListener('click', () => falar(FRASE, { origem: 'clique' }));
  $('#parar').addEventListener('click', parar);
  $('#vel').addEventListener('input', (e) => { $('#vel-v').textContent = `${Number(e.target.value).toFixed(2)}×`; });
  $('#vel').addEventListener('change', (e) => { salvar({ velocidade: Number(e.target.value) }); falar(FRASE, { origem: 'clique' }); });
  $('#vol').addEventListener('input', (e) => { $('#vol-v').textContent = `${Math.round(e.target.value * 100)}%`; });
  $('#vol').addEventListener('change', (e) => { salvar({ volume: Number(e.target.value) }); falar(FRASE, { origem: 'clique' }); });
}

desenhar();
if (modoCalmo()) document.title = 'Voz e conforto (modo calmo) · Prospector';
