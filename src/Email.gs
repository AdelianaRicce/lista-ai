/*************************************************
 * 20. 📧 E-MAILS — Fase 1 · Etapa 1 (v3): abas, prévia e carga do Trello
 * ALTERADO (1.4.15): coluna 30 "Reaberto em" + garantirColunasEmails_() (usada pela entrada do Gmail).
 *
 * Arquivo do projeto do Lista Ai ("Emails").
 * Usa funções que já existem: trelloListaAi_, lerDicionarioCard_, lerSlaEFeriadosCard_,
 * calcularPrazoCard_, trechosExpedienteCard_, normalizarTexto, normalizarNome,
 * CONFIG.ABA_USUARIOS e CARD_TRELLO.
 *
 * Rodar pelo editor:
 *  - criarAbasEmails()        cria as abas que faltam; aba já existente e VAZIA tem o cabeçalho refeito
 *  - previaCargaEmails()      lê o quadro "Listagem de emails" e regrava a aba EMAIL_PREVIA.
 *                             Não altera o Trello nem a EMAILS. A coluna "Ajuste" é preservada.
 *  - cargaDefinitivaEmails()  grava na EMAILS o que a prévia mostra (pode rodar de novo, não duplica)
 *                             e pré-preenche a EMAIL_DOMINIOS.
 *
 * SLA (dias úteis): começa quando o e-mail é assumido (ajustado ao próximo momento útil); o dia do
 * início é o dia 1. Dias 1–5 = Semana 1, 6–10 = Semana 2, depois das 18h do 10º dia = Fora do prazo.
 * Categorias sem SLA (aba EMAIL_CATEGORIAS, "Conta SLA" = NÃO) ficam "Sem SLA".
 *************************************************/

const EMAILS_CFG = {
  QUADRO_ID: 'ID_DO_QUADRO_DE_EMAILS',  // quadro de e-mails no Trello
  ABA_EMAILS: 'EMAILS',
  ABA_RODA: 'EMAIL_RODA',
  ABA_CATEGORIAS: 'EMAIL_CATEGORIAS',
  ABA_DOMINIOS: 'EMAIL_DOMINIOS',
  ABA_EVENTOS: 'EV_EMAILS',
  ABA_PREVIA: 'EMAIL_PREVIA',
  GRUPO: 'E-mail',
  CATEGORIA_PADRAO: 'Suporte',
  PREFIXO_CONCLUIDOS: 'concluid',     // listas "Concluídos ..." (comparado sem acento/maiúsculas)
  LISTAS_IGNORAR: ['ANOTAÇÕES DO QUADRO'],
  LISTA_FORA_DO_PRAZO: 'FORA DO PRAZO',
  HORAS_REGRA_C: 90,                  // regra C da migração: última msg do suporte há > 2 semanas úteis
  ETAPAS: ['🟢 Semana 1', '🟡 Semana 2', '🔴 Fora do prazo'],
  DIAS_SEMANA_1: 5,                   // dias úteis 1 a 5 = Semana 1; 6 a 10 = Semana 2
  DIAS_PRAZO: 10,                     // prazo: até 18h do 10º dia útil (o dia do início conta como dia 1)
  SEM_SLA: 'Sem SLA',
  AJUSTES: ['Manter aberto', 'Concluir'],
  DOMINIOS_GENERICOS: ['gmail.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'yahoo.com',
    'yahoo.com.br', 'icloud.com', 'uol.com.br', 'bol.com.br', 'terra.com.br', 'ig.com.br'],
  INICIAIS_PROTOCOLO: { C: 'Coordenação', A: 'Ana Lima', B: 'Bruno Costa', K: 'Carla Dias', D: 'Diego Alves' },
  RODA_INICIAL: [                     // Nome no Lista Ai | Marcador Gmail | Na roda
    ['Coordenação', 'Coordenação', 'NÃO'],
    ['Ana Lima', 'Analista Ana', 'NÃO'],
    ['Bruno Costa', 'Analista Bruno Costa', 'SIM'],
    ['Carla Dias', 'Analista Carla', 'NÃO'],
    ['Diego Alves', 'Analista Diego', 'SIM']
  ],
  CATEGORIAS_INICIAIS: [              // Grupo | Categoria | Subcategoria | Conta SLA | Listas no Trello | Label no Trello
    ['E-mail', 'Suporte', '', 'SIM', 'NA SEMANA; SEMANA 1; SEMANA 2; FORA DO PRAZO', ''],
    ['E-mail', 'Coordenação', '', 'NÃO', 'COORDENAÇÃO', ''],
    ['E-mail', 'Desenvolvimento/Comercial', 'Geral', 'NÃO', 'DESENV/COMERCIAL', 'Pendente desenv.'],
    ['E-mail', 'Desenvolvimento/Comercial', 'Dev 1', 'NÃO', '', 'Pendente desenv. Dev 1'],
    ['E-mail', 'Desenvolvimento/Comercial', 'Dev 2', 'NÃO', '', 'Pendente desenv. Dev 2'],
    ['E-mail', 'Desenvolvimento/Comercial', 'Comercial', 'NÃO', '', 'Pendente comercial']
  ]
};

