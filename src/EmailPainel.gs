/*************************************************
 * 21. 📧 MODO E-MAILS DO WIDGET (Lista Ai 1.4.21) — backend
 *
 * ALTERADO (1.4.21): ação PROTOCOLO (só Coordenação) — informa ou corrige o protocolo de um e-mail
 * aberto ou concluído, em texto livre. Protocolo no formato E: bloqueia se já estiver em outro e-mail
 * e ajusta a sequência (EMAIL_PROX_PROTOCOLO / liberados); outros formatos repetidos só pedem
 * confirmação ([DUPLICADO]). O link do card de passagem é achado pela chave E… ou pela EMAIL-<id>.
 *
 * ALTERADO (1.4.17): roda.ultimos = quem assumiu e-mail por último (5, mais recente primeiro),
 * para o "Últimos" da caixa "Próximo e-mail" do Widget.
 *
 * ALTERADO (1.4.16): item "pz" (prazo final) para o Widget ordenar os filtros por vencimento.
 *
 * ALTERADO (1.4.15 — entrada do Gmail, EmailsEntrada.gs):
 *  - item "rb" = 💬 Reaberto (coluna "Reaberto em"); qualquer ação no Widget tira o sinal;
 *  - Assumir/Reatribuir: o indicado que ficou de fora recupera a vez na roda;
 *  - Descartar: libera o protocolo E (volta para a próxima reserva) e limpa a célula;
 *  - "Próximo" da roda considera quem recuperou a vez e pula quem está fora/ausente.
 *
 * Arquivo NOVO do projeto do Lista Ai (Editor > + > Script > "EmailsPainel").
 * Depende do Emails.gs (EMAILS_CFG, CAB_EMAILS, proximoUtilEmail_, prazoFinalEmail_,
 * etapaPorPrazoEmail_) e do backend (obterNivelUsuario, normalizarTexto, normalizarNome,
 * CONFIG.ABA_USUARIOS, lerSlaEFeriadosCard_).
 *
 * Pontes chamadas pelo Widget:
 *  - webObterPainelEmails(usuario)          lista, roda, categorias e pessoas (texto JSON)
 *  - webAcaoEmail(acao, id, dados, quem)    ASSUMIR | REATRIBUIR | CATEGORIA | CONCLUIR | DESCARTAR | PROTOCOLO
 *  - webObterRodaEmails(quem)               roda completa (Gerenciar roda — só Coordenação)
 *  - webSalvarRodaEmails(item, quem)        grava "Na roda" e a ausência de uma pessoa (só Coordenação)
 *
 * Regras (decisões de 10–12/10/2026):
 *  - Qualquer pessoa logada faz qualquer ação; quem fez fica no log EV_EMAILS.
 *    (1.4.21: exceto PROTOCOLO, só Coordenação.)
 *  - Assumir: pergunta no Widget se SUBSTITUI ou INCLUI junto. Reatribuir sempre substitui.
 *  - O SLA começa no 1º "assumido" (aqui ou, depois, pelo marcador/resposta no Gmail),
 *    ajustado ao próximo momento útil. Prazo: 18h do 10º dia útil.
 *  - Mudar para uma categoria sem SLA para a contagem de vez e grava a "Etapa ao sair".
 *  - O que precisa refletir no Gmail/Trello fica na coluna "Pendência Gmail" (RESP, CATEGORIA,
 *    CONCLUIR, DESCARTAR) — lido pela entrada do Gmail (EmailsEntrada.gs) e aplicado pelo FluxoContinuo.
 *************************************************/

const PAINEL_EM = {
  DIAS_CONCLUIDOS: 30,
  SITUACOES_ABERTAS: ['Aguardando', 'Em atendimento'],
  PROP_PROXIMO: 'EMAIL_RODA_PROXIMO',
  PROTOCOLO_MAX: 60 // NOVO (1.4.21): tamanho máximo do protocolo informado à mão
};

/* ============================ LISTA ============================ */

/**
 * Tudo que o modo E-mails precisa, como TEXTO JSON (o navegador faz o JSON.parse).
 * emails: abertos + concluídos nos últimos 30 dias (os migrados sem data de conclusão não entram).
 */
