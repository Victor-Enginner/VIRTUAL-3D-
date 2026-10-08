// TV ao vivo na sala de reunião: o sinal HLS público do canal (o mesmo que a Famelack toca) vira
// TEXTURA de vídeo na tela da TV 3D — objeto de verdade no mundo (perspectiva, móveis passam na frente).
// Começa desligada: só baixa vídeo quando você liga. Aceita qualquer link de canal da Famelack.
// O conteúdo é da emissora; aqui é uso pessoal, como assistir no site deles.
import * as THREE from 'three';
import { hostLiberado, lerLinkFamelack, streamValido } from './tv-canal.js';
export { lerLinkFamelack, streamValido };

const DADOS = 'https://raw.githubusercontent.com/famelack/famelack-data/main/tv/compressed/countries/';
// teto de 360p via hls.js: liberado em 08/10/2026 (Victor pediu TV fluida), só para os domínios de HOSTS_HLS no connect-src
const LIMITAR_QUALIDADE = true;
const ALTURA_MAX = 360; // qualidade máxima do vídeo na TV (pixels de altura)
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

// `canal`/`chave` opcionais: o 2º andar tem TVs com outros canais sem mexer no canal salvo do Paraíso
export function montarTV({ grupoTv, grupos = null, aoMudar = () => {}, canal: canalInicial = null, chave = CHAVE }) {
  const todas = grupos || [grupoTv];
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous'; // o servidor do sinal libera CORS: dá para virar textura WebGL
  video.playsInline = true; video.muted = true; video.preload = 'none';
  const textura = new THREE.VideoTexture(video);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.generateMipmaps = false; textura.minFilter = THREE.LinearFilter; // sem mipmap: não regera a pirâmide a cada quadro
  // SEM freio: o three.js já envia um quadro por quadro REAL de vídeo (requestVideoFrameCallback). O freio antigo (66 ms,
  // depois 33 ms) descartava todo quadro que chegasse 1–2 ms adiantado (vídeo a 30 qps oscila entre ~31 e ~36 ms):
  // a TV mostrava 15–25 qps irregulares, o "engasgo" que o Victor via. Aqui só contamos os envios para o ?diag.
  let enviosTextura = 0;
  Object.defineProperty(textura, 'needsUpdate', { set(v) { if (v !== true) return; enviosTextura++; this.version++; } });
  video.disablePictureInPicture = true; video.disableRemotePlayback = true;
  // O Chrome PAUSA sozinho vídeo mudo que não está visível na página ("video-only background media was paused to save
  // power"): era o "liga e já trava" do Victor (visto no ?diag). O vídeo só virava textura, fora do DOM. Agora fica na
  // página, num canto, 2×2 px e quase transparente: para o Chrome é visível; para quem olha, não aparece.
  Object.assign(video.style, { position: 'fixed', left: '0', bottom: '0', width: '64px', height: '36px', opacity: '0.01', pointerEvents: 'none', zIndex: '-1' });
  video.setAttribute('aria-hidden', 'true');
  document.body.append(video);
  // Se o Chrome pausar (economia de energia) com a página visível, retoma na hora (retomar() fica mais abaixo).
  video.addEventListener('pause', () => { if (!document.hidden) retomar(); });
  // voltou a tocar: some o aviso de erro antigo
  video.addEventListener('playing', () => { if (erro) { erro = ''; pintar(); aoMudar(estado()); } });
  const desligada = new THREE.MeshBasicMaterial({ toneMapped: false });
  const ligada = new THREE.MeshBasicMaterial({ map: textura, toneMapped: false });
  const telas = [];
  let hls = null, ligadaAgora = false, carregando = false, erro = '';
  let canal = canalInicial || CANAL_PADRAO;
  try { const s = JSON.parse(localStorage.getItem(chave) || 'null'); if (s && streamValido(s.stream)) canal = s; } catch { /* sem preferência salva */ }

  const trocarEspera = () => { desligada.map?.dispose(); desligada.map = telaDeEspera(canal.nome); desligada.needsUpdate = true; };
  trocarEspera();
  // pausada pela aba oculta = tela de espera, NUNCA um quadro congelado (antes parecia "ligou e travou")
  let pausadaPorAba = false;
  const pintar = () => { for (const t of telas) t.material = ligadaAgora && !carregando && !erro && !pausadaPorAba ? ligada : desligada; };

  // cada tela é um plano encaixado na frente do modelo da TV, medido depois que ele carrega;
  // todas usam o MESMO vídeo (um download só, mesmo com duas TVs)
  // a tela é medida no espaço da PRÓPRIA TV (frente = +Z local): vale para TV girada (parede lateral do 2º andar).
  // Para TV sem giro (as do Paraíso) dá exatamente a mesma posição de antes.
  for (const grupo of todas) grupo.userData.pronto?.then(() => {
    grupo.updateMatrixWorld(true);
    const caixa = new THREE.Box3().setFromObject(grupo).applyMatrix4(grupo.matrixWorld.clone().invert());
    const t = caixa.getSize(new THREE.Vector3());
    const w = t.x * 0.9, h = Math.min(w * 9 / 16, t.y * 0.62);
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(w, h), desligada);
    tela.position.set((caixa.min.x + caixa.max.x) / 2, caixa.max.y - t.y * 0.06 - h / 2, caixa.max.z + 0.004);
    tela.name = telas.length ? `tela-tv-${telas.length + 1}` : 'tela-tv';
    grupo.add(tela);
    telas.push(tela);
    pintar();
    aoMudar(estado());
  });

  const estado = () => ({ ligada: ligadaAgora, carregando, erro, canal, som: !video.muted, telas: telas.length });

  async function tocar() {
    erro = ''; carregando = true; aoMudar(estado());
    try {
      if (hls) { hls.destroy(); hls = null; }
      // hls.js deixa limitar a qualidade (360p), mas ele baixa o sinal por fetch e a política de segurança do servidor (connect-src)
      // só libera hls.js se o Victor autorizar; sem isso usa o HLS nativo do navegador, que escolhe a qualidade sozinho
      const usarHlsJs = (LIMITAR_QUALIDADE && hostLiberado(canal.stream)) || !video.canPlayType('application/vnd.apple.mpegurl');
      const Hls = usarHlsJs ? (await import(HLS_JS)).default : null;
      if (!Hls || !Hls.isSupported()) {
        if (!video.canPlayType('application/vnd.apple.mpegurl')) throw new Error('este navegador não toca HLS');
        video.src = canal.stream; // HLS nativo (Safari, Chrome, Edge atuais)
      } else {
        // qualidade baixa de propósito: a TV ocupa uma parte pequena da tela 3D, então 360p parece igual e pesa muito menos
        hls = new Hls({ liveDurationInfinity: true, lowLatencyMode: false, startLevel: 0, capLevelToPlayerSize: true, maxBufferLength: 8, maxMaxBufferLength: 12, backBufferLength: 4, enableWorker: true });
        hls.on(Hls.Events.MANIFEST_PARSED, (_e, d) => {
          const niveis = d.levels || [];
          let teto = 0;
          niveis.forEach((n, i) => { if ((n.height || 0) <= ALTURA_MAX && (n.height || 0) >= (niveis[teto]?.height || 0)) teto = i; });
          hls.autoLevelCapping = teto;
          hls.currentLevel = teto;
        });
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
      await video.play().catch((e) => { if (!document.hidden) throw e; }); // oculta: o Chrome pausa; retomar() resolve ao reaparecer
    } catch (e) { erro = e.name === 'NotAllowedError' ? 'o navegador bloqueou o vídeo: toque em Ligar de novo' : e.message; }
    carregando = false; pintar(); aoMudar(estado());
  }

  function parar() {
    video.pause();
    if (hls) { hls.destroy(); hls = null; }
    video.removeAttribute('src'); video.load(); // solta a conexão: TV desligada não baixa nada
    pintar();
  }

  // retomar(): TV ligada e página visível → vídeo tocando NO AO VIVO. Corrige os dois travamentos medidos em 08/10:
  //  1. ligada com o painel oculto, o Chrome pausava e nada dava play de novo ao reaparecer (ficava no 1º quadro);
  //  2. pausado antes de começar, o relógio ficava em 0 s fora do trecho baixado (36–54 s): precisa pular para o ao vivo.
  function retomar() {
    if (!ligadaAgora || pausadaPorAba || carregando || document.hidden) return;
    const b = video.buffered;
    if (b.length) {
      const ini = b.start(0), fim = b.end(b.length - 1);
      if (video.currentTime < ini || video.currentTime > fim) video.currentTime = hls?.liveSyncPosition ?? Math.max(ini, fim - 3);
    }
    if (video.paused) video.play().catch(() => {});
  }
  // vigia: a cada 2 s, se a TV está ligada e visível mas o relógio do vídeo não andou, retoma
  let relogioAnterior = -1;
  setInterval(() => {
    if (!ligadaAgora || document.hidden || carregando) { relogioAnterior = -1; return; }
    if (video.paused || video.currentTime === relogioAnterior) retomar();
    relogioAnterior = video.currentTime;
  }, 2000);

  // Aba escondida: só pausa depois de 1 MINUTO oculta. No app do Claude o painel do navegador fica "oculto" enquanto
  // o Victor digita no chat; pausar na hora fazia a TV congelar e recomeçar a cada vai-e-volta ("liga e fica travada").
  const ESPERA_OCULTA_MS = 60_000;
  let timerOculta = null;
  document.addEventListener('visibilitychange', () => {
    if (!ligadaAgora) return;
    if (document.hidden) {
      clearTimeout(timerOculta);
      timerOculta = setTimeout(() => { pausadaPorAba = true; parar(); aoMudar(estado()); }, ESPERA_OCULTA_MS);
    } else {
      clearTimeout(timerOculta);
      if (pausadaPorAba) { pausadaPorAba = false; tocar(); } else retomar(); // reapareceu: garante vídeo andando no ao vivo
    }
  });

  return {
    estado,
    video, // para medir fluidez (quadros recebidos/perdidos) no diagnóstico
    enviosTextura: () => enviosTextura, // quadros que chegaram à TELA (o que o Victor vê)
    async ligar() { ligadaAgora = true; await tocar(); },
    desligar() { ligadaAgora = false; parar(); erro = ''; aoMudar(estado()); },
    som() { video.muted = !video.muted; aoMudar(estado()); },
    async trocar(link) {
      const novo = await resolverCanal(link);
      canal = novo;
      trocarEspera();
      try { localStorage.setItem(chave, JSON.stringify(canal)); } catch { /* só não lembra */ }
      if (ligadaAgora) await tocar(); else aoMudar(estado());
      return canal;
    },
  };
}

