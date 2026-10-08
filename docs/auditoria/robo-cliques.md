# Robô de cliques — 08/10/2026 05:27

Gerado por `python scripts/robo-cliques.py` numa cópia do banco real. **ESCREVE** 5 · **MORTO** 1 · **MUDA_TELA** 70 · **NAO_CLICAVEL** 2 · **NAVEGA** 105

## MORTO (1)

| Página | Elemento | Detalhe |
|---|---|---|
| engine | 03 Qualificar Nova · Juízo 0 |  |

## NAO_CLICAVEL (2)

| Página | Elemento | Detalhe |
|---|---|---|
| configurador | Pular para a mensagem | ElementHandle.click: Timeout 3000ms exceeded. |
| base | Mais | ElementHandle.click: Timeout 3000ms exceeded. |

## Todos

| Página | Elemento | Resultado | Banco / rede |
|---|---|---|---|
| inicio | Painel 15 | NAVEGA |  |
| inicio | Produção | NAVEGA |  |
| inicio | Agentes 5 | NAVEGA |  |
| inicio | Nichos | NAVEGA |  |
| inicio | Engine | NAVEGA |  |
| inicio | Fluxos | NAVEGA |  |
| inicio | Conforto | NAVEGA |  |
| inicio | Paraíso | NAVEGA |  |
| inicio | Base | NAVEGA |  |
| inicio | Config. | NAVEGA |  |
| inicio | Mais | MUDA_TELA |  |
| inicio | FALAR | MUDA_TELA |  |
| inicio | Enviar | MUDA_TELA |  |
| inicio | Varrer | NAVEGA |  |
| inicio | 15 Aprovar | NAVEGA |  |
| inicio | 40 Enviar | NAVEGA |  |
| inicio | A Alva Assistente executiva | NAVEGA |  |
| inicio | A Atlas Inteligência de mercado | NAVEGA |  |
| inicio | N Nova Estratégia | NAVEGA |  |
| inicio | M Maia Copy | NAVEGA |  |
| inicio | L Leo Operações | NAVEGA |  |
| inicio | Barbearia · Lisboa Gusbarber - Cabeleireiro de Homens / Barb | NAVEGA |  |
| inicio | Barbearia · Lisboa Cabeleireiros de Homens Estrela Barbersho | NAVEGA |  |
| inicio | Barbearia · Lisboa Aneel barbershop prioridade 91 · sem site | NAVEGA |  |
| painel | Início | NAVEGA |  |
| painel | Mais | MUDA_TELA |  |
| painel | Nova sessão | ESCREVE | config, sessoes, POST /api/sessoes → 200 |
| painel | Ajustes | MUDA_TELA |  |
| painel | Retomar agentes | ESCREVE | config, POST /api/agentes/retomar → 200 |
| painel | Começar a aprovar | MUDA_TELA |  |
| painel | ver na lista | MUDA_TELA |  |
| painel | Falar um comando | MUDA_TELA |  |
| painel | 130 encontrados | MUDA_TELA |  |
| painel | 57 com site fraco ou sem site 44% | MUDA_TELA |  |
| painel | 55 mensagens escritas 96% | MUDA_TELA |  |
| painel | 0 enviados 0% | MUDA_TELA |  |
| painel | 0 responderam | MUDA_TELA |  |
| painel | on | MUDA_TELA |  |
| painel | Colocar na fila do Atlas | MUDA_TELA |  |
| painel | Para aprovar15 | MUDA_TELA |  |
| painel | Qualificados15 | MUDA_TELA |  |
| painel | Na fila40 | MUDA_TELA |  |
| painel | Enviados0 | MUDA_TELA |  |
| painel | Responderam0 | MUDA_TELA |  |
| painel | Fechados0 | MUDA_TELA |  |
| painel | Não fecharam0 | MUDA_TELA |  |
| painel | Sem resposta0 | MUDA_TELA |  |
| painel | Sem telefone3 | MUDA_TELA |  |
| painel | Descartados57 | MUDA_TELA |  |
| painel | Todos130 | MUDA_TELA |  |
| painel | Enviar em sequência | MUDA_TELA |  |
| painel | Cancelar | ESCREVE | envios, leads, POST /api/envios/41/cancelar → 200 |
| producao | Mais | MUDA_TELA |  |
| producao | Ver fora do fluxo | MUDA_TELA |  |
| producao | Paulo - Cabeleireiro de Homens Barbearia · Lisboa-LIS Sem si | NAVEGA |  |
| producao | Cabeleireiro de Homens Nova Lisboa Barbearia · Lisboa-LIS Se | NAVEGA |  |
| producao | Trust Barbershop - Lisboa Barbearia · Lisboa-LIS Sem site 90 | NAVEGA |  |
| producao | Belarmino Barbearia Clássica Barbearia · Lisboa-LIS Site for | NAVEGA |  |
| producao | A FIRMA / Barber Club Barbearia · Lisboa-LIS Site fora do ar | NAVEGA |  |
| producao | NONNO GRILL CHURRASCARIA FRANCA SP Churrascaria · Franca-SP  | NAVEGA |  |
| producao | RESTAURANTE BARÃO Restaurante · Franca-SP Sem site 90 | NAVEGA |  |
| producao | SOLAR CENTER SOLUÇÕES ECOLÓGICAS Fornecedor de sistemas de a | NAVEGA |  |
| producao | LA FINESTRA FRANCA SP Restaurante · Franca-SP Só rede social | NAVEGA |  |
| producao | epic Pizza Pizzaria · Franca-SP Só cardápio/delivery 76 | NAVEGA |  |
| producao | Azul Culinária Brasileira Restaurante · Franca-SP Site em co | NAVEGA |  |
| producao | Bistrô Retrô Restaurante brasileiro · Franca-SP Só rede soci | NAVEGA |  |
| producao | Dr Barbeiro Estefânia Barbearia · Lisboa-LIS Site próprio 49 | NAVEGA |  |
| producao | Madero & Jeronimo Burger Franca Hamburgueria · Franca-SP Sit | NAVEGA |  |
| producao | Sapataria da Pizza Pizzaria · Franca-SP Site próprio 49 | NAVEGA |  |
| producao | The Barber Company El Corte Inglés Lisboa Barbearia · Lisboa | NAVEGA |  |
| producao | Natália Araújo Estética - Franca SP Esteticista · Franca-SP  | NAVEGA |  |
| producao | Quantica Energia Fotovoltaica Fornecedor de equipamentos a e | NAVEGA |  |
| producao | Barbearia Pedrinho Cabelo e Arte Estafânia Barbearia · Lisbo | NAVEGA |  |
| producao | Barbearia Partner Barbearia · Lisboa-LIS Só rede social 77 | NAVEGA |  |
| producao | Royal Barbershop Barbearia · Lisboa-LIS Só plataforma de age | NAVEGA |  |
| producao | FADE DISTRICT BARBERSHOP Barbearia · Lisboa-LIS Só rede soci | NAVEGA |  |
| producao | Luxsol - Energia Solar Fornecedor de equipamentos a energia  | NAVEGA |  |
| producao | Passos Energia Solar - Unidade Franca SP Fornecedor de equip | NAVEGA |  |
| producao | CONNECTION BARBERSHOP Barbearia · Lisboa-LIS Site próprio 51 | NAVEGA |  |
| producao | Solarprime Soluções em Energia / Unidade Franca Empresa de e | NAVEGA |  |
| producao | VINIMAQ - ENERGIA SOLAR Empresa de energia solar · Franca-SP | NAVEGA |  |
| producao | Dra. Talita Gonçalves / Biomédica / Clínica de Estética / Pr | NAVEGA |  |
| producao | Bem Estar Estética Esteticista · Franca-SP Sem site 89 | NAVEGA |  |
| producao | EcoPower Ribeirão Preto Fornecedor de equipamentos a energia | NAVEGA |  |
| producao | Ontech Energia Solar Fornecedor de equipamentos a energia so | NAVEGA |  |
| producao | Rafa Dias / Designer de Sobrancelhas Salão de Beleza · Lisbo | NAVEGA |  |
| producao | Lins Energia Solar Empresa de energia solar · Ribeirão Preto | NAVEGA |  |
| producao | Spark Energias Renováveis Fornecedor de equipamentos a energ | NAVEGA |  |
| producao | DLIMPSOL Energia Solar Empresa de energia solar · Ribeirão P | NAVEGA |  |
| producao | Capitão Prime Hamburgueria Franca Hamburgueria · Franca-SP S | NAVEGA |  |
| producao | FrancaSol Energia Solar Fornecedor de equipamentos a energia | NAVEGA |  |
| producao | Elitios Soluções Energéticas / Energia Solar / Franca e Regi | NAVEGA |  |
| producao | Dayma - Clínica de Estética Clínica especializada · Franca-S | NAVEGA |  |
| producao | Probelle - Centro de Saúde e Estética Avançada Centro de saú | NAVEGA |  |
| producao | Clínica Estética Virtuosa - Franca Centro de saúde e beleza  | NAVEGA |  |
| producao | Clínica Especializada Dra. Franciela Costa Clínica especiali | NAVEGA |  |
| producao | Clínica de estética Nikaela Lima Centro estético · Franca-SP | NAVEGA |  |
| producao | Estética Gabriela Gonçalves - Franca SP Clínica especializad | NAVEGA |  |
| producao | Fogo Vivo Steakhouse Churrascaria · Franca-SP Só rede social | NAVEGA |  |
| producao | Heat BBQ / Hamburgueria Artesanal em Franca Hamburgueria · F | NAVEGA |  |
| producao | Casa Burger Hamburgueria · Franca-SP Só cardápio/delivery 75 | NAVEGA |  |
| producao | Joana Nail Designer / Unhas de Gel, Acrílico e Verniz Gel Li | NAVEGA |  |
| producao | Glittereti Nails Manicure · Lisboa-LIS Só rede social 74 | NAVEGA |  |
| producao | Hit Nails Beauty Salon / Unhas De Gel e Acrílico Lisboa Mani | NAVEGA |  |
| producao | Solarbens - Energia Fotovoltaica Fornecedor de equipamentos  | NAVEGA |  |
| producao | Sobrancelhas em Lisboa Aline Oliveira Salão de Beleza · Lisb | NAVEGA |  |
| producao | Jak Albuquerque Studio - Sobrancelhas, Micropigmentação, rem | NAVEGA |  |
| producao | Contato Energia Solar Fornecedor de equipamentos a energia s | NAVEGA |  |
| producao | Clínica Performance - Estética Avançada em Franca Esteticist | NAVEGA |  |
| producao | Andry Studio, Design de Sobrancelha, Esteticista · Lisboa-LI | NAVEGA |  |
| producao | Clínica Dra. Michele Ludovino Biomédica Esteta / Harmonizaçã | NAVEGA |  |
| producao | Andresa Fonseca - Estética e Massoterapia Franca SP Estetici | NAVEGA |  |
| producao | DLX Energia Solar - Ribeirão Preto Empresa de energia solar  | NAVEGA |  |
| producao | Michele Furtado Beauty - Nails & Aesthetics Manicure · Lisbo | NAVEGA |  |
| producao | Ateliê Solar Fornecedor de equipamentos a energia solar · Ri | NAVEGA |  |
| producao | Chama Solar Soluções Fotovoltaicas Empresa de energia solar  | NAVEGA |  |
| producao | Connect Energia Solar - Ribeirão Preto/SP Fornecedor de equi | NAVEGA |  |
| producao | Soltaic Energia Solar Empresa de energia solar · Ribeirão Pr | NAVEGA |  |
| producao | Maestro Solar Empresa de energia solar · Franca-SP Site próp | NAVEGA |  |
| producao | EletroBidu Energia Solar Empresa de energia solar · Franca-S | NAVEGA |  |
| producao | Clínica Estética Fisioforma - Unidade Franca Centro de saúde | NAVEGA |  |
| agentes | Mais | MUDA_TELA |  |
| agentes | Alva Assistente executiva | NAVEGA |  |
| agentes | Atlas Inteligência de mercado | NAVEGA |  |
| agentes | Nova Estratégia | NAVEGA |  |
| agentes | Maia Copy | NAVEGA |  |
| agentes | Leo Operações | NAVEGA |  |
| agentes | Atividade | MUDA_TELA |  |
| agentes | Função e ferramentas | MUDA_TELA |  |
| agentes | Como decide | MUDA_TELA |  |
| nichos | Mais | MUDA_TELA |  |
| nichos | Ver Energia solar & Automação no quadro | NAVEGA |  |
| nichos | Ver Barbearia & Estilo VIP no quadro | NAVEGA |  |
| nichos | Ver Estética avançada no quadro | NAVEGA |  |
| nichos | Ver Restaurantes & Delivery no quadro | NAVEGA |  |
| nichos | Ver Salão, Unhas & Sobrancelhas no quadro | NAVEGA |  |
| fluxos | Mais | MUDA_TELA |  |
| fluxos | Google Maps | MUDA_TELA |  |
| fluxos | OpenStreetMap | MUDA_TELA |  |
| fluxos | Auditoria | MUDA_TELA |  |
| fluxos | Banco local | MUDA_TELA |  |
| fluxos | Nova | MUDA_TELA |  |
| fluxos | Maia | MUDA_TELA |  |
| fluxos | Você | MUDA_TELA |  |
| fluxos | Fila (Leo) | MUDA_TELA |  |
| fluxos | WhatsApp | MUDA_TELA |  |
| fluxos | Equipe | MUDA_TELA |  |
| fluxos | Google Maps (navegador local) Funcionando 4 varredura(s) usa | MUDA_TELA |  |
| fluxos | OpenStreetMap (Overpass) Parado Sem varredura do OSM ativa ( | MUDA_TELA |  |
| fluxos | Auditoria de site (Atlas) Funcionando 130 empresas já têm a  | MUDA_TELA |  |
| fluxos | Banco local (SQLite) Funcionando 130 leads guardados no seu  | MUDA_TELA |  |
| fluxos | Nova · decisão Funcionando Modelo local ligado (JOSIEFIED-Qw | MUDA_TELA |  |
| fluxos | Maia · mensagem Funcionando Escrevendo com o modelo local. | MUDA_TELA |  |
| fluxos | Sua aprovação Esperando você 15 mensagens esperando você. Ab | MUDA_TELA |  |
| fluxos | Fila de envio (Leo) Parado 40 na fila · 0 de 50 enviados hoj | MUDA_TELA |  |
| fluxos | WhatsApp (OpenWA) Com falha Não conectou (sem resposta). Mod | MUDA_TELA |  |
| fluxos | Equipe de agentes Parado Todos pausados: só começam quando v | MUDA_TELA |  |
| engine | Mais | MUDA_TELA |  |
| engine | Etapas | NAVEGA |  |
| engine | Portões e presos | NAVEGA |  |
| engine | Controlador | NAVEGA |  |
| engine | Calibração | NAVEGA |  |
| engine | Regras aprendidas | NAVEGA |  |
| engine | Papers | NAVEGA |  |
| engine | 01 Varrer o mapa Atlas · Coleta 4 | MUDA_TELA |  |
| engine | 02 Auditar o site Atlas · Coleta 0 | MUDA_TELA |  |
| engine | 03 Qualificar Nova · Juízo 0 | MORTO |  |
| engine | 04 Redigir a mensagem Maia · Escrita 15 | MUDA_TELA |  |
| engine | 05 Sua aprovação Você · Decisão humana 15 | MUDA_TELA |  |
| engine | 06 Enviar Leo · Envio 40 | MUDA_TELA |  |
| engine | 07 Acompanhar respostas Leo · Envio 0 | MUDA_TELA |  |
| engine | 08 Aprender com você Nova · Juízo 26 | MUDA_TELA |  |
| configurador | Pular para a mensagem | NAO_CLICAVEL |  |
| configurador | Mais | MUDA_TELA |  |
| configurador | Novo agente | ESCREVE | agentes_custom, conversas_config, POST /api/config-agentes → 200 |
| configurador | Começar um agente novo | ESCREVE | agentes_custom, conversas_config, POST /api/config-agentes → 200 |
| configurador | Anexar arquivo | MUDA_TELA |  |
| configurador | Ditar mensagem | MUDA_TELA |  |
| configurador | Enviar | MUDA_TELA |  |
| base | Mais | NAO_CLICAVEL |  |
| conforto | Mais | MUDA_TELA |  |
| conforto | on | MUDA_TELA |  |
| creditos | Mais | MUDA_TELA |  |
