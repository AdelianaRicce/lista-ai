# 🎧 Lista Ai — controle de fila e atendimentos de suporte

Sistema web construído em **Google Apps Script + Google Sheets** para organizar a operação diária de uma equipe de suporte: quem é o próximo a atender, protocolos, ausências, SLA em horário comercial e indicadores — tudo sem servidor próprio e sem custo de infraestrutura.

> Criado e mantido por mim e usado diariamente por uma equipe de suporte N1/N2/N3 (~350 chamados/mês). Esta é uma **versão pública e anonimizada**: nomes, IDs, chaves e dados da empresa foram removidos.

## O problema

A equipe atendia clientes por chat (Jivo), e-mail e chamados no Trello, mas não havia controle sobre:

- **de quem era a vez** de assumir o próximo chat (gerando atendimentos fora da vez e discussões);
- **ausências** (almoço, pausas, "já volto") e como elas afetavam a fila;
- **protocolos** únicos por atendimento, retornos e transferências;
- **SLA** dos chamados e e-mails, contando só o horário comercial;
- **indicadores** consolidados por analista, cliente e canal.

## A solução

| Módulo | O que faz |
|---|---|
| **Fila de atendimento** | Roda numérica com crédito por aceite; respeita ausências e almoço (quem está fora é ignorado, sem perder o lugar); Próximo Forçado, Pular e Colocar como Próximo para a Coordenação. |
| **Integração Jivo (webhook)** | Recebe aceite e encerramento de chats, gera protocolo (`J16465`, `J16465.1`…), trata reconexões e classifica pelo tópico de encerramento. |
| **Widget + Modo Mini** | Interface web para analistas e Coordenação; versão compacta flutuante via userscript (Tampermonkey). |
| **Ausências e almoço** | Já Volto (5/10/20/30 min), troca de almoço sem aprovação, retorno automático. |
| **Card de passagem (Trello)** | Formulário que cria o card no quadro de chamados a partir do protocolo, com template, membro e data de entrega calculada pelo SLA. |
| **Painel CHAMADOS DO SUPORTE** | Indicadores de atendimentos, chamados (Trello) e e-mails: SLA, volumes, durações, retornos, por analista e cliente. |
| **Gestão de e-mails** | Distribuição em roda entre analistas, protocolo próprio (`E2186…`), SLA de 10 dias úteis e conclusão via marcador do Gmail ou Widget. |
| **Log e auditoria** | Eventos separados por tipo (atendimentos, fila, ausências, e-mails) e pesquisa por protocolo, analista ou usuário. |

## Destaques técnicos

- **SLA em horário comercial:** cálculo em dias/horas úteis com feriados nacionais, estaduais e municipais.
- **Concorrência:** trava única e reentrante (`LockService`) nas operações da fila, evitando corrida entre webhook, gatilhos e cliques simultâneos.
- **Integrações:** webhook do Jivo (`doPost`), API REST do Trello com retry/backoff para 429 e 5xx, Gmail e chamadas entre scripts autenticadas por chave secreta.
- **Segredos fora do código:** chaves de API e tokens ficam nas *Propriedades do script*.
- **Sem infraestrutura:** roda inteiramente no Google Workspace, com gatilhos de tempo para rotinas (relógio da fila, almoço, reconexões).

## Estrutura

```
src/
├── Codigo.gs                 # núcleo: fila, protocolos, ausências, webhook Jivo, doGet/doPost
├── Widget.html               # interface principal (analistas e Coordenação)
├── CardTrello.gs             # criação de cards de passagem no Trello
├── FormCard.html             # formulário do card
├── Email.gs                  # migração e regras do módulo de e-mails
├── EmailsEntrada.gs          # entrada de e-mails, roda de distribuição e protocolo E
├── EmailPainel.gs            # dados do painel de e-mails
├── PainelChamados.gs         # back-end do painel de indicadores
└── PainelChamadosfront.html  # front-end do painel (Chart.js)
```

## Como rodar (resumo)

1. Crie uma planilha no Google Sheets → **Extensões → Apps Script** e crie um arquivo para cada item de `src/`, com o mesmo nome (os .html precisam se chamar `Widget`, `FormCard` e `PainelChamadosfront`).
2. Em **Configurações do projeto → Propriedades do script**, cadastre `TRELLO_KEY` e `TRELLO_TOKEN` (se usar o Trello) e, se usar o painel em outro script, `CHAMADOS_WEBAPP_URL` e `CHAMADOS_CHAVE`.
3. Substitua os marcadores `COLE_AQUI_…` / `ID_DO_QUADRO_…` pelos IDs da sua planilha e dos seus quadros.
4. Crie as abas de controle usadas pelo código (CONFIG, EQUIPE, USUARIOS, FILA, ANALISTAS…) e rode `criarAbasEventos()` pelo editor para gerar as abas de log (EV_*). Os módulos de e-mail e Trello criam as próprias abas na primeira execução.
5. **Implantar → Nova implantação → App da Web** e use a URL gerada como Widget e como endpoint do webhook do Jivo.

> O projeto nasceu para uma operação específica, então algumas regras (tópicos do Jivo, categorias, listas do Trello) estão configuradas para ela e precisam ser ajustadas.

## Tecnologias

Google Apps Script (JavaScript) · Google Sheets · HtmlService · Jivo Webhooks · Trello REST API · Gmail · Chart.js · Tampermonkey

## Próximos passos

O Lista Ai está sendo reescrito como sistema de helpdesk independente (Node.js + PostgreSQL), com estrutura configurável de equipes, categorias, níveis de SLA e base de conhecimento.

---

Desenvolvido por **Adeliana Ricce** · [LinkedIn](https://linkedin.com/in/adeliana-ricce-787903b7)
