from playwright.sync_api import sync_playwright
import sys, pathlib
html, saida = sys.argv[1], sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 1200, 'height': 630}, device_scale_factor=1)
    pg.goto(pathlib.Path(html).resolve().as_uri())
    pg.wait_for_timeout(800)
    pg.screenshot(path=saida, type='jpeg', quality=88)
    b.close()
print('ok')
