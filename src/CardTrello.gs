/*************************************************
 * 18. 🗂️ CARD NO TRELLO A PARTIR DO PROTOCOLO (Lista Ai 1.4.0 — Etapa 1: backend)
 *
 * Arquivo NOVO do projeto do Lista Ai (Editor > + > Script > "CardTrello").
 * Usa funções que já existem no backend: executarComTrava, registrarEvento,
 * validarAcaoEmNomeDeOutro, obterNivelUsuario, normalizarNome, normalizarTexto,
 * e as constantes CONFIG, PLANILHA_CHAMADOS_ID e ABA_DICIONARIO_CHAMADOS.
 *
 * Regras:
 *  - 1 card por protocolo EXATO (16234, 16234.1 e 16234.2 são independentes).
 *    Se já existe, o painel só abre o card (aba CARDS_TRELLO guarda o vínculo).
 *  - Só linha EM ATENDIMENTO da PROTOCOLOS. Cada analista nas próprias linhas;
 *    a Coordenação (Nível 3) em qualquer linha.
 *  - Título "Jivo <protocolo>"; card no TOPO da lista escolhida.
 *  - 1ª linha da descrição: "🤖 Criado via Lista Ai por <analista> · Protocolo <protocolo>"
 *    (lida depois pela carga histórica como "Quem passou").
 *  - Labels: Cliente (1), Tipo xml (1 ou mais) e Urgente (opcional) — todas lidas do
 *    DICIONARIO da planilha de chamados pela categoria.
 *  - Membro: analista dono da linha (USUARIOS Coluna E = ID do Trello).
 *  - Data de entrega: SLA da lista de destino (aba LISTAS) em horário comercial
 *    (seg–sex, 9h–18h, aba FERIADOS da planilha de chamados).
 *  - Anexos (PDF/JPG/PNG, até 10 MB cada, máx. 10): só como anexo, sem capa.
 *
 * NOVO (Lista Ai 1.4.14): card de passagem a partir de um E-MAIL (modo E-mails do Widget).
 *  - Chave do card: protocolo E (ex.: E2186) ou "EMAIL-<id da conversa>" (e-mails migrados
 *    com protocolo antigo ou sem protocolo). A linha vem da aba EMAILS (Emails.gs).
 *  - Título "Email 2186" (só os números do protocolo E); sem protocolo E: "Email (sem protocolo)",
 *    para ajustar no Trello depois.
 *  - Qualquer pessoa logada cria o card do e-mail (sem a regra de dono da linha).
 *  - Membro: 1º responsável do e-mail (ou quem acionou, se não houver responsável).
 *  - Cliente sugerido: o cliente gravado na EMAILS (pelo nome, no DICIONARIO).
 *
 * Funções para rodar pelo editor (uma vez):
 *  - instalarPassosDiagrama()      cria a aba PASSOS_DIAGRAMA com a lista de passos
 *  - listarMembrosQuadroTrello()   mostra no log o ID do Trello de cada membro
 *  - testarConexaoCardTrello()     confere token, quadro, listas, labels e SLA
 *  - limparCacheCardTrello()       força reler DICIONARIO / LISTAS / FERIADOS
 *************************************************/

const CARD_TRELLO = {
  QUADRO_ID: 'ID_DO_QUADRO_DE_CHAMADOS',
  LISTAS_DESTINO: [
    { id: '6891094f73dcb178cd7e185e', nome: 'Atendimento' },
    { id: '688d05ef46021b25d10d366a', nome: 'Passagem para Processo', padrao: true },
    { id: '688d05f46a55c6bb0f76229b', nome: 'Processo' },
    { id: '6890b2be86f90cb1ce26fa87', nome: 'Sustentação' },
    { id: '6a70b6e75f546c3895ebc5b5', nome: 'Coordenação' } // ALTERADO (09/10/2026): todos os níveis
  ],
  LINK_PRIORIDADES: 'https://trello.com/c/SEU_CARD_DE_PRIORIDADES',
  TIPOS_USER: ['Terceiro', 'Cliente', 'Compradora', 'TI', 'Fiscal', 'Logística', 'Representante'],
  CATEGORIA_CLIENTE: 'Cliente',
  CATEGORIA_TIPO_XML: 'Tipo xml',
  CATEGORIA_URGENTE: 'Urgente',
  LINK_DIAGRAMA: 'https://trello.com/c/SEU_CARD_DE_DIAGRAMAS',
  ABA_CARDS: 'CARDS_TRELLO',
  ABA_PASSOS: 'PASSOS_DIAGRAMA',
  ABA_LISTAS_CHAMADOS: 'LISTAS',
  ABA_FERIADOS_CHAMADOS: 'FERIADOS',
  COL_CANAIS_CLIENTE: 3,       // CANAIS Coluna C = nome da label de Cliente daquele canal
  COL_USUARIOS_ID_TRELLO: 5,   // USUARIOS Coluna E = ID de membro do Trello
  HORA_INICIO: 9,
  HORA_FIM: 18,
  DIAS_UTEIS: [1, 2, 3, 4, 5],
  ANEXO_TIPOS: ['application/pdf', 'image/jpeg', 'image/png'],
  ANEXO_MAX_BYTES_ARQUIVO: 10 * 1024 * 1024,
  ANEXO_MAX_ARQUIVOS: 10,
  CACHE_DIC: 'CARD_TRELLO_DIC_V1',
  CACHE_SLA: 'CARD_TRELLO_SLA_V1',
  CACHE_MAPA: 'CARD_TRELLO_MAPA_V1',
  CACHE_SEG: 3600 // 1h: label nova no DICIONARIO aparece no formulário em até 1h
};

