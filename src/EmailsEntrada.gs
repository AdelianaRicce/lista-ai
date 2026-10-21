/*************************************************
 * 22. 📧 E-MAILS — ENTRADA DO GMAIL (Lista Ai 1.4.17)
 *
 * ALTERADO (1.4.17): APLICAR_MARCADORES_GMAIL (false) — até a implantação estar completa o Lista Ai só LÊ
 * o Gmail e não põe nem tira marcadores (⏭, Protocolo/E…, analista, subcategoria), exceto o "Concluído"
 * (APLICAR_CONCLUIDO_GMAIL: true — posto na conclusão pelo Widget/Trello e tirado na reabertura). O protocolo
 * continua no Lista Ai e no Widget; o Trello continua sendo ajustado. APLICAR_MARCADOR_PROTOCOLO (false)
 * controla só o Protocolo/E… quando os marcadores forem religados.
 *
 * ALTERADO (1.4.16):
 *  - a "Chegada" dos e-mails migrados do Trello (abertos) é corrigida pela 1ª mensagem do cliente
 *    sempre que a conversa vem do FluxoContinuo (a carga usou a data do título do card);
 *  - ajustarMigradosSemResponsavel(): rodar UMA vez — migrados abertos sem responsável voltam a
 *    "Aguardando" (🆕 Novos), sem SLA e sem indicado; o SLA começa quando alguém assumir.
 *
 * Arquivo NOVO do projeto do Lista Ai (Editor > + > Script > "EmailsEntrada").
 * Depende do Emails.gs (EMAILS_CFG, CAB_EMAILS, proximoUtilEmail_, prazoFinalEmail_,
 * etapaPorPrazoEmail_, dominioEmail_, seguroEmail_, garantirColunasEmails_), do EmailsPainel.gs
 * (colunasEm_, listaEm_, msEm_, mesmoNomeEm_, lerRodaEm_) e do backend (normalizarTexto,
 * lerSlaEFeriadosCard_, lerDicionarioCard_).
 *
 * Quem chama: o FluxoContinuo (conta de suporte), pelo doPost do Lista Ai com
 * { fonte: 'fluxoEmails', chave, acao, ... }. Só o Lista Ai grava na planilha; só o
 * FluxoContinuo mexe no Gmail e no Trello.
 *
 *   acao 'sincronizar'  conversas novas/atualizadas + marcadores das conversas vigiadas + mapa
 *                       dos cards do quadro → cria linhas, roda, protocolo, cliente, lê o que mudou
 *                       no Gmail/Trello e devolve as TAREFAS (marcadores e cards a ajustar).
 *   acao 'confirmar'    o FluxoContinuo avisa o que aplicou → limpa a "Pendência Gmail" e grava
 *                       a "Lista no Trello".
 *
 * Regra de ouro: linha com "Pendência Gmail" preenchida ainda não foi refletida no Gmail/Trello;
 * enquanto isso, o que vier do Gmail/Trello para ela é ignorado (vale o Lista Ai).
 *
 * Rodar UMA vez pelo editor, depois de colar: configurarEntradaEmails()
 *************************************************/

const ENTRADA_EM = {
  PROP_CHAVE: 'EMAIL_CHAVE_FLUXO',
  PROP_PROX_PROTOCOLO: 'EMAIL_PROX_PROTOCOLO',
  PROP_LIVRES: 'EMAIL_PROTOCOLOS_LIVRES',
  PROP_DEVOLVIDOS: 'EMAIL_RODA_DEVOLVIDOS',
  PRIMEIRO_PROTOCOLO: 2186,
  MARCADOR_CONCLUIDO: 'Concluído',
  PREFIXO_INDICADO: '⏭ ',
  PREFIXO_MARCADOR_PROTOCOLO: 'Protocolo/',
  APLICAR_MARCADOR_PROTOCOLO: false,           // NOVO (1.4.17): false = não põe Protocolo/E… no Gmail (o protocolo segue no Lista Ai)
  // NOVO (1.4.17): false = o Lista Ai só LÊ o Gmail (marcador de analista, "Concluído", subcategoria) e não
  // põe nem tira marcador nenhum (⏭, Protocolo, analista, Concluído, subcategoria). O Trello continua sendo ajustado.
  APLICAR_MARCADORES_GMAIL: false,
  // NOVO (1.4.17): com APLICAR_MARCADORES_GMAIL false, o "Concluído" continua sendo posto (conclusão pelo
  // Widget/Trello) e tirado (reabertura). false = nem ele.
  APLICAR_CONCLUIDO_GMAIL: true,
  LISTA_CONCLUIDOS_RECENTES: 'Concluídos últimos 30 dias',
  PREFIXO_LISTA_MES: 'Concluídos',             // + mês + ano com 2 dígitos (ex.: Concluídos outubro 26)
  DIAS_RECENTES: 30,
  DIAS_VIGIA_CONCLUIDOS: 15,                   // concluídos vigiados (retirar o "Concluído" reabre)
  LISTAS_ETAPA: { aguard: 'NA SEMANA', s1: 'SEMANA 1', s2: 'SEMANA 2', fora: 'FORA DO PRAZO' },
  MAX_EXCLUSOES_POR_EXECUCAO: 5,               // mais que isso numa execução = suspeita de leitura incompleta
  CARD_EXCLUIDO: '(card excluído)',
  SUFIXO_ARQUIVADO: ' (arquivado)',
  VIAS_COM_MARCADOR: ['Gmail', 'Widget', 'Trello', 'Cliente']
};

const MESES_EM = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

/* ============================ CONFIGURAÇÃO (rodar uma vez) ============================ */

function configurarEntradaEmails() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName(EMAILS_CFG.ABA_EMAILS);
  if (!aba) throw new Error('Rode criarAbasEmails() antes.');
  garantirColunasEmails_(aba);

  const pr = PropertiesService.getScriptProperties();
  let chave = pr.getProperty(ENTRADA_EM.PROP_CHAVE);
  if (!chave) {
    chave = Utilities.getUuid().replace(/-/g, '');
    pr.setProperty(ENTRADA_EM.PROP_CHAVE, chave);
  }

  // Próximo protocolo: nunca abaixo do maior E já gravado na EMAILS
  const c = colunasEm_();
  let maior = 0;
  if (aba.getLastRow() >= 2) {
    aba.getRange(2, c.prot + 1, aba.getLastRow() - 1, 1).getValues().forEach(l => {
      const m = /^E(\d+)$/i.exec(String(l[0] || '').trim());
      if (m) maior = Math.max(maior, +m[1]);
    });
  }
  const atual = Number(pr.getProperty(ENTRADA_EM.PROP_PROX_PROTOCOLO)) || 0;
  const prox = Math.max(atual, ENTRADA_EM.PRIMEIRO_PROTOCOLO, maior + 1);
  pr.setProperty(ENTRADA_EM.PROP_PROX_PROTOCOLO, String(prox));
  if (!pr.getProperty(ENTRADA_EM.PROP_LIVRES)) pr.setProperty(ENTRADA_EM.PROP_LIVRES, '[]');
  if (!pr.getProperty(ENTRADA_EM.PROP_DEVOLVIDOS)) pr.setProperty(ENTRADA_EM.PROP_DEVOLVIDOS, '[]');

  Logger.log('✅ Entrada de e-mails configurada.');
  Logger.log('Coluna "Reaberto em" conferida na EMAILS.');
  Logger.log('Próximo protocolo: E' + prox);
  Logger.log('LISTA_AI_CHAVE (copie para as Propriedades do script do FluxoContinuo): ' + chave);
  Logger.log('LISTA_AI_URL (copie também): ' + ScriptApp.getService().getUrl());
}

