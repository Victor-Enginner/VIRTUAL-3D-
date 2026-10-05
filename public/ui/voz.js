// Comando de voz do Victor: SÓ ENTRADA, pelo microfone, quando ele clica. Os agentes não falam (docs/ACESSIBILIDADE.md).
// O reconhecimento é do navegador (Web Speech API): no Chrome e no Edge o áudio é processado pelo serviço deles;
// Firefox e Brave não têm. Um módulo só para todas as telas que têm caixa de comando (Início, Painel).
//
//   ligarVoz(botao, { aoParcial(texto), aoFinal(texto), aoErro(mensagem), aoMudar(ouvindo) })
// O botão ganha a classe `ouvindo` enquanto escuta (estado parado, sem animação) e aria-pressed.

const MENSAGENS = {
  'not-allowed': 'Permissão de microfone negada. Clique no cadeado da barra de endereço e libere o microfone para este site.',
  'service-not-allowed': 'O navegador bloqueou o reconhecimento de voz neste site.',
  'no-speech': 'Não ouvi nada. Clique no microfone e fale de novo.',
  'audio-capture': 'Não encontrei um microfone. Confira se ele está conectado.',
  network: 'O reconhecimento de voz do navegador precisa de internet.',
};
export const mensagemDeErroDeVoz = (codigo) => MENSAGENS[codigo] || `Voz: ${codigo}`;

export const vozDisponivel = () => Boolean(globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition);

export function ligarVoz(botao, { aoParcial, aoFinal, aoErro, aoMudar } = {}) {
  if (!botao) return null;
  const Rec = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
  if (!Rec) {
    botao.disabled = true;
    botao.title = 'Este navegador não tem reconhecimento de voz (use Chrome ou Edge). Digite o comando.';
    return null;
  }
  botao.title = 'Falar um comando (o reconhecimento é do navegador: no Chrome o áudio vai para o Google)';
  botao.setAttribute('aria-pressed', 'false');
  let rec = null;
  const mudar = (ouvindo) => {
    botao.classList.toggle('ouvindo', ouvindo);
    botao.setAttribute('aria-pressed', String(ouvindo));
    aoMudar?.(ouvindo);
  };
  botao.addEventListener('click', () => {
    if (rec) { rec.stop(); return; } // segundo clique encerra
    rec = new Rec();
    rec.lang = 'pt-BR';
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (ev) => {
      const texto = [...ev.results].map((r) => r[0].transcript).join(' ').trim();
      aoParcial?.(texto);
      if (ev.results[ev.results.length - 1].isFinal && texto) aoFinal?.(texto);
    };
    rec.onerror = (ev) => aoErro?.(mensagemDeErroDeVoz(ev.error));
    rec.onend = () => { rec = null; mudar(false); };
    try { rec.start(); mudar(true); } catch (e) { rec = null; aoErro?.(`Não consegui ligar o microfone: ${e.message}`); }
  });
  return { ouvindo: () => Boolean(rec), parar: () => rec?.stop() };
}
