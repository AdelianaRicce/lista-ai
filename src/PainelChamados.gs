/*************************************************
 * 19. 📊 PAINEL "CHAMADOS DO SUPORTE" (Lista Ai 1.4.0 — Etapa 4: backend)
 *
 * ALTERADO (painel 1.4 / Lista Ai 1.4.22): webObterEmailsPainelChamados — e-mails da aba EMAILS para a
 * aba "E-mails" e para a Visão geral (cartão E-mail e indicadores somados). Ver a seção no fim do arquivo.
 *
 * Arquivo NOVO do projeto do Lista Ai (Editor > + > Script > "PainelChamados").
 * Página: <url do Web App>?pagina=chamados  (rota criada no doGet — ver instruções).
 *
 * Lê a planilha de chamados (PLANILHA_CHAMADOS_ID, já usada pelas Tarefas):
 *   BASE, DEVOLUCOES, PERMANENCIAS (pelo NOME do cabeçalho) e CONTROLE (posições fixas).
 * Cache: os dados ficam guardados até a próxima carga com sucesso (chave = CONTROLE!B6),
 * então abrir/recarregar o painel não relê a planilha à toa.
 *
 * "Atualizar agora": chama o Web App da planilha de chamados, que AGENDA a carga e
 * responde na hora. Intervalo mínimo de 15 min entre cargas e trava contra cliques
 * simultâneos ficam do lado da planilha de chamados (doGet do CargaHistoricaChamados.gs).
 *
 * Propriedades do script do Lista Ai:
 *   CHAMADOS_WEBAPP_URL  -> URL /exec do Web App da planilha de chamados
 *   CHAMADOS_CHAVE       -> mesma chave gravada em CH_CHAVE_PAINEL na planilha de chamados
 *************************************************/

const PAINEL_CH = {
  ABA_BASE: 'BASE',
  ABA_DEVOLUCOES: 'DEVOLUCOES',
  ABA_PERMANENCIAS: 'PERMANENCIAS',
  ABA_CONTROLE: 'CONTROLE',
  CATEGORIA_CLIENTE: 'Cliente',
  CATEGORIA_TIPO_XML: 'Tipo xml',
  CACHE_PREFIXO: 'PAINEL_CH_V2_', // ALTERADO (painel 1.2): cards passaram a levar os protocolos
  CACHE_SEG: 21600,       // 6h (máximo do CacheService)
  PEDACO_CACHE: 40000     // caracteres por pedaço (cada valor do cache aceita até 100 KB)
};