/* ============================ PONTO DE ENTRADA (doPost) ============================ */

/** Chamado pelo doPost quando conteudo.fonte === 'fluxoEmails'. Sempre responde JSON. */
function processarLoteFluxoEmails(conteudo) {
  const responder = o => ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
  try {
    const chave = PropertiesService.getScriptProperties().getProperty(ENTRADA_EM.PROP_CHAVE);
    if (!chave || String(conteudo.chave || '') !== chave) return responder({ ok: false, erro: 'Chave inválida.' });
    const acao = String(conteudo.acao || '');
    if (acao === 'ping') return responder({ ok: true, agora: Date.now() });
    if (acao === 'sincronizar') return responder(sincronizarEmailsFluxo_(conteudo));
    if (acao === 'confirmar') return responder(confirmarEmailsFluxo_(conteudo));
    return responder({ ok: false, erro: 'Ação desconhecida: ' + acao });
  } catch (e) {
    return responder({ ok: false, erro: e.message });
  }
}

/* ============================ SINCRONIZAR ============================ */

/**
 * p = {
 *   simulacao: bool,
 *   conversas: [{ id, link, chegada, assunto, remetente, marcadores: [], primeiraResposta, ultimaCliente,
 *                 ultimaSuporte, card }],                       // datas em ms
 *   etiquetas: { idConversa: [marcadores] },                   // conversas vigiadas (lista "vigia" anterior)
 *   quadro: { completo: bool, listas: { idLista: nome }, cards: { idCard: [idLista, arquivado 0|1] } }
 * }
 */
function sincronizarEmailsFluxo_(p) {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('Lista Ai ocupado; fica para a próxima execução.');
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.getSheetByName(EMAILS_CFG.ABA_EMAILS);
    if (!aba) throw new Error('A aba EMAILS não existe.');
    const sim = !!p.simulacao;
    if (!sim) garantirColunasEmails_(aba);

    const c = colunasEm_();
    const nCol = CAB_EMAILS.length;
    const totalAntes = aba.getLastRow() >= 2 ? aba.getLastRow() - 1 : 0;
    const dados = totalAntes ? aba.getRange(2, 1, totalAntes, Math.min(nCol, aba.getMaxColumns())).getValues() : [];
    dados.forEach(l => { while (l.length < nCol) l.push(''); });

    const agora = new Date();
    const ctx = criarContextoEntradaEm_(ss, sim, agora, p.quadro || null);

    const idx = { porId: {}, porCard: {} };
    dados.forEach((l, i) => {
      const id = String(l[c.id] || '').trim();
      if (id) idx.porId[id] = i;
      const card = String(l[c.card] || '').trim();
      if (card) idx.porCard[card] = i;
    });

    // Referência para "cliente escreveu depois da conclusão" — tirada ANTES de qualquer mudança.
    const refConclusao = dados.map(l => msEm_(l[c.conclEm]) || msEm_(l[c.atual]) || msEm_(l[c.chegada]));

    // 1. Conversas (novas, vínculo com linhas migradas e dados que não dependem de pendência)
    const cvPorLinha = {};
    const marcadoresPorLinha = {};
    (p.conversas || []).forEach(cv => {
      const i = entradaConversaEm_(cv, dados, idx, ctx);
      if (i === -1) return;
      cvPorLinha[i] = cv;
      marcadoresPorLinha[i] = cv.marcadores || [];
    });
    Object.keys(p.etiquetas || {}).forEach(id => {
      const i = idx.porId[id];
      if (i !== undefined && marcadoresPorLinha[i] === undefined) marcadoresPorLinha[i] = p.etiquetas[id] || [];
    });

    // 2. Trello: card mudou de lista, foi arquivado ou excluído
    if (ctx.quadro) entradaTrelloEm_(dados, ctx);

    // 3. Gmail: marcadores de analista, de subcategoria e "Concluído"
    Object.keys(marcadoresPorLinha).forEach(k => {
      const i = Number(k);
      if (ctx.novas[i]) return; // linha criada agora já leu os marcadores
      entradaMarcadoresEm_(dados[i], i, marcadoresPorLinha[i], ctx);
    });

    // 4. Cliente escreveu num e-mail concluído → reabre (mesmo protocolo, SLA do zero, Semana 1)
    Object.keys(cvPorLinha).forEach(k => {
      const i = Number(k);
      if (ctx.novas[i]) return;
      const l = dados[i], cv = cvPorLinha[i];
      if (pendenciaEm_(l, c)) return;
      if (String(l[c.sit] || '').indexOf('Concluído') !== 0) return;
      const ultCli = Number(cv.ultimaCliente) || 0;
      if (ultCli && ultCli > refConclusao[i]) {
        reabrirEm_(l, i, ctx, 'Cliente', 'Nova mensagem do cliente', ultCli);
      }
    });

    // 5. Tarefas para o FluxoContinuo
    const tarefas = [];
    dados.forEach((l, i) => {
      const t = tarefaDaLinhaEm_(l, i, ctx);
      if (t) tarefas.push(t);
    });

    // 6. Gravação
    if (!sim) {
      const mudadas = Object.keys(ctx.mudou).map(Number);
      mudadas.forEach(i => { dados[i][c.atual] = agora; });
      if (mudadas.length) {
        const n = dados.length;
        if (n > totalAntes) {
          const novas = n - totalAntes;
          [c.id, c.prot, c.card].forEach(col => aba.getRange(totalAntes + 2, col + 1, novas, 1).setNumberFormat('@'));
        }
        aba.getRange(2, 1, n, nCol).setValues(dados);
        if (n > totalAntes) {
          [c.chegada, c.catDesde, c.assumido, c.resp1, c.ini, c.prazo, c.conclEm, c.atual, c.reab]
            .forEach(col => aba.getRange(totalAntes + 2, col + 1, n - totalAntes, 1).setNumberFormat('dd/MM/yyyy HH:mm'));
        }
      }
      gravarEventosEntradaEm_(ss, ctx.eventos);
      salvarEstadoProtocoloEm_(ctx.prot);
      salvarEstadoRodaEm_(ctx.roda);
    }

    return {
      ok: true,
      simulacao: sim,
      tarefas: tarefas,
      vigia: listaVigiaEm_(dados, c, agora.getTime()),
      alertas: ctx.alertas,
      resumo: ctx.resumo,
      eventos: sim ? ctx.eventos.map(e => [e[1], e[3], e[4], e[6]].filter(Boolean).join(' · ')) : undefined
    };
  } finally {
    lock.releaseLock();
  }
}

