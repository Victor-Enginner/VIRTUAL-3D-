// Ritmo de envio: teto diário, espera aleatória entre mensagens, só em horário comercial.
// Tudo no horário local da máquina. Função pura: recebe `agora` e `aleatorio` para ser testável.

export function inicioDoDia(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function dentroDaJanela(d, cfg) {
  const h = d.getHours() + d.getMinutes() / 60;
  return cfg.dias_semana.includes(d.getDay()) && h >= cfg.janela_inicio_h && h < cfg.janela_fim_h;
}

// Próximo começo de janela estritamente depois do dia de `d` (ou no próprio dia, se ainda não abriu).
function proximaAbertura(d, cfg, aleatorio) {
  const x = new Date(d);
  const jitterMin = Math.floor(aleatorio() * 15); // não começa todo dia no mesmo minuto
  for (let i = 0; i < 8; i++) {
    const abre = new Date(x);
    abre.setHours(cfg.janela_inicio_h, jitterMin, 0, 0);
    if (cfg.dias_semana.includes(abre.getDay()) && abre > d) return abre;
    x.setDate(x.getDate() + 1);
  }
  throw new Error('nenhum dia da semana habilitado para envio');
}

export function intervaloAleatorioMs(cfg, aleatorio = Math.random) {
  const min = cfg.intervalo_min_s, max = Math.max(cfg.intervalo_max_s, min);
  return Math.round((min + aleatorio() * (max - min)) * 1000);
}

// Devolve { pode: true } ou { pode: false, proximo: Date, motivo }.
export function avaliarEnvio({ agora, enviadosHoje, proximoPermitido, cfg, aleatorio = Math.random }) {
  if (enviadosHoje >= cfg.limite_diario) {
    const amanha = inicioDoDia(agora);
    amanha.setDate(amanha.getDate() + 1);
    return { pode: false, proximo: proximaAbertura(new Date(amanha.getTime() - 1), cfg, aleatorio), motivo: `limite de ${cfg.limite_diario} por dia atingido` };
  }
  if (!dentroDaJanela(agora, cfg)) return { pode: false, proximo: proximaAbertura(agora, cfg, aleatorio), motivo: 'fora do horário de envio' };
  if (proximoPermitido && agora < proximoPermitido) {
    if (dentroDaJanela(proximoPermitido, cfg)) return { pode: false, proximo: proximoPermitido, motivo: 'aguardando intervalo entre mensagens' };
    return { pode: false, proximo: proximaAbertura(proximoPermitido, cfg, aleatorio), motivo: 'intervalo passa do horário de hoje' };
  }
  return { pode: true };
}