const CAB_EMAILS = ['ID da conversa', 'Link Gmail', 'Chegada', 'Assunto', 'Remetente', 'Domínio', 'Cliente',
  'Origem do cliente', 'Protocolo', 'Grupo', 'Categoria', 'Subcategoria', 'Categoria desde', 'Etapa ao sair',
  'Indicado', 'Responsáveis', 'Assumido em', '1ª resposta em', 'Início do SLA', 'Prazo final', 'Situação',
  'Concluído em', 'Concluído por', 'Concluído via', 'Pendência Gmail', 'Origem', 'ID do card Trello',
  'Lista no Trello', 'Atualizado em', 'Reaberto em']; // ALTERADO (1.4.15): + "Reaberto em" (coluna 30)
const CAB_RODA = ['Nome no Lista Ai', 'Marcador Gmail', 'Na roda', 'Ausente desde', 'Ausente até', 'Motivo'];
const CAB_CATEGORIAS = ['Grupo', 'Categoria', 'Subcategoria', 'Conta SLA', 'Listas no Trello (separe com ;)',
  'Label no Trello'];
const CAB_DOMINIOS = ['Domínio', 'Cliente', 'Origem', 'Ocorrências'];
const CAB_EV_EMAILS = ['Data', 'Protocolo', 'ID da conversa', 'Evento', 'Analista', 'Feito por', 'Detalhe'];
const CAB_PREVIA = ['Situação proposta', 'Motivo', 'Ajuste', 'Situação final', 'Categoria', 'Subcategoria',
  'Etapa', 'Lista atual', 'Arquivado', 'Título do card', 'Chegada', 'Assunto', 'Remetente', 'Domínio', 'Cliente',
  'Responsáveis', 'Origem do responsável', 'Protocolo', 'Última mensagem', 'Última msg de', 'ID da conversa',
  'Link Gmail', 'Link do card', 'ID do card', 'Alertas'];

/* ============================ ABAS ============================ */

function criarAbasEmails() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const r = [];
  const status = x => x.criada ? ' criada' : (x.refeita ? ' (cabeçalho refeito)' : ' já existia');

  const e = garantirAbaEmail_(ss, EMAILS_CFG.ABA_EMAILS, CAB_EMAILS,
    { texto: [1, 9, 27], datas: [3, 13, 17, 18, 19, 20, 22, 29, 30] });
  r.push(EMAILS_CFG.ABA_EMAILS + status(e));

  const roda = garantirAbaEmail_(ss, EMAILS_CFG.ABA_RODA, CAB_RODA, { datas: [4, 5] });
  if (roda.criada || roda.refeita) {
    roda.aba.getRange(2, 1, EMAILS_CFG.RODA_INICIAL.length, 3).setValues(EMAILS_CFG.RODA_INICIAL);
    roda.aba.getRange(2, 3, 50, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['SIM', 'NÃO'], true).build());
    roda.aba.autoResizeColumns(1, CAB_RODA.length);
  }
  r.push(EMAILS_CFG.ABA_RODA + status(roda));

  const cat = garantirAbaEmail_(ss, EMAILS_CFG.ABA_CATEGORIAS, CAB_CATEGORIAS, {});
  if (cat.criada || cat.refeita) {
    cat.aba.getRange(2, 1, EMAILS_CFG.CATEGORIAS_INICIAIS.length, CAB_CATEGORIAS.length)
      .setValues(EMAILS_CFG.CATEGORIAS_INICIAIS);
    cat.aba.getRange(2, 4, 50, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(['SIM', 'NÃO'], true).build());
    cat.aba.autoResizeColumns(1, CAB_CATEGORIAS.length);
  }
  r.push(EMAILS_CFG.ABA_CATEGORIAS + status(cat));

  r.push(EMAILS_CFG.ABA_DOMINIOS + status(garantirAbaEmail_(ss, EMAILS_CFG.ABA_DOMINIOS, CAB_DOMINIOS, {})));
  r.push(EMAILS_CFG.ABA_EVENTOS + status(garantirAbaEmail_(ss, EMAILS_CFG.ABA_EVENTOS, CAB_EV_EMAILS,
    { texto: [2, 3], datas: [1] })));

  // Confere se os nomes da roda existem na USUARIOS (o de-para depende da grafia exata)
  const nomes = {};
  const us = ss.getSheetByName(CONFIG.ABA_USUARIOS);
  if (us && us.getLastRow() >= 2) {
    us.getRange(2, 1, us.getLastRow() - 1, 1).getValues().forEach(l => { nomes[normalizarNome(l[0])] = true; });
  }
  const faltam = EMAILS_CFG.RODA_INICIAL.map(x => x[0]).filter(n => !nomes[normalizarNome(n)]);

  Logger.log('✅ ' + r.join(' | '));
  if (faltam.length) Logger.log('⚠️ Não encontrados na USUARIOS (confira a grafia na EMAIL_RODA): ' + faltam.join(', '));
}

/**
 * NOVO (1.4.15): colunas acrescentadas depois da carga (ex.: "Reaberto em") — cria a coluna que faltar
 * no fim da EMAILS e escreve o cabeçalho. Não mexe nos dados.
 */