function criarContextoEntradaEm_(ss, sim, agora, quadro) {
  const marcadorDe = {}, nomePorMarcador = {}, todosMarcadores = [];
  const roda = ss.getSheetByName(EMAILS_CFG.ABA_RODA);
  if (roda && roda.getLastRow() >= 2) {
    roda.getRange(2, 1, roda.getLastRow() - 1, 2).getValues().forEach(l => {
      const nome = String(l[0] || '').trim(), marc = String(l[1] || '').trim();
      if (!nome || !marc) return;
      marcadorDe[normalizarTexto(nome)] = marc;
      nomePorMarcador[normalizarTexto(marc)] = nome;
      todosMarcadores.push(marc);
    });
  }
  const clientes = {};
  try {
    lerDicionarioCard_().clientes.forEach(x => { clientes[normalizarTexto(x.nome)] = x.nome; });
  } catch (e) { /* sem DICIONARIO: cliente só pelo domínio */ }

  return {
    ss: ss, sim: sim, agora: agora, ms: agora.getTime(),
    feriados: lerSlaEFeriadosCard_().feriados,
    mc: lerMapaCategoriasEm_(ss),
    marcadorDe: marcadorDe, nomePorMarcador: nomePorMarcador, todosMarcadores: todosMarcadores,
    dominios: lerDominiosEm_(ss), clientes: clientes,
    prot: lerEstadoProtocoloEm_(),
    roda: lerEstadoRodaEm_(ss, agora.getTime()),
    quadro: quadro,
    c: colunasEm_(),
    novas: {}, mudou: {}, eventos: [], alertas: [],
    resumo: { novas: 0, vinculadas: 0, chegadas: 0, assumidos: 0, concluidos: 0, reabertos: 0, categorias: 0, descartados: 0, tarefas: 0 }
  };
}

/* ---------------------------- 1. Conversas ---------------------------- */

/** Devolve o índice da linha da conversa (nova ou existente) ou -1 se ignorada. */
function entradaConversaEm_(cv, dados, idx, ctx) {
  const c = ctx.c;
  const id = String(cv.id || '').trim();
  if (!id) return -1;
  const idCard = String(cv.card || '').trim();
  let i = idx.porId[id];

  // Linha migrada sem ID da conversa ("TRELLO-<card>"): vincula pelo ID do card
  if (i === undefined && idCard && idx.porCard[idCard] !== undefined) {
    const j = idx.porCard[idCard];
    const antigo = String(dados[j][c.id] || '').trim();
    if (!antigo || /^TRELLO-/.test(antigo)) {
      delete idx.porId[antigo];
      dados[j][c.id] = id;
      if (!dados[j][c.gmail] && cv.link) dados[j][c.gmail] = cv.link;
      idx.porId[id] = j;
      i = j;
      ctx.mudou[j] = true;
      ctx.resumo.vinculadas++;
    } else {
      // O card já pertence a outra conversa (mesmo protocolo/assunto): não vira outro e-mail
      ctx.alertas.push('Conversa ' + id + ' caiu no card de outra conversa (' + antigo + '); não foi criada linha nova.');
      return -1;
    }
  }

  if (i === undefined) {
    i = novaLinhaEmailEm_(cv, dados, ctx);
    idx.porId[id] = i;
    if (idCard) idx.porCard[idCard] = i;
    return i;
  }

  // Linha existente: dados que não dependem de pendência
  const l = dados[i];
  const aberto = PAINEL_EM.SITUACOES_ABERTAS.indexOf(String(l[c.sit]).trim()) !== -1;
  // NOVO (1.4.16): chegada real dos migrados abertos (1ª mensagem do cliente)
  const chegada = Number(cv.chegada) || 0;
  if (chegada && aberto && String(l[c.origem] || '').trim() === 'Trello' &&
      Math.abs(chegada - msEm_(l[c.chegada])) > 60000) {
    l[c.chegada] = new Date(chegada);
    ctx.mudou[i] = true;
    ctx.resumo.chegadas++;
  }
  if (idCard && !String(l[c.card] || '').trim()) { l[c.card] = idCard; idx.porCard[idCard] = i; ctx.mudou[i] = true; }
  const resp1 = Number(cv.primeiraResposta) || 0;
  if (resp1 && !msEm_(l[c.resp1])) { l[c.resp1] = new Date(resp1); ctx.mudou[i] = true; }
  const ultSup = Number(cv.ultimaSuporte) || 0;
  if (msEm_(l[c.reab]) && ultSup > msEm_(l[c.reab])) { l[c.reab] = ''; ctx.mudou[i] = true; } // alguém respondeu
  if (aberto && !String(l[c.cli] || '').trim()) {
    const cli = clienteDoEmailEm_(String(l[c.dom] || dominioEmail_(cv.remetente)), cv.marcadores || [], ctx);
    if (cli.cliente) { l[c.cli] = cli.cliente; l[c.origCli] = cli.origem; ctx.mudou[i] = true; }
  }
  return i;
}

function novaLinhaEmailEm_(cv, dados, ctx) {
  const c = ctx.c;
  const l = new Array(CAB_EMAILS.length).fill('');
  const agora = ctx.agora;
  const dominio = dominioEmail_(cv.remetente);
  const cli = clienteDoEmailEm_(dominio, cv.marcadores || [], ctx);
  const indicado = proximaVezEm_(ctx.roda);
  const protocolo = reservarProtocoloEm_(ctx.prot);
  const padrao = ctx.mc.padrao();

  l[c.id] = String(cv.id);
  l[c.gmail] = cv.link || '';
  l[c.chegada] = cv.chegada ? new Date(Number(cv.chegada)) : agora;
  l[c.assunto] = seguroEmail_(cv.assunto || '');
  l[c.rem] = seguroEmail_(cv.remetente || '');
  l[c.dom] = dominio;
  l[c.cli] = cli.cliente;
  l[c.origCli] = cli.cliente ? cli.origem : 'Não identificado';
  l[c.prot] = protocolo;
  l[c.grupo] = EMAILS_CFG.GRUPO;
  l[c.cat] = padrao.categoria;
  l[c.sub] = padrao.sub;
  l[c.catDesde] = agora;
  l[c.ind] = indicado;
  l[c.sit] = 'Aguardando';
  if (Number(cv.primeiraResposta)) l[c.resp1] = new Date(Number(cv.primeiraResposta));
  l[c.origem] = 'Gmail';
  l[c.card] = String(cv.card || '');
  l[c.listaTrello] = estadoCardEm_(ctx, String(cv.card || '')) || '';
  l[c.pend] = 'NOVO';

  const i = dados.length;
  dados.push(l);
  ctx.novas[i] = true;
  ctx.mudou[i] = true;
  ctx.resumo.novas++;
  eventoEntradaEm_(ctx, l, 'CHEGOU', indicado, 'Gmail', indicado ? 'Indicado: ' + indicado : 'Sem indicado (roda vazia)');

  // Marcadores que já vieram na chegada (analista, subcategoria, "Concluído")
  entradaMarcadoresEm_(l, i, cv.marcadores || [], ctx, true);
  return i;
}

