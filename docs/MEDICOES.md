# Medições de desempenho

## 04/10/2026 — PC do Victor (i7-3770S, 16 GB), navegador embutido do app Claude
- **GPU detectada pelo navegador: AMD Radeon RX 580** (WebGL2 via ANGLE/Direct3D11). Não é "sem GPU útil" como se supunha.
- Sala 3D (`/sala.html`, 999×922, banco vazio, mascotes desligados): **58,8 fps**, pior quadro 33 ms.
- Sala 3D com `mascotes: true` no `localStorage`: **57,6 fps**. Os mascotes não aparecem na Sala (só em outras telas), então isso não mede o custo deles.
- Início (`/inicio.html`, globo + 2 canvas): **60 fps**, pior quadro 17 ms.
- Meta de 45 fps: atendida nesta máquina.

### Não medido
- Flashes acima de 3 por segundo: não há instrumento para isso; revisão só por leitura de código/CSS (`test/conforto.test.mjs` cobre as regras).
- Sala com equipe cheia de leads e eventos (banco vazio aqui).
- Custo isolado do globo e dos mascotes.
- Notebook/PC sem a RX 580 (o prompt falava em "sem GPU útil"; conferir se é outro computador).