function garantirColunasEmails_(aba) {
  const n = CAB_EMAILS.length;
  if (aba.getMaxColumns() < n) aba.insertColumnsAfter(aba.getMaxColumns(), n - aba.getMaxColumns());
  const cab = aba.getRange(1, 1, 1, n).getValues()[0];
  for (let i = 0; i < n; i++) {
    if (String(cab[i] || '').trim()) continue;
    aba.getRange(1, i + 1).setValue(CAB_EMAILS[i]).setFontWeight('bold').setBackground('#e8eaed');
    if (CAB_EMAILS[i] === 'Reaberto em') aba.getRange(2, i + 1, Math.max(aba.getMaxRows() - 1, 1), 1).setNumberFormat('dd/MM/yyyy HH:mm');
  }
}

/** Cria a aba; se já existir mas estiver VAZIA (só cabeçalho), refaz o cabeçalho. Nunca apaga dados. */
function garantirAbaEmail_(ss, nome, cab, opcoes) {
  let aba = ss.getSheetByName(nome);
  let criada = false, refeita = false;
  if (!aba) { aba = ss.insertSheet(nome); criada = true; }
  else if (aba.getLastRow() <= 1) { aba.getDataRange().clearDataValidations(); aba.clear(); refeita = true; }
  else return { aba: aba, criada: false, refeita: false };

  aba.getRange(1, 1, 1, cab.length).setValues([cab]).setFontWeight('bold').setBackground('#e8eaed');
  aba.setFrozenRows(1);
  const n = aba.getMaxRows() - 1;
  (opcoes.texto || []).forEach(c => aba.getRange(2, c, n, 1).setNumberFormat('@'));
  (opcoes.datas || []).forEach(c => aba.getRange(2, c, n, 1).setNumberFormat('dd/MM/yyyy HH:mm'));
  return { aba: aba, criada: criada, refeita: refeita };
}

/* ============================ PRÉVIA DA CARGA ============================ */

function previaCargaEmails() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inicio = Date.now();
  const ctx = contextoCargaEmail_(ss);
  const ajustes = lerAjustesPreviaEmail_(ss);
  const validos = cardsValidosEmail_(ctx.q);

  const itens = validos.map(c => analisarCardEmail_(c, ctx, ajustes[c.id] || ''));
  // Abertos primeiro (é o que precisa de conferência), depois por chegada
  itens.sort((a, b) => a.aberto === b.aberto ? a.chegada - b.chegada : (a.aberto ? -1 : 1));

  gravarPreviaEmail_(ss, itens.map(i => i.linha));
  Logger.log(resumoPreviaEmail_(ctx.q, itens, ctx.q.cards.length - validos.length, inicio));
}

function contextoCargaEmail_(ss) {
  return {
    q: lerQuadroEmails_(),
    cats: lerCategoriasEmail_(ss),
    marcadores: lerMarcadoresRodaEmail_(ss),
    feriados: lerSlaEFeriadosCard_().feriados,
    agora: Date.now()
  };
}

function cardsValidosEmail_(q) {
  const ignorar = EMAILS_CFG.LISTAS_IGNORAR.map(normalizarTexto);
  return q.cards.filter(c => ignorar.indexOf(normalizarTexto((q.listas[c.idList] || {}).nome)) === -1);
}

/** Quadro inteiro: listas, labels, membros, cards (inclusive arquivados) + de-paras do Lista Ai. */
function lerQuadroEmails_() {
  const id = EMAILS_CFG.QUADRO_ID;
  const quadro = trelloListaAi_('get', '/boards/' + id, { fields: 'name' });
  const q = { nome: quadro.name, listas: {}, labels: {}, membros: {}, usuarios: {}, clientes: {}, cards: [] };

  trelloListaAi_('get', '/boards/' + id + '/lists', { fields: 'name,closed', filter: 'all' })
    .forEach(l => { q.listas[l.id] = { nome: l.name, arquivada: !!l.closed }; });
  trelloListaAi_('get', '/boards/' + id + '/labels', { fields: 'name', limit: 1000 })
    .forEach(l => { if (l.name) q.labels[l.id] = l.name; });
  trelloListaAi_('get', '/boards/' + id + '/members', { fields: 'fullName' })
    .forEach(m => { q.membros[m.id] = m.fullName; });

  // ID do Trello -> nome no Lista Ai (USUARIOS: A = nome, E = ID do Trello)
  const col = CARD_TRELLO.COL_USUARIOS_ID_TRELLO;
  const us = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_USUARIOS);
  if (us && us.getLastRow() >= 2 && us.getLastColumn() >= col) {
    us.getRange(2, 1, us.getLastRow() - 1, col).getValues().forEach(l => {
      const idT = String(l[col - 1] || '').trim();
      if (idT) q.usuarios[idT] = String(l[0] || '').trim();
    });
  }
  // Clientes ativos do DICIONARIO (comparados pelo nome, sem acento/maiúsculas)
  lerDicionarioCard_().clientes.forEach(c => { q.clientes[normalizarTexto(c.nome)] = c.nome; });

  const vistos = {};
  let antes = null;
  while (true) {
    const p = { fields: 'name,desc,idList,closed,idLabels,idMembers,shortUrl', limit: 1000 };
    if (antes) p.before = antes;
    const pagina = trelloListaAi_('get', '/boards/' + id + '/cards/all', p);
    let novos = 0;
    pagina.forEach(c => { if (vistos[c.id]) return; vistos[c.id] = true; novos++; q.cards.push(c); });
    if (pagina.length < 1000 || !novos) break;
    antes = pagina.map(c => c.id).sort()[0];
  }
  return q;
}