/* ---------------------------- 2. Trello ---------------------------- */

function entradaTrelloEm_(dados, ctx) {
  const c = ctx.c, q = ctx.quadro;
  const excluidos = [];

  dados.forEach((l, i) => {
    const idCard = String(l[c.card] || '').trim();
    if (!idCard || ctx.novas[i]) return;       // linha criada agora já guardou o estado do card
    const salvo = String(l[c.listaTrello] || '').trim();
    const card = (q.cards || {})[idCard];

    if (!card) {
      if (!q.completo || salvo === ENTRADA_EM.CARD_EXCLUIDO) return;
      if (PAINEL_EM.SITUACOES_ABERTAS.indexOf(String(l[c.sit]).trim()) !== -1) {
        excluidos.push(i);                      // aberto: descarta (com trava de quantidade, abaixo)
      } else {
        l[c.listaTrello] = ENTRADA_EM.CARD_EXCLUIDO; // concluído/descartado: só registra
        ctx.mudou[i] = true;
      }
      return;
    }
    const estado = estadoCardEm_(ctx, idCard);
    if (estado === salvo) return;
    if (pendenciaEm_(l, c)) return;      // o Lista Ai ainda vai mover; vale o Lista Ai

    l[c.listaTrello] = estado;
    ctx.mudou[i] = true;
    const nome = q.listas[card[0]] || '';
    const arquivado = !!card[1];
    const concluidaAgora = arquivado || listaConcluidaEm_(nome);
    const ignorada = EMAILS_CFG.LISTAS_IGNORAR.map(normalizarTexto).indexOf(normalizarTexto(nome)) !== -1;
    const sit = String(l[c.sit] || '').trim();
    const aberto = PAINEL_EM.SITUACOES_ABERTAS.indexOf(sit) !== -1;

    if (aberto) {
      if (concluidaAgora) {
        concluirEm_(l, i, ctx, 'Trello', arquivado ? 'Card arquivado' : 'Card movido para ' + nome);
      } else if (!ignorada) {
        const cat = ctx.mc.porLista(nome);
        if (!cat) {
          ctx.alertas.push('Lista "' + nome + '" sem categoria na EMAIL_CATEGORIAS (e-mail ' + (l[c.prot] || l[c.id]) + ').');
        } else if (normalizarTexto(cat.categoria) !== normalizarTexto(l[c.cat])) {
          mudarCategoriaEm_(l, i, ctx, cat, 'Trello');
        }
      }
    } else if (sit.indexOf('Concluído') === 0 && !concluidaAgora && !ignorada) {
      reabrirEm_(l, i, ctx, 'Trello', 'Card movido para ' + nome, ctx.ms);
    }
  });

  // Card excluído no Trello: descarta o e-mail aberto (o protocolo vai junto)
  if (excluidos.length > ENTRADA_EM.MAX_EXCLUSOES_POR_EXECUCAO) {
    ctx.alertas.push(excluidos.length + ' cards de e-mails sumiram do quadro de uma vez; nada foi descartado. ' +
      'Confira o Trello (se a exclusão foi de propósito, descarte pelo Widget).');
    return;
  }
  excluidos.forEach(i => {
    const l = dados[i];
    l[c.listaTrello] = ENTRADA_EM.CARD_EXCLUIDO;
    descartarEm_(l, i, ctx, 'Trello', 'Card excluído no Trello');
  });
}

/* ---------------------------- 3. Gmail ---------------------------- */

/** marcadores = nomes dos marcadores da conversa no Gmail. naCriacao = linha criada agora (ignora a pendência NOVO). */
function entradaMarcadoresEm_(l, i, marcadores, ctx, naCriacao) {
  const c = ctx.c;
  if (!naCriacao && pendenciaEm_(l, c)) return;
  const nomes = (marcadores || []).map(m => String(m || '').trim()).filter(Boolean);
  const norm = {};
  nomes.forEach(n => { norm[normalizarTexto(n)] = n; });
  const temConcluido = !!norm[normalizarTexto(ENTRADA_EM.MARCADOR_CONCLUIDO)];
  const sit = String(l[c.sit] || '').trim();
  const aberto = PAINEL_EM.SITUACOES_ABERTAS.indexOf(sit) !== -1;

  if (aberto) {
    // Analistas (só acrescenta: tirar o marcador não tira o responsável)
    const antes = listaEm_(l[c.resp]);
    const novos = [];
    nomes.forEach(n => {
      const nome = ctx.nomePorMarcador[normalizarTexto(n)];
      if (nome && !antes.concat(novos).some(x => mesmoNomeEm_(x, nome))) novos.push(nome);
    });
    if (novos.length) {
      const depois = antes.concat(novos);
      l[c.resp] = depois.join(', ');
      iniciarSlaEntradaEm_(l, ctx);
      devolverVezEm_(ctx.roda, String(l[c.ind] || '').trim(), antes, depois);
      if (msEm_(l[c.reab])) l[c.reab] = '';
      acrescentarPendenciaEm_(l, c, 'RESP');
      ctx.mudou[i] = true;
      ctx.resumo.assumidos++;
      eventoEntradaEm_(ctx, l, 'ASSUMIU', novos.join(', '), 'Gmail', 'Marcador no Gmail');
    }

    // Subcategoria pelo marcador (ex.: "Pendente desenv. Dev 1")
    const porLabel = nomes.map(n => ctx.mc.porLabel(n)).filter(Boolean);
    const cat = porLabel.filter(x => normalizarTexto(x.sub) !== 'geral')[0] || porLabel[0];
    if (cat && (normalizarTexto(cat.categoria) !== normalizarTexto(l[c.cat]) ||
        normalizarTexto(cat.sub) !== normalizarTexto(l[c.sub]))) {
      mudarCategoriaEm_(l, i, ctx, cat, 'Gmail');
    }

    if (temConcluido) concluirEm_(l, i, ctx, 'Gmail', 'Marcador ' + ENTRADA_EM.MARCADOR_CONCLUIDO);
  } else if (sit === 'Concluído' && !temConcluido &&
      viasComMarcadorEm_().indexOf(String(l[c.conclVia] || '').trim()) !== -1) { // ALTERADO (1.4.17)
    reabrirEm_(l, i, ctx, 'Gmail', 'Marcador ' + ENTRADA_EM.MARCADOR_CONCLUIDO + ' retirado', ctx.ms);
  }
}

/* ---------------------------- Mudanças na linha ---------------------------- */

function concluirEm_(l, i, ctx, via, detalhe) {
  const c = ctx.c;
  const resp = listaEm_(l[c.resp]);
  l[c.sit] = 'Concluído';
  l[c.conclEm] = ctx.agora;
  l[c.conclPor] = resp.join(', ') || via;
  l[c.conclVia] = via;
  l[c.reab] = '';
  acrescentarPendenciaEm_(l, c, 'CONCLUIR');
  ctx.mudou[i] = true;
  ctx.resumo.concluidos++;
  eventoEntradaEm_(ctx, l, 'CONCLUIU', resp.join(', '), via, detalhe);
}

