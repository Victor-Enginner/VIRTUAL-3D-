# Plataforma de agentes — arquitetura-alvo (08/10/2026)

Estudo para transformar o ecossistema do Victor numa plataforma onde **pessoas se inscrevem, escolhem ou criam agentes e usam**.
Base: navegação de `victor-ai-enginner.vercel.app`, `agentes-money-preview.vercel.app` (Alva, Atlas, Maia, Leo, Nova, `/app`),
código do Agentes Money (`packages/agent-config`, `scripts/agent-create.ts`, `docs/audits/2026-10-07/AUDITORIA.md`) e do Prospector.

## 1. O ecossistema hoje (o que cada peça é)

| Peça | Papel | Estado real |
|---|---|---|
| **victor-ai-enginner.vercel.app** | Vitrine da consultoria: automação, chatbots, conteúdo, dados, voz/vídeo. Planos US$ 190 / 590 / 1.200 por mês | Página pronta; cases "em breve"; em inglês, para "one-person businesses" |
| **Agentes Money (Agent Foundry GEN 01)** | O **produto**: 5 especialistas com landing própria, `/app` com conversa, tarefas, memória e controle | Demonstração: respostas simuladas, integrações "em preparação", sem login nem contas (F03), `agent:create` é um questionário no terminal que **gera código** e exige novo deploy |
| **Prospector + Paraíso Artificial** | A **máquina de vendas**: acha empresas, audita, decide, escreve, envia; escritório 3D | Real e testado (307 testes), banco v11, bandit de território, comandos com eval |

Os três falam dos **mesmos cinco agentes**. Hoje não trocam nada entre si.

## 2. O catálogo: profissões até 2030 → serviço → sinal detectável → agente

A lista do Fórum Econômico Mundial (Future of Jobs 2025) é o catálogo do Victor: ele vende o trabalho dessas profissões como serviço.
O que torna isso **prospectável** é a coluna "sinal": o que o Atlas consegue **medir** numa empresa sem inventar.

| Profissão em alta | Serviço vendido | Sinal que o Atlas mede (fato) | Agente |
|---|---|---|---|
| Especialista em cibersegurança | Auditoria e correção: HTTPS, cabeçalhos, SPF/DKIM/DMARC, CMS desatualizado, formulário sem proteção | O Atlas **já baixa o site**: falta checar certificado, cabeçalhos, versão do CMS e o DNS do e-mail do domínio | **Etbaal** (novo; nome escolhido pelo Victor) |
| Integrador de IA / automação | Fluxos de WhatsApp: agendamento, confirmação, lembrete, follow-up | Ramo de agenda (clínica, salão, pet, oficina) + só telefone fixo ou sem agendamento online no site | **Leo** |
| Desenvolvedor web / presença digital | Site, landing, Google Meu Negócio completo, placa NFC de avaliação | Sem site, só rede social, poucas avaliações para o tamanho da cidade, perfil sem horário | **Atlas + Maia** |
| Cientista/analista de dados | Painel de vendas e relatórios automáticos | Ramo com volume (varejo, restaurante grande, rede) | **Atlas (análise)** |
| Engenheiro de prompt / auditor de viés | Implantação de agentes com regras e avaliação | Empresa que já usa chatbot genérico no site | **Nova** |
| Energia renovável / ESG | Prospecção para integradoras solares (cliente do Victor) | Nicho `energia_solar` já existe | **Atlas** |
| Saúde mental, educação digital | Agenda, captação e conteúdo para psicólogos, escolas, cursos | Ramos em crescimento: novos negócios com sistemas imaturos | **Maia + Leo** |
| Ambientes imersivos | Escritório 3D / showroom para o cliente | Empresas com marca forte e equipe | **Paraíso** como produto |

Formato da oferta: pequenas empresas não recusam tecnologia por falta de valor, e sim por **custo e complexidade**
(arXiv 2512.10074); adoção **incremental** funciona melhor (2512.04339). Logo: começar com um serviço pequeno e mensal
(o plano Starter) e subir para Growth/Partner.

## 3. O que falta para "pessoas se inscreverem e usarem meus agentes"