/** Página do painel — chamada pelo doGet quando ?pagina=chamados. */
function paginaPainelChamados() {
  return HtmlService.createTemplateFromFile('PainelChamadosfront')
    .evaluate()
    .setTitle('CHAMADOS DO SUPORTE')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** Link do painel, para o atalho 📊 Chamados do Widget. */
function webObterUrlPainelChamados() {
  return ScriptApp.getService().getUrl() + '?pagina=chamados';
}

/**
 * Todos os dados do painel, como TEXTO JSON (o navegador faz o JSON.parse).
 * { controle, cards, devolucoes, permanencias, geradoEm } — datas em milissegundos.
 */
function webObterDadosPainelChamados() {
  const ss = SpreadsheetApp.openById(PLANILHA_CHAMADOS_ID);
  const controle = lerControlePainelCh_(ss);
  const chave = PAINEL_CH.CACHE_PREFIXO + (controle.ultimaOkMs || 0);

  const salvo = lerCacheGrandePainel_(chave);
  if (salvo) return salvo;

  const json = JSON.stringify({
    controle: controle,
    cards: lerBasePainelCh_(ss),
    devolucoes: lerDevolucoesPainelCh_(ss),
    permanencias: lerPermanenciasPainelCh_(ss),
    geradoEm: Date.now()
  });
  gravarCacheGrandePainel_(chave, json);
  return json;
}

/** Situação da atualização (consulta o Web App da planilha de chamados). */
function webStatusAtualizacaoChamados() {
  return chamarWebAppChamados_('status');
}

/** Pede uma carga agora. Resposta: { estado: 'agendada' | 'em_andamento' | 'aguarde', ... }. */
function webSolicitarAtualizacaoChamados(quemAcionou) {
  return chamarWebAppChamados_('atualizar', quemAcionou);
}

/* ---------------------------- leituras ---------------------------- */

function lerControlePainelCh_(ss) {
  const aba = ss.getSheetByName(PAINEL_CH.ABA_CONTROLE);
  if (!aba) return { ultimaOkMs: 0 };
  const v = aba.getRange(1, 2, 6, 1).getValues().map(r => r[0]);
  return {
    ultimaExecMs: msPainelCh_(v[0]),
    origem: String(v[1] || ''),
    situacao: String(v[2] || ''),
    detalhe: String(v[3] || ''),
    ultimaOkMs: msPainelCh_(v[5])
  };
}

function lerAbaPorCabecalhoPainelCh_(ss, nome) {
  const aba = ss.getSheetByName(nome);
  if (!aba || aba.getLastRow() < 2) return { col: () => -1, linhas: [], nomes: [] };
  const v = aba.getDataRange().getValues();
  const nomes = v[0].map(c => String(c).trim());
  return {
    nomes: nomes,
    linhas: v.slice(1),
    col: n => nomes.indexOf(n)
  };
}

function lerBasePainelCh_(ss) {
  const t = lerAbaPorCabecalhoPainelCh_(ss, PAINEL_CH.ABA_BASE);
  const c = {
    id: t.col('ID do card'), titulo: t.col('Título'), lista: t.col('Lista atual'), status: t.col('Status'),
    criado: t.col('Criado em'), concluido: t.col('Concluído em'), membros: t.col('Membros'),
    dev: t.col('Qtd. devoluções'), conferir: t.col('Retornos a conferir'), est: t.col('SLAs estourados'),
    link: t.col('Link do card'),
    prot: t.col('Protocolos') // NOVO (painel 1.2): "JIVO12531, WPP031" — base do "virou chamado"
  };
  // Colunas de categoria: localizadas pelo nome, sem acento/maiúsculas ("Tipo_xml" = "Tipo xml").
  const porCategoria = nome => {
    const alvo = normalizarTexto(nome);
    return t.nomes.findIndex(n => normalizarTexto(n) === alvo);
  };
  const cCli = porCategoria(PAINEL_CH.CATEGORIA_CLIENTE);
  const cXml = porCategoria(PAINEL_CH.CATEGORIA_TIPO_XML);
  const val = (l, i) => i === -1 ? '' : l[i];

  return t.linhas.filter(l => c.id !== -1 && l[c.id]).map(l => ({
    id: String(l[c.id]),
    t: String(val(l, c.titulo) || ''),
    l: String(val(l, c.lista) || ''),
    s: String(val(l, c.status) || ''),
    cr: msPainelCh_(val(l, c.criado)),
    co: msPainelCh_(val(l, c.concluido)),
    cli: listaPainelCh_(val(l, cCli)),
    xml: listaPainelCh_(val(l, cXml)),
    mem: listaPainelCh_(val(l, c.membros)),
    dv: numPainelCh_(val(l, c.dev)),
    cf: numPainelCh_(val(l, c.conferir)),
    est: numPainelCh_(val(l, c.est)),
    u: String(val(l, c.link) || ''),
    pr: listaPainelCh_(val(l, c.prot)) // NOVO (painel 1.2)
  }));
}

function lerDevolucoesPainelCh_(ss) {
  const t = lerAbaPorCabecalhoPainelCh_(ss, PAINEL_CH.ABA_DEVOLUCOES);
  const c = {
    sit: t.col('Situação'), nivel: t.col('Nível que devolveu'), data: t.col('Data'), card: t.col('ID do card'),
    tipo: t.col('Tipo final'), motivo: t.col('Motivo final'), qd: t.col('Quem devolveu'),
    qp: t.col('Quem passou'), qa: t.col('Quem assumiu'), horas: t.col('Horas úteis no nível'),
    est: t.col('SLA do nível estourado')
  };
  const val = (l, i) => i === -1 ? '' : l[i];
  return t.linhas
    .filter(l => val(l, c.card) && String(val(l, c.sit)) !== 'Não é devolução')
    .map(l => ({
      sit: String(val(l, c.sit) || ''),
      n: String(val(l, c.nivel) || ''),
      d: msPainelCh_(val(l, c.data)),
      card: String(val(l, c.card)),
      tipo: String(val(l, c.tipo) || ''),
      mot: listaPainelCh_(val(l, c.motivo)),
      qd: String(val(l, c.qd) || ''),
      qp: String(val(l, c.qp) || ''),
      qa: String(val(l, c.qa) || ''),
      h: val(l, c.horas) === '' ? null : Number(val(l, c.horas)),
      e: String(val(l, c.est) || '')
    }));
}

function lerPermanenciasPainelCh_(ss) {
  const t = lerAbaPorCabecalhoPainelCh_(ss, PAINEL_CH.ABA_PERMANENCIAS);
  const c = {
    card: t.col('ID do card'), lista: t.col('Lista'), entrou: t.col('Entrou'), saiu: t.col('Saiu'),
    quem: t.col('Quem moveu'), horas: t.col('Horas úteis'), sla: t.col('SLA (h)'),
    prazo: t.col('Prazo calculado'), sit: t.col('Situação SLA'), exc: t.col('Excedente (h)')
  };
  const val = (l, i) => i === -1 ? '' : l[i];
  return t.linhas.filter(l => val(l, c.card)).map(l => ({
    card: String(val(l, c.card)),
    l: String(val(l, c.lista) || ''),
    e: msPainelCh_(val(l, c.entrou)),
    s: msPainelCh_(val(l, c.saiu)),
    q: String(val(l, c.quem) || ''),
    h: numPainelCh_(val(l, c.horas)),
    sla: numPainelCh_(val(l, c.sla)),
    p: msPainelCh_(val(l, c.prazo)),
    sit: String(val(l, c.sit) || ''),
    x: numPainelCh_(val(l, c.exc))
  }));
}

/** Número da planilha. Se a célula estiver formatada como data, o Sheets devolve Date: converte de volta. */
function numPainelCh_(v) {
  if (v instanceof Date) {
    return Math.round((v.getTime() - new Date(1899, 11, 30).getTime()) / 864000) / 100;
  }
  return Number(v) || 0;
}

function msPainelCh_(v) {
  return (v instanceof Date && !isNaN(v.getTime())) ? v.getTime() : 0;
}

function listaPainelCh_(v) {
  return String(v === null || v === undefined ? '' : v).split(',').map(s => s.trim()).filter(Boolean);
}

/* ---------------------------- cache em pedaços ---------------------------- */

function gravarCacheGrandePainel_(chave, texto) {
  try {
    const n = Math.ceil(texto.length / PAINEL_CH.PEDACO_CACHE);
    const itens = {};
    itens[chave + '_N'] = String(n);
    for (let i = 0; i < n; i++) {
      itens[chave + '_' + i] = texto.substring(i * PAINEL_CH.PEDACO_CACHE, (i + 1) * PAINEL_CH.PEDACO_CACHE);
    }
    CacheService.getScriptCache().putAll(itens, PAINEL_CH.CACHE_SEG);
  } catch (e) {
    // sem cache: o painel só fica um pouco mais lento
  }
}

function lerCacheGrandePainel_(chave) {
  try {
    const cache = CacheService.getScriptCache();
    const n = Number(cache.get(chave + '_N') || 0);
    if (!n) return null;
    const chaves = [];
    for (let i = 0; i < n; i++) chaves.push(chave + '_' + i);
    const partes = cache.getAll(chaves);
    if (chaves.some(k => partes[k] === undefined || partes[k] === null)) return null;
    return chaves.map(k => partes[k]).join('');
  } catch (e) {
    return null;
  }
}

/** Rodar pelo editor se quiser forçar o painel a reler a planilha (ex.: depois de um ajuste manual). */
function limparCachePainelChamados() {
  const ss = SpreadsheetApp.openById(PLANILHA_CHAMADOS_ID);
  const chave = PAINEL_CH.CACHE_PREFIXO + (lerControlePainelCh_(ss).ultimaOkMs || 0);
  CacheService.getScriptCache().remove(chave + '_N');
  Logger.log('✅ Cache do painel limpo.');
}

/* ---------------------------- Web App da planilha de chamados ---------------------------- */

function chamarWebAppChamados_(acao, quem) {
  const props = PropertiesService.getScriptProperties();
  const base = String(props.getProperty('CHAMADOS_WEBAPP_URL') || '').trim();
  const chave = String(props.getProperty('CHAMADOS_CHAVE') || '').trim();
  if (!base || !chave) {
    throw new Error('Atualização não configurada: grave CHAMADOS_WEBAPP_URL e CHAMADOS_CHAVE nas Propriedades do script do Lista Ai.');
  }
  const url = base + '?acao=' + encodeURIComponent(acao) + '&chave=' + encodeURIComponent(chave) +
    (quem ? '&quem=' + encodeURIComponent(quem) : '');
  const resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
  let j;
  try {
    j = JSON.parse(resp.getContentText());
  } catch (e) {
    throw new Error('A planilha de chamados não respondeu como esperado (código ' + resp.getResponseCode() +
      '). Confira se o Web App dela está publicado com acesso "Qualquer pessoa".');
  }
  if (j.erro) throw new Error(j.erro);
  return j;
}

/** Rodar pelo editor para conferir a ligação com a planilha de chamados. */
function testarPainelChamados() {
  const dados = JSON.parse(webObterDadosPainelChamados());
  Logger.log('Cards: ' + dados.cards.length + ' | Devoluções: ' + dados.devolucoes.length +
    ' | Permanências: ' + dados.permanencias.length);
  Logger.log('Última atualização OK: ' + (dados.controle.ultimaOkMs ? new Date(dados.controle.ultimaOkMs) : '—'));
  Logger.log('Com cliente: ' + dados.cards.filter(c => c.cli.length).length +
    ' | Com tipo xml: ' + dados.cards.filter(c => c.xml.length).length);
  try {
    Logger.log('Status da atualização: ' + JSON.stringify(webStatusAtualizacaoChamados()));
  } catch (e) {
    Logger.log('⚠️ Atualização pelo painel: ' + e.message);
  }
  Logger.log('Link do painel: ' + webObterUrlPainelChamados());
}

/* ---------------------------- Atendimentos Jivo (Lista Ai) ---------------------------- */

/**
 * ALTERADO (painel 1.3): atendimentos e retornos de DUAS fontes, emendadas pela data de corte:
 *  - HIST_JIVO (carga histórica dos JSONs do Jivo): chats que começaram ANTES do corte;
 *  - EV_ATENDIMENTOS (Lista Ai): eventos A PARTIR do corte.
 * Corte = HJ.CORTE do CargaHistoricaJivo.gs (02/10/2026 00:00). Sem sobreposição.
 * Devolve TEXTO JSON: { eventos: [{ d, p, ca, cli, a, k, ti, du, pr, o }], cards, corteMs, geradoEm }
 *  k  = 'A' atendimento | 'R' retorno
 *  ti = tipo de atendimento (só histórico) | du = duração em min | pr = 1ª resposta em min (só histórico)
 *  o  = 'H' histórico (Jivo) | 'L' Lista Ai
 */
function webObterAtendimentosJivo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const TIPOS_FIM = ['CHAT_FINISHED', 'CHAT_FINISHED_CASCATA', 'ATENDIMENTO_FINALIZADO_MANUAL_ADMIN'];
  const corteMs = (typeof HJ !== 'undefined' && HJ.CORTE) ? HJ.CORTE.getTime() : new Date(2026, 9, 2).getTime();

  // Canal -> cliente (CANAIS: B = nome do canal, C = cliente)
  const clientePorCanal = {};
  const canais = ss.getSheetByName(CONFIG.ABA_CANAIS);
  if (canais && canais.getLastRow() >= 2 && canais.getLastColumn() >= 3) {
    canais.getRange(2, 1, canais.getLastRow() - 1, 3).getValues().forEach(l => {
      const n = normalizarTexto(l[1]);
      if (n) clientePorCanal[n] = String(l[2] || '').trim();
    });
  }

  const eventos = [];

  // 1) HISTÓRICO (HIST_JIVO): só Conta = A ou R, antes do corte.
  // A=Data início | D=Conta | E=Analista | G=Canal | H=Cliente | J=Protocolo | L=Tipo | N=Duração | O=1ª resposta
  const hist = ss.getSheetByName('HIST_JIVO');
  if (hist && hist.getLastRow() >= 2) {
    hist.getRange(2, 1, hist.getLastRow() - 1, 15).getValues().forEach(l => {
      const k = String(l[3] || '').trim();
      if ((k !== 'A' && k !== 'R') || !(l[0] instanceof Date) || l[0].getTime() >= corteMs) return;
      const canal = String(l[6] || '').trim();
      eventos.push({
        d: l[0].getTime(),
        p: String(l[9] || '').split(',')[0].trim(),
        ca: canal,
        cli: String(l[7] || '').trim() || clientePorCanal[normalizarTexto(canal)] || '',
        a: String(l[4] || '').trim(),
        k: k,
        ti: String(l[11] || '').trim(),
        du: numOuNuloPainel_(l[13]),
        pr: numOuNuloPainel_(l[14]),
        o: 'H'
      });
    });
  }

  // 2) LISTA AI (EV_ATENDIMENTOS): só a partir do corte.
  const aba = ss.getSheetByName(ABAS_EVENTOS.ATENDIMENTOS);
  if (aba && aba.getLastRow() >= 2) {
    // A=Data/Hora | B=Canal | C=Protocolo | D=Tipo | E=Analista | F=Descrição
    const linhas = aba.getRange(2, 1, aba.getLastRow() - 1, 6).getValues()
      .filter(l => l[0] instanceof Date && l[0].getTime() >= corteMs)
      .map(l => ({ l: l, tipo: String(l[3] || '').trim().toUpperCase() }))
      .filter(x => x.tipo === 'RETORNO_REGISTRADO' || x.tipo === 'ATENDIMENTO_CONVERTIDO_RETORNO' || TIPOS_FIM.indexOf(x.tipo) !== -1)
      .sort((a, b) => a.l[0].getTime() - b.l[0].getTime());
    const convertidos = {};
    linhas.forEach(x => { if (x.tipo === 'ATENDIMENTO_CONVERTIDO_RETORNO') convertidos[String(x.l[2]).trim()] = true; });
    const retornoAberto = {}; // protocolo -> evento do Retorno, até o encerramento dele
    linhas.forEach(x => {
      const l = x.l;
      if (x.tipo === 'ATENDIMENTO_CONVERTIDO_RETORNO') return;
      if (TIPOS_FIM.indexOf(x.tipo) !== -1 && convertidos[String(l[2]).trim()]) return;
      const p = String(l[2] === null || l[2] === undefined ? '' : l[2]).trim();
      const canal = String(l[1] || '').trim();
      const ev = {
        d: l[0].getTime(), p: p, ca: canal,
        cli: clientePorCanal[normalizarTexto(canal)] || '',
        a: String(l[4] || '').trim(),
        ti: '', du: null, pr: null, o: 'L'
      };
      if (x.tipo === 'RETORNO_REGISTRADO') {
        if (p) retornoAberto[p] = ev;
        ev.k = 'R';
        eventos.push(ev);
        return;
      }
      if (p && retornoAberto[p]) { // encerramento do Retorno: não conta; a duração vai para o retorno
        if (retornoAberto[p].du === null) retornoAberto[p].du = duracaoDoEventoPainel_(l[5]);
        delete retornoAberto[p];
        return;
      }
      ev.k = 'A';
      ev.du = duracaoDoEventoPainel_(l[5]);
      eventos.push(ev);
    });
  }

  return JSON.stringify({
    eventos: eventos,
    cards: (typeof obterMapaCardsTrello === 'function') ? obterMapaCardsTrello() : {},
    corteMs: corteMs,
    geradoEm: Date.now()
  });
}