/** Reabre na mesma linha: mesmo protocolo e responsáveis, categoria com SLA, SLA do zero a partir de baseMs. */
function reabrirEm_(l, i, ctx, via, detalhe, baseMs) {
  const c = ctx.c;
  const resp = listaEm_(l[c.resp]);
  const cat = ctx.mc.linhaDe(l[c.cat], l[c.sub]);
  if (!cat || !cat.sla) {
    const padrao = ctx.mc.padrao();
    l[c.cat] = padrao.categoria;
    l[c.sub] = padrao.sub;
    l[c.catDesde] = ctx.agora;
  }
  l[c.etapaSaiu] = '';
  l[c.conclEm] = '';
  l[c.conclPor] = '';
  l[c.conclVia] = '';
  l[c.reab] = ctx.agora;
  if (resp.length) {
    l[c.sit] = 'Em atendimento';
    const ini = proximoUtilEmail_(baseMs || ctx.ms, ctx.feriados);
    l[c.ini] = new Date(ini);
    l[c.prazo] = prazoFinalEmail_(ini, ctx.feriados) || '';
  } else {
    l[c.sit] = 'Aguardando';
    l[c.ini] = '';
    l[c.prazo] = '';
    if (!String(l[c.ind] || '').trim()) l[c.ind] = proximaVezEm_(ctx.roda);
  }
  acrescentarPendenciaEm_(l, c, 'REABRIR');
  ctx.mudou[i] = true;
  ctx.resumo.reabertos++;
  eventoEntradaEm_(ctx, l, 'REABRIU', resp.join(', '), via, detalhe);
}

function mudarCategoriaEm_(l, i, ctx, alvo, via) {
  const c = ctx.c;
  const atual = ctx.mc.linhaDe(l[c.cat], l[c.sub]);
  const tinhaSla = atual ? atual.sla : true;
  if (tinhaSla && !alvo.sla && !l[c.etapaSaiu]) {
    const ini = msEm_(l[c.ini]);
    l[c.etapaSaiu] = ini ? etapaPorPrazoEmail_(ini, msEm_(l[c.prazo]), ctx.feriados, ctx.ms).selo : 'Antes de assumir';
  }
  const detalhe = (String(l[c.cat] || '—') + (l[c.sub] ? ' › ' + l[c.sub] : '')) + ' → ' +
    alvo.categoria + (alvo.sub ? ' › ' + alvo.sub : '');
  l[c.cat] = alvo.categoria;
  l[c.sub] = alvo.sub || '';
  l[c.catDesde] = ctx.agora;
  if (alvo.sla) iniciarSlaEntradaEm_(l, ctx);
  acrescentarPendenciaEm_(l, c, 'CATEGORIA');
  ctx.mudou[i] = true;
  ctx.resumo.categorias++;
  eventoEntradaEm_(ctx, l, 'CATEGORIA', listaEm_(l[c.resp]).join(', '), via, detalhe);
}

function descartarEm_(l, i, ctx, via, motivo) {
  const c = ctx.c;
  const prot = String(l[c.prot] || '').trim();
  l[c.sit] = 'Descartado';
  l[c.conclEm] = ctx.agora;
  l[c.conclPor] = via;
  l[c.conclVia] = via;
  liberarProtocoloEm_(ctx.prot, prot);
  if (/^E\d+$/i.test(prot)) l[c.prot] = '';
  acrescentarPendenciaEm_(l, c, 'DESCARTAR');
  ctx.mudou[i] = true;
  ctx.resumo.descartados++;
  eventoEntradaEm_(ctx, l, 'DESCARTOU', listaEm_(l[c.resp]).join(', '), via, motivo + (prot ? ' · protocolo ' + prot + ' liberado' : ''));
}

/** Primeiro "assumido" vindo do Gmail: mesma regra do Widget (iniciarSlaEm_), com as categorias já lidas. */
function iniciarSlaEntradaEm_(l, ctx) {
  const c = ctx.c;
  if (!listaEm_(l[c.resp]).length) return;
  if (!l[c.assumido]) l[c.assumido] = ctx.agora;
  if (String(l[c.sit]).trim() === 'Aguardando') l[c.sit] = 'Em atendimento';
  if (msEm_(l[c.ini])) return;
  const cat = ctx.mc.linhaDe(l[c.cat], l[c.sub]);
  if (cat && !cat.sla) return;
  const ini = proximoUtilEmail_(ctx.ms, ctx.feriados);
  l[c.ini] = new Date(ini);
  l[c.prazo] = prazoFinalEmail_(ini, ctx.feriados) || '';
}

/* ---------------------------- 5. Tarefas ---------------------------- */

/**
 * Linha com pendência → estado completo desejado no Gmail e no Trello.
 * Linha sem pendência → só move o card quando a etapa do SLA mudou (ou concluído há mais de 30 dias).
 */
