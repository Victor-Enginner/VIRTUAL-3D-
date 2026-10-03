// TV ao vivo na sala de reunião: o sinal HLS público do canal (o mesmo que a Famelack toca) vira
// TEXTURA de vídeo na tela da TV 3D — objeto de verdade no mundo (perspectiva, móveis passam na frente).
// Começa desligada: só baixa vídeo quando você liga. Aceita qualquer link de canal da Famelack.
// O conteúdo é da emissora; aqui é uso pessoal, como assistir no site deles.
import * as THREE from 'three';
import { lerLinkFamelack, streamValido } from './tv-canal.js';
export { lerLinkFamelack, streamValido };

const DADOS = 'https://raw.githubusercontent.com/famelack/famelack-data/main/tv/compressed/countries/';
const HLS_JS = 'https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.mjs';
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

export function montarTV({ grupoTv, aoMudar = () => {} }) {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous'; // o servidor do sinal libera CORS: dá para virar textura WebGL
  video.playsInline = true; video.muted = true; video.preload = 'none';
  const textura = new THREE.VideoTexture(video);
  textura.colorSpace = THREE.SRGBColorSpace;
  const desligada = new THREE.MeshStandardMaterial({ color: 0x050608, roughness: 0.18, metalness: 0.4 });
  const ligada = new THREE.MeshBasicMaterial({ map: textura, toneMapped: false });
  let tela = null, hls = null, ligadaAgora = false, carregando = false, erro = '';
  let canal = CANAL_PADRAO;
  try { const s = JSON.parse(localStorage.getItem(CHAVE) || 'null'); if (s && streamValido(s.stream)) canal = s; } catch { /* sem preferência salva */ }

  // a tela é um plano encaixado na frente do modelo da TV, medido depois que ele carrega
  grupoTv.userData.pronto?.then(() => {
    const caixa = new THREE.Box3().setFromObject(grupoTv);
    const t = caixa.getSize(new THREE.Vector3());
    const w = t.x * 0.9, h = Math.min(w * 9 / 16, t.y * 0.62);
    tela = new THREE.Mesh(new THREE.PlaneGeometry(w, h), desligada);
    tela.position.set((caixa.min.x + caixa.max.x) / 2, caixa.max.y - t.y * 0.06 - h / 2, caixa.max.z + 0.004);
    tela.name = 'tela-tv';
    grupoTv.parent.add(tela);
    aoMudar(estado());
  });

  const estado = () => ({ ligada: ligadaAgora, carregando, erro, canal, som: !video.muted, posicao: tela?.position.clone() || null });

  async function tocar() {
    erro = ''; carregando = true; aoMudar(estado());
    try {
      if (hls) { hls.destroy(); hls = null; }
      if (video.canPlayType('application/vnd.apple.mpegurl')) video.src = canal.stream; // HLS nativo (Safari, Android)
      else {
        const { default: Hls } = await import(HLS_JS); // só baixa o leitor de HLS quando a TV liga
        if (!Hls.isSupported()) throw new Error('este navegador não toca HLS');
        hls = new Hls({ liveDurationInfinity: true, lowLatencyMode: false, maxBufferLength: 20 });
        hls.on(Hls.Events.ERROR, (_e, d) => { if (d.fatal) { erro = `sinal caiu (${d.details})`; aoMudar(estado()); } });
        hls.loadSource(canal.stream);
        hls.attachMedia(video);
      }
      await video.play();
      if (tela) tela.material = ligada;
    } catch (e) { erro = e.name === 'NotAllowedError' ? 'o navegador bloqueou o vídeo: toque em Ligar de novo' : e.message; }
    carregando = false; aoMudar(estado());
  }

  function parar() {
    video.pause();
    if (hls) { hls.destroy(); hls = null; }
    video.removeAttribute('src'); video.load(); // solta a conexão: TV desligada não baixa nada
    if (tela) tela.material = desligada;
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
      try { localStorage.setItem(CHAVE, JSON.stringify(canal)); } catch { /* só não lembra */ }
      if (ligadaAgora) await tocar(); else aoMudar(estado());
      return canal;
    },
  };
}
