"""Robô de cliques (evolução 1, "selo de verdade"): clica em TODO elemento clicável de cada página — inclusive os que o
JavaScript cria (cartões, ações de lead, abas) — e prova o que cada clique fez de verdade.

Uso (o script sobe o próprio servidor numa CÓPIA do banco; o banco real nunca é tocado):
    python scripts/robo-cliques.py                 todas as páginas
    python scripts/robo-cliques.py painel engine   só algumas
Saída: docs/auditoria/robo-cliques.md (+ .json).

Para cada clique compara uma impressão digital ANTES x DEPOIS de três coisas:
  banco  → hash das linhas de cada tabela (o que mudou de verdade)
  tela   → texto visível, diálogos abertos, URL
  rede   → POST/PUT/DELETE disparados e o status HTTP
Classificação: ESCREVE (mudou o banco) · NAVEGA · MUDA_TELA · EXTERNO (abriu outra janela) · ERRO (4xx/5xx ou erro no console) · MORTO (nada mudou).
Eventos/jobs que mudam sozinhos (relógio da Alva) são ignorados na comparação do banco."""
import hashlib, json, os, urllib.request, shutil, socket, sqlite3, subprocess, sys, tempfile, time
from pathlib import Path
from playwright.sync_api import sync_playwright

RAIZ = Path(__file__).resolve().parent.parent
PORTA = 4302
BASE = f'http://127.0.0.1:{PORTA}'
PAGINAS = {
    'inicio': '/inicio.html', 'painel': '/', 'producao': '/producao.html', 'agentes': '/agentes.html',
    'nichos': '/nichos.html', 'fluxos': '/fluxos.html', 'engine': '/engine.html', 'configurador': '/configurador.html',
    'base': '/base.html', 'conforto': '/conforto.html', 'creditos': '/creditos.html',
}
IGNORAR_TABELAS = {'eventos', 'jobs', 'sqlite_sequence'}  # mudam sozinhas com o tempo
CLICAVEIS = 'button, [role=button], [role=tab], a[href^="#"], a[href^="/"], summary, [data-acao], [data-aba], input[type=checkbox]'


def copiar_banco():
    destino = Path(tempfile.mkdtemp(prefix='robo-cliques-'))
    origem = sqlite3.connect(f'file:{RAIZ / "data" / "prospector.db"}?mode=ro', uri=True)
    origem.execute(f"VACUUM INTO '{(destino / 'prospector.db').as_posix()}'")
    origem.close()
    db = sqlite3.connect(destino / 'prospector.db')
    # a sessão com dados (a de mais leads) fica ativa na cópia, para existirem cartões e ações de verdade
    try:
        sid = db.execute('SELECT sessao_id FROM leads GROUP BY sessao_id ORDER BY COUNT(*) DESC LIMIT 1').fetchone()
        if sid: db.execute("INSERT INTO config (k, v) VALUES ('sessao_ativa', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v", (json.dumps(sid[0]),))
        db.commit()
    except sqlite3.Error: pass
    db.close()
    return destino


def digital_banco(arquivo):
    db = sqlite3.connect(f'file:{arquivo}?mode=ro', uri=True)
    out = {}
    for (t,) in db.execute("SELECT name FROM sqlite_master WHERE type='table'"):
        if t in IGNORAR_TABELAS: continue
        h = hashlib.md5()
        for linha in db.execute(f'SELECT * FROM "{t}" ORDER BY rowid'): h.update(repr(linha).encode())
        out[t] = h.hexdigest()
    db.close()
    return out


def digital_tela(pg):
    return pg.evaluate("""() => ({
      url: location.href,
      texto: document.body.innerText.length + ':' + [...document.body.innerText].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0),
      dialogos: document.querySelectorAll('dialog[open], [role=dialog]:not([hidden])').length,
      foco: document.activeElement?.id || document.activeElement?.tagName,
    })""")


def pausar_equipe():
    # cada clique começa com a equipe parada: um "Retomar" anterior não pode contaminar a medição dos próximos
    req = urllib.request.Request(BASE + '/api/agentes/pausar', data=b'{}', headers={'Content-Type': 'application/json'}, method='POST')
    try: urllib.request.urlopen(req, timeout=5).read()
    except Exception: pass


