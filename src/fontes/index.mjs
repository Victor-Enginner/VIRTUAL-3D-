import { spawn } from 'node:child_process';
import path from 'node:path';
import { CONFIG, ROOT } from '../config.mjs';
import { NICHOS } from '../nichos.mjs';

// Cada fonte devolve uma lista de { nome, telefone, site, endereco, categoria, rating, avaliacoes, maps_url }.
// Campo que a fonte não trouxe fica null.

export function coletarMaps({ cidade, uf, nicho, limite, aoItem }) {
  const termo = `${NICHOS[nicho]?.maps || nicho} em ${cidade} ${uf}`;
  const script = path.join(ROOT, 'src', 'fontes', 'maps_coletor.py');
  return new Promise((resolve, reject) => {
    const proc = spawn(CONFIG.python, [script, JSON.stringify({ termo, limite })], { env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
    const itens = [];
    let resto = '', fim = null, stderr = '';
    const timer = setTimeout(() => proc.kill(), 15 * 60_000);
    proc.stdout.setEncoding('utf8');
    proc.stdout.on('data', (chunk) => {
      resto += chunk;
      const linhas = resto.split('\n');
      resto = linhas.pop();
      for (const l of linhas) {
        if (!l.trim()) continue;
        let o; try { o = JSON.parse(l); } catch { continue; }
        if (o.fim) fim = o;
        else if (o.nome && !o.erro_item) { itens.push(o); aoItem?.(o); }
      }
    });
    proc.stderr.on('data', (c) => { stderr = (stderr + c).slice(-2000); });
    proc.on('error', (e) => { clearTimeout(timer); reject(new Error(`não consegui rodar ${CONFIG.python}: ${e.message}`)); });
    proc.on('close', (code) => {
      clearTimeout(timer);
      if (fim?.erro) return reject(new Error(`coletor Maps: ${fim.erro}`));
      if (code !== 0 && !itens.length) return reject(new Error(`coletor Maps saiu com código ${code}: ${stderr.trim().split('\n').pop() || ''}`));
      resolve({ itens, aviso: fim?.aviso || null });
    });
  });
}

const OVERPASS = 'https://overpass-api.de/api/interpreter';

export async function coletarOsm({ cidade, nicho, limite }) {
  const tags = NICHOS[nicho]?.osm;
  if (!tags) throw new Error(`nicho sem tags OSM: ${nicho}`);
  const nomeCidade = cidade.replace(/"/g, '');
  const filtros = tags.map(([k, v]) => `nwr["${k}"="${v}"](area.a);`).join('');
  const q = `[out:json][timeout:60];area["name"="${nomeCidade}"]["boundary"="administrative"]["admin_level"="8"]->.a;(${filtros});out tags center ${limite};`;
  const r = await fetch(OVERPASS, {
    method: 'POST', signal: AbortSignal.timeout(90_000),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'prospector/0.1 (uso local)' },
    body: `data=${encodeURIComponent(q)}`,
  });
  if (!r.ok) throw new Error(`Overpass respondeu ${r.status}`);
  const j = await r.json();
  const itens = (j.elements || []).filter((e) => e.tags?.name).map((e) => {
    const t = e.tags;
    const rua = [t['addr:street'], t['addr:housenumber']].filter(Boolean).join(', ');
    return {
      nome: t.name,
      telefone: t['contact:whatsapp'] || t.phone || t['contact:phone'] || t['contact:mobile'] || null,
      site: t.website || t['contact:website'] || t['contact:instagram'] || t['contact:facebook'] || null,
      endereco: rua ? `${rua}${t['addr:suburb'] ? ` - ${t['addr:suburb']}` : ''}, ${cidade}` : null,
      categoria: NICHOS[nicho].rotulo,
      rating: null,
      avaliacoes: null,
      maps_url: `https://www.openstreetmap.org/${e.type}/${e.id}`,
    };
  });
  return { itens: itens.slice(0, limite), aviso: itens.length ? null : 'nenhum lugar com nome no OSM para essa cidade/nicho' };
}