// Aba CARDS_TRELLO (criada sozinha no 1º card): vínculo protocolo ↔ card. Nunca é limpa.
const CABECALHO_CARDS_TRELLO = ['Protocolo', 'ID do card', 'Link', 'Lista', 'Analista', 'Criado por',
  'Criado em', 'Cliente', 'Tipo xml', 'Urgente', 'Anexos', 'Data de entrega'];

/* =====================================================================
 * PONTES DO PAINEL
 * ===================================================================== */

/**
 * Abre o formulário: se o protocolo já tem card, devolve só { existente } (o painel abre o
 * link). Senão, devolve tudo que o formulário precisa — sem objetos Date (ponte segura).
 */
function webObterDadosFormCard(protocolo, quemAcionou) {
  protocolo = textoProtocoloCard_(protocolo);
  if (!protocolo) throw new Error('Protocolo não informado.');

  const existente = obterCardDoProtocolo_(protocolo, false);
  if (existente) return { existente: existente };

  const ehCoord = ehCoordenacaoCard_(quemAcionou);
  const linha = localizarLinhaParaCard_(protocolo, ehCoord, quemAcionou);
  if (!linha) {
    if (ehChaveEmailCard_(protocolo)) throw new Error('O e-mail ' + protocolo + ' não foi encontrado na aba EMAILS.');
    throw new Error(ehCoord ? 'O protocolo ' + protocolo + ' não está na lista de atendimentos de hoje.' : 'O protocolo ' + protocolo + ' não está EM ATENDIMENTO.');
  }
  if (!linha.ehEmail) validarAcaoEmNomeDeOutro(linha.analista, quemAcionou);

  const dic = lerDicionarioCard_();
  const clienteSugerido = linha.ehEmail
    ? clientePorNomeCard_(linha.clienteNome, dic.clientes)
    : clientePorCanalCard_(linha.canal, dic.clientes);

  let avisos = [];
  if (linha.ehEmail) {
    if (!/^E\d+$/i.test(protocolo)) avisos.push('Este e-mail não tem protocolo E — o título fica "Email (sem protocolo)"; ajuste no Trello depois.');
    if (linha.clienteNome && !clienteSugerido) avisos.push('O cliente "' + linha.clienteNome + '" do e-mail não está no DICIONARIO — escolha o cliente.');
  } else if (!clienteSugerido && linha.canal) {
    avisos.push('O canal "' + linha.canal + '" não tem cliente cadastrado na aba CANAIS (Coluna C) — escolha o cliente.');
  }

  return {
    existente: null,
    protocolo: protocolo,
    titulo: tituloCardTrello_(protocolo, linha),
    analista: linha.analista,
    horarioInicio: linha.inicio ? formatarDataCard_(linha.inicio) : '',
    user: linha.user,
    canal: linha.canal,
    clienteSugeridoId: clienteSugerido ? clienteSugerido.id : '',
    listas: CARD_TRELLO.LISTAS_DESTINO.filter(l => ehCoord || !l.soCoordenacao),
    linkPrioridades: CARD_TRELLO.LINK_PRIORIDADES,
    tiposUser: CARD_TRELLO.TIPOS_USER,
    clientes: dic.clientes,
    tiposXml: dic.tiposXml,
    urgentes: dic.urgentes,
    passos: lerPassosDiagrama_(),
    linkDiagrama: CARD_TRELLO.LINK_DIAGRAMA,
    anexos: {
      tipos: CARD_TRELLO.ANEXO_TIPOS,
      maxArquivos: CARD_TRELLO.ANEXO_MAX_ARQUIVOS,
      maxMbArquivo: Math.round(CARD_TRELLO.ANEXO_MAX_BYTES_ARQUIVO / 1048576)
    },
    avisos: avisos
  };
}

/**
 * Cria o card. "dados" vem do formulário:
 * { protocolo, listaId, clienteId, user, tipoUser, tiposXmlIds: [], urgenteId, espelho,
 *   faccao, erroOriginal, passoDiagrama, documentacao, analise, conclusao,
 *   anexos: [{ nome, tipo, base64 }] }
 * Devolve { sucesso, link, lista, dataEntrega, avisos, falhasAnexos } ou
 * { existente } se outro clique criou o card antes.
 */
