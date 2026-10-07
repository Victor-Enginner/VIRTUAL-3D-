"""Gera os prints do README a partir da DEMONSTRAÇÃO (dados fictícios), nunca do banco real.
Uso:  DEMO=1 PORT=4301 node src/server.mjs   (em outro terminal)   e depois   python scripts/capturas.py
Saída: docs/img/*.jpg (1440x900). Requer Playwright (o mesmo do coletor do Maps)."""
import sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4301'
SO = set(sys.argv[2:])  # opcional: nomes das páginas (ex.: sala base)
SAIDA = Path(__file__).resolve().parent.parent / 'docs' / 'img'
SAIDA.mkdir(parents=True, exist_ok=True)

# (arquivo, caminho, espera em segundos, script opcional antes do print)
PAGINAS = [
    ('inicio', '/inicio.html', 4, None),
    ('painel', '/', 3, None),
    ('producao', '/producao.html', 3, None),
    ('agentes', '/agentes.html', 3, None),
    ('nichos', '/nichos.html', 4, None),
    ('fluxos', '/fluxos.html', 3, None),
    ('engine', '/engine.html', 3, None),
    ('configurador', '/configurador.html', 3, None),
    ('sala', '/sala.html', 70, "document.querySelector('#btn-rotulos')?.click?.()"),
    ('base', '/base.html', 50, None),
]

with sync_playwright() as p:
    # usa a placa de vídeo real (sem GPU o WebGL por software não monta a Sala 3D a tempo)
    nav = p.chromium.launch(headless=True, args=['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-webgl'])
    ctx = nav.new_context(viewport={'width': 1440, 'height': 900}, device_scale_factor=1)
    # a foto de fundo e o vídeo de chuva são do Victor (direitos de terceiros): nunca entram nos prints do README
    ctx.route('**/assets/fundo/**', lambda r: r.abort())
    ctx.route('**/assets/video/**', lambda r: r.abort())
    for nome, caminho, espera, js in PAGINAS:
        if SO and nome not in SO: continue
        pg = ctx.new_page()
        try:
            pg.goto(BASE + caminho, wait_until='domcontentloaded', timeout=180000)
            if nome == 'sala':
                # espera a cena 3D montar de verdade (a placa pode demorar) e só então deixa a tinta assentar
                pg.wait_for_selector('.cena.pronta', state='attached', timeout=240000)  # seletor (a política de segurança da página bloqueia código em texto)
                espera = 14
            time.sleep(espera)
            if js:
                try: pg.evaluate(js)
                except Exception: pass
            pg.screenshot(path=str(SAIDA / f'{nome}.jpg'), type='jpeg', quality=86)
            print('ok', nome)
        except Exception as e:
            print('falhou', nome, e)
        finally:
            pg.close()
    nav.close()
