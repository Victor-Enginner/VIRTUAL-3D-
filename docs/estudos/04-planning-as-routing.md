# Do LLM Agents Execute the Plans They Declare? — Planning-as-Routing (arXiv 2609.38108)

- **Autores:** Oota, Herrera, Cabot, López de Prado, Khan (ADIA Lab, Granada, LIST, Cornell, LBNL).
- **Lido:** completo (seções 3 e 6).

## Mecanismo
- **4 modos de plano:** Predefinido (plano fixo, sem replanejar) · Sequencial (planeja-executa-replaneja) ·
  Hierárquico (orquestrador–workers–síntese) · Busca (vários planos candidatos, juiz por rubrica escolhe).
- **3 condições comparadas:** ReAct puro; Plan+ReAct (plano no prompt, executor genérico); **Planning-as-Routing**
  (o modelo declara o modo e um **roteador determinístico, sem inferência,** manda para o executor específico).
- **Verificador de estrutura (por regra):** casa cada passo declarado com as ações, na ordem (ações extras entre eles
  são permitidas).
- **Métricas de processo:** aderência ao plano, qualidade do plano, fidelidade de ordem.

## Achados
1. Plan+ReAct **não preserva** a estrutura declarada (22–45% das trajetórias), e piora com planos longos.
2. O melhor modo varia por ambiente e modelo — **mas** controles com o mesmo número de tentativas mostram que boa parte
   do ganho "do modo certo" vem de **tentar de novo**, não de complementaridade real.
3. Executor específico por modo eleva o sucesso (ALFWorld 0,48 → 0,92; SWE-bench Verified 0,36 → 0,44).
4. **Escolher o modo ainda é difícil:** a declaração do modelo pouco supera uma preferência fixa; **exemplos no prompt
   (few-shot) ajudam mais que ligar "thinking".**

## No Prospector
| Conceito | Onde | Status |
|---|---|---|
| Modo escolhido por regra (não pelo modelo) | `MODO` em `src/tocomas/fidelidade.mjs` (varrer = busca; resto predefinido) | feito |
| Plano declarado + ferramentas usadas | `abrirPlano` / `fechar` | feito |
| Placar de fidelidade | flag `fidelidade`, Base do Mestre | feito |
| Verificar **ordem** dos passos (não só o conjunto) | — | backlog B8 (só quando houver plano com vários passos) |
| Few-shot quando o modelo precisar escolher algo | `decide()` | anotação para prompts futuros |