function tarefaDaLinhaEm_(l, i, ctx) {
  const c = ctx.c;
  const id = String(l[c.id] || '').trim();
  if (!id) return null;
  const pend = pendenciaEm_(l, c);
  const idCard = String(l[c.card] || '').trim();
  const card = (ctx.quadro && idCard) ? (ctx.quadro.cards || {})[idCard] : null;
  const rotulo = (String(l[c.prot] || '').trim() || 'sem protocolo') + ' · ' + String(l[c.assunto] || '').replace(/^'/, '').slice(0, 60);

  if (pend) {
    const t = { id: id, pend: pend, card: idCard, rotulo: rotulo };
    // ALTERADO (1.4.17): todos os marcadores, só o "Concluído" ou nenhum
    if (/^[0-9a-f]{10,}$/i.test(id)) {
      if (ENTRADA_EM.APLICAR_MARCADORES_GMAIL) t.gmail = gmailDesejadoEm_(l, ctx, pend);
      else if (ENTRADA_EM.APLICAR_CONCLUIDO_GMAIL) t.gmail = gmailSoConcluidoEm_(l, ctx);
    }
    if (card) t.trello = trelloDesejadoEm_(l, ctx, card, true);
    if (!t.gmail && !t.trello) {
      // Nada a refletir (migrado sem conversa e sem card): limpa direto
      if (!ctx.sim) { l[c.pend] = ''; ctx.mudou[i] = true; }
      return null;
    }
    ctx.resumo.tarefas++;
    return t;
  }
  if (!card) return null;
  const tr = trelloDesejadoEm_(l, ctx, card, false);
  if (!tr) return null;
  ctx.resumo.tarefas++;
  return { id: id, pend: '', card: idCard, rotulo: rotulo, trello: tr };
}

function gmailDesejadoEm_(l, ctx, pend) {
  const c = ctx.c;
  const sit = String(l[c.sit] || '').trim();
  const prefixos = [ENTRADA_EM.PREFIXO_INDICADO, ENTRADA_EM.PREFIXO_MARCADOR_PROTOCOLO];
  if (sit === 'Descartado') return { quer: [], exatos: [], prefixos: prefixos };

  const aberto = PAINEL_EM.SITUACOES_ABERTAS.indexOf(sit) !== -1;
  const concluido = sit.indexOf('Concluído') === 0;
  const resp = listaEm_(l[c.resp]);
  const quer = [];
  const exatos = [ENTRADA_EM.MARCADOR_CONCLUIDO].concat(ctx.mc.todosLabels());
  if (pend.split(';').indexOf('RESP') !== -1) exatos.push.apply(exatos, ctx.todosMarcadores);

  resp.forEach(n => { const m = ctx.marcadorDe[normalizarTexto(n)]; if (m) quer.push(m); });
  const prot = String(l[c.prot] || '').trim();
  if (aberto) {
    const ind = String(l[c.ind] || '').trim();
    if (!resp.length && ind) quer.push(ENTRADA_EM.PREFIXO_INDICADO + ind);
    if (ENTRADA_EM.APLICAR_MARCADOR_PROTOCOLO && /^E\d+$/i.test(prot)) { // ALTERADO (1.4.17)
      quer.push(ENTRADA_EM.PREFIXO_MARCADOR_PROTOCOLO + prot.toUpperCase());
    }
  }
  if (concluido) quer.push(ENTRADA_EM.MARCADOR_CONCLUIDO);
  const lab = ctx.mc.labelDe(l[c.cat], l[c.sub]);
  if (lab) quer.push(lab);
  return { quer: quer, exatos: exatos, prefixos: prefixos };
}

function trelloDesejadoEm_(l, ctx, card, completo) {
  const c = ctx.c;
  const sit = String(l[c.sit] || '').trim();
  const nomeAtual = ctx.quadro.listas[card[0]] || '';
  const arquivado = !!card[1];

  if (sit === 'Descartado') return (completo && !arquivado) ? { arquivar: true } : null;

  const concluido = sit.indexOf('Concluído') === 0;
  const r = {};
  const lista = listaDesejadaEm_(l, ctx);
  if (lista) {
    if (concluido) {
      if (!arquivado) {
        const recentes = normalizarTexto(ENTRADA_EM.LISTA_CONCLUIDOS_RECENTES);
        if (!listaConcluidaEm_(nomeAtual)) r.lista = lista;                       // ainda numa lista de aberto
        else if (normalizarTexto(nomeAtual) === recentes && normalizarTexto(lista) !== recentes) r.lista = lista; // passou dos 30 dias
      }
    } else if (normalizarTexto(nomeAtual) !== normalizarTexto(lista)) {
      r.lista = lista;
    }
  }
  if (!concluido && arquivado) r.desarquivar = true;
  if (completo) {
    const lab = ctx.mc.labelDe(l[c.cat], l[c.sub]);
    r.labelsQuer = lab ? [lab] : [];
    r.labelsTirar = ctx.mc.todosLabels().filter(x => !lab || normalizarTexto(x) !== normalizarTexto(lab));
    return r;
  }
  return Object.keys(r).length ? r : null;
}

/** Lista do Trello em que o card deve estar (null = não mexer). */
function listaDesejadaEm_(l, ctx) {
  const c = ctx.c;
  const sit = String(l[c.sit] || '').trim();
  if (sit === 'Descartado') return null;
  if (sit.indexOf('Concluído') === 0) {
    const ce = msEm_(l[c.conclEm]);
    if (!ce) return null; // concluído na migração: fica onde está
    if (ctx.ms - ce <= ENTRADA_EM.DIAS_RECENTES * 86400000) return ENTRADA_EM.LISTA_CONCLUIDOS_RECENTES;
    return nomeListaMesEm_(new Date(ce));
  }
  const cat = ctx.mc.linhaDe(l[c.cat], l[c.sub]);
  if (!cat || cat.sla) {
    const ini = msEm_(l[c.ini]);
    if (!ini) return ENTRADA_EM.LISTAS_ETAPA.aguard;
    const selo = etapaPorPrazoEmail_(ini, msEm_(l[c.prazo]), ctx.feriados, ctx.ms).selo;
    if (selo === EMAILS_CFG.ETAPAS[2]) return ENTRADA_EM.LISTAS_ETAPA.fora;
    if (selo === EMAILS_CFG.ETAPAS[1]) return ENTRADA_EM.LISTAS_ETAPA.s2;
    return ENTRADA_EM.LISTAS_ETAPA.s1;
  }
  return ctx.mc.listaDe(l[c.cat], l[c.sub]);
}

function nomeListaMesEm_(d) {
  const tz = Session.getScriptTimeZone();
  return ENTRADA_EM.PREFIXO_LISTA_MES + ' ' + MESES_EM[Number(Utilities.formatDate(d, tz, 'M')) - 1] + ' ' +
    Utilities.formatDate(d, tz, 'yy');
}

/** Conversas que o FluxoContinuo deve reler a cada execução (abertas + concluídas com marcador há poucos dias). */
function listaVigiaEm_(dados, c, agoraMs) {
  const limite = agoraMs - ENTRADA_EM.DIAS_VIGIA_CONCLUIDOS * 86400000;
  const ids = [];
  dados.forEach(l => {
    const id = String(l[c.id] || '').trim();
    if (!/^[0-9a-f]{10,}$/i.test(id)) return;
    const sit = String(l[c.sit] || '').trim();
    if (PAINEL_EM.SITUACOES_ABERTAS.indexOf(sit) !== -1) { ids.push(id); return; }
    if (sit === 'Concluído' && msEm_(l[c.conclEm]) >= limite &&
        viasComMarcadorEm_().indexOf(String(l[c.conclVia] || '').trim()) !== -1) ids.push(id); // ALTERADO (1.4.17)
  });
  return ids.slice(0, 450);
}

/* ============================ AJUSTE ÚNICO (1.4.16) ============================ */

/**
 * Rodar UMA vez pelo editor. Migrados do Trello, abertos e SEM responsável: a carga tinha iniciado o
 * SLA pela data do título; agora voltam a "Aguardando" (🆕 Novos no Widget), sem SLA e sem indicado
 * (não gastam a vez da roda). O SLA começa quando alguém assumir. Pode rodar de novo (não repete).
 */
function ajustarMigradosSemResponsavel() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('Lista Ai ocupado; tente de novo em instantes.');
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.getSheetByName(EMAILS_CFG.ABA_EMAILS);
    if (!aba || aba.getLastRow() < 2) { Logger.log('A aba EMAILS está vazia.'); return; }
    garantirColunasEmails_(aba);
    const c = colunasEm_();
    const n = aba.getLastRow() - 1;
    const dados = aba.getRange(2, 1, n, CAB_EMAILS.length).getValues();
    const agora = new Date();
    const eventos = [];
    const ajustados = [];
    dados.forEach(l => {
      if (String(l[c.origem] || '').trim() !== 'Trello') return;
      if (String(l[c.sit] || '').trim() !== 'Em atendimento') return;
      if (listaEm_(l[c.resp]).length) return;
      l[c.sit] = 'Aguardando';
      l[c.assumido] = '';
      l[c.ini] = '';
      l[c.prazo] = '';
      l[c.etapaSaiu] = '';
      l[c.atual] = agora;
      ajustados.push((l[c.prot] || 'sem protocolo') + ' · ' + String(l[c.assunto] || '').replace(/^'/, '').slice(0, 50));
      eventos.push([agora, String(l[c.prot] || ''), String(l[c.id] || ''), 'AJUSTE_MIGRACAO', '', 'Lista Ai',
        'Migrado sem responsável: volta para Novos (SLA zerado)']);
    });
    if (ajustados.length) {
      aba.getRange(2, 1, n, CAB_EMAILS.length).setValues(dados);
      gravarEventosEntradaEm_(ss, eventos);
    }
    Logger.log('✅ Migrados sem responsável ajustados: ' + ajustados.length +
      (ajustados.length ? '\n- ' + ajustados.join('\n- ') : ''));
  } finally {
    lock.releaseLock();
  }
}

/* ============================ CONFIRMAR ============================ */

/** p.feitos = [{ id, pend, estado }] — estado = lista do card depois de aplicar ("SEMANA 1", "X (arquivado)"). */
function confirmarEmailsFluxo_(p) {
  const feitos = p.feitos || [];
  if (!feitos.length) return { ok: true, confirmados: 0 };
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('Lista Ai ocupado; a confirmação fica para a próxima execução.');
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.getSheetByName(EMAILS_CFG.ABA_EMAILS);
    if (!aba || aba.getLastRow() < 2) return { ok: true, confirmados: 0 };
    const c = colunasEm_();
    const n = aba.getLastRow() - 1;
    const ids = aba.getRange(2, c.id + 1, n, 1).getValues();
    const pends = aba.getRange(2, c.pend + 1, n, 1).getValues();
    const listas = aba.getRange(2, c.listaTrello + 1, n, 1).getValues();
    const porId = {};
    ids.forEach((l, i) => { porId[String(l[0] || '').trim()] = i; });

    let confirmados = 0;
    feitos.forEach(f => {
      const i = porId[String(f.id || '').trim()];
      if (i === undefined) return;
      if (f.pend && String(pends[i][0] || '').trim() === String(f.pend).trim()) pends[i][0] = '';
      if (f.estado !== undefined && f.estado !== null) listas[i][0] = String(f.estado);
      confirmados++;
    });
    aba.getRange(2, c.pend + 1, n, 1).setValues(pends);
    aba.getRange(2, c.listaTrello + 1, n, 1).setValues(listas);
    return { ok: true, confirmados: confirmados };
  } finally {
    lock.releaseLock();
  }
}

