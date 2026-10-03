// TV ao vivo na sala de reunião: o sinal HLS público do canal (o mesmo que a Famelack toca) vira
// TEXTURA de vídeo na tela da TV 3D — objeto de verdade no mundo (perspectiva, móveis passam na frente).
// Começa desligada: só baixa vídeo quando você liga. Aceita qualquer link de canal da Famelack.
// O conteúdo é da emissora; aqui é uso pessoal, como assistir no site deles.
import * as THREE from 'three';
import { lerLinkFamelack, streamValido } from './tv-canal.js';
export { lerLinkFamelack, streamValido };

const DADOS = 'https://raw.githubusercontent.com/famelack/famelack-data/main/tv/compressed/countries/';
const HLS_JS = 'https://cdn.jsdelivr.net/npm/hls.js@1.7.3/dist/hls.mjs'; // versão fixa: nada muda sozinho
const CHAVE = 'prospector-tv:v1';
export const CANAL_PADRAO = { nome: 'Aratu On', pagina: 'https://famelack.com/tv/br/lua1c7mx0j9rv8', stream: 'https://cdn.live.br1.jmvstream.com/w/LVW-9359/LVW9359_XSyReL0QVf/playlist.m3u8' };

// procura o canal nos dados públicos da Famelack (arquivo .json comprimido com gzip)
export async function resolverCanal(link) {
  const l = lerLinkFamelack(link);
  if (!l) throw new Error('não parece um link de canal da Famelack (famelack.com/tv/pais/id)');
  const r = await fetch(`${DADOS}${l.pais}.json`);
  if (!r.ok) throw new Error(`lista do país "${l.pais}" indisponível (${r.status})`);
  const texto = await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).text();
  const lista = JSON.parse(texto);
  const c = (Array.isArray(lista) ? lista : Object.values(lista)).find((x) => x.nanoid === l.id);
  if (!c) throw new Error('canal não encontrado na lista da Famelack');
  const stream = (c.sources?.streams || []).find(streamValido);
  if (!stream) throw new Error(c.sources?.youtube ? 'esse canal é do YouTube; na TV 3D só entram canais com sinal HLS' : 'esse canal não tem sinal HLS público');
  return { nome: String(c.name || 'Canal').slice(0, 60), pagina: `https://famelack.com/tv/${l.pais}/${l.id}`, stream, geoBloqueado: Boolean(c.isGeoBlocked) };
}