/** NOVO (painel 1.3): "Duração: 00:12:34" (descrição do CHAT_FINISHED) -> minutos; null se não houver. */
function duracaoDoEventoPainel_(descricao) {
  const m = /Dura[çc][ãa]o:\s*(\d+):(\d{2}):(\d{2})/.exec(String(descricao || ''));
  return m ? Math.round((Number(m[1]) * 60 + Number(m[2]) + Number(m[3]) / 60) * 10) / 10 : null;
}

/** NOVO (painel 1.3): número da planilha ou null (célula vazia). */
function numOuNuloPainel_(v) {
  return (v === '' || v === null || v === undefined || isNaN(Number(v))) ? null : Number(v);
}

/* ---------------------------- E-mails (NOVO painel 1.4 / Lista Ai 1.4.22) ---------------------------- */

/**
 * E-mails da aba EMAILS para o painel, como TEXTO JSON. Descartados não entram.
 * Regras (decisões de 21/10/2026):
 *  - o e-mail conta como atendimento pela data em que foi ASSUMIDO ("Assumido em"; nos migrados do
 *    Trello é a data do título do card);
 *  - só a categoria que conta SLA (Suporte) entra na soma de atendimentos da Visão geral;
 *    Coordenação e Desenvolvimento/Comercial ficam só nos indicadores da aba E-mails (campo "su");
 *  - etapa do SLA dos abertos calculada como no Widget (Semana 1, Semana 2, Fora do prazo).
 * Devolve { emails: [{ id, p, a, cli, resp, cat, sub, sit, k, et, ch, as, ce, pz, cd, su, rb, o, cl }], geradoEm }
 *  k  = 'aguard' | 's1' | 's2' | 'fora' | 'semsla' | 'concl'
 *  cd = 1 concluído dentro do prazo | 0 depois do prazo | null sem prazo ou sem data de conclusão
 *  o  = 'Gmail' | 'Trello' (migrado)
 */