function webObterPainelEmails(usuario) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName(EMAILS_CFG.ABA_EMAILS);
  if (!aba) throw new Error('A aba EMAILS não existe. Rode criarAbasEmails().');
  garantirColunasEmails_(aba); // NOVO (1.4.15)

  const agora = Date.now();
  const limiteConcl = agora - PAINEL_EM.DIAS_CONCLUIDOS * 86400000;
  const feriados = lerSlaEFeriadosCard_().feriados;
  const cats = lerListaCategoriasEmail_(ss);
  const semSla = {};
  cats.forEach(c => { if (!c.sla) semSla[normalizarTexto(c.categoria)] = true; });
  const c = colunasEm_();
  // Cards já criados pelo Lista Ai (aba CARDS_TRELLO): chave = protocolo E ou "EMAIL-<id da conversa>".
  const mapaCards = (typeof obterMapaCardsTrello === 'function') ? obterMapaCardsTrello() : {};

  const dados = aba.getLastRow() >= 2 ? aba.getRange(2, 1, aba.getLastRow() - 1, CAB_EMAILS.length).getValues() : [];
  const emails = [];
  dados.forEach(l => {
    const id = String(l[c.id] || '').trim();
    if (!id) return;
    const sit = String(l[c.sit] || '').trim();
    const aberto = PAINEL_EM.SITUACOES_ABERTAS.indexOf(sit) !== -1;
    const conclMs = msEm_(l[c.conclEm]);
    const concluidoRecente = sit.indexOf('Concluído') === 0 && conclMs >= limiteConcl;
    if (!aberto && !concluidoRecente) return;

    const cat = String(l[c.cat] || '').trim();
    let k = 'concl', etapa = '';
    if (aberto) {
      if (semSla[normalizarTexto(cat)]) {
        k = 'semsla';
        etapa = EMAILS_CFG.SEM_SLA + (l[c.etapaSaiu] ? ' · saiu na ' + l[c.etapaSaiu] : '');
      } else if (!msEm_(l[c.ini])) {
        k = 'aguard';
        etapa = '⏳ Aguardando assumir';
      } else {
        const e = etapaPorPrazoEmail_(msEm_(l[c.ini]), msEm_(l[c.prazo]), feriados, agora);
        k = e.selo === EMAILS_CFG.ETAPAS[2] ? 'fora' : (e.selo === EMAILS_CFG.ETAPAS[1] ? 's2' : 's1');
        etapa = e.texto;
      }
    } else {
      etapa = '✅ Concluído em ' + Utilities.formatDate(new Date(conclMs), Session.getScriptTimeZone(), 'dd/MM');
    }

    const prot = String(l[c.prot] || '').trim();
    const chaveCard = chaveCardEmail_(prot, id);
    emails.push({
      id: id,
      p: prot,
      kc: chaveCard,
      // ALTERADO (1.4.21): card criado antes do protocolo E (chave EMAIL-<id>) continua sendo achado
      cl: mapaCards[chaveCard] || mapaCards['EMAIL-' + id] || '',
      a: String(l[c.assunto] || '').replace(/^'/, ''),
      r: String(l[c.rem] || '').replace(/^'/, ''),
      cli: String(l[c.cli] || '').trim(),
      resp: listaEm_(l[c.resp]),
      cat: cat,
      sub: String(l[c.sub] || '').trim(),
      sit: sit,
      k: k,
      et: etapa,
      ch: msEm_(l[c.chegada]),
      ce: conclMs,
      cp: String(l[c.conclPor] || '').trim(),
      g: String(l[c.gmail] || '').trim(),
      t: String(l[c.card] || '').trim(),
      ind: String(l[c.ind] || '').trim(),
      rb: (aberto && msEm_(l[c.reab])) ? 1 : 0, // NOVO (1.4.15): 💬 Reaberto
      pz: aberto ? msEm_(l[c.prazo]) : 0        // NOVO (1.4.16): prazo final (ordena "o que vence antes")
    });
  });

  const roda = lerRodaEm_(ss, agora);
  // NOVO (1.4.17): últimos a assumir (pela coluna "Assumido em"; vale o 1º responsável da linha)
  const ultimos = dados
    .filter(l => msEm_(l[c.assumido]) && listaEm_(l[c.resp]).length)
    .sort((a, b) => msEm_(b[c.assumido]) - msEm_(a[c.assumido]))
    .slice(0, 5)
    .map(l => listaEm_(l[c.resp])[0]);
  return JSON.stringify({
    emails: emails,
    roda: { ativos: roda.ativos.map(p => p.nome), proximo: roda.proximo, ultimos: ultimos },
    categorias: cats,
    pessoas: lerPessoasEm_(ss),
    nivel: usuario ? (Number(obterNivelUsuario(usuario)) || 0) : 0,
    geradoEm: agora
  });
}

/* ============================ AÇÕES ============================ */

/**
 * acao: ASSUMIR { modo: 'incluir' | 'substituir' }
 *       REATRIBUIR { para }
 *       CATEGORIA { categoria, sub }
 *       CONCLUIR
 *       DESCARTAR { motivo }
 *       PROTOCOLO { protocolo, confirmarDuplicado }   (NOVO 1.4.21 — só Coordenação; aberto ou concluído)
 */
function webAcaoEmail(acao, id, dados, quem) {
  quem = String(quem || '').trim();
  if (!quem) throw new Error('Faça login no Lista Ai.');
  id = String(id || '').trim();
  if (!id) throw new Error('E-mail não informado.');
  dados = dados || {};
  const acaoUp = String(acao || '').toUpperCase(); // NOVO (1.4.21)
  if (acaoUp === 'PROTOCOLO' && (Number(obterNivelUsuario(quem)) || 0) < 3) {
    throw new Error('Só a Coordenação informa ou corrige o protocolo do e-mail.');
  }

  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(20000)) throw new Error('Outra alteração está em andamento. Tente de novo em instantes.');
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const aba = ss.getSheetByName(EMAILS_CFG.ABA_EMAILS);
    if (!aba || aba.getLastRow() < 2) throw new Error('A aba EMAILS está vazia.');
    garantirColunasEmails_(aba); // NOVO (1.4.15)

    const ids = aba.getRange(2, 1, aba.getLastRow() - 1, 1).getValues();
    let nLinha = -1;
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]).trim() === id) { nLinha = i + 2; break; }
    }
    if (nLinha === -1) throw new Error('E-mail não encontrado na EMAILS.');

    const rng = aba.getRange(nLinha, 1, 1, CAB_EMAILS.length);
    const l = rng.getValues()[0];
    const c = colunasEm_();
    const agora = new Date();
    const sitAtual = String(l[c.sit]).trim();
    const aberto = PAINEL_EM.SITUACOES_ABERTAS.indexOf(sitAtual) !== -1;
    // ALTERADO (1.4.21): PROTOCOLO também vale para e-mail concluído (não para descartado)
    const permitido = aberto || (acaoUp === 'PROTOCOLO' && sitAtual.indexOf('Concluído') === 0);
    if (!permitido) throw new Error('Este e-mail não está mais aberto (situação: ' + l[c.sit] + '). Atualize a lista.');

    let evento = '', analista = '', detalhe = '';
    switch (acaoUp) {
      case 'ASSUMIR': {
        const atuais = listaEm_(l[c.resp]);
        const jaSou = atuais.some(n => mesmoNomeEm_(n, quem));
        const substituir = dados.modo === 'substituir';
        if (!substituir && jaSou) throw new Error('Você já é responsável por este e-mail.');
        l[c.resp] = (substituir ? [quem] : atuais.concat([quem])).join(', ');
        iniciarSlaEm_(ss, l, c, agora);
        evento = 'ASSUMIU';
        analista = quem;
        detalhe = substituir ? 'Substituiu: ' + (atuais.join(', ') || '—') : (atuais.length ? 'Incluído junto de: ' + atuais.join(', ') : '');
        ajustarVezAposMudancaEm_(String(l[c.ind] || '').trim(), atuais, listaEm_(l[c.resp])); // NOVO (1.4.15)
        acrescentarPendenciaEm_(l, c, 'RESP');
        break;
      }
      case 'REATRIBUIR': {
        const para = String(dados.para || '').trim();
        if (!para) throw new Error('Escolha para quem reatribuir.');
        const antes = listaEm_(l[c.resp]);
        l[c.resp] = para;
        iniciarSlaEm_(ss, l, c, agora);
        evento = 'REATRIBUIU';
        analista = para;
        detalhe = 'De: ' + (antes.join(', ') || '—');
        ajustarVezAposMudancaEm_(String(l[c.ind] || '').trim(), antes, [para]); // NOVO (1.4.15)
        acrescentarPendenciaEm_(l, c, 'RESP');
        break;
      }
      case 'CATEGORIA': {
        const cats = lerListaCategoriasEmail_(ss);
        const alvo = cats.filter(x => normalizarTexto(x.categoria) === normalizarTexto(dados.categoria))[0];
        if (!alvo) throw new Error('Categoria inválida.');
        const sub = String(dados.sub || '').trim();
        if (sub && !alvo.subs.some(s => normalizarTexto(s) === normalizarTexto(sub))) throw new Error('Subcategoria inválida.');
        if (normalizarTexto(alvo.categoria) === normalizarTexto(l[c.cat]) && normalizarTexto(sub) === normalizarTexto(l[c.sub])) {
          throw new Error('O e-mail já está nessa categoria.');
        }
        const atual = cats.filter(x => normalizarTexto(x.categoria) === normalizarTexto(l[c.cat]))[0];
        const tinhaSla = atual ? atual.sla : true;
        if (tinhaSla && !alvo.sla && !l[c.etapaSaiu]) {
          const ini = msEm_(l[c.ini]);
          l[c.etapaSaiu] = ini
            ? etapaPorPrazoEmail_(ini, msEm_(l[c.prazo]), lerSlaEFeriadosCard_().feriados, agora.getTime()).selo
            : 'Antes de assumir';
        }
        detalhe = (String(l[c.cat] || '—') + (l[c.sub] ? ' › ' + l[c.sub] : '')) + ' → ' + alvo.categoria + (sub ? ' › ' + sub : '');
        l[c.cat] = alvo.categoria;
        l[c.sub] = sub;
        l[c.catDesde] = agora;
        evento = 'CATEGORIA';
        acrescentarPendenciaEm_(l, c, 'CATEGORIA');
        break;
      }
      case 'CONCLUIR': {
        l[c.sit] = 'Concluído';
        l[c.conclEm] = agora;
        l[c.conclPor] = quem;
        l[c.conclVia] = 'Widget';
        evento = 'CONCLUIU';
        acrescentarPendenciaEm_(l, c, 'CONCLUIR');
        break;
      }
      case 'DESCARTAR': {
        const motivo = String(dados.motivo || '').trim();
        if (!motivo) throw new Error('Informe o motivo do descarte.');
        l[c.sit] = 'Descartado';
        l[c.conclEm] = agora;
        l[c.conclPor] = quem;
        l[c.conclVia] = 'Widget';
        evento = 'DESCARTOU';
        detalhe = motivo;
        // NOVO (1.4.15): o protocolo E volta para a próxima reserva (sem buraco na sequência)
        const protDesc = String(l[c.prot] || '').trim();
        if (/^E\d+$/i.test(protDesc)) {
          liberarProtocoloAgoraEm_(protDesc);
          detalhe += ' · protocolo ' + protDesc + ' liberado';
          l[c.prot] = '';
        }
        acrescentarPendenciaEm_(l, c, 'DESCARTAR');
        break;
      }
      case 'PROTOCOLO': {
        // NOVO (1.4.21): informar/corrigir o protocolo (texto livre). Não reflete no Gmail nem no Trello.
        const r = aplicarProtocoloManualEm_(aba, nLinha, l, c, dados);
        evento = 'PROTOCOLO_INFORMADO';
        detalhe = (r.antes || '(sem protocolo)') + ' → ' + r.novo + (r.duplicado ? ' · repetido em outro e-mail (confirmado)' : '') +
          (r.sequencia ? ' · ' + r.sequencia : '');
        break;
      }
      default:
        throw new Error('Ação desconhecida: ' + acao);
    }

    if (acaoUp !== 'PROTOCOLO') l[c.reab] = ''; // NOVO (1.4.15): alguém agiu no e-mail → sai o 💬 Reaberto
    l[c.atual] = agora;
    rng.setValues([l]);
    registrarEventoEmail_(ss, l[c.prot], id, evento, analista || listaEm_(l[c.resp]).join(', '), quem, detalhe);
    return { ok: true, evento: evento };
  } finally {
    lock.releaseLock();
  }
}