function webCriarCardTrello(dados, quemAcionou) {
  dados = dados || {};
  const protocolo = textoProtocoloCard_(dados.protocolo);
  if (!protocolo) throw new Error('Protocolo não informado.');

  // 1) Validações que não dependem da trava (falham antes de qualquer gravação).
  const f = validarFormularioCard_(dados);
  const blobs = montarAnexosCard_(dados.anexos);
  const dic = lerDicionarioCard_();
  const lista = CARD_TRELLO.LISTAS_DESTINO.filter(l => l.id === f.listaId)[0];
  if (!lista) throw new Error('Lista de destino inválida.');
  const cliente = dic.clientes.filter(c => c.id === f.clienteId)[0];
  if (!cliente) throw new Error('Cliente inválido (não está ativo na categoria "' + CARD_TRELLO.CATEGORIA_CLIENTE + '" do DICIONARIO).');
  const tiposXml = f.tiposXmlIds.map(id => dic.tiposXml.filter(t => t.id === id)[0]);
  if (tiposXml.some(t => !t)) throw new Error('Tipo xml inválido (não está ativo na categoria "' + CARD_TRELLO.CATEGORIA_TIPO_XML + '" do DICIONARIO).');
  let urgente = null;
  if (f.urgenteId) {
    urgente = dic.urgentes.filter(u => u.id === f.urgenteId)[0];
    if (!urgente) throw new Error('Etiqueta de urgência inválida (categoria "' + CARD_TRELLO.CATEGORIA_URGENTE + '" do DICIONARIO).');
  }

  // 2) Trava própria (DocumentLock) — não segura a trava da fila durante a chamada ao Trello.
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) throw new Error('Outro card está sendo criado agora. Tente de novo em instantes.');
  let r;
  try {
    const ja = obterCardDoProtocolo_(protocolo, true);
    if (ja) return { existente: ja };

    const ehCoord = ehCoordenacaoCard_(quemAcionou);
    const linha = localizarLinhaParaCard_(protocolo, ehCoord, quemAcionou);
    if (!linha) {
      if (ehChaveEmailCard_(protocolo)) throw new Error('O e-mail ' + protocolo + ' não foi encontrado na aba EMAILS.');
      throw new Error(ehCoord ? 'O protocolo ' + protocolo + ' não está mais na lista de atendimentos.' : 'O protocolo ' + protocolo + ' não está mais EM ATENDIMENTO.');
    }
    if (lista.soCoordenacao && !ehCoord) throw new Error('A lista ' + lista.nome + ' é exclusiva da Coordenação.');
    if (!linha.ehEmail) validarAcaoEmNomeDeOutro(linha.analista, quemAcionou);

    const avisos = [];
    const idMembro = obterIdTrelloDoUsuario_(linha.analista);
    if (!idMembro) avisos.push(linha.analista + ' não tem ID do Trello na USUARIOS (Coluna E) — card criado sem membro.');

    const sla = lerSlaEFeriadosCard_();
    const horasSla = sla.slaPorLista[lista.id] || null;
    const dataEntrega = horasSla ? calcularPrazoCard_(Date.now(), horasSla, sla.feriados) : null;
    if (!horasSla) avisos.push('A lista ' + lista.nome + ' não tem SLA na aba LISTAS — card sem data de entrega.');

    const idLabels = [cliente.id].concat(tiposXml.map(t => t.id)).concat(urgente ? [urgente.id] : []);
    const desc = montarDescricaoCard_(protocoloDescricaoCard_(protocolo), linha, f, cliente.nome, tiposXml.map(t => t.nome));

    const payload = {
      idList: lista.id,
      name: tituloCardTrello_(protocolo, linha),
      desc: desc,
      pos: 'top',
      idLabels: idLabels.join(',')
    };
    if (idMembro) payload.idMembers = idMembro;
    if (dataEntrega) payload.due = dataEntrega.toISOString();

    const card = trelloListaAi_('post', '/cards', null, payload, { repetirErro5xx: false });

    gravarVinculoCard_([protocolo, card.id, card.shortUrl || card.url || '', lista.nome, linha.analista,
      quemAcionou || linha.analista, new Date(), cliente.nome, tiposXml.map(t => t.nome).join(', '),
      urgente ? urgente.nome : '', blobs.length, dataEntrega || '']);

    r = { card: card, linha: linha, avisos: avisos, dataEntrega: dataEntrega };
  } finally {
    lock.releaseLock();
  }

  // 3) Anexos e registro, fora da trava (podem demorar). Card já existe: falha aqui só avisa.
  const falhasAnexos = enviarAnexosCard_(r.card.id, blobs);
  const link = r.card.shortUrl || r.card.url || '';
  const acionadoPor = ehAcaoPropria(r.linha.analista, quemAcionou) ? '' : ' (acionado por ' + quemAcionou + ')';
  const textoEvento = 'Card criado em ' + lista.nome + ': ' + link +
    (r.dataEntrega ? ' | Entrega: ' + formatarDataCard_(r.dataEntrega) : '') +
    (blobs.length ? ' | Anexos: ' + (blobs.length - falhasAnexos.length) + '/' + blobs.length : '') +
    (urgente ? ' | URGENTE' : '');
  if (r.linha.ehEmail) {
    // NOVO (1.4.14): e-mail registra no log do próprio e-mail (EV_EMAILS).
    if (typeof registrarEventoEmail_ === 'function') {
      registrarEventoEmail_(SpreadsheetApp.getActiveSpreadsheet(), r.linha.protocoloEmail, r.linha.idConversa,
        'CARD_CRIADO', r.linha.analista, quemAcionou || r.linha.analista, textoEvento);
    }
  } else {
    registrarEvento(r.linha.canal, protocolo, 'ATENDIMENTO_CARD_TRELLO_CRIADO', r.linha.analista,
      textoEvento + acionadoPor, r.linha.chatId);
  }

  return {
    sucesso: true,
    link: link,
    lista: lista.nome,
    dataEntrega: r.dataEntrega ? formatarDataCard_(r.dataEntrega) : '',
    avisos: r.avisos,
    falhasAnexos: falhasAnexos
  };
}

/**
 * { protocolo: link } de todos os cards já criados — usado pelo painel e pelo Modo Mini
 * para trocar o botão "criar" por "abrir card". Cache de 1h, limpo a cada card novo.
 */
function obterMapaCardsTrello() {
  const cache = CacheService.getScriptCache();
  const salvo = cache.get(CARD_TRELLO.CACHE_MAPA);
  if (salvo) {
    try { return JSON.parse(salvo); } catch (e) {}
  }
  const mapa = {};
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CARD_TRELLO.ABA_CARDS);
  if (sheet && sheet.getLastRow() >= 2) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues().forEach(l => {
      const p = textoProtocoloCard_(l[0]);
      if (p && l[2]) mapa[p] = String(l[2]);
    });
  }
  try { cache.put(CARD_TRELLO.CACHE_MAPA, JSON.stringify(mapa), CARD_TRELLO.CACHE_SEG); } catch (e) {}
  return mapa;
}