// Diagnóstico ao vivo: abra a página com ?diag (ex.: /andar2.html?diag ou /sala.html?diag). Mostra, a cada segundo,
// os quadros/s da cena, de cada TV (quadros NOVOS de vídeo), o buffer, o estado e se a aba está oculta.
// Feito para achar o travamento que o Victor vê e as medições automáticas não pegaram. Sem ?diag, nada aparece.
export function diagnosticoTVs(tvs) {
  if (!new URLSearchParams(location.search).has('diag')) return;
  const caixa = document.createElement('pre');
  caixa.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;margin:0;padding:8px 10px;background:#000d;color:#7dffb0;font:12px/1.4 Consolas,monospace;border:1px solid #7dffb055;border-radius:8px;pointer-events:none;white-space:pre';
  document.body.append(caixa);
  let cena = 0;
  const contaCena = () => { cena++; requestAnimationFrame(contaCena); };
  requestAnimationFrame(contaCena);
  const quadros = tvs.map(() => 0);
  tvs.forEach((t, i) => { const f = () => { quadros[i]++; t.video.requestVideoFrameCallback(f); }; t.video.requestVideoFrameCallback?.(f); });
  const eventos = tvs.map(() => ({ waiting: 0, stalled: 0 }));
  const enviados = [];
  tvs.forEach((t, i) => { for (const k of ['waiting', 'stalled']) t.video.addEventListener(k, () => eventos[i][k]++); });
  setInterval(() => {
    const linhas = [`cena ${cena} qps · aba ${document.hidden ? 'OCULTA' : 'visível'} · ${innerWidth}x${innerHeight}`];
    tvs.forEach((t, i) => {
      const v = t.video, e = t.estado();
      const buf = v.buffered.length ? (v.buffered.end(v.buffered.length - 1) - v.currentTime).toFixed(1) : '0';
      const env = t.enviosTextura(); const naTela = env - (enviados[i] ?? env); enviados[i] = env;
      linhas.push(`${e.canal.nome}: ${e.ligada ? (e.carregando ? 'sintonizando' : e.erro ? 'ERRO ' + e.erro : 'no ar') : 'desligada'} · vídeo ${quadros[i]} qps · na tela ${naTela} qps · ${v.videoWidth}x${v.videoHeight} · buffer ${buf}s · esperas ${eventos[i].waiting}/${eventos[i].stalled}`);
      quadros[i] = 0;
    });
    cena = 0;
    caixa.textContent = linhas.join('\n');
  }, 1000);
}