/** EMAIL_CATEGORIAS do grupo E-mail: { porLista: {lista: cat}, porLabel: {label: cat} }. */
function lerCategoriasEmail_(ss) {
  const aba = ss.getSheetByName(EMAILS_CFG.ABA_CATEGORIAS);
  if (!aba || aba.getLastRow() < 2) throw new Error('Rode criarAbasEmails() para criar a aba ' + EMAILS_CFG.ABA_CATEGORIAS + '.');
  const r = { porLista: {}, porLabel: {} };
  aba.getRange(2, 1, aba.getLastRow() - 1, 6).getValues().forEach(l => {
    if (normalizarTexto(l[0]) !== normalizarTexto(EMAILS_CFG.GRUPO)) return;
    const cat = { categoria: String(l[1] || '').trim(), sub: String(l[2] || '').trim(), sla: normalizarTexto(l[3]) === 'sim' };
    if (!cat.categoria) return;
    String(l[4] || '').split(';').map(s => normalizarTexto(s)).filter(Boolean).forEach(n => { r.porLista[n] = cat; });
    const lb = normalizarTexto(l[5]);
    if (lb) r.porLabel[lb] = cat;
  });
  return r;
}

/** EMAIL_RODA: marcador/label do analista -> nome no Lista Ai. */
function lerMarcadoresRodaEmail_(ss) {
  const m = {};
  const aba = ss.getSheetByName(EMAILS_CFG.ABA_RODA);
  if (aba && aba.getLastRow() >= 2) {
    aba.getRange(2, 1, aba.getLastRow() - 1, 2).getValues().forEach(l => {
      const nome = String(l[0] || '').trim(), marc = normalizarTexto(l[1]);
      if (nome && marc) m[marc] = nome;
    });
  }
  return m;
}