/**
 * NOVO (1.4.21): grava o protocolo informado na linha "l" (em memória; quem chama grava a linha).
 *  - texto livre (espaços repetidos viram um só), até PAINEL_EM.PROTOCOLO_MAX caracteres;
 *  - formato E (E2186): em maiúsculas; bloqueia se já estiver em outro e-mail; tira o número da lista
 *    de liberados e, se for maior ou igual ao próximo da sequência, empurra a sequência;
 *  - outros formatos repetidos em outro e-mail: erro [DUPLICADO] até o Widget confirmar.
 * Devolve { antes, novo, duplicado, sequencia }.
 */
function aplicarProtocoloManualEm_(aba, nLinha, l, c, dados) {
  let novo = String(dados.protocolo === null || dados.protocolo === undefined ? '' : dados.protocolo)
    .replace(/\s+/g, ' ').trim();
  if (!novo) throw new Error('Informe o protocolo.');
  if (novo.length > PAINEL_EM.PROTOCOLO_MAX) throw new Error('O protocolo passa de ' + PAINEL_EM.PROTOCOLO_MAX + ' caracteres.');
  const ehE = /^E\d+$/i.test(novo);
  if (ehE) novo = novo.toUpperCase();
  const antes = String(l[c.prot] || '').trim();
  if (antes.toUpperCase() === novo.toUpperCase()) throw new Error('O e-mail já está com esse protocolo.');

  const prots = aba.getRange(2, c.prot + 1, aba.getLastRow() - 1, 1).getValues();
  const repetido = prots.some((x, k) => k + 2 !== nLinha && String(x[0] || '').trim().toUpperCase() === novo.toUpperCase());
  if (repetido && ehE) throw new Error('O protocolo ' + novo + ' já está em outro e-mail.');
  if (repetido && !dados.confirmarDuplicado) {
    throw new Error('[DUPLICADO] O protocolo ' + novo + ' já está em outro e-mail. Gravar mesmo assim?');
  }

  let sequencia = '';
  if (ehE) {
    const n = Number(novo.substring(1));
    const e = lerEstadoProtocoloEm_();
    const antesLivres = e.livres.length;
    e.livres = e.livres.filter(x => x !== n);
    if (e.livres.length !== antesLivres) sequencia = 'número tirado dos liberados';
    if (n >= e.prox) {
      e.prox = n + 1;
      sequencia = (sequencia ? sequencia + '; ' : '') + 'sequência avançada para E' + e.prox;
    }
    if (sequencia) salvarEstadoProtocoloEm_(e);
  }

  aba.getRange(nLinha, c.prot + 1).setNumberFormat('@'); // texto: "16050" não vira número
  l[c.prot] = novo;
  return { antes: antes, novo: novo, duplicado: repetido, sequencia: sequencia };
}

