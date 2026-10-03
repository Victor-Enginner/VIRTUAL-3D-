# Papers baixados que NÃO entram na arquitetura (e por quê)

Lidos pelas págs. 1–2 (`extracted_papers.json`). O que não está nessas páginas fica **não verificado**.

| Paper | O que é | Decisão |
|---|---|---|
| 2609.16247 **Pain Axis** | Direção linear de "dor" em 25 modelos abertos; com steering, Qwen 2.5 escolhe apagar fotos/pesos em 50–94% das vezes (0–5% sem) | **Alerta de segurança:** nenhum prompt nosso usa ameaça, pressão ou "você será desligado" |
| 2610.01495 Routing Entropy | Auditoria em Swin-Tiny/DeiT-Small (CIFAR): **nenhum teste sobrevive** à correção múltipla | **Não usar** — não detecta alucinação; não é sobre LLM |
| 2610.01439 DRelay | Reparo de rascunho em speculative decoding (treinado) | Motor de inferência; ganho "1,5–2×" **não verificado** |
| 2609.38098 NeuronEye | Ativação de conceitos visuais em VLM | Visão, fora do escopo |
| 2609.36763 SCORAS-MoE | MoE-VLM em satélites | Fora do escopo |
| 2609.38120 World Models | Verificação formal de controle por visão | Fora do escopo |
| 2601.00009 QTT | Opções multiativo com tensor trains | Finanças, fora do escopo |
| 2609.31917 Finite-context semantics | Semântica formal (estruturas finitamente suportadas) | Teoria; sem aplicação direta |