/* ============================ PROTOCOLO ============================ */

function lerEstadoProtocoloEm_() {
  const pr = PropertiesService.getScriptProperties();
  let livres = [];
  try { livres = JSON.parse(pr.getProperty(ENTRADA_EM.PROP_LIVRES) || '[]'); } catch (e) { livres = []; }
  return {
    prox: Number(pr.getProperty(ENTRADA_EM.PROP_PROX_PROTOCOLO)) || ENTRADA_EM.PRIMEIRO_PROTOCOLO,
    livres: livres.map(Number).filter(n => n > 0)
  };
}

function salvarEstadoProtocoloEm_(e) {
  const pr = PropertiesService.getScriptProperties();
  pr.setProperty(ENTRADA_EM.PROP_PROX_PROTOCOLO, String(e.prox));
  pr.setProperty(ENTRADA_EM.PROP_LIVRES, JSON.stringify(e.livres.slice(0, 500)));
}

/** Primeiro o menor número liberado por descarte; senão o próximo da sequência. */
function reservarProtocoloEm_(e) {
  if (e.livres.length) {
    e.livres.sort((a, b) => a - b);
    return 'E' + e.livres.shift();
  }
  return 'E' + (e.prox++);
}

function liberarProtocoloEm_(e, protocolo) {
  const m = /^E(\d+)$/i.exec(String(protocolo || '').trim());
  if (!m) return;
  const n = Number(m[1]);
  if (n >= e.prox || e.livres.indexOf(n) !== -1) return;
  e.livres.push(n);
}

/** Usado pelo Widget (Descartar): libera o número com a propriedade lida e gravada na hora. */
function liberarProtocoloAgoraEm_(protocolo) {
  const e = lerEstadoProtocoloEm_();
  liberarProtocoloEm_(e, protocolo);
  salvarEstadoProtocoloEm_(e);
}

/* ============================ RODA ============================ */

function lerEstadoRodaEm_(ss, agoraMs) {
  const roda = lerRodaEm_(ss, agoraMs);
  const pr = PropertiesService.getScriptProperties();
  return {
    ativos: roda.ativos.map(p => p.nome),
    naRoda: roda.todos.filter(p => p.naRoda).map(p => p.nome),
    proximo: pr.getProperty(PAINEL_EM.PROP_PROXIMO) || '',
    devolvidos: lerDevolvidosEm_()
  };
}

function salvarEstadoRodaEm_(r) {
  const pr = PropertiesService.getScriptProperties();
  pr.setProperty(PAINEL_EM.PROP_PROXIMO, r.proximo || '');
  salvarDevolvidosEm_(r.devolvidos.filter(n => r.naRoda.some(x => mesmoNomeEm_(x, n))));
}

function lerDevolvidosEm_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(ENTRADA_EM.PROP_DEVOLVIDOS) || '[]'); }
  catch (e) { return []; }
}

function salvarDevolvidosEm_(lista) {
  PropertiesService.getScriptProperties().setProperty(ENTRADA_EM.PROP_DEVOLVIDOS, JSON.stringify(lista || []));
}

/**
 * Quem é a vez (e anda a roda). Primeiro quem perdeu um e-mail e recuperou a vez (ordem alfabética);
 * senão o "próximo" guardado — se ele estiver fora da roda/ausente, o seguinte em ordem alfabética.
 * Muda o objeto r (devolvidos/proximo). Roda vazia = ''.
 */
function proximaVezEm_(r) {
  const ativos = r.ativos.slice().sort((a, b) => a.localeCompare(b, 'pt-BR'));
  if (!ativos.length) return '';
  const dev = ativos.filter(a => r.devolvidos.some(n => mesmoNomeEm_(n, a)));
  if (dev.length) {
    r.devolvidos = r.devolvidos.filter(n => !mesmoNomeEm_(n, dev[0]));
    return dev[0];
  }
  let i = ativos.findIndex(a => mesmoNomeEm_(a, r.proximo));
  if (i === -1) {
    i = r.proximo ? ativos.findIndex(a => a.localeCompare(r.proximo, 'pt-BR') > 0) : 0;
    if (i === -1) i = 0;
  }
  r.proximo = ativos[(i + 1) % ativos.length];
  return ativos[i];
}

/** Só olha, sem andar a roda (o Widget mostra quem é a vez). */
function verProximaVezEm_(r) {
  return proximaVezEm_({ ativos: r.ativos, proximo: r.proximo, devolvidos: r.devolvidos.slice() });
}

/**
 * O indicado que tinha a vez (e-mail aguardando) ou era responsável e ficou de fora recupera a vez.
 * Devolve true quando devolveu.
 */