| Lacuna | Por que trava | Correção com base |
|---|---|---|
| **Agente é código**, não dado (`agent-create.ts` escreve `.ts` + deploy) | Ninguém de fora cria agente sem programador | **Especificação de agente como dado** (JSON validado por schema), carregada pelo runtime em tempo de execução. Um cartão por agente, no formato dos protocolos A2A/MCP (arXiv 2505.02279) |
| **Sem login, conta, organização** (auditoria F03) | Dados de clientes misturados; nada para cobrar | Contas + organização (tenant) + papéis antes de qualquer dado real |
| **Ferramentas simuladas** (integrações MOCK, F04) | "Capacidade planejada" na página não é produto | Uma ferramenta **real** por agente antes de vender (ex.: Etbaal com a auditoria de segurança do site, que o Prospector já quase faz) |
| **Permissões amplas** | Agente criado por terceiro pode pedir ferramenta perigosa | **Menor privilégio por tarefa**: concessão curta e específica checada antes de cada efeito (IntentCap, 2609.14631); teto por papel + bloqueio de combinações arriscadas (2607.22445); planejar e só então executar (2509.08646) |
| **Sem avaliação antes de publicar** | Agente novo pode alucinar ou falhar calado (o bug das 10 opções mostrou isso) | Todo agente novo passa por um **eval** de casos reais antes de ir ao ar (igual `npm run eval-comandos`) |
| **Criação de agente do zero é difícil** | Usuário não sabe escrever persona, ferramentas e regras | Criar a partir de **perfis prontos recuperados** de um catálogo (LLM Agents Factory, 2608.09934) + uma meta-camada que olha as falhas e injeta contexto (FAMA, 2604.25135) |

## 4. Ordem de construção

1. **Especificação única de agente** (schema compartilhado pelos dois projetos): identidade, papel, ferramentas permitidas,
   limites, casos de avaliação. O Prospector lê e publica o cartão de cada agente. Base de tudo o que vem depois.
2. **Etbaal, o primeiro agente novo**: auditoria de cibersegurança do site de cada lead (fato, sem inventar), virando sinal no
   Atlas e serviço vendável. Ferramenta real, não simulada.
3. **Catálogo de ofertas ligado aos sinais**: a Nova passa a dizer "esta empresa → auditoria de segurança + fluxo de WhatsApp".
4. **Bandit contextual** (ramo, cidade, sinais, oferta) aprendendo com aprovações e respostas.
5. **Criador de agentes em tempo de execução** (a partir da especificação), com eval obrigatório e permissões mínimas.
6. **Contas e organizações** no Agentes Money; o Prospector vira o "agente de vendas" interno da plataforma.

## 5. Referência de preço do mercado (pesquisa de 08/10/2026 — o Victor ainda define os dele)

Faixas de **páginas comerciais**, não pesquisa oficial: servem de régua, não de preço. No sistema, cada oferta guarda
`faixa_mercado` (com a fonte) e `preco_victor = null` até ele decidir — nada inventado.

| Serviço | Faixa encontrada | Fonte |
|---|---|---|
| Agente de IA no WhatsApp (implantação) | R$ 2.000–10.000 | agenciacafeonline.com.br, 2026 |
| Agente de IA no WhatsApp (manutenção) | R$ 300–1.500/mês | agenciacafeonline.com.br; zaptrend.com.br |
| Automação de WhatsApp (plataforma + gestão) | R$ 200–1.000/mês | zaptrend.com.br |
| Custo do modelo de IA (500 conversas/mês) | R$ 30–250/mês | zaptrend.com.br |
| Gestão do Perfil da Empresa no Google | R$ 400–1.200/mês; configuração única ~R$ 500 | beonmarketingfortaleza.com.br; dunadesign.com.br |
| Placa NFC de avaliação | kit de 10 por R$ 150; unidade a partir de R$ 89 | spot5.com.br; usetag.online |
| Consultoria do Victor (vitrine) | US$ 190 / 590 / 1.200 por mês | victor-ai-enginner.vercel.app |

Por que cibersegurança (Etbaal) tem demanda agora: média de **4.118 ataques por semana** por empresa no Brasil em abril de 2026,
+46% em um ano (Check Point, via sindpd.org.br); PMEs apontadas como alvo principal (inforchannel.com.br, 09/2026);
33 mil ataques a PMEs disfarçados de ferramenta de IA no 1º quadrimestre de 2026, ~5× 2025 (Kaspersky, securelist.com.br);
golpe de **site falso** e de **WhatsApp** lideram as contestações do 1º semestre de 2026 (Santander).

O que as fontes concordam sobre "ganhar dinheiro de verdade": o modelo mais defendido é **serviço com recorrência por
dependência do cliente** (agente/automação + manutenção mensal), validado com 3 a 5 clientes reais antes de escalar.
É exatamente o desenho Prospector (acha) → Agentes Money (entrega) → mensalidade.