/* =====================================================================
 * LEITURAS
 * ===================================================================== */

/** Protocolo sempre como texto, do jeito que aparece na PROTOCOLOS (16234, 16234.2). */
function textoProtocoloCard_(p) {
  return (p === null || p === undefined) ? '' : String(p).trim();
}

/**
 * ALTERADO (09/10/2026): protocolo como vai para o TÍTULO do card no Trello — sem o prefixo
 * "J" do Lista Ai, no padrão "Jivo 16465" ("J16465" -> "16465", "J16465.2" -> "16465.2").
 * A chave da CARDS_TRELLO e a descrição do card continuam com o protocolo completo (J16465).
 */
function protocoloParaTrello_(p) {
  return textoProtocoloCard_(p).replace(/^J(?=\d)/i, '');
}

/** NOVO (1.4.14): chave de card de e-mail — "E2186" ou "EMAIL-<id da conversa>". */
function ehChaveEmailCard_(p) {
  return /^E\d+$/i.test(textoProtocoloCard_(p)) || /^EMAIL-/i.test(textoProtocoloCard_(p));
}

/** NOVO (1.4.14): título do card — "Jivo 16465" ou "Email 2186" (só números do protocolo E). */
function tituloCardTrello_(protocolo, linha) {
  if (linha && linha.ehEmail) {
    const m = /^E(\d+)$/i.exec(textoProtocoloCard_(protocolo));
    return 'Email ' + (m ? m[1] : '(sem protocolo)');
  }
  return 'Jivo ' + protocoloParaTrello_(protocolo);
}

/** NOVO (1.4.14): protocolo como aparece na descrição — a chave "EMAIL-..." vira "(sem protocolo E)". */
function protocoloDescricaoCard_(protocolo) {
  return /^EMAIL-/i.test(textoProtocoloCard_(protocolo)) ? '(sem protocolo E)' : protocolo;
}

/** NOVO (1.4.14): linha para o card — e-mail (aba EMAILS) ou atendimento do Jivo (PROTOCOLOS). */
function localizarLinhaParaCard_(protocolo, ehCoord, quemAcionou) {
  if (ehChaveEmailCard_(protocolo)) {
    const linha = localizarEmailParaCard_(protocolo);
    if (linha && !linha.analista) linha.analista = String(quemAcionou || '').trim();
    return linha;
  }
  return localizarLinhaProtocoloCard_(protocolo, ehCoord);
}

/**
 * NOVO (1.4.14): e-mail da aba EMAILS pela chave ("E2186" pelo Protocolo; "EMAIL-<id>" pelo
 * ID da conversa). Devolve uma "linha" no mesmo formato da PROTOCOLOS, com ehEmail = true.
 */
function localizarEmailParaCard_(chave) {
  if (typeof EMAILS_CFG === 'undefined' || typeof CAB_EMAILS === 'undefined') return null;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(EMAILS_CFG.ABA_EMAILS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const col = n => CAB_EMAILS.indexOf(n);
  const dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, CAB_EMAILS.length).getValues();
  const k = textoProtocoloCard_(chave);
  const porId = /^EMAIL-/i.test(k) ? k.substring(6).trim() : '';
  for (let i = dados.length - 1; i >= 0; i--) {
    const l = dados[i];
    const bate = porId
      ? String(l[col('ID da conversa')]).trim() === porId
      : String(l[col('Protocolo')]).trim().toUpperCase() === k.toUpperCase();
    if (!bate) continue;
    const resp = String(l[col('Responsáveis')] || '').split(',').map(s => s.trim()).filter(Boolean);
    const inicio = (l[col('Assumido em')] instanceof Date) ? l[col('Assumido em')]
      : ((l[col('Chegada')] instanceof Date) ? l[col('Chegada')] : null);
    return {
      ehEmail: true,
      linhaPlanilha: i + 2,
      status: 'EMAIL',
      analista: resp[0] || '',
      inicio: inicio,
      canal: '',
      user: String(l[col('Remetente')] || '').replace(/^'/, '').trim(),
      chatId: '',
      clienteNome: String(l[col('Cliente')] || '').split(',')[0].trim(),
      idConversa: String(l[col('ID da conversa')] || '').trim(),
      protocoloEmail: String(l[col('Protocolo')] || '').trim()
    };
  }
  return null;
}

/**
 * Última linha com esse protocolo exato na PROTOCOLOS.
 * qualquerStatus = true (Coordenação): aceita qualquer status; senão, só EM ATENDIMENTO.
 */
function localizarLinhaProtocoloCard_(protocolo, qualquerStatus) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const larg = Math.max(sheet.getLastColumn(), 16);
  const dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, larg).getValues();
  for (let i = dados.length - 1; i >= 0; i--) {
    const l = dados[i];
    if (textoProtocoloCard_(l[0]) !== protocolo) continue;
    const status = String(l[4]).toUpperCase().trim();
    if (!qualquerStatus && status !== 'EM ATENDIMENTO' && status !== 'ENCERRADO') continue; // 1.4.9: card após encerrar
    const inicio = (l[1] instanceof Date) ? l[1] : ((l[5] instanceof Date) ? l[5] : null); // B (Chat Aceito) ou F
    return {
      linhaPlanilha: i + 2,
      status: status,
      analista: String(l[2] || '').trim(),
      inicio: inicio,
      canal: String(l[13] || '').trim(),  // N
      user: String(l[14] || '').trim(),   // O (nome do visitante no Jivo)
      chatId: String(l[15] || '').trim()  // P
    };
  }
  return null;
}