def banco_quieto(arquivo, max_s=6):
    # espera o banco parar de mudar (o que já estava rodando termina) antes de tirar a digital "antes"
    ant = digital_banco(arquivo)
    for _ in range(int(max_s / 0.5)):
        time.sleep(0.5)
        agora = digital_banco(arquivo)
        if agora == ant: return agora
        ant = agora
    return ant


def esperar_porta():
    for _ in range(60):
        try:
            socket.create_connection(('127.0.0.1', PORTA), 0.5).close(); return
        except OSError: time.sleep(0.5)
    raise SystemExit('o servidor de teste não subiu')


def rotulo(el):
    return (el.get('texto') or el.get('aria') or el.get('title') or el.get('id') or el.get('tag')).strip()[:60]


def listar(pg):
    return pg.evaluate("""(sel) => [...document.querySelectorAll(sel)].map((e, i) => {
      const r = e.getBoundingClientRect(), st = getComputedStyle(e);
      return { i, tag: e.tagName.toLowerCase(), id: e.id, texto: (e.innerText || e.value || '').replace(/\\s+/g, ' ').trim(),
        aria: e.getAttribute('aria-label') || '', title: e.getAttribute('title') || '', href: e.getAttribute('href') || '',
        classe: e.className && e.className.baseVal === undefined ? String(e.className) : '',
        visivel: r.width > 0 && r.height > 0 && st.visibility !== 'hidden' && st.display !== 'none', desligado: !!e.disabled };
    })""", CLICAVEIS)