// tela de espera (TV desligada): parece uma TV em standby, com o canal e como ligar — não um buraco preto
function telaDeEspera(nome) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 288;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 512, 288);
  grad.addColorStop(0, '#05070b'); grad.addColorStop(1, '#0d1420');
  g.fillStyle = grad; g.fillRect(0, 0, 512, 288);
  g.strokeStyle = '#00edff33'; g.lineWidth = 2; g.strokeRect(14, 14, 484, 260);
  g.fillStyle = '#00edff'; g.font = '600 30px Inter, "Segoe UI", system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText('TV AO VIVO', 256, 120);
  g.fillStyle = '#a1a1aa'; g.font = '400 22px Inter, "Segoe UI", system-ui, sans-serif';
  g.fillText(nome, 256, 158);
  g.fillStyle = '#b7ff00'; g.font = '500 18px Inter, "Segoe UI", system-ui, sans-serif';
  g.fillText('toque em "TV" no topo da Sala para ligar', 256, 210);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function montarTV({ grupoTv, grupos = null, aoMudar = () => {} }) {
  const todas = grupos || [grupoTv];
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous'; // o servidor do sinal libera CORS: dá para virar textura WebGL
  video.playsInline = true; video.muted = true; video.preload = 'none';
  const textura = new THREE.VideoTexture(video);
  textura.colorSpace = THREE.SRGBColorSpace;
  const desligada = new THREE.MeshBasicMaterial({ toneMapped: false });
  const ligada = new THREE.MeshBasicMaterial({ map: textura, toneMapped: false });
  const telas = [];
  let hls = null, ligadaAgora = false, carregando = false, erro = '';
  let canal = CANAL_PADRAO;
  try { const s = JSON.parse(localStorage.getItem(CHAVE) || 'null'); if (s && streamValido(s.stream)) canal = s; } catch { /* sem preferência salva */ }

  const trocarEspera = () => { desligada.map?.dispose(); desligada.map = telaDeEspera(canal.nome); desligada.needsUpdate = true; };
  trocarEspera();
  const pintar = () => { for (const t of telas) t.material = ligadaAgora && !carregando && !erro ? ligada : desligada; };

  // cada tela é um plano encaixado na frente do modelo da TV, medido depois que ele carrega;
  // todas usam o MESMO vídeo (um download só, mesmo com duas TVs)
  for (const grupo of todas) grupo.userData.pronto?.then(() => {
    const caixa = new THREE.Box3().setFromObject(grupo);
    const t = caixa.getSize(new THREE.Vector3());
    const w = t.x * 0.9, h = Math.min(w * 9 / 16, t.y * 0.62);
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(w, h), desligada);
    tela.position.set((caixa.min.x + caixa.max.x) / 2, caixa.max.y - t.y * 0.06 - h / 2, caixa.max.z + 0.004);
    tela.name = telas.length ? `tela-tv-${telas.length + 1}` : 'tela-tv';
    grupo.parent.add(tela);
    telas.push(tela);
    pintar();
    aoMudar(estado());
  });

  const estado = () => ({ ligada: ligadaAgora, carregando, erro, canal, som: !video.muted, telas: telas.length });

  async function tocar() {
    erro = ''; carregando = true; aoMudar(estado());
    try {
      if (hls) { hls.destroy(); hls = null; }
      if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = canal.stream; // HLS nativo (Safari, Android)
      else {
        const { default: Hls } = await import(HLS_JS); // só baixa o leitor de HLS quando a TV liga
        if (!Hls.isSupported()) throw new Error('este navegador não toca HLS');
        hls = new Hls({ liveDurationInfinity: true, lowLatencyMode: false, maxBufferLength: 20 });
        // sinal caiu: tenta se recuperar sozinho (padrão do hls.js), até 3 vezes com espera crescente
        let tentativas = 0;
        hls.on(Hls.Events.FRAG_LOADED, () => { tentativas = 0; });
        hls.on(Hls.Events.ERROR, (_e, d) => {
          if (!d.fatal) return;
          if (tentativas < 3 && (d.type === Hls.ErrorTypes.NETWORK_ERROR || d.type === Hls.ErrorTypes.MEDIA_ERROR)) {
            tentativas++;
            erro = ''; carregando = true; aoMudar(estado());
            setTimeout(() => { if (!hls) return; if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError(); else hls.startLoad(); carregando = false; aoMudar(estado()); }, 1500 * tentativas);
            return;
          }
          erro = `sinal caiu (${d.details}) — tente Ligar de novo`; pintar(); aoMudar(estado());
        });
        hls.loadSource(canal.stream);
        hls.attachMedia(video);
      }
      await video.play();
    } catch (e) { erro = e.name === 'NotAllowedError' ? 'o navegador bloqueou o vídeo: toque em Ligar de novo' : e.message; }
    carregando = false; pintar(); aoMudar(estado());
  }

  function parar() {
    video.pause();
    if (hls) { hls.destroy(); hls = null; }
    video.removeAttribute('src'); video.load(); // solta a conexão: TV desligada não baixa nada
    pintar();
  }

  // aba escondida: pausa o download; ao voltar, retoma no ao vivo
  document.addEventListener('visibilitychange', () => {
    if (!ligadaAgora) return;
    if (document.hidden) parar(); else tocar();
  });

  return {
    estado,
    async ligar() { ligadaAgora = true; await tocar(); },
    desligar() { ligadaAgora = false; parar(); erro = ''; aoMudar(estado()); },
    som() { video.muted = !video.muted; aoMudar(estado()); },
    async trocar(link) {
      const novo = await resolverCanal(link);
      canal = novo;
      trocarEspera();
      try { localStorage.setItem(CHAVE, JSON.stringify(canal)); } catch { /* só não lembra */ }
      if (ligadaAgora) await tocar(); else aoMudar(estado());
      return canal;
    },
  };
}