/** true = Coordenação (qualquer linha e status). Exige login. */
function ehCoordenacaoCard_(quemAcionou) {
  if (!quemAcionou) throw new Error('Faça login no Lista Ai para criar o card.');
  return obterNivelUsuario(quemAcionou) >= 3;
}

/** Card já criado para o protocolo: { id, link, lista } ou null. semCache = lê a aba direto. */
function obterCardDoProtocolo_(protocolo, semCache) {
  if (!semCache) {
    const link = obterMapaCardsTrello()[protocolo];
    return link ? { link: link } : null;
  }
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CARD_TRELLO.ABA_CARDS);
  if (!sheet || sheet.getLastRow() < 2) return null;
  const dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
  for (let i = dados.length - 1; i >= 0; i--) {
    if (textoProtocoloCard_(dados[i][0]) === protocolo) {
      return { id: String(dados[i][1]), link: String(dados[i][2]), lista: String(dados[i][3]) };
    }
  }
  return null;
}

/**
 * Labels ativas do DICIONARIO (planilha de chamados) das categorias Cliente, Tipo xml e
 * Urgente: { clientes, tiposXml, urgentes } com [{ id, nome }]. Categoria comparada sem
 * acento/maiúsculas/símbolos ("Tipo_xml" = "Tipo xml").
 */
function lerDicionarioCard_() {
  const cache = CacheService.getScriptCache();
  const salvo = cache.get(CARD_TRELLO.CACHE_DIC);
  if (salvo) {
    try { return JSON.parse(salvo); } catch (e) {}
  }
  let aba;
  try {
    aba = SpreadsheetApp.openById(PLANILHA_CHAMADOS_ID).getSheetByName(ABA_DICIONARIO_CHAMADOS);
  } catch (e) {
    throw new Error('Não foi possível abrir a planilha de chamados: ' + e.message);
  }
  const r = { clientes: [], tiposXml: [], urgentes: [] };
  const cat = {
    [normalizarTexto(CARD_TRELLO.CATEGORIA_CLIENTE)]: r.clientes,
    [normalizarTexto(CARD_TRELLO.CATEGORIA_TIPO_XML)]: r.tiposXml,
    [normalizarTexto(CARD_TRELLO.CATEGORIA_URGENTE)]: r.urgentes
  };
  if (aba && aba.getLastRow() >= 2) {
    // A=Label | B=Cor | C=ID da label | D=Cards | E=Categoria | F=Nome exibido | G=Ativo
    aba.getRange(2, 1, aba.getLastRow() - 1, 7).getValues().forEach(l => {
      const id = String(l[2] || '').trim();
      const destino = cat[normalizarTexto(l[4])];
      if (!id || !destino) return;
      if (normalizarTexto(l[6]) === 'nao') return;
      const nome = String(l[5] || '').trim() || String(l[0] || '').trim();
      destino.push({ id: id, nome: nome });
    });
  }
  Object.keys(r).forEach(k => r[k].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')));
  try { cache.put(CARD_TRELLO.CACHE_DIC, JSON.stringify(r), CARD_TRELLO.CACHE_SEG); } catch (e) {}
  return r;
}

/** SLA por lista (aba LISTAS: B=ID, H=SLA) e feriados (aba FERIADOS: A=Data) da planilha de chamados. */
function lerSlaEFeriadosCard_() {
  const cache = CacheService.getScriptCache();
  const salvo = cache.get(CARD_TRELLO.CACHE_SLA);
  if (salvo) {
    try { return JSON.parse(salvo); } catch (e) {}
  }
  const ss = SpreadsheetApp.openById(PLANILHA_CHAMADOS_ID);
  const tz = Session.getScriptTimeZone();
  const r = { slaPorLista: {}, feriados: {} };

  const abaL = ss.getSheetByName(CARD_TRELLO.ABA_LISTAS_CHAMADOS);
  if (abaL && abaL.getLastRow() >= 2) {
    abaL.getRange(2, 1, abaL.getLastRow() - 1, 8).getValues().forEach(l => {
      const id = String(l[1] || '').trim();
      const n = Number(String(l[7] === null ? '' : l[7]).replace(',', '.'));
      if (id && String(l[7]).trim() !== '' && !isNaN(n) && n > 0) r.slaPorLista[id] = n;
    });
  }
  const abaF = ss.getSheetByName(CARD_TRELLO.ABA_FERIADOS_CHAMADOS);
  if (abaF && abaF.getLastRow() >= 2) {
    abaF.getRange(2, 1, abaF.getLastRow() - 1, 1).getValues().forEach(l => {
      const v = l[0];
      if (v instanceof Date) { r.feriados[Utilities.formatDate(v, tz, 'yyyy-MM-dd')] = true; return; }
      const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(v).trim());
      if (m) r.feriados[m[3] + '-' + m[2] + '-' + m[1]] = true;
    });
  }
  try { cache.put(CARD_TRELLO.CACHE_SLA, JSON.stringify(r), CARD_TRELLO.CACHE_SEG); } catch (e) {}
  return r;
}

/** Cliente sugerido pelo canal: CANAIS Coluna B = nome do canal, Coluna C = label de Cliente. */
function clientePorCanalCard_(canal, clientes) {
  if (!canal) return null;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_CANAIS);
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < CARD_TRELLO.COL_CANAIS_CLIENTE) return null;
  const dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, CARD_TRELLO.COL_CANAIS_CLIENTE).getValues();
  const alvo = normalizarTexto(canal);
  for (let i = 0; i < dados.length; i++) {
    if (normalizarTexto(dados[i][1]) !== alvo) continue;
    const nomeCliente = normalizarTexto(dados[i][CARD_TRELLO.COL_CANAIS_CLIENTE - 1]);
    if (!nomeCliente) return null;
    return clientes.filter(c => normalizarTexto(c.nome) === nomeCliente)[0] || null;
  }
  return null;
}