/** Primeiro "assumido": grava Assumido em, sai de Aguardando e inicia o SLA (se a categoria conta SLA). */
function iniciarSlaEm_(ss, l, c, agora) {
  if (!l[c.assumido]) l[c.assumido] = agora;
  if (String(l[c.sit]).trim() === 'Aguardando') l[c.sit] = 'Em atendimento';
  if (msEm_(l[c.ini])) return;
  const cat = lerListaCategoriasEmail_(ss).filter(x => normalizarTexto(x.categoria) === normalizarTexto(l[c.cat]))[0];
  if (cat && !cat.sla) return;
  const feriados = lerSlaEFeriadosCard_().feriados;
  const ini = proximoUtilEmail_(agora.getTime(), feriados);
  l[c.ini] = new Date(ini);
  l[c.prazo] = prazoFinalEmail_(ini, feriados) || '';
}

function acrescentarPendenciaEm_(l, c, token) {
  const atuais = String(l[c.pend] || '').split(';').map(s => s.trim()).filter(Boolean);
  if (atuais.indexOf(token) === -1) atuais.push(token);
  l[c.pend] = atuais.join(';');
}

function registrarEventoEmail_(ss, protocolo, id, evento, analista, quem, detalhe) {
  const aba = ss.getSheetByName(EMAILS_CFG.ABA_EVENTOS);
  if (!aba) return;
  aba.appendRow([new Date(), String(protocolo || ''), String(id || ''), evento, analista || '', quem || '', detalhe || '']);
}

