# -*- coding: utf-8 -*-
"""
Coletor do Google Maps com navegador local (Playwright).

Uso:  python maps_coletor.py '{"termo": "barbearia em Franca SP", "limite": 20}'
Saída: uma linha JSON por estabelecimento (NDJSON) e, no fim, {"fim": true, ...}.

Regra deste coletor: o que a página não mostra vira null. Nenhum telefone, nota,
endereço ou site é deduzido ou preenchido com valor padrão.

Risco conhecido e aceito pelo operador: raspar o Google Maps viola os termos de uso
do Google e pode levar a bloqueio do IP. O ritmo abaixo é lento de propósito.
"""
import json
import random
import re
import sys
import time
import urllib.parse

from playwright.sync_api import sync_playwright


def emitir(obj):
    sys.stdout.write(json.dumps(obj, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def texto(page, seletor, attr=None):
    el = page.query_selector(seletor)
    if not el:
        return None
    v = el.get_attribute(attr) if attr else el.inner_text()
    return v.strip() if v else None


def sem_rotulo(v):
    # "Telefone: (16) 99385-0531" → "(16) 99385-0531"
    return re.sub(r"^[^:]{1,20}:\s*", "", v).strip() if v else None


def nota_e_avaliacoes(page, palavra="avalia"):
    # a quantidade de avaliações carrega depois da nota; sem esperar, o bloco vem só com "4,9"
    try:
        page.wait_for_selector('div.F7nice span[aria-label*="' + palavra + '"]', timeout=2500)
    except Exception:
        pass
    bloco = texto(page, "div.F7nice")
    if not bloco:
        return None, None
    m = re.search(r"(\d[,.]\d)", bloco)
    nota = float(m.group(1).replace(",", ".")) if m else None
    m2 = re.search(r"\(([\d.\s]+)\)", bloco)
    qtd = int(re.sub(r"\D", "", m2.group(1))) if m2 else None
    return nota, qtd


def main():
    args = json.loads(sys.argv[1])
    termo, limite = args["termo"], int(args.get("limite", 20))
    hl = args.get("hl", "pt-BR")
    gl = args.get("gl", "br")
    palavra_avaliacao = args.get("avaliacao", "avalia")
    url = "https://www.google.com/maps/search/" + urllib.parse.quote(termo) + "?hl=" + hl + "&gl=" + gl
    coletados = 0
    with sync_playwright() as p:
        nav = p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
        ctx = nav.new_context(locale=hl, viewport={"width": 1280, "height": 900})
        pagina = ctx.new_page()
        pagina.goto(url, timeout=45000, wait_until="domcontentloaded")
        try:
            pagina.wait_for_selector('a[href*="/maps/place/"]', timeout=20000)
        except Exception:
            emitir({"fim": True, "coletados": 0, "aviso": "nenhum resultado (ou página de consentimento/bloqueio)", "url": pagina.url})
            nav.close()
            return

        # rola o painel de resultados até ter links suficientes ou parar de crescer
        vistos = -1
        for _ in range(12):
            links = pagina.eval_on_selector_all('a[href*="/maps/place/"]', "els => els.map(e => [e.getAttribute('aria-label'), e.href])")
            if len(links) >= limite or len(links) == vistos:
                break
            vistos = len(links)
            if not pagina.query_selector('div[role="feed"]'):
                break
            pagina.eval_on_selector('div[role="feed"]', "el => el.scrollBy(0, 2500)")
            pagina.wait_for_timeout(1200 + random.randint(0, 800))

        unicos, hrefs = [], set()
        for nome, href in links:
            if href and href not in hrefs:
                hrefs.add(href)
                unicos.append((nome, href))

        for nome, href in unicos[:limite]:
            det = ctx.new_page()
            try:
                det.goto(href, timeout=45000, wait_until="domcontentloaded")
                det.wait_for_selector("h1", timeout=15000)
                det.wait_for_timeout(1200)
                nota, qtd = nota_e_avaliacoes(det, palavra_avaliacao)
                emitir({
                    "nome": texto(det, "h1") or nome,
                    "telefone": sem_rotulo(texto(det, 'button[data-item-id^="phone:tel:"]', "aria-label")),
                    "site": texto(det, 'a[data-item-id="authority"]', "href"),
                    "endereco": sem_rotulo(texto(det, 'button[data-item-id="address"]', "aria-label")),
                    "categoria": texto(det, "button.DkEaL"),
                    "rating": nota,
                    "avaliacoes": qtd,
                    "maps_url": href.split("?")[0],
                })
                coletados += 1
            except Exception as e:
                emitir({"erro_item": str(e)[:200], "nome": nome})
            finally:
                det.close()
            time.sleep(1.5 + random.random() * 2.0)
        nav.close()
    emitir({"fim": True, "coletados": coletados})


if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        main()
    except Exception as e:
        emitir({"fim": True, "erro": str(e)[:300]})
        sys.exit(1)