function devolverVezEm_(r, indicado, antes, depois) {
  if (!indicado) return false;
  const tinha = !antes.length || antes.some(n => mesmoNomeEm_(n, indicado));
  const ficou = depois.some(n => mesmoNomeEm_(n, indicado));
  if (!tinha || ficou || r.devolvidos.some(n => mesmoNomeEm_(n, indicado))) return false;
  r.devolvidos.push(indicado);
  return true;
}

/** Para o Widget (Assumir/Reatribuir): lê, aplica e grava a devolução da vez. */
function ajustarVezAposMudancaEm_(indicado, antes, depois) {
  const r = { devolvidos: lerDevolvidosEm_() };
  if (devolverVezEm_(r, indicado, antes, depois)) salvarDevolvidosEm_(r.devolvidos);
}

/* ============================ CLIENTE / CATEGORIAS ============================ */

function lerDominiosEm_(ss) {
  const m = {};
  const aba = ss.getSheetByName(EMAILS_CFG.ABA_DOMINIOS);
  if (aba && aba.getLastRow() >= 2) {
    aba.getRange(2, 1, aba.getLastRow() - 1, 2).getValues().forEach(l => {
      const d = String(l[0] || '').trim().toLowerCase(), cli = String(l[1] || '').trim();
      if (d && cli) m[d] = cli;
    });
  }
  return m;
}

/** Domínio (EMAIL_DOMINIOS) → marcador do Gmail que seja cliente do DICIONARIO → vazio. */
function clienteDoEmailEm_(dominio, marcadores, ctx) {
  const d = String(dominio || '').toLowerCase();
  if (d && EMAILS_CFG.DOMINIOS_GENERICOS.indexOf(d) === -1 && ctx.dominios[d]) {
    return { cliente: ctx.dominios[d], origem: 'Domínio' };
  }
  const achados = (marcadores || []).map(n => ctx.clientes[normalizarTexto(n)]).filter(Boolean);
  if (achados.length) return { cliente: achados[0], origem: 'Marcador' };
  return { cliente: '', origem: '' };
}

/**
 * EMAIL_CATEGORIAS do grupo E-mail, com as listas e labels de cada linha:
 * porLista(nome), porLabel(nome), linhaDe(cat, sub), listaDe(cat, sub), labelDe(cat, sub), todosLabels(), padrao().
 */
function lerMapaCategoriasEm_(ss) {
  const aba = ss.getSheetByName(EMAILS_CFG.ABA_CATEGORIAS);
  const linhas = [];
  if (aba && aba.getLastRow() >= 2) {
    aba.getRange(2, 1, aba.getLastRow() - 1, 6).getValues().forEach(l => {
      if (normalizarTexto(l[0]) !== normalizarTexto(EMAILS_CFG.GRUPO)) return;
      const categoria = String(l[1] || '').trim();
      if (!categoria) return;
      linhas.push({
        categoria: categoria, sub: String(l[2] || '').trim(), sla: normalizarTexto(l[3]) === 'sim',
        listas: String(l[4] || '').split(';').map(s => s.trim()).filter(Boolean),
        label: String(l[5] || '').trim()
      });
    });
  }
  const n = normalizarTexto;
  const daCategoria = cat => linhas.filter(x => n(x.categoria) === n(cat));
  return {
    linhas: linhas,
    porLista: nome => linhas.find(x => x.listas.some(li => n(li) === n(nome))) || null,
    porLabel: nome => n(nome) ? (linhas.find(x => x.label && n(x.label) === n(nome)) || null) : null,
    linhaDe: (cat, sub) => {
      const lc = daCategoria(cat);
      return lc.find(x => n(x.sub) === n(sub)) || lc[0] || null;
    },
    listaDe: (cat, sub) => {
      const lc = daCategoria(cat);
      const exata = lc.find(x => n(x.sub) === n(sub) && x.listas.length);
      const qualquer = lc.find(x => x.listas.length);
      return (exata || qualquer) ? (exata || qualquer).listas[0] : null;
    },
    labelDe: (cat, sub) => {
      const x = daCategoria(cat).find(y => n(y.sub) === n(sub));
      return x && x.label ? x.label : '';
    },
    todosLabels: () => linhas.map(x => x.label).filter(Boolean),
    padrao: () => {
      const x = daCategoria(EMAILS_CFG.CATEGORIA_PADRAO)[0];
      return { categoria: x ? x.categoria : EMAILS_CFG.CATEGORIA_PADRAO, sub: x ? x.sub : '' };
    }
  };
}

/* ============================ APOIO ============================ */

function pendenciaEm_(l, c) { return String(l[c.pend] || '').trim(); }

/**
 * NOVO (1.4.17): conclusões que têm o "Concluído" no Gmail (tirar o marcador reabre).
 * Sem aplicar marcadores, só as concluídas PELO marcador do Gmail — as do Widget/Trello não têm o
 * marcador e não podem reabrir por "falta" dele.
 */
function viasComMarcadorEm_() {
  return (ENTRADA_EM.APLICAR_MARCADORES_GMAIL || ENTRADA_EM.APLICAR_CONCLUIDO_GMAIL)
    ? ENTRADA_EM.VIAS_COM_MARCADOR : ['Gmail'];
}

/** NOVO (1.4.17): só o "Concluído" — presente se concluído, ausente nos demais casos. Nada mais é tocado. */
function gmailSoConcluidoEm_(l, ctx) {
  const concluido = String(l[ctx.c.sit] || '').trim().indexOf('Concluído') === 0;
  return { quer: concluido ? [ENTRADA_EM.MARCADOR_CONCLUIDO] : [], exatos: [ENTRADA_EM.MARCADOR_CONCLUIDO], prefixos: [] };
}

function listaConcluidaEm_(nome) {
  return normalizarTexto(nome).indexOf(EMAILS_CFG.PREFIXO_CONCLUIDOS) === 0;
}

/** "SEMANA 1", "Concluídos julho 26 (arquivado)" ou '' se o card não está no mapa. */
function estadoCardEm_(ctx, idCard) {
  const q = ctx.quadro;
  if (!q || !idCard) return '';
  const card = (q.cards || {})[idCard];
  if (!card) return '';
  return (q.listas[card[0]] || '(lista desconhecida)') + (card[1] ? ENTRADA_EM.SUFIXO_ARQUIVADO : '');
}

function eventoEntradaEm_(ctx, l, evento, analista, via, detalhe) {
  const c = ctx.c;
  ctx.eventos.push([ctx.agora, String(l[c.prot] || ''), String(l[c.id] || ''), evento, analista || '',
    via === 'Cliente' ? 'Gmail (cliente)' : via, detalhe || '']);
}

function gravarEventosEntradaEm_(ss, eventos) {
  if (!eventos.length) return;
  const aba = ss.getSheetByName(EMAILS_CFG.ABA_EVENTOS);
  if (!aba) return;
  aba.getRange(aba.getLastRow() + 1, 1, eventos.length, eventos[0].length).setValues(eventos);
}