function analisarCardEmail_(c, ctx, ajuste) {
  const q = ctx.q;
  const lista = q.listas[c.idList] || { nome: '(lista removida)', arquivada: false };
  const nLista = normalizarTexto(lista.nome);
  const desc = String(c.desc || '');
  const titulo = String(c.name || '');
  const partes = titulo.split(' - ');
  const criado = new Date(parseInt(String(c.id).substring(0, 8), 16) * 1000);
  const unicos = a => a.filter((v, i) => v && a.indexOf(v) === i);
  const alertas = [];

  // ---- Dados do card ----
  let chegada = dataDoTituloEmail_(titulo, criado);
  if (!chegada) { chegada = criado; alertas.push('Título sem data: usada a criação do card'); }
  const assunto = partes.length >= 3 ? partes.slice(2).join(' - ').trim() : titulo.trim();
  let protocolo = partes.length >= 3 ? partes[1].trim() : '';
  if (/sem\s*protocolo/i.test(protocolo)) protocolo = '';
  const remetente = campoDescEmail_(desc, 'Remetente');
  const idConversa = ((/ID da conversa:\s*([0-9a-f]+)/i.exec(desc)) || [])[1] || '';
  const linkGmail = campoDescEmail_(desc, 'Conversa no Gmail');

  // "**Última mensagem:** 25/09/2026 14:32 (Suporte)" — gravado pela integração Gmail → Trello
  const u = /\*\*Última mensagem:\*\*\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})\s*\((Suporte|Cliente)\)/i.exec(desc);
  const ultData = u ? new Date(+u[3], +u[2] - 1, +u[1], +u[4], +u[5]) : null;
  const ultDe = u ? u[6] : '';
  const nomesLabels = (c.idLabels || []).map(id => q.labels[id]).filter(Boolean);

  // ---- Cliente ----
  const clientes = unicos(nomesLabels.map(n => q.clientes[normalizarTexto(n)]));
  if (clientes.length > 1) alertas.push('Mais de um cliente: ' + clientes.join(', '));

  // ---- Responsáveis: labels de analista → membros → inicial do protocolo antigo ----
  let origemResp = '';
  let resp = unicos(nomesLabels.map(n => ctx.marcadores[normalizarTexto(n)]));
  if (resp.length) origemResp = 'Label';
  if (!resp.length) {
    resp = unicos((c.idMembers || []).map(id => q.usuarios[id] || q.membros[id] || id));
    if (resp.length) origemResp = 'Membro';
  }
  if (!resp.length) {
    const m = /^\d+\s*([A-Za-z])\s*\d+$/.exec(protocolo);
    const nome = m ? EMAILS_CFG.INICIAIS_PROTOCOLO[m[1].toUpperCase()] : '';
    if (nome) { resp = [nome]; origemResp = 'Inicial do protocolo'; }
  }

  // ---- Situação ----
  const listaConcluida = nLista.indexOf(EMAILS_CFG.PREFIXO_CONCLUIDOS) === 0;
  const arquivado = c.closed || lista.arquivada;
  let proposta, motivo;
  if (listaConcluida) {
    proposta = 'Concluído (migração)'; motivo = 'Lista de concluídos';
  } else if (arquivado) {
    proposta = 'Concluído (migração)'; motivo = c.closed ? 'Card arquivado' : 'Lista arquivada';
  } else if (ultDe === 'Suporte' && venceuEmail_(ultData.getTime(), EMAILS_CFG.HORAS_REGRA_C, ctx.feriados, ctx.agora)) {
    proposta = 'Concluído (migração)'; motivo = 'Regra C: última mensagem do suporte há mais de 2 semanas úteis';
  } else {
    proposta = 'Em atendimento';
    motivo = u ? 'Última mensagem: ' + ultDe : 'Sem dados da última mensagem';
  }
  const final = ajuste === 'Concluir' ? 'Concluído (migração)'
    : (ajuste === 'Manter aberto' ? 'Em atendimento' : proposta);
  const aberto = final === 'Em atendimento';

  // ---- Categoria: label de subcategoria prevalece sobre a lista ----
  const porLabel = nomesLabels.map(n => ctx.cats.porLabel[normalizarTexto(n)]).filter(Boolean);
  let cat = porLabel.filter(x => normalizarTexto(x.sub) !== 'geral')[0] || porLabel[0] || ctx.cats.porLista[nLista];
  if (!cat) {
    cat = ctx.cats.porLista[normalizarTexto('SEMANA 1')] || { categoria: EMAILS_CFG.CATEGORIA_PADRAO, sub: '', sla: true };
    if (aberto) alertas.push('Lista sem categoria na ' + EMAILS_CFG.ABA_CATEGORIAS + ': ' + lista.nome);
  }

  // ---- Etapa do SLA (só abertos) ----
  const inicioSla = proximoUtilEmail_(chegada.getTime(), ctx.feriados);
  let etapa = '', etapaTexto = '';
  if (aberto) {
    if (!cat.sla) etapa = etapaTexto = EMAILS_CFG.SEM_SLA;
    else if (nLista === normalizarTexto(EMAILS_CFG.LISTA_FORA_DO_PRAZO)) etapa = etapaTexto = EMAILS_CFG.ETAPAS[2];
    else {
      const e = etapaSlaEmail_(inicioSla, ctx.feriados, ctx.agora);
      etapa = e.selo;          // usado no resumo do log
      etapaTexto = e.texto;    // mostrado na aba (com o dia)
    }
    if (!idConversa) alertas.push('Aberto sem ID da conversa: concluir só pelo Widget ou Trello');
    if (!resp.length) alertas.push('Aberto sem responsável');
    if (!clientes.length) alertas.push('Sem cliente' + (nomesLabels.length ? ' (labels: ' + nomesLabels.join(', ') + ')' : ''));
  } else if (!idConversa) {
    alertas.push('Sem ID da conversa: só histórico');
  }

  return {
    aberto: aberto, chegada: chegada.getTime(), motivo: motivo, etapa: etapa, lista: lista.nome,
    categoria: cat.categoria + (cat.sub ? ' › ' + cat.sub : ''), origemResp: origemResp,
    ajuste: ajuste, alertas: alertas,
    dados: {
      idCard: c.id, link: c.shortUrl || '', lista: lista.nome, idConversa: idConversa, linkGmail: linkGmail,
      chegada: chegada, assunto: assunto, remetente: remetente, dominio: dominioEmail_(remetente),
      clientes: clientes, resp: resp, protocolo: protocolo, cat: cat, final: final,
      inicioSla: new Date(inicioSla)
    },
    linha: [proposta, motivo, ajuste, final, cat.categoria, cat.sub, etapaTexto, lista.nome, arquivado ? 'SIM' : 'NÃO',
      seguroEmail_(titulo), chegada, seguroEmail_(assunto), seguroEmail_(remetente), dominioEmail_(remetente),
      clientes.join(', '), resp.join(', '), origemResp, protocolo, ultData || '', ultDe, idConversa, linkGmail,
      c.shortUrl || '', c.id, alertas.join(' | ')]
  };
}

/* ============================ SLA ============================ */

/** Próximo momento útil (9h–18h, seg–sex, sem feriados) a partir de ms; dentro do expediente devolve o próprio ms. */
function proximoUtilEmail_(ms, feriados) {
  const t = trechosExpedienteCard_(ms, ms + 30 * 86400000, feriados);
  return t.length ? t[0][0] : ms;
}

