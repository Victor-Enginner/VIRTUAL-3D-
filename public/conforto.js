// Conforto — modo calmo e mascotes. Nada aqui toca, fala ou se mexe sozinho: tudo começa desligado e você liga.
// As regras de verdade ficam em ui/conforto.js e ui/mascotes.js.
import { montarShell } from './ui/shell.js';
import { modoCalmo, preferencias, salvar } from './ui/conforto.js';
import { chamarMascote } from './ui/mascotes.js';

montarShell('conforto', { fundoNeural: false });
const $ = (s) => document.querySelector(s);

function desenhar() {
  const p = preferencias();
  const sistemaReduz = matchMedia('(prefers-reduced-motion: reduce)').matches;
  $('#pagina').innerHTML = `
    <section class="voz-bloco" aria-labelledby="h-calmo">
      <h2 id="h-calmo">Modo calmo</h2>
      <label class="check"><input type="checkbox" id="calmo" ${p.calmo ? 'checked' : ''}> Ligar o modo calmo neste navegador</label>
      <ul>
        <li>Sem animação decorativa (o fundo de letras que seguem o cursor, transições, confete).</li>
        <li>Agentes na Sala 3D vão direto aos lugares, sem multidão andando.</li>
        <li>Sem som da sala (digitação e envelopes) e sem mascotes.</li>
      </ul>
      <p class="sub">${sistemaReduz ? 'Seu sistema já pede "reduzir movimento": as animações já estão reduzidas, com ou sem o modo calmo.' : 'Se o seu sistema tiver "reduzir movimento" ligado, isso já vale sozinho.'}</p>
    </section>

    <section class="voz-bloco" aria-labelledby="h-mascotes">
      <h2 id="h-mascotes">Mascotes</h2>
      <label class="check"><input type="checkbox" id="mascotes" ${p.mascotes ? 'checked' : ''} ${p.calmo ? 'disabled' : ''}> Deixar as criaturas dos agentes visitarem a tela (desligado por padrão)</label>
      <ul>
        <li>Daemon (Alva), Wumpus (Atlas), Grue (Nova), Fantasma (Maia) e Verme (Leo).</li>
        <li>Ficam mais ausentes que presentes: somem por 2 a 6 minutos e ficam só 10 a 24 segundos.</li>
        <li>São pequenas (64 px), ficam nas bordas, olham para o seu cursor, às vezes brincam em dupla e somem “como mágica”.</li>
        <li>Nunca bloqueiam um clique, não fazem som e não aparecem no modo calmo nem na Sala 3D.</li>
      </ul>
      <label class="check"><input type="checkbox" id="mascotes-sistema" ${p.mascotesApesarDoSistema ? 'checked' : ''} ${p.calmo ? 'disabled' : ''}> Mostrar mesmo com “reduzir movimento” do sistema</label>
      <p class="sub">${sistemaReduz ? 'O seu computador está com as animações do Windows desligadas (comum para ganhar velocidade), então as criaturas só aparecem se você marcar esta opção.' : 'O seu sistema não pede menos movimento; esta opção só faz diferença se isso mudar.'}</p>
      <p><button class="btn" type="button" id="chamar-mascote" ${p.mascotes && !p.calmo ? '' : 'disabled'}>Chamar uma agora</button></p>
    </section>

    <section class="voz-bloco" aria-labelledby="h-regras">
      <h2 id="h-regras">Regras do sistema</h2>
      <ul>
        <li>Os agentes não falam: só trabalham e mostram o que fazem em texto.</li>
        <li>Você pode dar comandos de voz no Painel (microfone). O reconhecimento é do navegador.</li>
        <li>Nada toca som ou começa a se mexer sozinho; tudo que se mexe tem um botão para ligar e desligar.</li>
      </ul>
    </section>`;
  $('#pagina').setAttribute('aria-busy', 'false');

  $('#calmo').addEventListener('change', (e) => {
    salvar({ calmo: e.target.checked });
    $('#mascotes').disabled = e.target.checked;
    $('#mascotes-sistema').disabled = e.target.checked;
    $('#chamar-mascote').disabled = e.target.checked || !$('#mascotes').checked;
  });
  $('#mascotes').addEventListener('change', (e) => { salvar({ mascotes: e.target.checked }); $('#chamar-mascote').disabled = !e.target.checked || preferencias().calmo; });
  $('#mascotes-sistema').addEventListener('change', (e) => salvar({ mascotesApesarDoSistema: e.target.checked }));
  $('#chamar-mascote').addEventListener('click', () => chamarMascote());
}

desenhar();
if (modoCalmo()) document.title = 'Conforto (modo calmo) · Prospector';