/* ============================ RODA ============================ */

/** Roda completa para o "Gerenciar roda" (só Coordenação). Datas como "AAAA-MM-DDTHH:MM". */
function webObterRodaEmails(quem) {
  exigirCoordenacaoEm_(quem);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const roda = lerRodaEm_(ss, Date.now());
  const tz = Session.getScriptTimeZone();
  const campo = d => d ? Utilities.formatDate(d, tz, "yyyy-MM-dd'T'HH:mm") : '';
  return {
    pessoas: roda.todos.map(p => ({
      nome: p.nome, marcador: p.marcador, naRoda: p.naRoda, ausente: p.ausente,
      desde: campo(p.desde), ate: campo(p.ate), motivo: p.motivo
    })),
    proximo: roda.proximo
  };
}

/** item: { nome, naRoda, desde, ate, motivo } — desde/até no formato do campo datetime-local. */
function webSalvarRodaEmails(item, quem) {
  exigirCoordenacaoEm_(quem);
  item = item || {};
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName(EMAILS_CFG.ABA_RODA);
  if (!aba || aba.getLastRow() < 2) throw new Error('A aba EMAIL_RODA está vazia.');
  const dados = aba.getRange(2, 1, aba.getLastRow() - 1, CAB_RODA.length).getValues();
  const i = dados.findIndex(l => mesmoNomeEm_(l[0], item.nome));
  if (i === -1) throw new Error(item.nome + ' não está na EMAIL_RODA.');

  const desde = dataDoCampoEm_(item.desde);
  const ate = dataDoCampoEm_(item.ate);
  if (ate && !desde) throw new Error('Informe o início da ausência.');
  if (desde && ate && ate.getTime() <= desde.getTime()) throw new Error('O fim da ausência precisa ser depois do início.');

  const antes = dados[i];
  const nova = [antes[0], antes[1], item.naRoda ? 'SIM' : 'NÃO', desde || '', ate || '', String(item.motivo || '').trim()];
  aba.getRange(i + 2, 1, 1, CAB_RODA.length).setValues([nova]);

  const partes = ['Na roda: ' + nova[2]];
  if (desde) {
    const tz = Session.getScriptTimeZone();
    partes.push('Ausente ' + Utilities.formatDate(desde, tz, 'dd/MM HH:mm') +
      (ate ? ' até ' + Utilities.formatDate(ate, tz, 'dd/MM HH:mm') : ' (sem fim)') + (nova[5] ? ' · ' + nova[5] : ''));
  } else {
    partes.push('Sem ausência');
  }
  registrarEventoEmail_(ss, '', '', 'RODA_ALTERADA', antes[0], quem, partes.join(' | '));
  return { ok: true };
}