function webObterEmailsPainelChamados() {
  if (typeof EMAILS_CFG === 'undefined' || typeof CAB_EMAILS === 'undefined') {
    throw new Error('Os arquivos de e-mail (Emails.gs e EmailsPainel.gs) não estão no projeto.');
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName(EMAILS_CFG.ABA_EMAILS);
  if (!aba || aba.getLastRow() < 2) return JSON.stringify({ emails: [], geradoEm: Date.now() });

  const agora = Date.now();
  const feriados = lerSlaEFeriadosCard_().feriados;
  const semSla = {};
  lerListaCategoriasEmail_(ss).forEach(x => { if (!x.sla) semSla[normalizarTexto(x.categoria)] = true; });
  const c = colunasEm_();
  const mapaCards = (typeof obterMapaCardsTrello === 'function') ? obterMapaCardsTrello() : {};
  const largura = Math.min(aba.getLastColumn(), CAB_EMAILS.length);
  const dados = aba.getRange(2, 1, aba.getLastRow() - 1, largura).getValues();
  const valor = (l, i) => i < largura ? l[i] : '';

  const emails = [];
  dados.forEach(l => {
    const id = String(valor(l, c.id) || '').trim();
    if (!id) return;
    const sit = String(valor(l, c.sit) || '').trim();
    if (sit === 'Descartado') return;
    const aberto = PAINEL_EM.SITUACOES_ABERTAS.indexOf(sit) !== -1;
    const cat = String(valor(l, c.cat) || '').trim();
    const contaSla = !semSla[normalizarTexto(cat)];
    const ini = msEm_(valor(l, c.ini));
    const prazo = msEm_(valor(l, c.prazo));
    const concl = msEm_(valor(l, c.conclEm));

    let k = 'concl', etapa = '';
    if (aberto) {
      if (!contaSla) { k = 'semsla'; etapa = EMAILS_CFG.SEM_SLA; }
      else if (!ini) { k = 'aguard'; etapa = 'Aguardando assumir'; }
      else {
        const e = etapaPorPrazoEmail_(ini, prazo, feriados, agora);
        k = e.selo === EMAILS_CFG.ETAPAS[2] ? 'fora' : (e.selo === EMAILS_CFG.ETAPAS[1] ? 's2' : 's1');
        etapa = e.texto;
      }
    } else {
      etapa = sit;
    }

    const prot = String(valor(l, c.prot) || '').trim();
    const chaveCard = chaveCardEmail_(prot, id);
    emails.push({
      id: id,
      p: prot,
      a: String(valor(l, c.assunto) || '').replace(/^'/, ''),
      cli: String(valor(l, c.cli) || '').trim(),
      resp: listaEm_(valor(l, c.resp)),
      cat: cat,
      sub: String(valor(l, c.sub) || '').trim(),
      sit: sit,
      k: k,
      et: etapa,
      ch: msEm_(valor(l, c.chegada)),
      as: msEm_(valor(l, c.assumido)),
      ce: concl,
      pz: prazo,
      cd: (!aberto && concl && prazo) ? (concl <= prazo ? 1 : 0) : null,
      su: contaSla ? 1 : 0,
      rb: (aberto && msEm_(valor(l, c.reab))) ? 1 : 0,
      o: String(valor(l, c.origem) || '').trim() || 'Gmail',
      cl: mapaCards[chaveCard] || mapaCards['EMAIL-' + id] || ''
    });
  });

  return JSON.stringify({ emails: emails, geradoEm: agora });
}

/** Rodar pelo editor: confere a leitura dos e-mails do painel. */
function testarEmailsPainelChamados() {
  const r = JSON.parse(webObterEmailsPainelChamados());
  const por = {};
  r.emails.forEach(e => { por[e.k] = (por[e.k] || 0) + 1; });
  Logger.log('E-mails: ' + r.emails.length + ' | por etapa: ' + JSON.stringify(por) +
    ' | sem "Assumido em": ' + r.emails.filter(e => !e.as).length +
    ' | migrados do Trello: ' + r.emails.filter(e => e.o === 'Trello').length);
}