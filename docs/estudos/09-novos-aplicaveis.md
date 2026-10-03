# Três papers novos (busca de 03/10/2026) lidos por inteiro

## 2610.02001 — Mingbird: harness local-first para modelos abertos pequenos
**Por que importa:** é o nosso cenário (Windows, Ollama, modelos de 2–9B). Tese medida pelos autores: boa parte das
falhas de modelos pequenos vem do **harness**, não do modelo. Lido: completo (seção 3 e ablação 5.6).

| Mecanismo | O que faz | Para nós |
|---|---|---|
| M1 prefill enxuto | classifica o domínio e carrega **só** as ferramentas daquela categoria; orçamento fixo de 797 tokens; nova função não pode aumentar o prefill (teste em CI) | prompts da Nova/Maia já são curtos; criar teste de tamanho máximo de prompt (B12) |
| M2 conversa × tarefa | conversa usa prefill mínimo; tarefa libera ferramentas | Configurador vs pipeline já separados |
| M3 portão de término | antes de aceitar "terminei", **relê a tarefa original** e confere ponto a ponto; roda as checagens e devolve a falha real | Maia: conferir a mensagem contra a observação/ângulo antes de aceitar (já fazemos parte com `contradicoes` + `carregaObservacao`) |
| M4 anti-loop por assinatura | assinatura = ferramenta + argumentos normalizados; trava em chamadas idênticas ou vazias; escalonamento | job repetido com mesmos argumentos sem resultado → crença "preso" já cobre parte (B7) |
| M5 rejeição com próxima ação | rejeitar "falso término" sempre traz **a próxima ação executável**; resgata 3 formatos de chamada malformada | mensagens de erro dos agentes devem dizer o que fazer |
| M6 edição segura | `.bak` automático e rollback de 1 comando | n/a (agentes não editam arquivos) |
| M7 resiliência | UTF-8 com substituição; turno vazio → reset; checkpoint para retomar | jobs já retomam; tratar resposta vazia do Ollama como falha |
| M8 fronteira de segurança | caminhos normalizados; `.env`/credenciais atrás de portão; fora da pasta exige confirmação humana; sub-agentes negados por padrão | Atlas já bloqueia IP privado; nunca ler `.env` em prompt |
| M14 cinco anéis | sub-agente com menos permissão; irreversível recusado; ação de sistema depende de o operador estar presente | envio de WhatsApp só com aprovação humana (já) |

## 2609.33401 — Modelos System One (Jev, Laya, Decider…) para decisões de segurança
**Por que importa:** avalia exatamente o tipo de decisão do nosso `decide()`. Lido: completo (conclusões e método de política).
- Acurácia geral boa e **calibração média boa podem esconder falhas concentradas** em grupos específicos.
- **Política de 3 zonas** sobre a probabilidade: permitir abaixo de 10,5%, bloquear acima de 89,5%, **o resto vai para
  revisão humana**. Com limites rígidos de erro, pouca coisa é automatizada; separar os limiares de permitir e bloquear
  aumenta a automação principalmente bloqueando mais.
- **Para nós (B3):** a Nova decide sozinha só nos extremos; o meio vai para você — e medir calibração **por nicho**,
  não só a média.

## 2609.31937 — Verificação como camada da arquitetura (V-model)
Lido: completo (proposta e conclusão). Piloto pequeno (47 execuções, backbone 8B).
- Cada nível de especificação tem um **verificador próprio**; um **controlador determinístico** aplica o veredito;
  **só veredito escreve na memória** (aceitos num registro, rejeições num índice por componente e causa).
- Cada verificador separa um **portão determinístico (custo zero)** de um **juiz LLM opcional**.
- Resultados do piloto: sem verificação, **nenhuma** execução terminou por decisão (todas pelo limite de passos);
  com verificação, 8 de 10 respondidas e o resto com abstenção justificada; **8 de 9 correções vieram dos portões
  determinísticos**; planejar sem verificador **piorou**.
- **Para nós:** confirma "fato é regra" e os checadores determinísticos da Maia; próximo passo é registrar
  **rejeições por causa** (B13) e só gravar na crença o que passou por portão.