/**
 * Lê a EMAIL_RODA. Ativo = "Na roda" SIM e fora de ausência agora. Ordem alfabética.
 * Próximo = o guardado na propriedade EMAIL_RODA_PROXIMO (a etapa da distribuição atualiza);
 * se não houver ou não estiver ativo, o 1º ativo em ordem alfabética.
 */
function lerRodaEm_(ss, agora) {
  const aba = ss.getSheetByName(EMAILS_CFG.ABA_RODA);
  const todos = [];
  if (aba && aba.getLastRow() >= 2) {
    aba.getRange(2, 1, aba.getLastRow() - 1, CAB_RODA.length).getValues().forEach(l => {
      const nome = String(l[0] || '').trim();
      if (!nome) return;
      const desde = l[3] instanceof Date ? l[3] : null;
      const ate = l[4] instanceof Date ? l[4] : null;
      const ausente = !!(desde && desde.getTime() <= agora && (!ate || ate.getTime() >= agora));
      todos.push({
        nome: nome, marcador: String(l[1] || '').trim(), naRoda: normalizarTexto(l[2]) === 'sim',
        desde: desde, ate: ate, motivo: String(l[5] || '').trim(), ausente: ausente
      });
    });
  }
  todos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  const ativos = todos.filter(p => p.naRoda && !p.ausente);
  const salvo = PropertiesService.getScriptProperties().getProperty(PAINEL_EM.PROP_PROXIMO) || '';
  // ALTERADO (1.4.15): mesma regra da distribuição (EmailsEntrada.gs) — quem recuperou a vez vem antes;
  // se o guardado está fora/ausente, vale o seguinte em ordem alfabética.
  const proximo = verProximaVezEm_({ ativos: ativos.map(p => p.nome), proximo: salvo, devolvidos: lerDevolvidosEm_() });
  return { todos: todos, ativos: ativos, proximo: proximo };
}