/** NOVO (1.4.14): cliente sugerido pelo NOME (cliente gravado na EMAILS). */
function clientePorNomeCard_(nome, clientes) {
  const alvo = normalizarTexto(nome);
  if (!alvo) return null;
  return clientes.filter(c => normalizarTexto(c.nome) === alvo)[0] || null;
}

/** ID de membro do Trello do usuário (USUARIOS Coluna E). */
function obterIdTrelloDoUsuario_(nome) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_USUARIOS);
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < CARD_TRELLO.COL_USUARIOS_ID_TRELLO) return '';
  const dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, CARD_TRELLO.COL_USUARIOS_ID_TRELLO).getValues();
  const alvo = normalizarNome(nome);
  for (let i = 0; i < dados.length; i++) {
    if (normalizarNome(dados[i][0]) === alvo) return String(dados[i][CARD_TRELLO.COL_USUARIOS_ID_TRELLO - 1] || '').trim();
  }
  return '';
}

/** Passos ativos da aba PASSOS_DIAGRAMA: [{ grupo, passo }] na ordem da aba. */
function lerPassosDiagrama_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CARD_TRELLO.ABA_PASSOS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues()
    .filter(l => String(l[1] || '').trim() && normalizarTexto(l[2]) !== 'nao')
    .map(l => ({ grupo: String(l[0] || '').trim(), passo: String(l[1]).trim() }));
}

/* =====================================================================
 * FORMULÁRIO, DESCRIÇÃO E ANEXOS
 * ===================================================================== */

/** Obrigatórios: todos, exceto Espelho, Facção/Fornecedor, Anexos e Urgente. */
function validarFormularioCard_(d) {
  const t = v => String(v === null || v === undefined ? '' : v).trim();
  const f = {
    listaId: t(d.listaId),
    clienteId: t(d.clienteId),
    user: t(d.user),
    tipoUser: t(d.tipoUser),
    tiposXmlIds: (Array.isArray(d.tiposXmlIds) ? d.tiposXmlIds : []).map(t).filter(Boolean),
    urgenteId: t(d.urgenteId),
    espelho: t(d.espelho),
    faccao: t(d.faccao),
    erroOriginal: t(d.erroOriginal),
    passoDiagrama: t(d.passoDiagrama),
    documentacao: t(d.documentacao),
    analise: t(d.analise),
    conclusao: t(d.conclusao)
  };
  const faltando = [];
  if (!f.listaId) faltando.push('Lista');
  if (!f.clienteId) faltando.push('Cliente');
  if (!f.user) faltando.push('User');
  if (!f.tipoUser) faltando.push('Tipo User');
  if (!f.tiposXmlIds.length) faltando.push('Tipo xml');
  if (!f.erroOriginal) faltando.push('Erro/Reclamação/Solicitação original');
  if (!f.passoDiagrama) faltando.push('Passo do diagrama');
  if (!f.documentacao) faltando.push('Card/Documentação utilizada');
  if (!f.analise) faltando.push('Análise do caso');
  if (!f.conclusao) faltando.push('Conclusão');
  if (faltando.length) throw new Error('Preencha: ' + faltando.join(', ') + '.');
  if (CARD_TRELLO.TIPOS_USER.indexOf(f.tipoUser) === -1) throw new Error('Tipo User inválido.');
  return f;
}

/**
 * Corpo do card, no formato do template manual, com "---" (linha horizontal no Trello)
 * entre os tópicos. 1ª linha = marca do Lista Ai (lida pela carga histórica).
 * A linha em branco ANTES do "---" é obrigatória: sem ela o Trello vira o texto de cima em título.
 */
function montarDescricaoCard_(protocolo, linha, f, clienteNome, tiposXmlNomes) {
  const L = [];
  const separar = () => L.push('', '---', '');
  L.push('🤖 Criado via Lista Ai por ' + linha.analista + ' · Protocolo ' + protocolo);
  separar();
  L.push('**Horário início atendimento:** ' + (linha.inicio ? formatarDataCard_(linha.inicio) : ''));
  L.push('**Cliente:** ' + clienteNome);
  L.push('**User:** ' + f.user);
  L.push('**Tipo User:** ' + f.tipoUser);
  L.push('**Tipo_xml:** ' + tiposXmlNomes.join(', '));
  L.push('**Código Espelho:** ' + f.espelho);
  L.push('**Facção/Fornecedor:** ' + f.faccao);
  separar();
  L.push('**Erro ou Reclamação ou Solicitação original do user:**');
  L.push(f.erroOriginal);
  separar();
  L.push('**Com base em qual [passo do diagrama](' + CARD_TRELLO.LINK_DIAGRAMA + ') ocorre o erro/análise?**');
  L.push(f.passoDiagrama);
  separar();
  L.push('**Card/Documentação utilizada:**');
  L.push(f.documentacao);
  separar();
  L.push('**Análise do caso (com passos e verificações feitas)**');
  L.push(f.analise);
  separar();
  L.push('**Conclusão/Duvida/Solicitação de Orientação ou Subida por termino de SLA**');
  L.push(f.conclusao);
  return L.join('\n').substring(0, 16000); // limite do Trello: 16.384 caracteres
}

