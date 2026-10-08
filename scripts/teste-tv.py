"""Teste VISUAL da TV ao vivo: abre a página no Google Chrome real (janela visível), liga a TV e tira um print
da TV a cada segundo. Se os prints forem iguais, a TV está travada — é o que o Victor vê, não o que o código diz.
Uso: python scripts/teste-tv.py [sala|andar2]  →  docs/auditoria/tv/*.png e o veredito no terminal."""
import hashlib, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

PAGINA = sys.argv[1] if len(sys.argv) > 1 else 'sala'
# área da tela onde a TV aparece depois do "Ver a TV" (Paraíso) / da vista inicial (2º andar), em 1280x800
RECORTE = {'x': 560, 'y': 96, 'width': 420, 'height': 110} if PAGINA == 'sala' else None  # 2º andar: tela inteira (a TV muda de lugar com a câmera)
SAIDA = Path(__file__).resolve().parent.parent / 'docs' / 'auditoria' / 'tv'
SAIDA.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    nav = p.chromium.launch(channel='chrome', headless=False, args=['--autoplay-policy=no-user-gesture-required'])
    pg = nav.new_page(viewport={'width': 1280, 'height': 800})
    log = []
    pg.on('console', lambda m: log.append(f'{m.type}: {m.text[:200]}'))
    pg.goto(f'http://127.0.0.1:4300/{PAGINA}.html')
    pg.wait_for_timeout(15000)
    if PAGINA == 'sala':
        pg.click('#btn-tv')                       # abre o painel
        pg.wait_for_timeout(500)
        pg.click('[data-tv="ligar"]')             # liga (clique real = gesto do usuário)
        pg.wait_for_timeout(1500)
        pg.click('[data-tv="ver"]')               # câmera vai até a TV
    else:
        pg.click('#btn-tv'); pg.wait_for_timeout(500)
        pg.click('[data-tv="0"][data-acao="ligar"]')
    pg.wait_for_timeout(8000)
    hashes = []
    for i in range(6):
        arq = SAIDA / f'{PAGINA}-{i}.png'
        pg.screenshot(path=str(arq), **({'clip': RECORTE} if RECORTE else {}))  # só a TV: chuva e agentes também se mexem e enganariam o teste
        hashes.append(hashlib.md5(arq.read_bytes()).hexdigest())
        time.sleep(1)
    estado = pg.evaluate("""() => [...document.querySelectorAll('video')].map(v => ({ pausado: v.paused, tempo: +v.currentTime.toFixed(1),
        quadros: v.getVideoPlaybackQuality().totalVideoFrames, altura: v.videoHeight, src: (v.currentSrc || '').slice(0, 60) }))""")
    print('prints diferentes:', len(set(hashes)), 'de', len(hashes))
    print('videos:', estado)
    print('console:', '\n  '.join(log[-12:]))
    nav.close()