def main():
    so = set(sys.argv[1:])
    pasta = copiar_banco()
    arquivo_db = pasta / 'prospector.db'
    env = {**os.environ, 'DATA_DIR': str(pasta), 'PORT': str(PORTA), 'SEM_COLETA': '1'}  # nunca coleta no Maps/OSM de verdade
    srv = subprocess.Popen(['node', 'src/server.mjs'], cwd=RAIZ, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    resultados = []
    links_ja = set()  # a barra lateral é igual em todas as páginas: cada link é testado uma vez só
    try:
        esperar_porta()
        with sync_playwright() as p:
            nav = p.chromium.launch(headless=True)
            ctx = nav.new_context(viewport={'width': 1440, 'height': 900})
            for nome, caminho in PAGINAS.items():
                if so and nome not in so: continue
                pg = ctx.new_page(); pg.goto(BASE + caminho); pg.wait_for_timeout(2500)
                vistos, alvos = set(), []
                for el in listar(pg):
                    if not el['visivel'] or el['desligado']: continue
                    chave = (el['tag'], rotulo(el), el['classe'])
                    if chave in vistos: continue  # 40 cartões iguais: testa o primeiro de cada tipo
                    if el['tag'] == 'a' and el['href'].startswith('/'):
                        if el['href'] in links_ja or el['href'] == caminho or (caminho == '/' and el['href'] in ('/', '/index.html')): continue  # link para a própria página não tem o que fazer
                        links_ja.add(el['href'])
                    if el['href'] == '#conteudo': continue  # atalho de acessibilidade (só aparece com Tab)
                    vistos.add(chave); alvos.append(el)
                pg.close()
                print(f'{nome}: {len(alvos)} clicáveis distintos', flush=True)
                for el in alvos:
                    c2 = nav.new_context(viewport={'width': 1440, 'height': 900})
                    pg = c2.new_page()
                    erros, escritas, externos = [], [], []
                    pg.on('console', lambda m: m.type == 'error' and erros.append(m.text[:160]))
                    pg.on('pageerror', lambda e: erros.append(str(e)[:160]))
                    pg.on('dialog', lambda d: d.accept('robo' if d.type == 'prompt' else None))
                    pg.on('response', lambda r: r.request.method not in ('GET', 'HEAD') and escritas.append(f'{r.request.method} {r.url.replace(BASE, "")} → {r.status}'))
                    c2.on('page', lambda np: externos.append(np.url or 'nova janela'))
                    pg.goto(BASE + caminho); pg.wait_for_timeout(2000)
                    erros.clear()  # erro de carregamento da página não é culpa do botão
                    pausar_equipe()
                    antes_db, antes_tela = banco_quieto(arquivo_db), digital_tela(pg)
                    # acha o MESMO elemento pela identidade (tag + rótulo + classe), nunca pela posição:
                    # a lista criada pelo JavaScript pode nascer em outra ordem a cada carga e trocar os rótulos do relatório
                    alvo = pg.evaluate_handle("""([sel, tag, rot, cls]) => [...document.querySelectorAll(sel)].find((e) => {
                      const r = e.getBoundingClientRect();
                      const t = ((e.innerText || e.value || '').replace(/\\s+/g, ' ').trim() || e.getAttribute('aria-label') || e.getAttribute('title') || e.id || e.tagName.toLowerCase()).trim().slice(0, 60);
                      const c = e.className && e.className.baseVal === undefined ? String(e.className) : '';
                      return e.tagName.toLowerCase() === tag && t === rot && c === cls && r.width > 0 && r.height > 0;
                    }) || null""", [CLICAVEIS, el['tag'], rotulo(el), el['classe']]).as_element()
                    if alvo is None: alvo = pg.locator('#__nao_existe__')  # sumiu nesta carga: vira NAO_CLICAVEL com motivo
                    falha_clique = None
                    try: alvo.click(timeout=3000)
                    except Exception as e: falha_clique = str(e).split('\n')[0][:140]
                    pg.wait_for_timeout(1500)
                    try: depois_tela = digital_tela(pg)
                    except Exception: depois_tela = {**antes_tela, 'url': 'navegou'}
                    depois_db = digital_banco(arquivo_db)
                    mudou_db = sorted(t for t in depois_db if depois_db.get(t) != antes_db.get(t))
                    ruins = [e for e in escritas if e.rsplit(' ', 1)[-1][0] in '45']
                    if falha_clique: classe = 'NAO_CLICAVEL'
                    elif ruins or erros: classe = 'ERRO'
                    elif mudou_db: classe = 'ESCREVE'
                    elif externos: classe = 'EXTERNO'
                    elif depois_tela['url'] != antes_tela['url']: classe = 'NAVEGA'
                    elif depois_tela != antes_tela or escritas: classe = 'MUDA_TELA'
                    else: classe = 'MORTO'
                    r = {'pagina': nome, 'elemento': rotulo(el), 'tag': el['tag'], 'href': el['href'], 'classe': classe,
                         'tabelas': mudou_db, 'rede': escritas, 'erros': erros, 'externo': externos, 'falha': falha_clique}
                    resultados.append(r)
                    print(f'  {classe:12} {r["elemento"]}', flush=True)
                    c2.close()
            nav.close()
    finally:
        srv.terminate(); srv.wait(10)
        shutil.rmtree(pasta, ignore_errors=True)
    escrever(resultados)


def escrever(res):
    saida = RAIZ / 'docs' / 'auditoria'; saida.mkdir(parents=True, exist_ok=True)
    (saida / 'robo-cliques.json').write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding='utf-8')
    cont = {}
    for r in res: cont[r['classe']] = cont.get(r['classe'], 0) + 1
    linhas = [f'# Robô de cliques — {time.strftime("%d/%m/%Y %H:%M")}', '',
              'Gerado por `python scripts/robo-cliques.py` numa cópia do banco real. ' + ' · '.join(f'**{k}** {v}' for k, v in sorted(cont.items())), '']
    for classe in ['ERRO', 'MORTO', 'NAO_CLICAVEL']:
        alvo = [r for r in res if r['classe'] == classe]
        if not alvo: continue
        linhas += [f'## {classe} ({len(alvo)})', '', '| Página | Elemento | Detalhe |', '|---|---|---|']
        for r in alvo: linhas.append(f"| {r['pagina']} | {r['elemento'].replace('|', '/')} | {'; '.join(r['erros'] + [x for x in r['rede'] if x[-3] in '45'] + ([r['falha']] if r['falha'] else [])).replace('|', '/')[:200]} |")
        linhas.append('')
    linhas += ['## Todos', '', '| Página | Elemento | Resultado | Banco / rede |', '|---|---|---|---|']
    for r in res: linhas.append(f"| {r['pagina']} | {r['elemento'].replace('|', '/')} | {r['classe']} | {', '.join(r['tabelas'] + r['rede'])[:120]} |")
    (saida / 'robo-cliques.md').write_text('\n'.join(linhas) + '\n', encoding='utf-8')
    print('\n' + ' · '.join(f'{k} {v}' for k, v in sorted(cont.items())))


if __name__ == '__main__':
    main()