/** [{ nome, tipo, base64 }] do painel -> Blobs. Valida tipo, quantidade e tamanho por arquivo. */
function montarAnexosCard_(anexos) {
  if (!Array.isArray(anexos) || !anexos.length) return [];
  if (anexos.length > CARD_TRELLO.ANEXO_MAX_ARQUIVOS) {
    throw new Error('No máximo ' + CARD_TRELLO.ANEXO_MAX_ARQUIVOS + ' anexos por card.');
  }
  return anexos.map((a, i) => {
    const tipo = String((a && a.tipo) || '').toLowerCase();
    const nome = String((a && a.nome) || ('anexo-' + (i + 1))).replace(/[\\\/:*?"<>|]/g, '_').substring(0, 120);
    if (CARD_TRELLO.ANEXO_TIPOS.indexOf(tipo) === -1) {
      throw new Error('Anexo "' + nome + '" não permitido: envie só PDF, JPG ou PNG.');
    }
    const bytes = Utilities.base64Decode(String((a && a.base64) || ''));
    if (bytes.length > CARD_TRELLO.ANEXO_MAX_BYTES_ARQUIVO) {
      throw new Error('O anexo "' + nome + '" passa de ' + Math.round(CARD_TRELLO.ANEXO_MAX_BYTES_ARQUIVO / 1048576) + ' MB.');
    }
    return Utilities.newBlob(bytes, tipo, nome);
  });
}

/** Sobe cada anexo (sem virar capa). Devolve a lista de falhas ("nome: erro"). */
function enviarAnexosCard_(idCard, blobs) {
  const falhas = [];
  blobs.forEach(b => {
    try {
      trelloListaAi_('post', '/cards/' + idCard + '/attachments', null,
        { file: b, name: b.getName(), setCover: 'false' }, { repetirErro5xx: false });
    } catch (e) {
      falhas.push(b.getName() + ': ' + e.message);
    }
  });
  return falhas;
}

function gravarVinculoCard_(linha) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CARD_TRELLO.ABA_CARDS);
  if (!sheet) {
    sheet = ss.insertSheet(CARD_TRELLO.ABA_CARDS);
    sheet.getRange(1, 1, 1, CABECALHO_CARDS_TRELLO.length).setValues([CABECALHO_CARDS_TRELLO]).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.getRange('A:B').setNumberFormat('@');               // protocolo e ID como texto
    sheet.getRange('G:G').setNumberFormat('dd/MM/yyyy HH:mm');
    sheet.getRange('L:L').setNumberFormat('dd/MM/yyyy HH:mm');
  }
  sheet.appendRow(linha);
  CacheService.getScriptCache().remove(CARD_TRELLO.CACHE_MAPA);
}

/* =====================================================================
 * PRAZO EM HORÁRIO COMERCIAL (mesma regra da carga histórica, sem pausas)
 * ===================================================================== */

/** Momento em que "horas" úteis se esgotam a partir de inicioMs (seg–sex, 9h–18h, sem feriados). */
function calcularPrazoCard_(inicioMs, horas, feriados) {
  let restante = horas * 3600000;
  let de = inicioMs;
  for (let bloco = 0; bloco < 24 && restante > 0; bloco++) { // blocos de 30 dias
    const ate = de + 30 * 86400000;
    const trechos = trechosExpedienteCard_(de, ate, feriados);
    for (let i = 0; i < trechos.length; i++) {
      const dur = trechos[i][1] - trechos[i][0];
      if (dur >= restante) return new Date(trechos[i][0] + restante);
      restante -= dur;
    }
    de = ate;
  }
  return null;
}

function trechosExpedienteCard_(ini, fim, feriados) {
  const tz = Session.getScriptTimeZone();
  const trechos = [];
  const d = new Date(ini);
  d.setHours(0, 0, 0, 0);
  while (d.getTime() < fim) {
    if (CARD_TRELLO.DIAS_UTEIS.indexOf(d.getDay()) !== -1 && !feriados[Utilities.formatDate(d, tz, 'yyyy-MM-dd')]) {
      const a = Math.max(ini, new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, CARD_TRELLO.HORA_INICIO * 60).getTime());
      const b = Math.min(fim, new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, CARD_TRELLO.HORA_FIM * 60).getTime());
      if (b > a) trechos.push([a, b]);
    }
    d.setDate(d.getDate() + 1);
  }
  return trechos;
}

function formatarDataCard_(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
}

/* =====================================================================
 * API DO TRELLO
 * ===================================================================== */

/**
 * Chamada à API com TRELLO_KEY / TRELLO_TOKEN das Propriedades do script DO LISTA AI.
 * "payload" vai no corpo (o texto da descrição não cabe na URL); com Blob vira multipart.
 * 429 sempre repete. 5xx só repete se opcoes.repetirErro5xx !== false — na criação NÃO
 * repete, porque o Trello pode ter criado o card mesmo devolvendo erro (evita card duplicado).
 */
function trelloListaAi_(metodo, caminho, query, payload, opcoes) {
  opcoes = opcoes || {};
  const props = PropertiesService.getScriptProperties();
  const key = props.getProperty('TRELLO_KEY');
  const token = props.getProperty('TRELLO_TOKEN');
  if (!key || !token) {
    throw new Error('Configure TRELLO_KEY e TRELLO_TOKEN nas Propriedades do script do Lista Ai.');
  }
  const qs = Object.assign({ key: key, token: token }, query || {});
  const url = 'https://api.trello.com/1' + caminho + '?' + Object.keys(qs)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(qs[k])).join('&');
  const req = { method: metodo, muteHttpExceptions: true };
  if (payload) req.payload = payload;

  for (let tentativa = 1; tentativa <= 4; tentativa++) {
    const resp = UrlFetchApp.fetch(url, req);
    const codigo = resp.getResponseCode();
    if (codigo === 429 || (codigo >= 500 && opcoes.repetirErro5xx !== false && tentativa < 4)) {
      Utilities.sleep(1500 * tentativa);
      continue;
    }
    if (codigo >= 400) throw new Error('Trello ' + codigo + ': ' + resp.getContentText().slice(0, 200));
    return JSON.parse(resp.getContentText());
  }
  throw new Error('Trello não respondeu após várias tentativas (' + caminho + ').');
}