/** Dia útil: seg–sex (CARD_TRELLO.DIAS_UTEIS) e fora da aba FERIADOS. */
function diaUtilEmail_(d, feriados) {
  return CARD_TRELLO.DIAS_UTEIS.indexOf(d.getDay()) !== -1 &&
    !feriados[Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd')];
}

/** Quantos dias úteis do dia do início até o dia de "ate" (os dois inclusive). */
function diasUteisEmail_(inicioMs, ateMs, feriados) {
  const d = new Date(inicioMs);
  d.setHours(0, 0, 0, 0);
  const fim = new Date(ateMs);
  fim.setHours(0, 0, 0, 0);
  let n = 0;
  while (d.getTime() <= fim.getTime()) {
    if (diaUtilEmail_(d, feriados)) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

/** Fim do prazo: 18h do 10º dia útil, contando o dia do início como dia 1. */
function prazoFinalEmail_(inicioMs, feriados) {
  const d = new Date(inicioMs);
  d.setHours(0, 0, 0, 0);
  let n = 0;
  for (let i = 0; i < 400; i++) {
    if (diaUtilEmail_(d, feriados) && ++n === EMAILS_CFG.DIAS_PRAZO) {
      d.setHours(CARD_TRELLO.HORA_FIM, 0, 0, 0);
      return d;
    }
    d.setDate(d.getDate() + 1);
  }
  return null;
}

/**
 * Etapa do SLA em dias úteis. inicioMs já deve estar ajustado ao próximo momento útil.
 * { selo: '🟡 Semana 2', texto: '🟡 Semana 2 · dia 7/10' } ou
 * { selo: '🔴 Fora do prazo', texto: '🔴 Fora do prazo · venceu em 23/10' }
 */
function etapaSlaEmail_(inicioMs, feriados, agora) {
  const prazo = prazoFinalEmail_(inicioMs, feriados);
  return etapaPorPrazoEmail_(inicioMs, prazo ? prazo.getTime() : 0, feriados, agora);
}

/** Mesma etapa, a partir do início e do prazo já gravados (o Widget usa esta). */
function etapaPorPrazoEmail_(inicioMs, prazoMs, feriados, agora) {
  if (!inicioMs) return { selo: '', texto: '' };
  if (prazoMs && agora > prazoMs) {
    const selo = EMAILS_CFG.ETAPAS[2];
    return { selo: selo, texto: selo + ' · venceu em ' + Utilities.formatDate(new Date(prazoMs), Session.getScriptTimeZone(), 'dd/MM') };
  }
  const dia = Math.max(1, diasUteisEmail_(inicioMs, agora, feriados));
  const selo = dia <= EMAILS_CFG.DIAS_SEMANA_1 ? EMAILS_CFG.ETAPAS[0] : EMAILS_CFG.ETAPAS[1];
  return { selo: selo, texto: selo + ' · dia ' + Math.min(dia, EMAILS_CFG.DIAS_PRAZO) + '/' + EMAILS_CFG.DIAS_PRAZO };
}

/** true se as "horas" úteis a partir de ini já se esgotaram (só para a regra C da migração). */
function venceuEmail_(ini, horas, feriados, agora) {
  const prazo = calcularPrazoCard_(ini, horas, feriados);
  return prazo ? prazo.getTime() < agora : false;
}

/* ============================ LEITURA DO CARD ============================ */

/** "25/09 - ..." -> data; o ano é o mais próximo da criação do card. Aceita também DD/MM/AAAA. */
function dataDoTituloEmail_(titulo, criado) {
  const m = /^\s*(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/.exec(String(titulo || ''));
  if (!m) return null;
  const dia = +m[1], mes = +m[2];
  if (dia < 1 || dia > 31 || mes < 1 || mes > 12) return null;
  if (m[3]) {
    const a = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const d = new Date(a, mes - 1, dia);
    return d.getDate() === dia ? d : null;
  }
  let melhor = null;
  [criado.getFullYear() - 1, criado.getFullYear(), criado.getFullYear() + 1].forEach(a => {
    const d = new Date(a, mes - 1, dia);
    if (d.getDate() !== dia) return; // 31/02 etc.
    if (!melhor || Math.abs(d - criado) < Math.abs(melhor - criado)) melhor = d;
  });
  return melhor;
}

function campoDescEmail_(desc, rotulo) {
  const m = new RegExp('\\*\\*' + rotulo + ':\\*\\*\\s*([^\\n]+)', 'i').exec(desc);
  return m ? m[1].trim() : '';
}

function dominioEmail_(remetente) {
  const m = /[^\s<>"']+@([^\s<>"']+)/.exec(String(remetente || ''));
  return m ? m[1].toLowerCase().replace(/[>.,;]+$/, '') : '';
}

/** Evita que textos iniciados por = + - @ virem fórmula. */
function seguroEmail_(v) {
  const s = String(v === null || v === undefined ? '' : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

/* ============================ ABA EMAIL_PREVIA ============================ */

function lerAjustesPreviaEmail_(ss) {
  const aba = ss.getSheetByName(EMAILS_CFG.ABA_PREVIA);
  const mapa = {};
  if (!aba || aba.getLastRow() < 2) return mapa;
  const v = aba.getDataRange().getValues();
  const cId = v[0].indexOf('ID do card'), cAj = v[0].indexOf('Ajuste');
  if (cId === -1 || cAj === -1) return mapa;
  v.slice(1).forEach(l => {
    const id = String(l[cId] || '').trim();
    const aj = String(l[cAj] || '').trim();
    if (id && aj) mapa[id] = aj;
  });
  return mapa;
}

function gravarPreviaEmail_(ss, linhas) {
  const aba = ss.getSheetByName(EMAILS_CFG.ABA_PREVIA) || ss.insertSheet(EMAILS_CFG.ABA_PREVIA);
  if (aba.getFilter()) aba.getFilter().remove();
  aba.getDataRange().clearDataValidations();
  aba.clear();
  aba.getRange(1, 1, 1, CAB_PREVIA.length).setValues([CAB_PREVIA]).setFontWeight('bold').setBackground('#e8eaed');
  aba.setFrozenRows(1);
  const n = linhas.length;
  if (!n) return;
  [18, 21, 24].forEach(c => aba.getRange(2, c, n, 1).setNumberFormat('@')); // Protocolo e IDs como texto
  aba.getRange(2, 1, n, CAB_PREVIA.length).setValues(linhas);
  [11, 19].forEach(c => aba.getRange(2, c, n, 1).setNumberFormat('dd/MM/yyyy HH:mm'));
  aba.getRange(2, 3, n, 1).setBackground('#fff8e1').setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(EMAILS_CFG.AJUSTES, true).build());
  aba.setColumnWidth(10, 320);
  aba.setColumnWidth(25, 380);
  aba.getRange(1, 1, n + 1, CAB_PREVIA.length).createFilter();
}

function resumoPreviaEmail_(q, itens, ignorados, inicio) {
  const conta = (lista, f) => lista.reduce((o, i) => { const k = f(i) || '(vazio)'; o[k] = (o[k] || 0) + 1; return o; }, {});
  const fmt = o => Object.keys(o).map(k => k + ': ' + o[k]).join(' | ') || '-';
  const abertos = itens.filter(i => i.aberto);
  const concl = itens.filter(i => !i.aberto);
  const comAlerta = (lista, t) => lista.filter(i => i.alertas.some(a => a.indexOf(t) === 0)).length;
  return [
    'Quadro: ' + q.nome + ' | cards lidos: ' + q.cards.length + ' | ignorados (listas ignoradas): ' + ignorados,
    'Situação final → Em atendimento: ' + abertos.length + ' | Concluído (migração): ' + concl.length,
    'Concluídos por motivo → ' + fmt(conta(concl, i => i.ajuste === 'Concluir' ? 'Ajuste manual' : i.motivo)),
    'Abertos por categoria → ' + fmt(conta(abertos, i => i.categoria)),
    'Abertos por etapa → ' + fmt(conta(abertos, i => i.etapa)),
    'Responsável (todos) por origem → ' + fmt(conta(itens, i => i.origemResp || 'Sem responsável')),
    'Alertas dos abertos → sem ID da conversa: ' + comAlerta(abertos, 'Aberto sem ID') +
      ' | sem responsável: ' + comAlerta(abertos, 'Aberto sem responsável') +
      ' | sem cliente: ' + comAlerta(abertos, 'Sem cliente') +
      ' | lista sem categoria: ' + comAlerta(abertos, 'Lista sem categoria'),
    'Tempo: ' + Math.round((Date.now() - inicio) / 1000) + ' s'
  ].join('\n');
}

/* ============================ CARGA DEFINITIVA ============================ */

/**
 * Grava na EMAILS o que a prévia mostra (respeitando a coluna Ajuste da EMAIL_PREVIA).
 * Pode rodar de novo: linhas de origem "Trello" são atualizadas pelo ID do card, sem duplicar.
 * Também pré-preenche a EMAIL_DOMINIOS (mantém as linhas que não são de origem "Carga").
 */
function cargaDefinitivaEmails() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inicio = Date.now();
  const aba = ss.getSheetByName(EMAILS_CFG.ABA_EMAILS);
  if (!aba) throw new Error('Rode criarAbasEmails() antes da carga.');

  const ctx = contextoCargaEmail_(ss);
  const ajustes = lerAjustesPreviaEmail_(ss);
  const itens = cardsValidosEmail_(ctx.q).map(c => analisarCardEmail_(c, ctx, ajustes[c.id] || ''));

  const nCol = CAB_EMAILS.length;
  const col = nome => CAB_EMAILS.indexOf(nome);
  const atuais = aba.getLastRow() >= 2 ? aba.getRange(2, 1, aba.getLastRow() - 1, nCol).getValues() : [];
  const porCard = {}, idsDeOutros = {};
  atuais.forEach((l, i) => {
    if (String(l[col('Origem')]) === 'Trello') porCard[String(l[col('ID do card Trello')])] = i;
    else idsDeOutros[String(l[col('ID da conversa')])] = true;
  });

  const agora = new Date();
  const alertas = [];
  const usados = {};
  let novos = 0, atualizados = 0;

  itens.forEach(it => {
    const d = it.dados;
    let id = d.idConversa;
    if (!id || usados[id] || idsDeOutros[id]) {
      if (id) alertas.push('ID da conversa repetido (card ' + d.link + '): gravado com o ID do card');
      id = 'TRELLO-' + d.idCard;
    }
    usados[id] = true;

    // Prazo: só categorias com SLA. Lista FORA DO PRAZO entra já vencida (prazo = início do SLA).
    const foraFixo = normalizarTexto(d.lista) === normalizarTexto(EMAILS_CFG.LISTA_FORA_DO_PRAZO);
    const prazo = !d.cat.sla ? '' : (foraFixo ? d.inicioSla : (prazoFinalEmail_(d.inicioSla.getTime(), ctx.feriados) || ''));
    const concluido = d.final !== 'Em atendimento';

    const linha = new Array(nCol).fill('');
    const p = (nome, v) => { linha[col(nome)] = v; };
    p('ID da conversa', id);
    p('Link Gmail', d.linkGmail);
    p('Chegada', d.chegada);
    p('Assunto', seguroEmail_(d.assunto));
    p('Remetente', seguroEmail_(d.remetente));
    p('Domínio', d.dominio);
    p('Cliente', d.clientes.join(', '));
    p('Origem do cliente', d.clientes.length ? 'Trello' : 'Não identificado');
    p('Protocolo', d.protocolo);
    p('Grupo', EMAILS_CFG.GRUPO);
    p('Categoria', d.cat.categoria);
    p('Subcategoria', d.cat.sub);
    p('Responsáveis', d.resp.join(', '));
    p('Assumido em', d.chegada);
    p('Início do SLA', d.cat.sla ? d.inicioSla : '');
    p('Prazo final', prazo);
    p('Situação', d.final);
    p('Concluído via', concluido ? 'Migração' : '');
    p('Origem', 'Trello');
    p('ID do card Trello', d.idCard);
    p('Lista no Trello', d.lista);
    p('Atualizado em', agora);

    if (porCard[d.idCard] !== undefined) { atuais[porCard[d.idCard]] = linha; atualizados++; }
    else { atuais.push(linha); novos++; }
  });

  if (atuais.length) {
    [1, 9, 27].forEach(c => aba.getRange(2, c, atuais.length, 1).setNumberFormat('@'));
    aba.getRange(2, 1, atuais.length, nCol).setValues(atuais);
    [3, 13, 17, 18, 19, 20, 22, 29, 30].forEach(c => aba.getRange(2, c, atuais.length, 1).setNumberFormat('dd/MM/yyyy HH:mm'));
  }
  const dominios = gravarDominiosEmail_(ss, itens, alertas);

  Logger.log([
    'EMAILS → novas: ' + novos + ' | atualizadas: ' + atualizados + ' | total na aba: ' + atuais.length,
    'EMAIL_DOMINIOS → domínios gravados pela carga: ' + dominios,
    alertas.length ? 'ALERTAS (' + alertas.length + '):\n- ' + alertas.slice(0, 40).join('\n- ') +
      (alertas.length > 40 ? '\n- ... e mais ' + (alertas.length - 40) : '') : 'Sem alertas.',
    'Tempo: ' + Math.round((Date.now() - inicio) / 1000) + ' s'
  ].join('\n'));
}

/** Domínio → cliente mais frequente (só cards com 1 cliente e domínio não genérico). Preserva linhas manuais. */
function gravarDominiosEmail_(ss, itens, alertas) {
  const aba = ss.getSheetByName(EMAILS_CFG.ABA_DOMINIOS);
  if (!aba) throw new Error('Rode criarAbasEmails() antes da carga.');
  const cont = {};
  itens.forEach(it => {
    const d = it.dados;
    if (!d.dominio || d.clientes.length !== 1 || EMAILS_CFG.DOMINIOS_GENERICOS.indexOf(d.dominio) !== -1) return;
    const m = cont[d.dominio] = cont[d.dominio] || {};
    m[d.clientes[0]] = (m[d.clientes[0]] || 0) + 1;
  });

  const manuais = aba.getLastRow() >= 2
    ? aba.getRange(2, 1, aba.getLastRow() - 1, 4).getValues()
      .filter(l => String(l[0]).trim() && String(l[2]).trim() !== 'Carga')
    : [];
  const temManual = {};
  manuais.forEach(l => { temManual[String(l[0]).trim().toLowerCase()] = true; });

  const linhas = [];
  Object.keys(cont).sort().forEach(dom => {
    if (temManual[dom]) return;
    const ord = Object.keys(cont[dom]).sort((a, b) => cont[dom][b] - cont[dom][a]);
    const total = ord.reduce((s, k) => s + cont[dom][k], 0);
    if (ord.length > 1) {
      alertas.push('Domínio ' + dom + ' com mais de um cliente: ' +
        ord.map(k => k + ' (' + cont[dom][k] + ')').join(', ') + ' → ficou ' + ord[0]);
    }
    linhas.push([dom, ord[0], 'Carga', total]);
  });

  if (aba.getLastRow() >= 2) aba.getRange(2, 1, aba.getLastRow() - 1, 4).clearContent();
  const todas = manuais.concat(linhas);
  if (todas.length) aba.getRange(2, 1, todas.length, 4).setValues(todas);
  aba.autoResizeColumns(1, 4);
  return linhas.length;
}