/* ============================ APOIO ============================ */

/** EMAIL_CATEGORIAS do grupo E-mail: [{ categoria, sla, subs: [] }] na ordem da aba. */
function lerListaCategoriasEmail_(ss) {
  const aba = ss.getSheetByName(EMAILS_CFG.ABA_CATEGORIAS);
  const lista = [];
  if (!aba || aba.getLastRow() < 2) return lista;
  aba.getRange(2, 1, aba.getLastRow() - 1, 4).getValues().forEach(l => {
    if (normalizarTexto(l[0]) !== normalizarTexto(EMAILS_CFG.GRUPO)) return;
    const nome = String(l[1] || '').trim();
    if (!nome) return;
    let cat = lista.find(x => normalizarTexto(x.categoria) === normalizarTexto(nome));
    if (!cat) {
      cat = { categoria: nome, sla: normalizarTexto(l[3]) === 'sim', subs: [] };
      lista.push(cat);
    }
    const sub = String(l[2] || '').trim();
    if (sub && cat.subs.indexOf(sub) === -1) cat.subs.push(sub);
  });
  return lista;
}

/** Nomes da USUARIOS (Coluna A), em ordem alfabética — opções do Reatribuir. */
function lerPessoasEm_(ss) {
  const us = ss.getSheetByName(CONFIG.ABA_USUARIOS);
  if (!us || us.getLastRow() < 2) return [];
  const nomes = us.getRange(2, 1, us.getLastRow() - 1, 1).getValues()
    .map(l => String(l[0] || '').trim()).filter(Boolean);
  return nomes.filter((n, i) => nomes.findIndex(x => mesmoNomeEm_(x, n)) === i)
    .sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

function colunasEm_() {
  const c = nome => {
    const i = CAB_EMAILS.indexOf(nome);
    if (i === -1) throw new Error('Coluna "' + nome + '" não existe na EMAILS.');
    return i;
  };
  return {
    id: c('ID da conversa'), gmail: c('Link Gmail'), chegada: c('Chegada'), assunto: c('Assunto'),
    rem: c('Remetente'), cli: c('Cliente'), prot: c('Protocolo'), cat: c('Categoria'), sub: c('Subcategoria'),
    catDesde: c('Categoria desde'), etapaSaiu: c('Etapa ao sair'), ind: c('Indicado'), resp: c('Responsáveis'),
    assumido: c('Assumido em'), ini: c('Início do SLA'), prazo: c('Prazo final'), sit: c('Situação'),
    conclEm: c('Concluído em'), conclPor: c('Concluído por'), conclVia: c('Concluído via'),
    pend: c('Pendência Gmail'), card: c('ID do card Trello'), atual: c('Atualizado em'),
    // NOVO (1.4.15): usadas pela entrada do Gmail (EmailsEntrada.gs)
    dom: c('Domínio'), origCli: c('Origem do cliente'), grupo: c('Grupo'), resp1: c('1ª resposta em'),
    origem: c('Origem'), listaTrello: c('Lista no Trello'), reab: c('Reaberto em')
  };
}

/**
 * Chave do card de passagem de um e-mail: o protocolo E (ex.: E2186) ou, sem ele,
 * "EMAIL-<id da conversa>" (migrados com protocolo antigo ou sem protocolo).
 */
function chaveCardEmail_(protocolo, id) {
  const p = String(protocolo || '').trim().toUpperCase();
  return /^E\d+$/.test(p) ? p : 'EMAIL-' + String(id || '').trim();
}

function exigirCoordenacaoEm_(quem) {
  if (!quem) throw new Error('Faça login no Lista Ai.');
  if ((Number(obterNivelUsuario(quem)) || 0) < 3) throw new Error('Só a Coordenação gerencia a roda de e-mails.');
}

function mesmoNomeEm_(a, b) { return normalizarNome(a) === normalizarNome(b); }

function msEm_(v) { return (v instanceof Date && !isNaN(v.getTime())) ? v.getTime() : 0; }

function listaEm_(v) {
  return String(v === null || v === undefined ? '' : v).split(',').map(s => s.trim()).filter(Boolean);
}

/** "AAAA-MM-DDTHH:MM" -> Date (horário local) ou null. */
function dataDoCampoEm_(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(v || '').trim());
  return m ? new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) : null;
}