/* =====================================================================
 * FUNÇÕES PARA RODAR PELO EDITOR
 * ===================================================================== */

/** Cria (ou completa) a aba PASSOS_DIAGRAMA: A=Grupo | B=Passo | C=Ativo. Não duplica passos. */
function instalarPassosDiagrama() {
  const passos = {
    // Exemplo genérico: cadastre aqui os grupos e passos do fluxo do seu produto.
    'Fluxo principal': ['Passo 1 — Exemplo', 'Passo 2 — Exemplo', 'Passo 3 — Exemplo'],
    'Fluxo alternativo': ['Passo 10 — Exemplo', 'Passo 20 — Exemplo']
  };

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CARD_TRELLO.ABA_PASSOS);
  if (!sheet) {
    sheet = ss.insertSheet(CARD_TRELLO.ABA_PASSOS);
    sheet.getRange(1, 1, 1, 3).setValues([['Grupo', 'Passo', 'Ativo']]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  const existentes = {};
  if (sheet.getLastRow() >= 2) {
    sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues()
      .forEach(l => { existentes[normalizarTexto(l[0])] = true; });
  }
  const novas = [];
  Object.keys(passos).forEach(g => passos[g].forEach(p => {
    if (!existentes[normalizarTexto(p)]) novas.push([g, p, 'SIM']);
  }));
  if (novas.length) sheet.getRange(sheet.getLastRow() + 1, 1, novas.length, 3).setValues(novas);
  sheet.getRange(2, 3, Math.max(sheet.getLastRow() - 1, 1), 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['SIM', 'NÃO'], true).build());
  sheet.autoResizeColumns(1, 3);
  Logger.log('✅ PASSOS_DIAGRAMA: ' + novas.length + ' passo(s) incluído(s).');
}

/** Mostra no log o ID de cada membro do quadro — copie para a USUARIOS, Coluna E. */
function listarMembrosQuadroTrello() {
  const membros = trelloListaAi_('get', '/boards/' + CARD_TRELLO.QUADRO_ID + '/members',
    { fields: 'fullName,username' });
  membros.sort((a, b) => String(a.fullName).localeCompare(String(b.fullName), 'pt-BR'))
    .forEach(m => Logger.log(m.fullName + '  |  @' + m.username + '  |  ID: ' + m.id));
}

/** Diagnóstico da integração: token, quadro, listas de destino, labels por categoria e SLA. */
function testarConexaoCardTrello() {
  limparCacheCardTrello();
  const quadro = trelloListaAi_('get', '/boards/' + CARD_TRELLO.QUADRO_ID, { fields: 'name' });
  Logger.log('Quadro: ' + quadro.name);

  const listas = trelloListaAi_('get', '/boards/' + CARD_TRELLO.QUADRO_ID + '/lists', { fields: 'name', filter: 'open' });
  const sla = lerSlaEFeriadosCard_();
  CARD_TRELLO.LISTAS_DESTINO.forEach(l => {
    const achou = listas.filter(x => x.id === l.id)[0];
    Logger.log((achou ? '✅ ' : '❌ NÃO ENCONTRADA ') + l.nome + ' | SLA: ' + (sla.slaPorLista[l.id] || 'sem SLA') + ' h');
  });
  Logger.log('Feriados lidos: ' + Object.keys(sla.feriados).length);

  const dic = lerDicionarioCard_();
  Logger.log('Clientes: ' + dic.clientes.length + ' | Tipo xml: ' + dic.tiposXml.length +
    ' | Urgente: ' + dic.urgentes.map(u => u.nome).join(', '));
  Logger.log('Passos do diagrama: ' + lerPassosDiagrama_().length);
  Logger.log('Exemplo de prazo agora + 2h úteis: ' + formatarDataCard_(calcularPrazoCard_(Date.now(), 2, sla.feriados)));
}

/** Limpa os caches (rode depois de editar DICIONARIO, LISTAS ou FERIADOS para valer na hora). */
function limparCacheCardTrello() {
  CacheService.getScriptCache().removeAll([CARD_TRELLO.CACHE_DIC, CARD_TRELLO.CACHE_SLA, CARD_TRELLO.CACHE_MAPA]);
  Logger.log('✅ Cache da integração com o Trello limpo.');
}

/* =====================================================================
 * PÁGINA DO FORMULÁRIO (Etapa 2)
 * ===================================================================== */

/** Página do formulário — chamada pelo doGet quando ?pagina=card. */
function paginaFormCard(e) {
  const p = (e && e.parameter) || {};
  const t = HtmlService.createTemplateFromFile('FormCard');
  t.paramsJson = JSON.stringify({
    protocolo: String(p.protocolo || '').trim(),
    usuario: String(p.usuario || '').trim()
  }).replace(/</g, '\\u003c');
  // ALTERADO (1.4.14): aba do navegador com "Email 2186" quando é card de e-mail.
  const titulo = ehChaveEmailCard_(p.protocolo)
    ? tituloCardTrello_(p.protocolo, { ehEmail: true })
    : 'Jivo ' + protocoloParaTrello_(p.protocolo);
  return t.evaluate()
    .setTitle('Novo card — ' + titulo)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** URL /exec do Lista Ai (o Widget monta o link do formulário a partir dela). */
function webObterUrlApp() {
  return ScriptApp.getService().getUrl();
}