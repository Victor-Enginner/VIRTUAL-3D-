# PoS — Beyond Memory: Explicit Belief States (arXiv 2610.01415)

- **Autores:** Luo, Jiang, Zuo, Wen, Gao, Sun, Zhang, Liu, Zhang, Situ, Zhou, Pei (Nankai, Alibaba, Tsinghua).
- **Código:** github.com/luoyu100/PoS · **Lido:** completo (seção 3 e 4.2).

## Problema
Memória (histórico cru ou resumido) guarda evidência, mas não diz **o que ainda é verdade agora** nem **o que falta**.
O agente continua agindo sem progredir — **Belief Trapping**.

## Mecanismo
**Crença** = (estado do mundo, objetivo, **lacunas epistêmicas**, **lacunas de realização**).
- Mundo como **Entidade–Estado–Relação**; cada estado/relação com **proveniência e confiança**; só entra o que afeta
  viabilidade de ação, avaliação de resultado ou o objetivo.
- **Lacuna epistêmica** = o que falta saber. **Lacuna de realização** = o que falta fazer.
- **Lacuna ativa:** uma por vez, a de maior valor agora (sem foco o agente pula entre lacunas).
- **Sentinela:** a atualização proposta pelo agente é **candidata**; antes de gravar, a sentinela procura
  **inconsistência interna** (estados incompatíveis na mesma entidade) e **externa** (contradiz a observação).
- **Saúde da crença (H)** numa janela de passos, com 3 sinais: **persistência** da lacuna, **estagnação** (passos sem
  progresso) e **recorrência** (o mesmo estado volta, distância de Jaccard). Preso quando H cai abaixo de um limiar.
- **Diagnóstico fatorado:** padrão **Parado / Ciclo / Deriva** × tipo de lacuna bloqueada → **restrições de
  recuperação**: suprimir ação ineficaz, cortar aresta recorrente, re-ancorar na lacuna ativa (realização);
  buscar evidência discriminante, induzir mudança relevante (epistêmica).

## Números
Melhor desempenho geral nos 4 benchmarks (execução e diagnóstico) com os 3 backbones; ablações mostram que
**validação de consistência e recuperação** são as partes importantes; resiste ao crescimento de contexto.

## No Prospector
| Conceito | Onde | Status |
|---|---|---|
| Fatos com fonte, validade e confiança | `src/tocomas/crenca.mjs` (`registrarFatos`, `VALIDADE_DIAS`) | feito |
| Pendências | `pendencias()` (falta_dado, conflito, aguardando_humano/resposta) | feito |
| Conflito entre fontes | `conflitos` | feito (é a "inconsistência externa" simples) |
| Preso por ciclos sem fato novo | `fecharCiclo` (LIMITE_PRESO = 3) | feito (só "estagnação") |
| Separar lacuna **epistêmica** × **de realização** | — | backlog B6 |
| Recorrência e padrões Parado/Ciclo/Deriva | — | backlog B7 |
| Recuperação por tipo (não só "tirar da fila") | — | backlog B7 |
