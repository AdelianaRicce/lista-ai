/*************************************************
 * CONTROLE DE ATENDIMENTOS - V8 (COM ATALHO ASSUMIR)
 *
 *  * 1_4_22 — Log do mês:
 *  - webBuscarLogMes(termo, 'atual' | 'anterior'): pesquisa da tela 🧾 Log no mês do calendário
 *    (EV_ATENDIMENTOS e EV_FILA, só Jivo). Protocolo (com derivados .1/.2 e Retornos que citam o
 *    número), analista, usuário ou texto; devolve a linha do tempo completa de cada protocolo achado.
 *
 *  * 1_4_18 — Ausente N2 sem validação de protocolo:
 *  - o protocolo do Ausente N2 é opcional e em texto livre (até 200 caracteres), sem
 *    validação de formato (normalizarProtocoloLivre);
 *  - "SLA de chamado": protocolo continua obrigatório, mas em texto livre; o e-mail não
 *    traz mais os links dos cards do Trello (webBuscarCardsDosProtocolos ficou sem uso pelo Widget).
 *
 *  * 1_4_11 — Rastreio de crédito e tela de log:
 *  - eventos de fila (CREDITO_RODADA_GERADO / _CONSUMIDO, RODADA_PULADA...) saem com o
 *    protocolo, canal e chat_id do aceite (Jivo) ou da transferência que moveu a fila;
 *  - webObterLogEventos: eventos de hoje e ontem (EV_ATENDIMENTOS, EV_FILA, EV_AUSENCIAS)
 *    para a tela 🧾 Log do widget.
 *  * 1_4_10 — Reconexão do Jivo e WEBHOOK_LOG enxuto:
 *  - chat_finished SEM tópico deixa a linha aguardando reconexão por 5 min; se o MESMO
 *    analista aceitar o MESMO visitante (visitor.number) no MESMO canal, a linha/protocolo
 *    é reaproveitada (só troca o chat_id; fila e créditos não mudam). Senão, o gatilho
 *    verificarReconexoesJivoVencidas encerra com a hora da queda (instalarGatilhoReconexaoJivo);
 *  - tópico Primeiro Contato reconhecido pelo id 3;
 *  - WEBHOOK_LOG grava só o resumo do payload (sem dados pessoais) + Coluna M = Nº Visitante.
 *
 *  * 1_4_9 — Correções da Coordenação, ações após encerrar, prefixo J e ausências:
 *  - Assumir / Retomar (N3) também lista os PAUSADOS e pergunta qual atendimento;
 *  - troca de almoço sem o bloqueio de 1h (a mesma duração do padrão continua) + rede de
 *    segurança no relógio (aplicarTrocasAlmocoDoDia);
 *  - PROTOCOLO COM PREFIXO DO CANAL: o Jivo gera "J16465" (Novo Erro: J16465.1, J16465.2).
 *    O contador (CONFIG!B2) continua só com o número; a leitura da sequência ignora o
 *    prefixo. Busca por protocolo digitado aceita com ou sem o "J" (mesmoProtocolo);
 *  - Retorno usa a ESPERA do Próximo Forçado (igual à Transferência);
 *  - Reverter Status (N3): escolhe o analista e a linha; só troca o status (não mexe em
 *    hora de fim, duração, fila, créditos nem contagem) — webReverterStatusLinha;
 *  - chat encerrado no Jivo com tópico "Primeiro Contato" encerra também a linha PAUSADA /
 *    EM FILA do mesmo chat (evento ENCERRADO_PAUSADO_PRIMEIRO_CONTATO);
 *  - tópico "Retorno Atendimento" (id 1): a linha vira Retorno (selo), conta como Retorno
 *    para quem encerrou e a vez/crédito do aceite são devolvidos como no botão Retorno;
 *  - 📜 Últimos: só aceites de chat (nova Coluna S da PROTOCOLOS = quem aceitou); linha
 *    transferida mostra o Destino;
 *  - Retorno e Transferir em linha ENCERRADA de hoje (sem mexer na fila). Retorno após
 *    encerrar grava ATENDIMENTO_CONVERTIDO_RETORNO (o painel desconta o atendimento);
 *  - analista AUSENTE pode receber Retorno / Transferência e agir normalmente — ausente só
 *    não pode ser o próximo;
 *  - Ausência Longa em minutos; Já Volto com 5/10/20/30 min (Coluna G da EQUIPE agora
 *    guarda o FIM previsto do Já Volto), limite padrão 4/dia e 20/semana;
 *  - Já Voltei da Coordenação: escolhe qualquer analista ausente.
 *
 *  * 1_4_7 — Ausente N2 com protocolo e saldo de tempo + "SLA de chamado":
 *  - o Ausente N2 exige o(s) protocolo(s) do chamado em análise (separados por vírgula);
 *    eles vão para o evento AUSENCIA_N2_INICIADA (Coluna C da EV_AUSENCIAS);
 *  - SALDO DO DIA: CONFIG!C9 agora é a quantidade de janelas de 2h30 por dia (padrão 2 =
 *    5h). Cada uso desconta só o tempo usado de verdade (o almoço não conta); quem volta
 *    antes pelo "Já Voltei" (ou por qualquer outro caminho) fica com o resto. Cada uso
 *    dura no máximo 2h30 (ou o saldo, se for menor); com menos de 30 min de saldo, não
 *    abre. Controle em Document Property N2_CONTROLE (zera todo dia). A Ausência Longa
 *    não entra no saldo;
 *  - "SLA de chamado" (Falar com Coordenação): protocolo(s) obrigatório(s) + "Resumo da
 *    análise" obrigatório, até 500 caracteres (webSolicitarSlaChamado). O e-mail leva o
 *    protocolo no assunto, o saldo de N2 do analista e os links dos cards encontrados;
 *  - webBuscarCardsDosProtocolos: procura os protocolos na BASE da planilha de chamados
 *    (coluna Protocolos) e nos cards criados pelo Lista Ai — só exibe o link, não trava.
 *
 *  * 1_4_6 — Tópicos que não contam protocolo + fila + Retorno/Transferir para todos:
 *  - a linha encerrada com "Cliente Agradeceu" / "Orientação Processos" NÃO é mais apagada:
 *    fica ENCERRADA, com "ignorado" na Coluna A (no lugar do número) e o tópico na Coluna I.
 *    O número continua fora da sequência e vai no evento ATENDIMENTO_IGNORADO_TOPICO
 *    (EV_ATENDIMENTOS, Coluna C). O Widget mostra "ignorado" + tópico; o Modo Mini não
 *    recebe essas linhas (filtradas na rota atendimentosFila — o Mini não muda);
 *  - vez devolvida: se já existir outro Próximo Forçado, quem perdeu a vez entra numa
 *    ESPERA (Document Property PROXIMOS_FORCADOS_PENDENTES) e vira o Próximo Forçado assim
 *    que o atual for resolvido (atendido, pulado ou descartado). Quem estiver na espera e
 *    não estiver ATIVO na hora de assumir perde a vez (regra antiga do forçado);
 *  - crédito de rodada: Retorno encerrado com esses tópicos também estorna a Coluna R
 *    (normalmente ela já foi estornada na conversão para Retorno; aqui é rede de segurança);
 *  - Retorno e Transferir em nome de outro analista liberados para todos os níveis (Widget):
 *    a Origem lista ATIVOS e AUSENTES (webObterDadosFila.analistasOrigem); os eventos
 *    RETORNO_REGISTRADO / TRANSFERENCIA registram "acionado por" quando quem clicou é outro.
 *
 *  * 1_3_16 — Tópico do Jivo + tópicos que não contam protocolo:
 *  - o tópico agora vem de payload.topic (title / topic_id) — antes lia "tags", que
 *    vinha vazio, e a Coluna I ficava sempre "Sem Tópico". O título é gravado SEM o
 *    emoji do início (ex.: "Orientação Processos"); tags não são mais lidas;
 *  - "Cliente Agradeceu" (por tag) virou TOPICOS_IGNORAR_PROTOCOLO (por tópico):
 *    "Cliente Agradeceu" (id 2) e "Orientação Processos" (id 4) — reconhecidos pelo ID
 *    OU pelo nome (sem emoji/acento/maiúsculas). A linha some da PROTOCOLOS, a vez na
 *    fila / crédito de rodada são devolvidos e o evento vai pra EV_ATENDIMENTOS
 *    (ATENDIMENTO_IGNORADO_TOPICO);
 *  - o NÚMERO do protocolo NÃO volta mais pra sequência (o cliente pode já ter recebido
 *    o número — devolver faria o próximo chat repetir o mesmo protocolo);
 *  - Retorno / Protocolo Múltiplo com esses tópicos encerram normalmente (mantêm a linha);
 *  - WEBHOOK_LOG ganhou as colunas K=Tópico e L=ID Tópico.
 *
 *  * 1_3_15 — Eventos fragmentados por tipo:
 *  - a aba EVENTOS foi aposentada (pode ser excluída). Cada evento vai para uma aba
 *    própria, conforme o tipo (mapa REGRAS_ABAS_EVENTOS, logo após as constantes):
 *      EV_ATENDIMENTOS | EV_FILA | EV_AUSENCIAS | EV_WEBHOOK | EV_SISTEMA
 *    (tipo novo não mapeado cai em EV_SISTEMA);
 *  - as abas são criadas sozinhas no 1º evento de cada tipo — ou todas de uma vez
 *    rodando criarAbasEventos() pelo editor; nascem só com as 7 colunas usadas;
 *  - colunas: A=Data/Hora | B=Canal | C=Protocolo | D=Tipo | E=Analista | F=Descrição |
 *    G=Chat ID (NOVA). Canal e Chat ID agora são preenchidos nos eventos de
 *    atendimento/webhook quando o dado existe (PROTOCOLOS N/P ou payload do Jivo);
 *  - leituras ajustadas: órfãos do webhook (EV_WEBHOOK), limites do Já Volto / N2 e
 *    último evento de status do almoço (EV_AUSENCIAS).
 *
 *  * 1_3_12 — Tarefas da Coordenação + anexos no Informar Ausência:
 *  - ✅ Tarefas (só Nível 3): Google Tasks (lista padrão) + aba TAREFAS; cada um vê
 *    só as próprias; cliente vem do DICIONARIO da planilha de chamados ("Cliente");
 *    requer o serviço avançado "Tasks" (Editor > Serviços) e rodar testarTarefasCoordenacao;
 *  - Informar Ausência aceita anexos (PDF/JPG/PNG, até 10 MB no total) — só no e-mail;
 *  - e-mail da Coordenação traz o e-mail do analista no corpo (pra pôr em cópia).
 *
 *  * 1_3_10 — Webhook sem duplicata / Agenda com fim / Troca de almoço:
 *  - chat_accepted / chat_finished repetidos (mesmo chat_id) são ignorados
 *    (WEBHOOK_DUPLICADO_IGNORADO); WEBHOOK_LOG mantido;
 *  - Informar Ausência: início + fim (opcional) + "dia inteiro" (09h–18h, sáb/dom
 *    -> segunda); o fim é só informativo (retorno sempre pelo "Já Voltei");
 *    lembrete 30 min antes; AGENDA ganhou J=Fim, K=Tipo, L=Dia inteiro;
 *  - Troca de almoço: hoje (até 1h antes do almoço vigente; Coordenação sem
 *    bloqueio) ou agendada; padrão em EQUIPE M/N; rotina diária às 6h;
 *  - relógio do almoço também processa a Agenda e não roda sáb/dom;
 *  - CORRIGIDO: marca SEM_PREVISAO (EQUIPE J) agora é limpa no retorno.
 * *
 * 1_2_12 — Ausências (Já Volto / Ausente N2 / Ausência Longa):
 *  - quem já está AUSENTE (com ou sem prazo) não inicia Já Volto nem N2;
 *  - "Já Voltei" vale pra qualquer ausência; webObterMinhaAusencia agora
 *    sempre informa { ausente, minutosRestantes, tipo } (o Widget decide
 *    Já Volto x Já Voltei pelo status escrito na EQUIPE);
 *  - Ausente N2: almoço do analista não conta nas 2h30; pré-checagem
 *    webObterAvisoAusenteN2 alimenta a caixa de confirmação;
 *  - trocas de status por outros caminhos (Definir Ativo/Ausente, edição na
 *    planilha, almoço) limpam prazos velhos das Colunas G/H;
 *  - relógio do almoço não devolve pra ATIVO quem tem prazo próprio (G/H).
 *************************************************/

const CONFIG = {
  ABA_EQUIPE: 'EQUIPE',
  ABA_FILA: 'FILA',
  ABA_PROTOCOLOS: 'PROTOCOLOS',
  // REMOVIDO (1.3.15): ABA_EVENTOS — os eventos agora vão para as abas EV_* (ver ABAS_EVENTOS).
  ABA_USUARIOS: 'USUARIOS',
  ABA_CANAIS: 'CANAIS', // NOVO: aba de mapeamento widget_id -> nome do canal (webhook chat_accepted/chat_finished)

  PROTOCOLO_INICIAL: 16410
};

// NOVO (1.4.9): prefixo do protocolo por canal. O cliente vê só a inicial do canal.
// O contador (CONFIG!B2) continua só com o número; o prefixo entra na hora de gravar.
const PREFIXO_PROTOCOLO_JIVO = 'J';
const PREFIXO_PROTOCOLO_EMAIL = 'E'; // reservado para o painel de e-mails (sequência própria)

// NOVO (1.4.9): PROTOCOLOS Coluna S — quem ACEITOU o chat (aceite pelo Jivo ou Chat Aceito
// manual). Não muda com Transferência nem Retorno. É o que alimenta o 📜 Últimos.
const COL_PROT_ACEITO_POR = 19;

// NOVO (1.4.9): opções do 🚶 Já Volto, em minutos.
const JA_VOLTO_OPCOES_MIN = [5, 10, 20, 30];

// NOVO: marca "ausência sem previsão de retorno" (Coluna J da EQUIPE)
const COL_AUSENCIA_SEM_PREVISAO = 10;
const MARCA_AUSENCIA_SEM_PREVISAO = 'SEM_PREVISAO';

// NOVO (1.3.8): crédito de rodada — EQUIPE Coluna L. Quantas passagens do relógio
// o analista ainda deve ser saltado por ter atendido FORA da vez dele.
const COL_CREDITOS_RODADA = 12;
// NOVO (1.3.8): PROTOCOLOS Coluna R — nome de quem ganhou crédito neste aceite
// (permite estornar o crédito nos tópicos que não contam protocolo ou no Retorno).
const COL_PROT_CREDITO = 18;

// NOVO (1.3.8): agenda de ausências (aba AGENDA)
const ABA_AGENDA = 'AGENDA';
const AGENDA_LEMBRETE_MIN = 30;        // ALTERADO (1.3.10): lembrete pop-up 30 min antes do início
const AGENDA_DURACAO_EVENTO_MIN = 30;  // duração visual do evento na agenda
const AGENDA_HISTORICO_DIAS = 7;       // quantos dias de histórico o painel mostra
const PROP_AGENDA_CACHE = 'AGENDA_ATIVAS';
// NOVO (1.3.10): expediente, almoço padrão e colunas novas da AGENDA
const HORA_ABERTURA_MIN = 9 * 60;              // 09:00 — abertura do expediente (seg–sex)
const HORA_FECHAMENTO_MIN = 18 * 60;           // 18:00 — fechamento do expediente
const COL_ALMOCO_PADRAO_INI = 13;              // EQUIPE Coluna M — almoço padrão (início)
const COL_ALMOCO_PADRAO_FIM = 14;              // EQUIPE Coluna N — almoço padrão (fim)
const TROCA_ALMOCO_ANTECEDENCIA_MIN = 60;      // troca p/ hoje: até 1h antes do almoço atual
const AUSENCIA_TOLERANCIA_IMEDIATA_MIN = 30;   // início até 30 min atrás = ausenta agora
// AGENDA: J=Fim | K=Tipo (AUSENCIA / TROCA_ALMOCO; vazio = AUSENCIA) | L=Dia inteiro (SIM)
const AGENDA_COLUNAS = 12;
const TIPO_AUSENCIA = 'AUSENCIA';
const TIPO_TROCA_ALMOCO = 'TROCA_ALMOCO';
// Eventos que mudam o status do analista (usados pra saber se a ausência atual é do almoço)
const TIPOS_EVENTO_STATUS = ['ALMOCO_INICIO_AUTO', 'ALMOCO_FIM_AUTO', 'ALMOCO_RETORNO_DIARIO', 'ALMOCO_RETORNO_TROCA',
  'STATUS_ANALISTA_ALTERADO', 'AUSENCIA_TEMPORARIA_INICIADA', 'AUSENCIA_N2_INICIADA', 'AUSENCIA_LONGA_INICIADA',
  'AUSENCIA_SEM_PREVISAO_INICIADA', 'AUSENCIA_TEMPORARIA_RETORNO_MANUAL', 'AUSENCIA_RETORNO_MANUAL',
  'AUSENCIA_LONGA_AUTO_RETORNO', 'AUSENCIA_TEMPORARIA_AUTO_RETORNO'];

/*************************************************
 * 0. 🗂️ EVENTOS FRAGMENTADOS POR TIPO (1.3.15)
 *************************************************/
// Cada evento vai para a aba da sua categoria. A decisão é feita SÓ aqui:
//  1) se o tipo está em "tipos" de alguma regra, vai pra aquela aba;
//  2) senão, se começa com algum dos "prefixos", vai pra aquela aba;
//  3) senão, cai em EV_SISTEMA (nunca se perde um evento por falta de mapeamento).
// Pra mandar um tipo novo pra outra aba, basta incluí-lo em "tipos" da regra certa.
// IMPORTANTE: todos os tipos de TIPOS_EVENTO_STATUS precisam cair em EV_AUSENCIAS
// (é de lá que mapaUltimoEventoStatus lê) — já cobertos pelos prefixos ALMOCO_/AUSENCIA_.
const ABAS_EVENTOS = {
  ATENDIMENTOS: 'EV_ATENDIMENTOS',
  FILA: 'EV_FILA',
  AUSENCIAS: 'EV_AUSENCIAS',
  WEBHOOK: 'EV_WEBHOOK',
  SISTEMA: 'EV_SISTEMA'
};

const REGRAS_ABAS_EVENTOS = [
  {
    aba: ABAS_EVENTOS.WEBHOOK,
    tipos: [],
    prefixos: ['WEBHOOK_']
  },
  {
    aba: ABAS_EVENTOS.AUSENCIAS,
    tipos: ['STATUS_ANALISTA_ALTERADO', 'ROTINA_DIARIA_ALMOCO'],
    prefixos: ['AUSENCIA_', 'ALMOCO_', 'TROCA_ALMOCO_']
  },
  {
    aba: ABAS_EVENTOS.FILA,
    tipos: ['ANALISTA_PULADO', 'ANALISTA_COLOCADO_COMO_PROXIMO', 'ENTROU_FILA_MANUAL', 'PROXIMO_N2_ALTERADO'],
    prefixos: ['FILA_', 'RODADA_', 'CREDITO_RODADA_', 'CREDITOS_RODADA_', 'VEZ_']
  },
  {
    aba: ABAS_EVENTOS.ATENDIMENTOS,
    tipos: ['ENVIADO_PARA_FILA', 'RETORNO_REGISTRADO', 'TRANSFERENCIA', 'STATUS_REVERTIDO',
      'TOPICO_IGNORAR_NAO_APLICADO', 'TAG_IGNORAR_NAO_APLICADA', 'DEBUG_ADMIN', 'DEBUG_TAG_CHAT_FINISHED',
      'ENCERRADO_PAUSADO_PRIMEIRO_CONTATO'], // NOVO (1.4.9)
    prefixos: ['CHAT_', 'ATENDIMENTO_', 'PROTOCOLO_']
  },
  {
    aba: ABAS_EVENTOS.SISTEMA,
    tipos: ['MENSAGEM_COORDENACAO', 'LIMPEZA_DIARIA'],
    prefixos: ['SENHA_', 'TAREFA_']
  }
];

// A=Data/Hora | B=Canal | C=Protocolo | D=Tipo | E=Analista | F=Descrição | G=Chat ID
// (A–F na mesma posição da antiga EVENTOS: as leituras por índice continuam valendo.)
const CABECALHO_EVENTOS = ['Data/Hora', 'Canal', 'Protocolo', 'Tipo', 'Analista', 'Descrição', 'Chat ID'];
const COLUNAS_EVENTOS = CABECALHO_EVENTOS.length;

// Cache das abas dentro da MESMA execução (evita getSheetByName a cada evento).
const CACHE_ABAS_EVENTOS = {};

/** Nome da aba de destino de um tipo de evento (regras acima). */
function obterAbaDestinoEvento(tipo) {
  const t = String(tipo || '').toUpperCase().trim();
  for (let i = 0; i < REGRAS_ABAS_EVENTOS.length; i++) {
    if (REGRAS_ABAS_EVENTOS[i].tipos.indexOf(t) !== -1) return REGRAS_ABAS_EVENTOS[i].aba;
  }
  for (let i = 0; i < REGRAS_ABAS_EVENTOS.length; i++) {
    if (REGRAS_ABAS_EVENTOS[i].prefixos.some(p => t.indexOf(p) === 0)) return REGRAS_ABAS_EVENTOS[i].aba;
  }
  return ABAS_EVENTOS.SISTEMA;
}

/**
 * Devolve a aba de eventos, criando se ainda não existir (cabeçalho, linha 1 congelada,
 * formatos e só as 7 colunas usadas — as 19 sobrando são excluídas pra não gastar o
 * limite de células da planilha). Se duas execuções tentarem criar ao mesmo tempo, a
 * segunda só reaproveita a aba que a primeira criou.
 */
function obterAbaEventos(nomeAba) {
  if (CACHE_ABAS_EVENTOS[nomeAba]) return CACHE_ABAS_EVENTOS[nomeAba];

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(nomeAba);
  if (!sheet) {
    try {
      sheet = ss.insertSheet(nomeAba);
      sheet.getRange(1, 1, 1, COLUNAS_EVENTOS).setValues([CABECALHO_EVENTOS]).setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.getRange('A:A').setNumberFormat('dd/MM/yyyy HH:mm:ss');
      sheet.getRange('G:G').setNumberFormat('@'); // Chat ID como texto
      const sobrando = sheet.getMaxColumns() - COLUNAS_EVENTOS;
      if (sobrando > 0) sheet.deleteColumns(COLUNAS_EVENTOS + 1, sobrando);
    } catch (e) {
      sheet = ss.getSheetByName(nomeAba);
      if (!sheet) throw e;
    }
  }
  CACHE_ABAS_EVENTOS[nomeAba] = sheet;
  return sheet;
}

/** Aba de eventos só para LEITURA (não cria): null se ainda não existir. */
function obterAbaEventosLeitura(nomeAba) {
  return CACHE_ABAS_EVENTOS[nomeAba] || SpreadsheetApp.getActiveSpreadsheet().getSheetByName(nomeAba);
}

/** Canal (Coluna N) e Chat ID (Coluna P) de uma linha da PROTOCOLOS já lida (getValues). */
function canalEChatDaLinhaProtocolo(linhaDados) {
  if (!linhaDados) return { canal: '', chatId: '' };
  return { canal: String(linhaDados[13] || ''), chatId: String(linhaDados[15] || '') };
}

/** Canal (N) e Chat ID (P) lendo direto uma linha da PROTOCOLOS (uma leitura só). */
function lerCanalEChatProtocolo(sheet, linha) {
  try {
    if (!sheet || sheet.getMaxColumns() < 16) return { canal: '', chatId: '' };
    const v = sheet.getRange(linha, 14, 1, 3).getValues()[0]; // N, O, P
    return { canal: String(v[0] || ''), chatId: String(v[2] || '') };
  } catch (e) {
    return { canal: '', chatId: '' };
  }
}

/**
 * Rodar UMA vez pelo editor (opcional): cria já todas as abas EV_* em vez de esperar o
 * primeiro evento de cada tipo. Não mexe em abas que já existem.
 */
function criarAbasEventos() {
  Object.keys(ABAS_EVENTOS).forEach(k => obterAbaEventos(ABAS_EVENTOS[k]));
  Logger.log('✅ Abas de eventos prontas: ' + Object.keys(ABAS_EVENTOS).map(k => ABAS_EVENTOS[k]).join(', '));
}

/*************************************************
 * 10. 🔑 LOGIN LEVE (identificação por Nome + PIN, sem OAuth do Google)
 *************************************************/
// Aba USUARIOS: A=Nome | B=PIN (texto, ex: "1234") | C=Nível (1, 2 ou 3) | D=E-mail (opcional)
// Nível 1 = Analista. Nível 2 = Analista + Ausente N2. Nível 3 = Coordenação
// (painel administrativo completo). Isso NÃO é segurança de verdade — é
// identificação leve para conveniência (auto-preencher quem está agindo) e
// para mostrar/esconder funções por perfil. Não substitui controle de acesso real.
// A Coluna D (E-mail) é usada só como Reply-To no "Falar com Coordenação"
// (Seção 13) — se vazia, o e-mail sai sem Reply-To.

/**
 * Ponte web: valida nome + PIN contra a aba USUARIOS e retorna a identidade
 * (nome exato cadastrado + nível). O front guarda isso no localStorage do
 * navegador — não existe sessão de verdade no servidor.
 */
function webLogin(nome, pin) {
  if (!nome || !pin) throw new Error("Informe nome e senha.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_USUARIOS);
  if (!sheet) throw new Error("Aba USUARIOS não encontrada. Peça pra Coordenação configurar.");

  const dados = sheet.getDataRange().getValues();
  const nomeAlvo = String(nome).trim().toLowerCase();

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim().toLowerCase() === nomeAlvo) {
      const pinCorreto = String(dados[i][1]).trim();
      if (pinCorreto !== String(pin).trim()) {
        throw new Error("Senha incorreta.");
      }
      const nivel = Number(dados[i][2]) || 1;
      return { nome: dados[i][0], nivel: nivel };
    }
  }
  throw new Error("Usuário não encontrado. Confira a grafia do nome ou fale com a Coordenação.");
}

/**
 * NOVO: o próprio analista troca a senha — precisa saber a senha ATUAL (não é
 * uma recuperação de verdade, é uma troca; como o login já fica salvo no
 * navegador via localStorage, quem realmente esquece o PIN não vai ter como
 * usar isso e deve procurar a Coordenação, que usa webResetarSenhaCoordenacao).
 */
function webTrocarSenha(nome, pinAtual, novoPin) {
  if (!nome || !pinAtual || !novoPin) throw new Error("Preencha nome, senha atual e nova senha.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_USUARIOS);
  if (!sheet) throw new Error("Aba USUARIOS não encontrada.");

  const dados = sheet.getDataRange().getValues();
  const nomeAlvo = String(nome).trim().toLowerCase();

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim().toLowerCase() === nomeAlvo) {
      const pinCorreto = String(dados[i][1]).trim();
      if (pinCorreto !== String(pinAtual).trim()) {
        throw new Error("Senha atual incorreta.");
      }
      sheet.getRange(i + 1, 2).setValue(String(novoPin).trim());
      if (typeof registrarEvento === 'function') {
        registrarEvento('', '', 'SENHA_ALTERADA', dados[i][0], 'Senha alterada pelo próprio usuário.');
      }
      return { sucesso: true };
    }
  }
  throw new Error("Usuário não encontrado.");
}

/**
 * NOVO: Coordenação (Nível 2) redefine a senha de qualquer analista direto,
 * sem precisar saber a senha antiga — pro caso de esquecimento de verdade.
 * (Igual ao resto do sistema, é identificação leve — o front só deve exibir
 * essa opção pra quem está logado como Nível 2.)
 */
function webResetarSenhaCoordenacao(nomeAlvo, novoPin) {
  if (!nomeAlvo || !novoPin) throw new Error("Informe o analista e a nova senha.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_USUARIOS);
  if (!sheet) throw new Error("Aba USUARIOS não encontrada.");

  const dados = sheet.getDataRange().getValues();
  const alvo = String(nomeAlvo).trim().toLowerCase();

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][0]).trim().toLowerCase() === alvo) {
      sheet.getRange(i + 1, 2).setValue(String(novoPin).trim());
      if (typeof registrarEvento === 'function') {
        registrarEvento('', '', 'SENHA_RESETADA_COORDENACAO', dados[i][0], 'Senha redefinida pela Coordenação.');
      }
      return { sucesso: true };
    }
  }
  throw new Error("Usuário não encontrado.");
}

/*************************************************
 * 13. ✉️ FALAR COM COORDENAÇÃO
 *************************************************/
// Manda um e-mail direto pra Coordenação (o Apps Script já roda "como o dono
// do projeto", então não precisa de nenhuma configuração extra de servidor).
// O destino fica em CONFIG!C14 — editável na planilha, sem precisar mexer em
// código. Se o analista tiver e-mail cadastrado em USUARIOS (Coluna D), ele
// entra como Reply-To: respondendo direto do Gmail, cai na caixa dele.
// ALTERADO (1.3.12): 4º parâmetro opcional "anexosBlobs" (lista de Blob, montada no
// servidor por montarAnexosEmail — o painel nunca manda Blob direto). O corpo agora traz
// o e-mail do analista em linha própria, pra facilitar colocar em cópia ao reencaminhar.
// ALTERADO (1.4.7): 5º parâmetro opcional "extras" (só chamadas do servidor):
//   { protocolo: '16050, 16072', rotuloMensagem: 'Resumo da análise' } — o protocolo vai no
//   assunto, numa linha própria do corpo e na Coluna C do evento MENSAGEM_COORDENACAO.
function webEnviarMensagemCoordenacao(nome, motivo, mensagem, anexosBlobs, extras) {
  if (!nome || !motivo) throw new Error("Informe seu nome e o motivo.");
  extras = (extras && typeof extras === 'object') ? extras : {};
  const protocoloExtra = String(extras.protocolo || '').trim();
  const rotuloMensagem = String(extras.rotuloMensagem || '').trim() || 'Mensagem';
  if (motivo === 'Outros' && (!mensagem || !String(mensagem).trim())) {
    throw new Error("Quando o motivo é \"Outros\", a mensagem é obrigatória.");
  }

  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CONFIG');
  const emailDestino = String(configSheet.getRange('C14').getValue() || '').trim() || 'coordenacao@exemplo.com';

  // Busca o e-mail do analista (Coluna D de USUARIOS) pra usar como Reply-To.
  let emailAnalista = '';
  const usuariosSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_USUARIOS);
  if (usuariosSheet) {
    const dadosUsuarios = usuariosSheet.getDataRange().getValues();
    const nomeAlvo = String(nome).trim().toLowerCase();
    for (let i = 1; i < dadosUsuarios.length; i++) {
      if (String(dadosUsuarios[i][0]).trim().toLowerCase() === nomeAlvo) {
        emailAnalista = String(dadosUsuarios[i][3] || '').trim(); // Coluna D
        break;
      }
    }
  }

  // Só aceita Blob de verdade (o que vem do painel pela ponte nunca é Blob).
  const anexos = Array.isArray(anexosBlobs)
    ? anexosBlobs.filter(b => b && typeof b.getBytes === 'function')
    : [];

  const corpo = 'Analista: ' + nome + '\n' +
                'E-mail do analista: ' + (emailAnalista || '(não cadastrado na USUARIOS)') + '\n' +
                'Motivo: ' + motivo + '\n' +
                (protocoloExtra ? 'Protocolo(s): ' + protocoloExtra + '\n' : '') + '\n' +
                rotuloMensagem + ':\n' + (mensagem ? String(mensagem).trim() : '(sem mensagem adicional)') +
                (anexos.length ? '\n\nAnexos (' + anexos.length + '): ' + anexos.map(b => b.getName()).join(', ') : '');

  const opcoesEmail = {};
  if (emailAnalista) {
    opcoesEmail.replyTo = emailAnalista;
  }
  if (anexos.length) {
    opcoesEmail.attachments = anexos;
  }

  MailApp.sendEmail(emailDestino, '💬 Lista Ai — ' + motivo + ' (' + nome + ')' + (protocoloExtra ? ' — Prot. ' + protocoloExtra : ''), corpo, opcoesEmail);

  if (typeof registrarEvento === 'function') {
    registrarEvento('', protocoloExtra, 'MENSAGEM_COORDENACAO', nome, 'Motivo: ' + motivo + ' | ' + rotuloMensagem + ': ' + (mensagem ? String(mensagem).trim() : '(sem mensagem adicional)') +
      (anexos.length ? ' | Anexos: ' + anexos.map(b => b.getName()).join(', ') : ''));
  }

  return { sucesso: true };
}


/*************************************************
 * MENU PRINCIPAL
 *************************************************/

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎫 Controle de Atendimento')
    .addItem('🟢 Chat Aceito', 'menuChatAceito')
    .addItem('🎫 Assumir Atendimento', 'menuAssumiAtendimento')
    .addItem('⏳ Enviar para Fila (Standby)', 'menuEnviarParaFila')
    .addItem('⏭️ Pular Próximo', 'pularProximo')
    .addItem('🔄 Retorno Atendimento', 'menuRegistrarRetorno')
    .addItem('🔀 Transferir Atendimento', 'menuTransferirAtendimento')
    //.addItem('↩️ Voltar à Fila', 'menuVoltarAFila')
    .addSeparator()
    .addSubMenu(
      SpreadsheetApp.getUi().createMenu('👑 Gestão da Equipe (Admin)')
        .addItem('⏮️ Reverter / Corrigir Status', 'menuReverterStatus')
        .addItem('🩹 Finalizar Atendimento Órfão (Webhook)', 'menuFinalizarAtendimentoOrfao')
        .addItem('🔢 Redefinir Fila em Ordem Numérica', 'menuRedefinirFilaNumerica')
        .addItem('🟢 Definir Analista como ATIVO', 'menuAdminAtivar')
        .addItem('🔴 Definir Analista como AUSENTE', 'menuAdminAusente')
        .addItem('⏰ Configurar Relógio de Ausências (Ativar Almoço)', 'criarGatilhoRelogio')
        .addItem('🚫 Desativar Relógio de Ausências', 'menuDesativarGatilhoRelogio')
        .addItem('🕚 Ativar Janela Automática (liga/desliga sozinho)', 'configurarJanelaAutomaticaAlmoco')
        .addItem('🚫 Desativar Janela Automática', 'desativarJanelaAutomaticaAlmoco')
    )
    .addSeparator()
    .addItem('🔄 Atualizar Fila', 'atualizarFila')
    .addToUi();
}

/**
 * Acionado pelo menu: redefine a fila em ordem numérica manualmente.
 */
function menuRedefinirFilaNumerica() {
  atualizarFila(true);
  SpreadsheetApp.getUi().alert('✅ Fila redefinida em ordem numérica, começando pelo próximo atual.');
}

/**
 * Função de chamada direta pelo Menu Admin para desativar com aviso na tela
 */
function menuDesativarGatilhoRelogio() {
  desativarGatilhoRelogio(false);
}


/*************************************************
 * GATILHO AUTOMÁTICO DE EDIÇÃO (ONEDIT)
 *************************************************/

function onEdit(e) {
  if (!e) return;
  const range = e.range;
  const sheet = range.getSheet();

  if (sheet.getName() === CONFIG.ABA_EQUIPE && range.getColumn() === 3) {
    // NOVO: troca MANUAL de status na planilha (ATIVO/AUSENTE digitado na Coluna C)
    // vale como "decisão de gente": derruba qualquer prazo de auto-serviço que
    // tenha ficado gravado nas Colunas G/H dessas linhas. Sem isso, um horário
    // velho ficava lá e desfazia, no polling seguinte, a próxima ausência da
    // pessoa. (Gravações feitas pelo próprio script não disparam o onEdit.)
    const primeiraLinha = Math.max(range.getRow(), 2);
    const ultimaLinha = range.getLastRow();
    if (ultimaLinha >= primeiraLinha) {
      // NOVO (1.4.7): fecha o Ausente N2 em andamento dessas linhas (desconta só o tempo usado).
      try {
        sheet.getRange(primeiraLinha, 2, ultimaLinha - primeiraLinha + 1, 1).getValues()
          .forEach(l => { if (l[0]) finalizarUsoN2(l[0], 'status alterado na planilha'); });
      } catch (erroN2) {}
      sheet.getRange(primeiraLinha, 7, ultimaLinha - primeiraLinha + 1, 2).clearContent();
    }
    atualizarFila();
  }
}


/*************************************************
 * SELEÇÃO DE ANALISTAS
 *************************************************/

function obterListaAnalistas(ordenarPorFila = false) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const equipeSheet = ss.getSheetByName(CONFIG.ABA_EQUIPE);
  if (equipeSheet.getLastRow() < 2) return [];

  const dadosEquipe = equipeSheet.getRange(2, 1, equipeSheet.getLastRow() - 1, 3).getValues();
  const ativos = dadosEquipe
    .filter(linha => String(linha[2]).toUpperCase() === 'ATIVO')
    .map(linha => linha[1]);

  if (!ordenarPorFila) return ativos;

  const filaSheet = ss.getSheetByName(CONFIG.ABA_FILA);
  if (filaSheet.getLastRow() < 2) return ativos;

  const dadosFila = filaSheet.getRange(2, 1, filaSheet.getLastRow() - 1, 2).getValues().map(l => l[1]);

  const ordenados = dadosFila.filter(nome => ativos.includes(nome));
  ativos.forEach(nome => {
    if (!ordenados.includes(nome)) ordenados.push(nome);
  });

  return ordenados;
}


/*************************************************
 * 1. 🟢 CHAT ACEITO (LÓGICA PURA + INTERFACES)
 *************************************************/

/**
 * Lógica pura compartilhada (não usa getUi)
 */
function processarChatAceitoCore(analista) {
  if (!analista) throw new Error("Analista não informado.");

  // ALTERADO (1.3.8): gira a fila ANTES de gravar a linha, pra saber se este aceite
  // foi fora da vez (gera crédito de rodada — Coluna R da linha, usada no estorno).
  // Falha na fila nunca impede o registro do chat.
  try { sincronizarAlmocoAgora(true); } catch (e) {} // NOVO (1.4.13)
  let giro = { tipo: '', credito: false, proximo: null };
  try {
    giro = moverAnalistaParaFimDaFila(analista, { gerarCredito: true }) || giro;
  } catch (erroFila) {
    registrarEvento('', '', 'FILA_NAO_GIROU', analista, 'Erro ao girar a fila após Chat Aceito manual: ' + erroFila.message);
  }

  // Revertido: marcarInício volta a false. A Coluna B (Data) já é preenchida em
  // toda linha desde a criação, então o front vai ler dali para o horário início.
  const linhaNova = ['', new Date(), analista, 'Primeiro Contato', 'EM TRIAGEM', '', '', '', ''];
  // ALTERADO (1.4.9): a linha sempre vai até a Coluna S (quem aceitou — base do 📜 Últimos).
  while (linhaNova.length < COL_PROT_CREDITO - 1) linhaNova.push('');
  linhaNova.push(giro.credito ? analista : ''); // Coluna R: crédito gerado neste aceite
  linhaNova.push(analista);                      // Coluna S: quem aceitou (NOVO 1.4.9)
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS).appendRow(linhaNova);
  registrarEvento('', '', 'CHAT_ACEITO', analista, 'Chat aceito. Em triagem.' + (giro.credito ? ' Fora da vez: +1 crédito de rodada.' : ''));

  const proximo = giro.proximo || obterProximoAnalista() || 'Fila vazia';
  return { analista: analista, proximo: proximo };
}

/**
 * Acionado pelo Menu da Planilha
 */
function menuChatAceito() {
  const analistas = obterListaAnalistas(true);
  if (analistas.length === 0) {
    SpreadsheetApp.getUi().alert('⚠️ Nenhum analista ATIVO encontrado.');
    return;
  }
  abrirJanelaComOpcoes('Seleção do Analista - Chat Aceito', 'executarChatAceito', analistas);
}

function executarChatAceito(analista) {
  if (!analista) return;

  const resultado = processarChatAceitoCore(analista);
  const PERMITIR_ASSUMIR_DIRETO = false;

  let botaoAssumirHtml = '';
  if (PERMITIR_ASSUMIR_DIRETO) {
    botaoAssumirHtml = `
      <button class="btn-assumir" onclick="google.script.run.assumirAtendimentoComConfirmacao(); google.script.host.close();">
        ⚡ Assumir Chat Agora
      </button>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 12px; line-height: 1.4; color: #202124; }
          .info { background: #e8f0fe; padding: 12px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #1a73e8; }
          .btn-group { text-align: right; display: flex; gap: 8px; justify-content: flex-end; }
          button { padding: 8px 14px; cursor: pointer; border-radius: 4px; font-weight: bold; font-size: 13px; border: none; }
          .btn-ok { background: #dadce0; color: #3c4043; }
          .btn-ok:hover { background: #bdc1c6; }
          .btn-assumir { background: #1a73e8; color: white; }
          .btn-assumir:hover { background: #1557b0; }
        </style>
      </head>
      <body>
        <div class="info">
          ✅ <b>Chat registrado em TRIAGEM!</b><br><br>
          <b>Analista responsável:</b> ${resultado.analista}<br>
          <b>Próximo da fila:</b> ${resultado.proximo}
        </div>
        <div class="btn-group">
          <button class="btn-ok" onclick="google.script.host.close()">OK</button>
          ${botaoAssumirHtml}
        </div>
      </body>
    </html>`;

  SpreadsheetApp.getUi().showModalDialog(
    HtmlService.createHtmlOutput(html).setWidth(400).setHeight(190),
    'Notificação de Triagem'
  );
}

/**
 * Ponte chamada pelo Widget Web App - Chat Aceito
 */
function webChatAceitoParam(protocolo) {
  if (!protocolo) return { sucesso: false, msg: 'Protocolo não informado.' };
  return processarChatAceitoCore(protocolo);
}

/*************************************************
 * 2. ⏳ ENVIAR PARA FILA (STANDBY) - LÓGICA + WEB
 *************************************************/
// APOSENTADA: não é mais chamada por nenhum botão do Widget (o botão "Fila
// (Standby)" foi removido). O envio pra Fila agora acontece via
// webPausarAtendimento com motivo "Fila". Mantida no arquivo só por
// referência/histórico -- candidata a remoção completa numa limpeza futura.
function processarEnviarParaFilaCore(analista) {
  if (!analista) throw new Error("Analista não informado.");

  registrarProtocolo('', analista, 'Primeiro Contato', 'FILA', false);
  registrarEvento('', '', 'ENVIADO_PARA_FILA', analista, 'Atendimento em Standby/Fila.');
  moverAnalistaParaFimDaFila(analista);

  const proximo = obterProximoAnalista() || 'Fila vazia';
  return { analista: analista, proximo: proximo };
}

function menuEnviarParaFila() {
  const analistas = obterListaAnalistas(false);
  if (analistas.length === 0) {
    SpreadsheetApp.getUi().alert('⚠️ Nenhum analista ATIVO encontrado.');
    return;
  }
  abrirJanelaComOpcoes('Seleção do Analista - Standby', 'executarEnviarParaFila', analistas);
}

function executarEnviarParaFila(analista) {
  if (!analista) return;
  const res = processarEnviarParaFilaCore(analista);
  SpreadsheetApp.getUi().alert(
    '⏳ Atendimento registrado na FILA (Standby) para ' + res.analista + '\n\n' +
    'Próximo da Fila: ' + res.proximo
  );
}

function webEnviarParaFilaParam(analistaEscolhido) {
  if (!analistaEscolhido) throw new Error("Analista não informado.");

  if (typeof processarEnviarParaFilaCore === 'function') {
    processarEnviarParaFilaCore(analistaEscolhido);
  } else {
    registrarProtocolo('', analistaEscolhido, 'Primeiro Contato', 'FILA', false);
    registrarEvento('', '', 'ENVIADO_PARA_FILA', analistaEscolhido, 'Atendimento enviado para a Fila.');
    moverAnalistaParaFimDaFila(analistaEscolhido);
  }

  const proximo = obterProximoAnalista() || 'Fila vazia';
  return { analista: analistaEscolhido, proximo: proximo };
}


/*************************************************
 * 3. 🎫 ASSUMIR ATENDIMENTO - LÓGICA + WEB (Otimizado)
 *************************************************/
function menuAssumiAtendimento() {
  const analistas = obterAnalistasEmTriagem();
  if (analistas.length === 0) {
    SpreadsheetApp.getUi().alert('ℹ️ Nenhum analista com atendimentos em EM TRIAGEM ou FILA no momento.');
    return;
  }
  abrirJanelaComOpcoes('Seleção do Analista - Assumir Atendimento', 'verificarPendenciasAnalista', analistas);
}

function obterAnalistasEmTriagem() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const analistasSet = new Set();

  for (let i = 0; i < dados.length; i++) {
    const analista = String(dados[i][2]).trim();
    const status = String(dados[i][4]).toUpperCase().trim();
    if ((status === 'EM TRIAGEM' || status === 'FILA' || status === 'PAUSADO') && analista !== '') {
      analistasSet.add(analista);
    }
  }
  return Array.from(analistasSet);
}

// Retorna as pendências de um analista (aceita EM TRIAGEM ou FILA)
function webBuscarPendenciasAnalista(analista) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ABA_PROTOCOLOS || 'PROTOCOLOS');
  if (!sheet) return [];

  const dados = sheet.getDataRange().getValues();
  let pendencias = [];

  for (let i = 1; i < dados.length; i++) {
    const linha = dados[i];
    const protocolo = linha[0];
    const analistaLinha = linha[2];
    const statusLinha = String(linha[4]).trim().toUpperCase();

    if (analistaLinha === analista && (statusLinha === 'EM TRIAGEM' || statusLinha === 'FILA' || statusLinha === 'PAUSADO')) {
      pendencias.push({
        linha: i + 1,
        protocolo: protocolo,
        status: statusLinha
      });
    }
  }

  return pendencias;
}

function verificarPendenciasAnalista(analista) {
  if (!analista) return;
  const pendencias = webBuscarPendenciasAnalista(analista);

  if (pendencias.length === 0) {
    SpreadsheetApp.getUi().alert('⚠️ Nenhum atendimento em TRIAGEM ou FILA encontrado para ' + analista);
    return;
  }

  if (pendencias.length === 1) {
    executarConfirmacaoAssumir(pendencias[0].linha, analista);
    return;
  }

  let opcoesHtml = pendencias.map(p =>
    `<option value="${p.linha}">Linha ${p.linha} | Status: ${p.status} (${p.dataHora})</option>`
  ).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 12px; }
          select { width: 100%; padding: 8px; margin: 10px 0 20px 0; }
          button { padding: 8px 16px; margin-left: 5px; cursor: pointer; }
          .btn-ok { background: #0b57d0; color: white; border: none; }
        </style>
      </head>
      <body>
        <label>Escolha o atendimento a assumir:</label>
        <select id="linhaOpcao">${opcoesHtml}</select>
        <div style="text-align:right;">
          <button onclick="google.script.host.close()">Cancelar</button>
          <button class="btn-ok" onclick="confirmar()">Assumir</button>
        </div>
        <script>
          function confirmar() {
            var linha = document.getElementById('linhaOpcao').value;
            google.script.run.withSuccessHandler(() => google.script.host.close())
            .executarConfirmacaoAssumir(linha, "${analista}");
          }
        </script>
      </body>
    </html>`;

  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(360).setHeight(180), 'Atendimentos Pendentes - ' + analista);
}

/**
 * Motor central do "Assumir": reaproveitado tanto pra assumir de verdade
 * (EM TRIAGEM/FILA — gera protocolo novo, zera Hora Início) quanto pra
 * retomar um PAUSADO (mantém o protocolo que já existe e soma o tempo parado
 * numa coluna separada, em vez de gerar tudo do zero). NÃO mexe na fila em
 * nenhum dos dois casos.
 */
function assumirOuRetomarLinha(linha, analista) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  const statusAtual = String(sheet.getRange(linha, 5).getValue()).toUpperCase().trim();
  const origemEv = lerCanalEChatProtocolo(sheet, linha); // NOVO (1.3.15): canal / chat_id do evento

  if (statusAtual === 'PAUSADO') {
    const protocoloExistente = sheet.getRange(linha, 1).getValue();
    const pausadoDesde = sheet.getRange(linha, 12).getValue();       // Coluna L
    const acumuladoAnterior = Number(sheet.getRange(linha, 13).getValue()) || 0; // Coluna M

    let novoAcumulado = acumuladoAnterior;
    if (pausadoDesde instanceof Date) {
      novoAcumulado += Math.floor((new Date() - pausadoDesde) / 1000);
    }

    sheet.getRange(linha, 5).setValue('EM ATENDIMENTO');
    sheet.getRange(linha, 12).clearContent();           // Pausado Desde
    sheet.getRange(linha, 13).setValue(novoAcumulado);  // Pausas Acumuladas

    if (typeof registrarEvento === 'function') {
      registrarEvento(origemEv.canal, protocoloExistente, 'ATENDIMENTO_RETOMADO', analista, 'Retomou o atendimento pausado na linha ' + linha + '.', origemEv.chatId);
    }

    return { protocolo: protocoloExistente, analista: analista, retomado: true };
  }

  // Fluxo padrão — EM TRIAGEM ou FILA: gera protocolo novo, marca Hora Início agora.
  const protocolo = gerarProtocolo();
  sheet.getRange(linha, 1).setValue(protocolo);
  sheet.getRange(linha, 5).setValue('EM ATENDIMENTO');
  sheet.getRange(linha, 6).setValue(new Date());

  if (typeof registrarEvento === 'function') {
    registrarEvento(origemEv.canal, protocolo, 'ATENDIMENTO_ASSUMIDO', analista, 'Atendimento assumido na linha ' + linha, origemEv.chatId);
  }

  return { protocolo: protocolo, analista: analista, retomado: false };
}

function executarConfirmacaoAssumir(linha, analista) {
  const resultado = assumirOuRetomarLinha(linha, analista);

  SpreadsheetApp.getUi().alert(
    (resultado.retomado ? '▶️ Atendimento Retomado!' : '✅ Atendimento Assumido!') + '\n\n' +
    'Analista: ' + analista + '\n' +
    'Protocolo: ' + resultado.protocolo
  );

  return resultado;
}

// Ponte Web para efetivar a assunção (ou retomada de pausa) direto da linha
// ALTERADO (1.4.9): 3º parâmetro opcional "quemAcionou"; confere o status antes de agir e
// registra ATENDIMENTO_RETOMADO_COORDENACAO quando a Coordenação retoma o pausado de outro.
function webConfirmarAssumirParam(linha, analista, quemAcionou) {
  if (!linha || !analista) throw new Error("Dados incompletos.");
  return executarComTrava(() => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
    const num = Number(linha);
    const v = sheet.getRange(num, 1, 1, 5).getValues()[0]; // A..E
    const status = String(v[4]).toUpperCase().trim();
    if (['EM TRIAGEM', 'FILA', 'PAUSADO'].indexOf(status) === -1 || normalizarNome(v[2]) !== normalizarNome(analista)) {
      throw new Error('Esse atendimento mudou desde que a lista foi aberta (agora: ' + (status || 'vazio') + '). Atualize e tente de novo.');
    }
    const res = assumirOuRetomarLinha(num, v[2]);
    if (res.retomado && quemAcionou && !ehAcaoPropria(v[2], quemAcionou)) {
      const origemEv = lerCanalEChatProtocolo(sheet, num);
      registrarEvento(origemEv.canal, res.protocolo, 'ATENDIMENTO_RETOMADO_COORDENACAO', v[2],
        'Retomado pela Coordenação (' + quemAcionou + ') pelo Assumir / Retomar.', origemEv.chatId);
    }
    return res;
  });
}


/*************************************************
 * 4. 🔄 REGISTRAR RETORNO (LÓGICA + WEB)
 *************************************************/

function menuRegistrarRetorno() {
  const analistas = obterListaAnalistas(false);
  if (analistas.length === 0) {
    SpreadsheetApp.getUi().alert('⚠️ Nenhum analista ativo encontrado.');
    return;
  }
  abrirJanelaComOpcoes('Quem vai transferir o retorno?', 'passo2RetornoOrigem', analistas);
}

function passo2RetornoOrigem(analistaOrigem) {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt(
    '🔄 Registrar Retorno',
    'Informe o NÚMERO DO PROTOCOLO ORIGINAL referente a este retorno:',
    ui.ButtonSet.OK_CANCEL
  );

  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const protocoloOriginal = resp.getResponseText().trim();

  if (!protocoloOriginal) {
    ui.alert('⚠️ É obrigatório informar o protocolo original para registrar o retorno.');
    return;
  }

  const analistas = obterListaAnalistas(false);

  let htmlScript = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 12px; }
          select { width: 100%; padding: 8px; margin: 10px 0 20px 0; }
          button { padding: 8px 16px; margin-left: 5px; cursor: pointer; }
          .btn-ok { background: #0b57d0; color: white; border: none; }
        </style>
      </head>
      <body>
        <label>Selecione o Analista RESPONSÁVEL por este retorno:</label>
        <select id="responsavel">${analistas.map(a => `<option value="${a}">${a}</option>`).join('')}</select>
        <div style="text-align:right;">
          <button onclick="google.script.host.close()">Cancelar</button>
          <button class="btn-ok" onclick="confirmar()">Encaminhar Retorno</button>
        </div>
        <script>
          function confirmar() {
            var r = document.getElementById('responsavel').value;
            google.script.run.withSuccessHandler(() => google.script.host.close())
            .executarRegistroRetornoCompleto("${analistaOrigem}", r, "${protocoloOriginal}");
          }
        </script>
      </body>
    </html>`;

  ui.showModalDialog(HtmlService.createHtmlOutput(htmlScript).setWidth(360).setHeight(170), 'Selecione o Responsável pelo Retorno');
}

/**
 * Motor central atualizado: Aceita retorno com ou sem triagem prévia
 */
// ALTERADO (1.3.19): "protocoloLinha" (opcional) = protocolo da linha a converter. Informado,
// o Retorno usa EXATAMENTE essa linha (antes pegava a linha ativa mais recente do analista, que
// podia ser outra). Vazio (menu do Sheets / Widget atual): segue a regra antiga.
// ALTERADO (1.4.6): "quemAcionou" (opcional) = quem clicou. Se for outra pessoa que não a
// Origem (qualquer nível pode registrar em nome de outro), o evento registra "acionado por".
function executarRegistroRetornoCompleto(origem, responsavel, protocoloOriginal, protocoloLinha, quemAcionou) {
  protocoloLinha = (protocoloLinha === null || protocoloLinha === undefined) ? '' : String(protocoloLinha).trim();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  const dados = sheet.getDataRange().getValues();
  let localizado = false;
  let origemEv = { canal: '', chatId: '' }; // NOVO (1.3.15): canal / chat_id do evento

  let protocoloConvertido = ''; // NOVO (1.4.9): protocolo de uma linha JÁ ENCERRADA que virou Retorno

  for (let i = dados.length - 1; i >= 1; i--) {
    // ALTERADO: aceita PAUSADO também -- desde que Fila virou um motivo de
    // Pausa (em vez de status próprio), uma linha ativa de verdade pode estar
    // em PAUSADO na hora do Retorno, e antes isso não era reconhecido, caindo
    // no fallback de criar uma linha nova por engano.
    // ALTERADO (1.4.9): com a linha escolhida (protocoloLinha), aceita também ENCERRADO
    // (o analista encerrou no Jivo antes de registrar o Retorno). Busca com ou sem o "J".
    const statusI = String(dados[i][4]).toUpperCase().trim();
    const statusAberto = statusI === 'EM TRIAGEM' || statusI === 'EM ATENDIMENTO' || statusI === 'PAUSADO';
    const encerradoValido = !!protocoloLinha && statusI === 'ENCERRADO' &&
      String(dados[i][0]).trim().toLowerCase() !== PROTOCOLO_IGNORADO_TEXTO;
    if (String(dados[i][2]).toLowerCase() === origem.toLowerCase() &&
        (!protocoloLinha || mesmoProtocolo(dados[i][0], protocoloLinha)) &&
        (statusAberto || encerradoValido)) {

      const linha = i + 1;
      origemEv = canalEChatDaLinhaProtocolo(dados[i]);
      sheet.getRange(linha, 1).setValue(protocoloOriginal);
      sheet.getRange(linha, 3).setValue(responsavel);
      sheet.getRange(linha, 4).setValue('Retorno');

      if (encerradoValido) {
        // NOVO (1.4.9): linha já encerrada — continua ENCERRADA (hora e duração mantidas) e
        // NADA mexe na fila (nem devolução de vez, nem estorno de crédito). Só a contagem
        // muda: o encerramento deixa de contar como atendimento (evento abaixo).
        protocoloConvertido = String(dados[i][0]).trim();
      } else {
        sheet.getRange(linha, 5).setValue('EM ATENDIMENTO');
        sheet.getRange(linha, 6).setValue(new Date());
        // NOVO: devolve a vez de quem aceitou o chat (se o aceite girou a fila).
        devolverVezPorRetorno(sheet, linha, dados[i][16], origem, protocoloOriginal);

        // NOVO (1.3.8): se o aceite foi FORA da vez (gerou crédito de rodada), o retorno
        // não conta como vez consumida — estorna o crédito e limpa a Coluna R.
        const creditoDoAceite = String(dados[i][COL_PROT_CREDITO - 1] || '').trim();
        if (creditoDoAceite) {
          estornarCreditoRodada(creditoDoAceite, protocoloOriginal, 'atendimento virou Retorno');
          sheet.getRange(linha, COL_PROT_CREDITO).clearContent();
        }
      }

      localizado = true;
      break;
    }
  }
  // NOVO (1.3.19): com protocolo informado, nunca cria linha nova — a linha esperada sumiu.
  if (!localizado && protocoloLinha) {
    throw new Error('O protocolo ' + protocoloLinha + ' não foi encontrado para ' + origem +
      ' (pode ter sido transferido ou já virou Retorno). Atualize e tente de novo.');
  }
  if (!localizado) {
    sheet.appendRow([
      protocoloOriginal,
      '',
      responsavel,
      'Retorno',
      'EM ATENDIMENTO',
      new Date()
    ]);
  }

  // NOVO (1.4.9): Retorno depois do encerramento — o CHAT_FINISHED já gravado (protocolo da
  // linha) deixa de contar como atendimento no painel CHAMADOS DO SUPORTE.
  if (protocoloConvertido) {
    registrarEvento(origemEv.canal, protocoloConvertido, 'ATENDIMENTO_CONVERTIDO_RETORNO', responsavel,
      'Atendimento já encerrado virou Retorno do protocolo ' + protocoloOriginal + ' — não conta como atendimento. Fila não alterada.',
      origemEv.chatId);
  }

  if (typeof registrarEvento === 'function') {
    // ALTERADO (1.4.6): registra quem acionou, quando não foi a própria Origem.
    const acionadoPor = (quemAcionou && !ehAcaoPropria(origem, quemAcionou)) ? ' | acionado por ' + quemAcionou : '';
    registrarEvento(origemEv.canal, protocoloOriginal, 'RETORNO_REGISTRADO', responsavel, 'Retorno do protocolo ' + protocoloOriginal + ' assumido por ' + responsavel + ' (origem: ' + origem + ')' + acionadoPor, origemEv.chatId);
  }

  if (typeof atualizarFila === 'function') {
    atualizarFila();
  }

  return { protocolo: protocoloOriginal, responsavel: responsavel };
}

/**
 * Ponte chamada pelo Widget Flutuante (Web App)
 * ALTERADO (1.3.19): 4º parâmetro opcional "protocoloLinha" — protocolo da linha que vira Retorno.
 * ALTERADO (1.4.6): 5º parâmetro opcional "quemAcionou" — quem clicou (vai pro evento).
 */
function webRegistrarRetorno(origem, responsavel, protocoloOriginal, protocoloLinha, quemAcionou) {
  if (!origem || !responsavel || !protocoloOriginal) {
    throw new Error("Dados incompletos para registrar o retorno.");
  }
  return executarRegistroRetornoCompleto(origem, responsavel, protocoloOriginal, protocoloLinha, quemAcionou);
}


/*************************************************
 * 5. 🔀 TRANSFERIR ATENDIMENTO (LÓGICA + WEB)
 *************************************************/

function menuTransferirAtendimento() {
  const ui = SpreadsheetApp.getUi();
  const analistas = obterListaAnalistas(false);

  if (analistas.length === 0) {
    ui.alert('⚠️ Nenhum analista ativo encontrado.');
    return;
  }

  abrirJanelaComOpcoes('Selecione o Analista ORIGEM (Quem está transferindo)', 'passo2TransferenciaOrigem', analistas);
}

function passo2TransferenciaOrigem(origem) {
  const ui = SpreadsheetApp.getUi();
  const resp = ui.prompt(
    '🔀 Transferir Atendimento',
    'Informe o NÚMERO DO PROTOCOLO (ou aperte OK / ENTER sem digitar nada se estiver EM TRIAGEM):',
    ui.ButtonSet.OK_CANCEL
  );

  if (resp.getSelectedButton() !== ui.Button.OK) return;
  const protocolo = resp.getResponseText().trim();

  const analistas = obterListaAnalistas(false).filter(a => a.toLowerCase() !== origem.toLowerCase());

  let htmlScript = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 12px; }
          select { width: 100%; padding: 8px; margin: 10px 0 20px 0; }
          button { padding: 8px 16px; margin-left: 5px; cursor: pointer; }
          .btn-ok { background: #0b57d0; color: white; border: none; }
        </style>
      </head>
      <body>
        <label>Selecione o Analista DESTINO:</label>
        <select id="destino">${analistas.map(a => `<option value="${a}">${a}</option>`).join('')}</select>
        <div style="text-align:right;">
          <button onclick="google.script.host.close()">Cancelar</button>
          <button class="btn-ok" onclick="confirmar()">Transferir</button>
        </div>
        <script>
          function confirmar() {
            var d = document.getElementById('destino').value;
            google.script.run.withSuccessHandler(() => google.script.host.close())
            .executarTransferenciaCompleta("${origem}", d, "${protocolo}");
          }
        </script>
      </body>
    </html>`;

  ui.showModalDialog(HtmlService.createHtmlOutput(htmlScript).setWidth(340).setHeight(170), 'Selecione o Destino');
}

/**
 * Motor central de Transferência completo e seguro
 * ALTERADO (1.4.6): 4º parâmetro opcional "quemAcionou" — quem clicou (vai pro evento).
 */

function executarTransferenciaCompleta(origem, destino, protocolo, quemAcionou) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  if (!sheet) throw new Error("Aba de protocolos não encontrada.");

  // CORRIGIDO: protocolo pode chegar como Number (ex: vindo do Modo Mini, que
  // manda o valor puro da planilha) em vez de String (o Widget sempre manda
  // String, porque vem de um <input type="text">). "protocolo.trim()" quebra
  // com "protocolo.trim is not a function" quando é Number -- força String
  // logo no início, pra funcionar igual não importa quem chamou.
  protocolo = (protocolo === null || protocolo === undefined) ? '' : String(protocolo).trim();

  const dados = sheet.getDataRange().getValues();
  let transferido = false;
  let linhaIdx = -1; // NOVO (1.4.8): linha transferida (lê Status, Q e R pra regra da fila)
  let origemEv = { canal: '', chatId: '' }; // NOVO (1.3.15): canal / chat_id do evento

  if (protocolo && protocolo !== '') {
    for (let i = dados.length - 1; i >= 1; i--) {
      // ALTERADO (1.4.9): aceita o protocolo com ou sem o prefixo "J".
      if (mesmoProtocolo(dados[i][0], protocolo)) {
        sheet.getRange(i + 1, 3).setValue(destino);
        origemEv = canalEChatDaLinhaProtocolo(dados[i]);
        transferido = true;
        linhaIdx = i;
        break;
      }
    }
  } else {
    for (let i = dados.length - 1; i >= 1; i--) {
      if (String(dados[i][2]).toLowerCase() === String(origem).toLowerCase() &&
          String(dados[i][4]).toUpperCase() === 'EM TRIAGEM') {

        sheet.getRange(i + 1, 3).setValue(destino);
        origemEv = canalEChatDaLinhaProtocolo(dados[i]);
        transferido = true;
        linhaIdx = i;
        break;
      }
    }
  }

  if (!transferido) {
    throw new Error('Não foi encontrado atendimento EM TRIAGEM para ' + origem + (protocolo ? ' com o protocolo ' + protocolo : '') + '.');
  }

  if (typeof registrarEvento === 'function') {
    // ALTERADO (1.4.6): registra quem acionou, quando não foi a própria Origem.
    const acionadoPor = (quemAcionou && !ehAcaoPropria(origem, quemAcionou)) ? ' | acionado por ' + quemAcionou : '';
    registrarEvento(origemEv.canal, protocolo || 'TRIAGEM', 'TRANSFERENCIA', origem, 'Atendimento transferido de ' + origem + ' para ' + destino + acionadoPor, origemEv.chatId);
  }

  // Regra da fila na Transferência — ALTERADO (1.4.8):
  //
  //  A Transferência NÃO gera crédito de rodada pra ninguém. Se o atendimento estava
  //  EM ATENDIMENTO e a Origem é diferente do Destino, a Origem não pode "pagar" uma vez
  //  por um chat que não ficou com ela:
  //  1) Origem ganhou crédito ao aceitar fora da vez (Coluna R = Origem): o crédito é
  //     estornado ANTES de girar a fila — ela volta pro lugar dela (se era a 2ª, vira a
  //     próxima quando o 1º girar). Se o crédito já tinha sido consumido, só registra o log.
  //  2) Origem era a próxima e girou a fila (Coluna Q = Origem): ela volta como próxima.
  //  "Volta como próxima" = Próximo Forçado (mesmo efeito do 🎯 Colocar como Próx.); se já
  //  houver outro forçado, ela entra na espera logo atrás dele, sem tirar a vez de ninguém.
  //  Destino: se era o próximo, a fila gira normalmente (e a Coluna Q passa pro nome dele);
  //  se não era, nada muda na fila e ele não ganha crédito.
  const linhaT = dados[linhaIdx];
  const numLinhaT = linhaIdx + 1;
  const protEv = protocolo || 'TRIAGEM';
  const aplicarDevolucao = normalizarNome(origem) !== normalizarNome(destino) &&
    String(linhaT[4]).toUpperCase().trim() === 'EM ATENDIMENTO';
  let devolverVez = false;

  if (aplicarDevolucao && normalizarNome(linhaT[17]) === normalizarNome(origem)) {
    estornarCreditoRodada(origem, protEv, 'atendimento transferido para ' + destino);
    sheet.getRange(numLinhaT, 18).setValue('');
  }
  if (aplicarDevolucao && normalizarNome(linhaT[16]) === normalizarNome(origem)) {
    sheet.getRange(numLinhaT, 17).setValue('');
    devolverVez = true;
  }

  // NOVO (1.4.9): linha JÁ ENCERRADA (o analista encerrou no Jivo antes de transferir) — só
  // muda o dono da linha. Nada encerrado mexe na fila (nem o Destino consome a vez).
  const linhaEncerrada = String(linhaT[4]).toUpperCase().trim() === 'ENCERRADO';

  if (!linhaEncerrada && typeof obterProximoAnalista === 'function' && typeof moverAnalistaParaFimDaFila === 'function') {
    const proximoAntes = obterProximoAnalista();
    const destinoEraProximo = proximoAntes && normalizarNome(proximoAntes) === normalizarNome(destino);

    if (destinoEraProximo) {
      const giro = moverAnalistaParaFimDaFila(destino, { protocolo: protEv, chatId: origemEv.chatId, canal: origemEv.canal }); // ALTERADO (1.4.11)
      if (giro && giro.tipo === 'GIROU') sheet.getRange(numLinhaT, 17).setValue(destino);
    }

    if (devolverVez) {
      const proximoAgora = obterProximoAnalista();
      if (!proximoAgora || normalizarNome(proximoAgora) !== normalizarNome(origem)) {
        const r = enfileirarProximoForcado(origem);
        registrarEvento(origemEv.canal, protEv, 'VEZ_DEVOLVIDA_TRANSFERENCIA', origem,
          origem + (r === 'ESPERA' ? ' entrou na espera do Próximo Forçado' : ' voltou como próximo da fila') +
          ' — transferiu o atendimento para ' + destino + ' e não ficou com o chat.', origemEv.chatId);
      }
    }
  }

  if (typeof atualizarFila === 'function') {
    atualizarFila();
  }

  return { origem: origem, destino: destino, protocolo: protocolo || 'TRIAGEM' };
}

/**
 * Ponte limpa chamada pelo Widget Web App para Transferência
 * ALTERADO (1.4.6): 4º parâmetro opcional "quemAcionou" (o Modo Mini não manda — segue igual).
 */
function webTransferirAtendimento(origem, destino, protocolo, quemAcionou) {
  if (!origem || !destino) {
    throw new Error("Analista de origem e destino são obrigatórios para a transferência.");
  }
  return executarTransferenciaCompleta(origem, destino, protocolo || '', quemAcionou);
}

/**
 * Retorna a lista de analistas para os modais do Widget
 */
function webObterAnalistasRetorno() {
  return obterListaAnalistas(false);
}

function webObterAnalistasTransferencia() {
  return obterListaAnalistas(false);
}

/**
 * NOVO (1.4.6): lista da ORIGEM nos modais de Retorno e Transferir — analistas ATIVOS e
 * AUSENTES da EQUIPE, na ordem das linhas (quem tem outro status, ex.: OFF, fica de fora).
 * [{ nome, ausente }]. O Widget recebe essa mesma lista a cada ciclo em
 * webObterDadosFila().analistasOrigem; esta ponte é só o caminho de reserva.
 */
function obterAnalistasOrigem(estado) {
  estado = estado || carregarEstadoFila();
  const vistos = {};
  const lista = [];
  estado.emOrdemLinha.forEach(info => {
    if (info.status !== 'ATIVO' && info.status !== 'AUSENTE') return;
    if (vistos[info.chave]) return;
    vistos[info.chave] = true;
    lista.push({ nome: String(info.nome), ausente: info.status === 'AUSENTE' });
  });
  return lista;
}

function webObterAnalistasOrigem() {
  return obterAnalistasOrigem();
}

/*************************************************
 * 6. ADMIN - REVERTER / CORRIGIR STATUS (INTELIGENTE)
 *************************************************/

function menuReverterStatus() {
  const ui = SpreadsheetApp.getUi();

  const resp = ui.prompt(
    '⏮️ Reverter / Corrigir Status (ADMIN)',
    'Informe o NÚMERO DO PROTOCOLO:\n(Ou clique em Cancelar / deixe em branco para buscar por Analista)',
    ui.ButtonSet.OK_CANCEL
  );

  if (resp.getSelectedButton() === ui.Button.OK && resp.getResponseText().trim() !== '') {
    const protocolo = resp.getResponseText().trim();
    processarReversaoAdmin(protocolo, null);
    return;
  }

  const analistas = obterListaAnalistas(false);
  if (!analistas || analistas.length === 0) {
    ui.alert('⚠️ Nenhum analista encontrado na equipe.');
    return;
  }

  abrirJanelaComOpcoes('Selecione o Analista para Corrigir', 'reverterPorAnalistaInteligente', analistas);
}

function reverterPorAnalistaInteligente(analista) {
  if (!analista) return;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  const dados = sheet.getDataRange().getValues();

  for (let i = dados.length - 1; i >= 1; i--) {
    const analistaLinha = String(dados[i][2]).toLowerCase().trim();
    if (analistaLinha === analista.toLowerCase().trim()) {
      const protocolo = dados[i][0] || 'Sem Protocolo (Linha ' + (i + 1) + ')';
      processarReversaoAdmin(protocolo, i + 1);
      return;
    }
  }

  SpreadsheetApp.getUi().alert('⚠️ Nenhum registro encontrado para o analista ' + analista);
}

/**
 * Ponte web segura (Nível 2 / Coordenação): reverte/corrige o status de um
 * protocolo direto pelo Widget, sem os prompts do Sheets (ui.prompt não
 * funciona fora do contexto de edição). Implementação independente da versão
 * de menu, pra não arriscar mudar o fluxo do Sheets que já funciona.
 */
function webReverterStatusProtocolo(protocolo, novoStatus) {
  if (!protocolo) throw new Error("Informe o protocolo.");
  if (!novoStatus) throw new Error("Informe o novo status.");

  const statusValido = ['FILA', 'EM TRIAGEM', 'EM ATENDIMENTO', 'ENCERRADO'];
  const statusNormalizado = String(novoStatus).toUpperCase().trim();
  if (!statusValido.includes(statusNormalizado)) {
    throw new Error('Status inválido. Use: FILA, EM TRIAGEM, EM ATENDIMENTO ou ENCERRADO.');
  }

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  const dados = sheet.getDataRange().getValues();

  let linha = null;
  for (let i = dados.length - 1; i >= 1; i--) {
    if (mesmoProtocolo(dados[i][0], protocolo) /* 1.4.9: com ou sem "J" */) {
      linha = i + 1;
      break;
    }
  }
  if (!linha) throw new Error('Protocolo ' + protocolo + ' não foi encontrado.');

  const analistaAtual = sheet.getRange(linha, 3).getValue();
  const origemEv = canalEChatDaLinhaProtocolo(dados[linha - 1]); // NOVO (1.3.15)
  sheet.getRange(linha, 5).setValue(statusNormalizado);

  if (statusNormalizado === 'FILA') {
    sheet.getRange(linha, 6).setValue('');
  } else if ((statusNormalizado === 'EM TRIAGEM' || statusNormalizado === 'EM ATENDIMENTO') && !sheet.getRange(linha, 6).getValue()) {
    sheet.getRange(linha, 6).setValue(new Date());
  }

  registrarEvento(origemEv.canal, protocolo, 'STATUS_REVERTIDO', analistaAtual, 'Status alterado via Painel Coordenação (Widget) para ' + statusNormalizado, origemEv.chatId);

  return { sucesso: true, protocolo: protocolo, novoStatus: statusNormalizado };
}

function processarReversaoAdmin(protocolo, linhaDireta) {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  const dados = sheet.getDataRange().getValues();

  let linha = linhaDireta;

  if (!linha) {
    for (let i = dados.length - 1; i >= 1; i--) {
      if (mesmoProtocolo(dados[i][0], protocolo) /* 1.4.9: com ou sem "J" */) {
        linha = i + 1;
        break;
      }
    }
  }

  if (!linha) {
    ui.alert('⚠️ Protocolo ' + protocolo + ' não foi encontrado.');
    return;
  }

  const respStatus = ui.prompt(
    '🛠️ Escolha o Novo Status',
    'Digite o número correspondente ao novo status:\n\n' +
    '1 - FILA\n' +
    '2 - EM TRIAGEM\n' +
    '3 - EM ATENDIMENTO\n' +
    '4 - ENCERRADO',
    ui.ButtonSet.OK_CANCEL
  );

  if (respStatus.getSelectedButton() !== ui.Button.OK) return;

  const opcao = respStatus.getResponseText().trim();
  let novoStatus = '';

  if (opcao === '1') novoStatus = 'FILA';
  else if (opcao === '2') novoStatus = 'EM TRIAGEM';
  else if (opcao === '3') novoStatus = 'EM ATENDIMENTO';
  else if (opcao === '4') novoStatus = 'ENCERRADO';
  else {
    ui.alert('⚠️ Opção inválida! Escolha de 1 a 4.');
    return;
  }

  const analistaAtual = sheet.getRange(linha, 3).getValue();
  const origemEv = canalEChatDaLinhaProtocolo(dados[linha - 1]); // NOVO (1.3.15)

  sheet.getRange(linha, 5).setValue(novoStatus);

  if (novoStatus === 'FILA') {
    sheet.getRange(linha, 6).setValue('');
  } else if ((novoStatus === 'EM TRIAGEM' || novoStatus === 'EM ATENDIMENTO') && !sheet.getRange(linha, 6).getValue()) {
    sheet.getRange(linha, 6).setValue(new Date());
  }

  if (typeof registrarEvento === 'function') {
    registrarEvento(origemEv.canal, protocolo, 'STATUS_REVERTIDO', analistaAtual, 'Status alterado via Admin para ' + novoStatus, origemEv.chatId);
  }

  ui.alert('✅ Sucesso!\n\nProtocolo / Linha ' + protocolo + ' alterado para: ' + novoStatus);
}


/*************************************************
 * 6b. 🩹 ADMIN - FINALIZAR ATENDIMENTO ÓRFÃO (WEBHOOK)
 *************************************************/

/**
 * Busca na aba EV_WEBHOOK os registros que o webhook do Jivo tentou finalizar
 * mas não conseguiu (analista sem protocolo EM ATENDIMENTO, ou ID de agente
 * não cadastrado na EQUIPE). Usado para o Admin resolver manualmente.
 * Limita aos 20 mais recentes para não pesar o modal.
 * ALTERADO (1.3.15): lê a EV_WEBHOOK (antes, a EVENTOS).
 */
function obterEventosOrfaosWebhook() {
  const sheet = obterAbaEventosLeitura(ABAS_EVENTOS.WEBHOOK);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const dados = sheet.getDataRange().getValues();
  // Colunas (via registrarEvento): A:DataHora | B:Canal | C:Protocolo | D:Tipo | E:Analista | F:Descrição | G:Chat ID
  let orfaos = [];

  for (let i = dados.length - 1; i >= 1; i--) {
    const tipo = String(dados[i][3]).toUpperCase().trim();
    if (tipo === 'WEBHOOK_ATENDIMENTO_NAO_ENCONTRADO' || tipo === 'WEBHOOK_AGENTE_NAO_ENCONTRADO' || tipo === 'WEBHOOK_SEM_AGENTE') {
      orfaos.push({
        linha: i + 1,
        dataHora: dados[i][0],
        analista: dados[i][4] || '',
        descricao: dados[i][5] || ''
      });
      if (orfaos.length >= 20) break;
    }
  }

  return orfaos;
}

/**
 * Acionado pelo Menu Admin: mostra os eventos órfãos e deixa o admin escolher qual resolver.
 */
function menuFinalizarAtendimentoOrfao() {
  const ui = SpreadsheetApp.getUi();
  const orfaos = obterEventosOrfaosWebhook();

  if (orfaos.length === 0) {
    ui.alert('✅ Nenhum atendimento órfão de webhook pendente no momento.');
    return;
  }

  const analistas = obterListaAnalistas(false);
  if (analistas.length === 0) {
    ui.alert('⚠️ Nenhum analista ativo encontrado para vincular a finalização.');
    return;
  }

  let opcoesEventos = orfaos.map(ev => {
    const dataTexto = (ev.dataHora instanceof Date)
      ? Utilities.formatDate(ev.dataHora, Session.getScriptTimeZone(), 'dd/MM HH:mm')
      : String(ev.dataHora);
    const rotulo = (ev.analista || '⚠️ Agente não identificado') + ' — ' + dataTexto + ' — ' + ev.descricao;
    return `<option value="${ev.linha}">${rotulo}</option>`;
  }).join('');

  let opcoesAnalistas = analistas.map(a => `<option value="${a}">${a}</option>`).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 12px; font-size: 12px; }
          label { display:block; font-weight:600; margin-top:8px; }
          select, input { width: 100%; padding: 8px; margin: 4px 0 4px 0; box-sizing: border-box; }
          button { padding: 8px 16px; margin-left: 5px; cursor: pointer; }
          .btn-ok { background: #0b57d0; color: white; border: none; }
          .rodape { text-align:right; margin-top:14px; }
        </style>
      </head>
      <body>
        <label>Evento órfão a resolver:</label>
        <select id="linhaEvento">${opcoesEventos}</select>

        <label>Analista responsável (confirme ou corrija):</label>
        <select id="analistaFinal">${opcoesAnalistas}</select>

        <label>Número do Protocolo (opcional):</label>
        <input type="text" id="protocoloManual" placeholder="Deixe em branco se não souber">

        <div class="rodape">
          <button onclick="google.script.host.close()">Cancelar</button>
          <button class="btn-ok" onclick="confirmar()">Finalizar Atendimento</button>
        </div>
        <script>
          function confirmar() {
            var linha = document.getElementById('linhaEvento').value;
            var analista = document.getElementById('analistaFinal').value;
            var protocolo = document.getElementById('protocoloManual').value.trim();
            google.script.run
              .withSuccessHandler(() => google.script.host.close())
              .withFailureHandler((err) => alert('Erro: ' + err.message))
              .executarFinalizacaoOrfao(linha, analista, protocolo);
          }
        </script>
      </body>
    </html>`;

  ui.showModalDialog(HtmlService.createHtmlOutput(html).setWidth(420).setHeight(320), '🩹 Finalizar Atendimento Órfão');
}

/**
 * Cria o registro de finalização em PROTOCOLOS a partir de um evento órfão do webhook,
 * e registra um novo evento LINKADO ao log original (referenciando a linha e a data/hora
 * do evento-fonte em EV_WEBHOOK), para manter rastreabilidade de que essa finalização
 * veio de uma resolução manual do Admin, não do fluxo automático do webhook.
 * ALTERADO (1.3.15): a linha do evento é da EV_WEBHOOK (mesma aba lida por
 * obterEventosOrfaosWebhook); canal e chat_id do evento original seguem pro novo evento.
 */
function executarFinalizacaoOrfao(linhaEvento, analista, protocoloManual, silencioso) {
  if (!analista) throw new Error("Selecione o analista responsável.");

  const eventosSheet = obterAbaEventosLeitura(ABAS_EVENTOS.WEBHOOK);
  if (!eventosSheet) throw new Error('Aba ' + ABAS_EVENTOS.WEBHOOK + ' não encontrada.');
  const linhaEventoNum = Number(linhaEvento);
  const dadosEvento = eventosSheet.getRange(linhaEventoNum, 1, 1, COLUNAS_EVENTOS).getValues()[0];

  const dataHoraEvento = dadosEvento[0]; // quando o webhook tentou (e não conseguiu) finalizar
  const descricaoOriginal = dadosEvento[5];
  const canalOriginal = dadosEvento[1] || '';
  const chatIdOriginal = dadosEvento[6] || '';

  const protSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  const protocoloFinal = (protocoloManual && protocoloManual.trim() !== '') ? protocoloManual.trim() : 'pendente';

  // Cria a linha já como FINALIZADO. Como o analista nunca assumiu no Widget, não existe
  // um "Iniciado" confiável — por isso a Duração fica marcada como indeterminada em vez
  // de calculada (evita mostrar um número de duração que seria inventado).
  protSheet.appendRow([
    protocoloFinal,          // A: Protocolo
    new Date(),               // B: Data
    analista,                  // C: Analista
    'Finalização Manual',       // D: Tipo
    'ENCERRADO',                 // E: Status
    '',                            // F: Iniciado (desconhecido)
    dataHoraEvento,                 // G: Encerrado (hora em que o Jivo avisou, via webhook)
    'Indeterminada',                  // H: Duração
    ''                                  // I: Tópico/Tag
  ]);

  const dataFormatada = (dataHoraEvento instanceof Date)
    ? Utilities.formatDate(dataHoraEvento, Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm')
    : String(dataHoraEvento);

  registrarEvento(
    canalOriginal,
    protocoloFinal,
    'ATENDIMENTO_FINALIZADO_MANUAL_ADMIN',
    analista,
    'Finalização manual pelo Admin, linkada ao evento da linha ' + linhaEventoNum + ' da ' + ABAS_EVENTOS.WEBHOOK + ' (' + dataFormatada + '). Evento original: ' + descricaoOriginal,
    chatIdOriginal
  );

  // CORRIGIDO: SpreadsheetApp.getUi() quebra se chamado a partir do Widget.
  // Parâmetro "silencioso" permite reaproveitar essa mesma função sem o alerta.
  if (!silencioso) {
    SpreadsheetApp.getUi().alert('✅ Atendimento de ' + analista + ' finalizado manualmente e linkado ao log original.');
  }

  return { protocolo: protocoloFinal, analista: analista };
}

/**
 * Ponte web segura (Nível 2 / Coordenação): finaliza um atendimento órfão do
 * webhook direto pelo Widget.
 */
function webFinalizarAtendimentoOrfao(linhaEvento, analista, protocoloManual) {
  return executarFinalizacaoOrfao(linhaEvento, analista, protocoloManual, true);
}


/**
 * Funções de apoio do Modo Debug no servidor
 */
function obterTodosAnalistasEquipe() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName(CONFIG.ABA_EQUIPE || "Equipe");
  if (!aba || aba.getLastRow() < 2) return [];
  return aba.getRange(2, 2, aba.getLastRow() - 1, 1).getValues().flat().filter(String);
}

function obterDadosProtocoloDebug(idProtocolo) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName(CONFIG.ABA_PROTOCOLO || "Protocolo");
  const dados = aba.getDataRange().getValues();
  const cab = dados[0];

  const colId = cab.indexOf("Protocolo");
  const colStatus = cab.indexOf("Status");
  const colAnalista = cab.indexOf("Analista");
  const colTipo = cab.indexOf("Tipo");

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][colId]).trim() === String(idProtocolo).trim()) {
      return {
        encontrado: true,
        status: dados[i][colStatus],
        analista: dados[i][colAnalista],
        tipo: dados[i][colTipo]
      };
    }
  }
  return { encontrado: false };
}

function salvarDebugAdmin(dadosForm) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const aba = ss.getSheetByName(CONFIG.ABA_PROTOCOLO || "Protocolo");
  const dados = aba.getDataRange().getValues();
  const cab = dados[0];

  const colId = cab.indexOf("Protocolo");
  const colStatus = cab.indexOf("Status");
  const colAnalista = cab.indexOf("Analista");
  const colTipo = cab.indexOf("Tipo");
  const colDataInicio = cab.indexOf("Data Inicio");

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][colId]).trim() === String(dadosForm.protocolo).trim()) {
      const linha = i + 1;

      aba.getRange(linha, colStatus + 1).setValue(dadosForm.status);
      aba.getRange(linha, colAnalista + 1).setValue(dadosForm.analista);
      aba.getRange(linha, colTipo + 1).setValue(dadosForm.tipo);

      if (colDataInicio !== -1) {
        if (dadosForm.status === 'FILA') {
          aba.getRange(linha, colDataInicio + 1).clearContent();
        } else if (!aba.getRange(linha, colDataInicio + 1).getValue()) {
          aba.getRange(linha, colDataInicio + 1).setValue(new Date());
        }
      }

      if (typeof registrarEvento === 'function') {
        registrarEvento('', '', 'DEBUG_ADMIN', dadosForm.analista, `Ajuste manual Admin no protocolo ${dadosForm.protocolo}`);
      }

      return `✅ Protocolo ${dadosForm.protocolo} atualizado com sucesso!`;
    }
  }
  return "❌ Erro ao atualizar o protocolo.";
}

/*************************************************
 * 7. 🔧 MOTOR ÚNICO DA FILA (reconstrução total em ordem numérica)
 *************************************************/
// A REGRA DE OURO: a fila SEMPRE roda em ordem numérica estrita (Coluna A —
// Ordem, identidade fixa de cada analista na EQUIPE), com no máximo UMA
// "virada de ciclo" (o maior número seguido do menor). Isso é matematicamente
// o mesmo que dizer: o estado da fila em qualquer momento é sempre uma simples
// ROTAÇÃO da lista completa (ATIVOS + AUSENTES) ordenada por Ordem — a única
// coisa que varia de verdade é QUEM está na frente ("o próximo"). Por isso,
// toda função que move a fila (servir alguém, colocar alguém manualmente como
// próximo, etc.) usa os mesmos dois helpers abaixo, nunca move só uma linha
// isoladamente — é exatamente esse "movimento parcial" que causava a fila
// desalinhar (ex: 4,5,6,7,2,3,9,8) e, como consequência, fazia quem voltava de
// uma ausência roubar a vez de quem realmente era o próximo.

/**
 * Lê a aba EQUIPE inteira (TODOS os analistas — ativos e ausentes; a Ordem é
 * a identidade fixa, nunca muda) e devolve ordenado ascendente pela Coluna A.
 * É sempre a partir daqui que a fila é reconstruída — nunca a partir do que já
 * estava fisicamente na aba FILA, pra Ordem nunca desviar.
 */
function obterEquipeOrdenadaPorOrdem() {
  const equipeSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  if (!equipeSheet || equipeSheet.getLastRow() < 2) return [];

  const dados = equipeSheet.getRange(2, 1, equipeSheet.getLastRow() - 1, 2).getValues(); // [Ordem, Nome]
  const todos = dados.filter(l => l[1]); // ignora linhas sem nome
  todos.sort((a, b) => Number(a[0]) - Number(b[0]));
  return todos;
}

/**
 * Reconstrói a aba FILA do zero: TODOS os analistas (ativos e ausentes) em
 * ordem numérica ascendente, começando fisicamente por "nomeFrente" e dando a
 * volta (wrap-around) pelos demais. Não remove ausentes — só ignora eles na
 * hora de calcular "quem é o próximo" (obterProximoAnalista já faz isso
 * sozinho, lendo essa mesma aba). Esse é o ÚNICO ponto do sistema que escreve
 * a posição física da fila — todas as outras funções (mover pro fim, colocar
 * como próximo, etc.) só decidem QUEM é "nomeFrente" e chamam esta função.
 */
function reconstruirFilaComFrente(nomeFrente, estado) {
  // ALTERADO (1.3.8): se o motor já tem a EQUIPE em memória (estado), reaproveita
  // em vez de ler a planilha de novo.
  const todos = estado
    ? estado.ordenados.map(i => [i.ordem, i.nome])
    : obterEquipeOrdenadaPorOrdem();
  if (todos.length === 0) return [];

  const nomeAlvo = String(nomeFrente).trim().toLowerCase();
  let indiceInicio = todos.findIndex(l => String(l[1]).trim().toLowerCase() === nomeAlvo);
  if (indiceInicio === -1) indiceInicio = 0; // segurança: se não achar, não trava a fila

  const sequencia = todos.slice(indiceInicio).concat(todos.slice(0, indiceInicio));

  const filaSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_FILA);
  const ultimaLinhaFila = filaSheet.getLastRow();
  if (ultimaLinhaFila >= 2) {
    filaSheet.getRange(2, 1, ultimaLinhaFila - 1, filaSheet.getLastColumn()).clearContent();
  }
  if (sequencia.length > 0) {
    filaSheet.getRange(2, 1, sequencia.length, 2).setValues(sequencia);
  }
  if (estado) estado.filaFisica = sequencia.map(l => l[1]);

  return sequencia;
}

/**
 * Move um analista pro fim do ciclo (ele acabou de consumir a vez dele) e
 * reconstrói a fila inteira em ordem numérica a partir de quem vem logo depois
 * dele — nunca mais um "movimento parcial" de uma linha só. É essa reconstrução
 * total que garante que, quando alguém volta de uma ausência, a vaga dele já
 * está automaticamente no lugar certo (nunca fura fila, nunca é furado).
 */
function normalizarNome(nome) {
  return String(nome || '').trim().toLowerCase();
}

/**
 * "Próximo Forçado" — a peça que faltava. Uma reinserção manual (Colocar como
 * Próximo) ou uma vez que veio por um caminho torto (Transferência, por
 * exemplo) NÃO deve reescrever o relógio físico da fila — ela é só uma
 * INTERRUPÇÃO de uma rodada. Guardamos isso à parte (PropertiesService, não
 * numa planilha) porque não é uma posição real da fila, é só "quem deve ser
 * respondido primeiro da próxima vez que alguém perguntar quem é o próximo".
 * Assim que essa pessoa é resolvida (atendida OU pulada), a marca some
 * sozinha e o relógio volta a valer exatamente de onde já estava.
 */
function obterProximoForcado() {
  return PropertiesService.getDocumentProperties().getProperty('PROXIMO_FORCADO') || null;
}

function definirProximoForcado(analista) {
  PropertiesService.getDocumentProperties().setProperty('PROXIMO_FORCADO', String(analista));
}

/*************************************************
 * 7c. ⏳ ESPERA DE PRÓXIMO FORÇADO (1.4.6)
 *************************************************/
// Só existe UM Próximo Forçado por vez. Quando uma vez precisa ser DEVOLVIDA (chat
// encerrado com um tópico que não conta protocolo) e já existe outro forçado, quem perdeu
// a vez entra numa ESPERA (lista em Document Property). Quando o forçado atual é
// resolvido (atendeu, foi pulado ou deixou de estar ATIVO), o 1º da espera assume.
// O "🎯 Colocar como Próx." manual continua igual: substitui o forçado atual.
const PROP_FORCADOS_PENDENTES = 'PROXIMOS_FORCADOS_PENDENTES';

function lerForcadosPendentes() {
  try {
    const lista = JSON.parse(PropertiesService.getDocumentProperties().getProperty(PROP_FORCADOS_PENDENTES) || '[]');
    return Array.isArray(lista) ? lista : [];
  } catch (e) {
    return [];
  }
}

function gravarForcadosPendentes(lista) {
  const props = PropertiesService.getDocumentProperties();
  if (lista && lista.length) props.setProperty(PROP_FORCADOS_PENDENTES, JSON.stringify(lista));
  else props.deleteProperty(PROP_FORCADOS_PENDENTES);
}

/**
 * Tira o Próximo Forçado atual e promove o 1º da espera (se houver). Devolve quem é o
 * forçado depois disso (ou null). "nomeEsperado": só libera se o forçado atual ainda for
 * ele — se outra execução já resolveu, não mexe (evita promover duas pessoas de uma vez).
 * Roda com a trava do script; sem conseguir a trava, não mexe em nada.
 */
function liberarProximoForcado(nomeEsperado) {
  const r = executarComTrava(() => {
    const props = PropertiesService.getDocumentProperties();
    const atual = props.getProperty('PROXIMO_FORCADO');
    if (nomeEsperado && atual && normalizarNome(atual) !== normalizarNome(nomeEsperado)) {
      return { forcado: atual };
    }
    props.deleteProperty('PROXIMO_FORCADO');
    const pendentes = lerForcadosPendentes();
    const promovido = pendentes.shift() || null;
    gravarForcadosPendentes(pendentes);
    if (promovido) {
      props.setProperty('PROXIMO_FORCADO', String(promovido));
      registrarEvento('', '', 'VEZ_FORCADO_PROMOVIDO', promovido,
        promovido + ' saiu da espera e virou o Próximo Forçado (vez devolvida por atendimento que não contou protocolo).' +
        (pendentes.length ? ' Ainda na espera: ' + pendentes.join(', ') + '.' : ''));
    }
    return { forcado: promovido };
  }, 3000, true);
  return r ? r.forcado : obterProximoForcado();
}

/**
 * Coloca alguém como Próximo Forçado ou, se já existir outro, na espera.
 * Devolve 'AGORA' | 'ESPERA' | 'JA_ESTAVA' (já é o forçado ou já está na espera).
 */
function enfileirarProximoForcado(nome) {
  return executarComTrava(() => {
    const props = PropertiesService.getDocumentProperties();
    const atual = props.getProperty('PROXIMO_FORCADO');
    if (!atual) {
      props.setProperty('PROXIMO_FORCADO', String(nome));
      return 'AGORA';
    }
    if (normalizarNome(atual) === normalizarNome(nome)) return 'JA_ESTAVA';
    const pendentes = lerForcadosPendentes();
    if (pendentes.some(n => normalizarNome(n) === normalizarNome(nome))) return 'JA_ESTAVA';
    pendentes.push(String(nome));
    gravarForcadosPendentes(pendentes);
    return 'ESPERA';
  });
}

/**
 * Se "analista" for exatamente quem está marcado como forçado no momento,
 * remove a marca e devolve true (o chamador não deve mexer no relógio físico
 * — ele já está no lugar certo). Se não bater ou não houver marca, devolve
 * false (o chamador segue com o fluxo normal).
 * ALTERADO (1.4.6): ao remover a marca, o 1º da espera (se houver) vira o forçado.
 */
function resolverProximoForcadoSeForEsse(analista) {
  const props = PropertiesService.getDocumentProperties();
  const atual = props.getProperty('PROXIMO_FORCADO');
  if (atual && normalizarNome(atual) === normalizarNome(analista)) {
    liberarProximoForcado(atual);
    return true;
  }
  return false;
}

/**
 * Move um analista pro fim do ciclo — MAS só avança o relógio de verdade
 * quando esse analista era REALMENTE o próximo da vez (obterProximoAnalista).
 * Duas situações não avançam nada:
 *  1) Ele era um "Próximo Forçado" (reinserção manual) — só limpa a marca; o
 *     relógio físico nunca tinha saído do lugar, então já está correto.
 *  2) Ele pegou um atendimento fora de ordem, sem passar por "Colocar como
 *     Próximo" (ex: escolhido manualmente no dropdown do Chat Aceito, ou uma
 *     Transferência pra alguém que não era o próximo) — não mexe na fila de
 *     ninguém. ALTERADO (1.3.8): quando o chamador passa { gerarCredito: true }
 *     (aceite pelo Jivo e Chat Aceito manual), quem atendeu fora da vez ganha +1
 *     crédito de rodada (Coluna L) e será saltado quando o relógio passar por ele.
 *     Transferência e Pausa "Fila" não passam a opção (seguem sem crédito).
 * Opções: { gerarCredito, estado, protocolo, chatId, canal }. Devolve { tipo: 'GIROU' |
 * 'FORCADO' | 'FORA_DA_VEZ', credito: bool, proximo: nome | null }.
 * ALTERADO (1.4.11): protocolo / chatId / canal (opcionais) vão para os eventos de fila
 * gerados aqui (CREDITO_RODADA_GERADO / _CONSUMIDO, RODADA_PULADA...) — rastreio do crédito.
 */
function moverAnalistaParaFimDaFila(analista, opcoes) {
  opcoes = opcoes || {};
  return executarComTrava(() => {
    const estado = opcoes.estado || carregarEstadoFila();
    const chave = normalizarNome(analista);
    const proximoAtual = calcularProximo(estado);
    const eventos = [];
    // NOVO (1.4.11): carimba canal/protocolo/chat_id da ação que moveu a fila nos eventos.
    const registrarEventosEmLote = lista => {
      (lista || []).forEach(e => {
        if (!e[0] && opcoes.canal) e[0] = opcoes.canal;
        if (!e[1] && opcoes.protocolo) e[1] = opcoes.protocolo;
        if (!e[5] && opcoes.chatId) e[5] = opcoes.chatId;
        // quem perdeu crédito/rodada não é quem atendeu: deixa claro de quem foi a ação.
        if ((e[2] === 'CREDITO_RODADA_CONSUMIDO' || e[2] === 'RODADA_PULADA') &&
            normalizarNome(e[3]) !== chave && String(e[4]).indexOf('Fila movida') === -1) {
          e[4] = String(e[4]) + ' Fila movida por ' + analista + (opcoes.protocolo ? ' (' + opcoes.protocolo + ')' : '') + '.';
        }
      });
      return gravarEventosEmLote(lista);
    };
    const res = { tipo: 'FORA_DA_VEZ', credito: false, proximo: null };

    // Rodada fechada (todos os ATIVOS elegíveis já tinham crédito): antes de mexer em
    // qualquer coisa, vira a rodada de verdade — desconta de todo mundo o mesmo tanto.
    aplicarViradaDeRodada(estado, eventos);

    if (!proximoAtual || normalizarNome(proximoAtual) !== chave) {
      // Não era o próximo da vez — não avança o relógio. Segurança extra: se por
      // algum motivo existir uma marca de forçado pra ele mesmo assim, limpa.
      // ALTERADO (1.4.6): relê o forçado (pode ter vindo alguém da espera).
      if (resolverProximoForcadoSeForEsse(analista)) estado.forcado = obterProximoForcado();

      // NOVO (1.3.8): aceite fora da vez (Jivo / Chat Aceito manual) consome a vez
      // dele nesta rodada — ganha +1 crédito e será saltado quando o relógio chegar nele.
      if (opcoes.gerarCredito) {
        const info = estado.porNome[chave];
        if (info) {
          info.creditos += 1;
          marcarAlteracao(estado, info, 'creditos');
          res.credito = true;
          eventos.push(['', '', 'CREDITO_RODADA_GERADO', info.nome,
            'Atendeu fora da vez (próximo era ' + (proximoAtual || 'ninguém') + ') — +1 crédito de rodada (total: ' + info.creditos + ').']);
        }
      }
      gravarAlteracoesEquipe(estado);
      registrarEventosEmLote(eventos);
      res.proximo = calcularProximo(estado);
      return res;
    }

    if (resolverProximoForcadoSeForEsse(analista)) {
      // Era o próximo só por causa da reinserção manual — o relógio físico já
      // está exatamente onde deveria continuar (não foi tocado quando a marca
      // foi criada), então não há nada mais a fazer aqui.
      // ALTERADO (1.4.6): relê o forçado (pode ter vindo alguém da espera).
      estado.forcado = obterProximoForcado();
      gravarAlteracoesEquipe(estado);
      registrarEventosEmLote(eventos);
      res.tipo = 'FORCADO';
      res.proximo = calcularProximo(estado);
      return res;
    }

    // Fluxo normal: ele era genuinamente o próximo segundo o relógio físico —
    // agora sim avança de verdade, reconstruindo em ordem ascendente.
    res.tipo = 'GIROU';
    const todos = estado.ordenados;
    if (todos.length === 0) return res;

    const indice = todos.findIndex(i => i.chave === chave);
    if (indice === -1) {
      registrarEvento('', '', 'FILA_NAO_GIROU', analista, 'Não foi possível mover "' + analista + '" para o fim da fila: não encontrado na aba EQUIPE.');
      return res;
    }
    const ocorrencias = todos.filter(i => i.chave === chave).length;
    if (ocorrencias > 1) {
      eventos.push(['', '', 'FILA_DUPLICATA_ENCONTRADA', analista, 'Encontradas ' + ocorrencias + ' linhas de "' + analista + '" na aba EQUIPE. Considere remover as duplicadas manualmente.']);
    }

    // NOVO (1.3.8): quem estava fisicamente ANTES dele na fila foi "passado" nesta
    // rodada (estava ausente ou com crédito) — quem tinha crédito consome 1 aqui,
    // senão seria saltado de novo na rodada seguinte (punição dupla).
    for (let f = 0; f < estado.filaFisica.length; f++) {
      const chaveF = normalizarNome(estado.filaFisica[f]);
      if (chaveF === chave) break;
      const infoF = estado.porNome[chaveF];
      if (infoF && infoF.creditos > 0 && !infoF.almoco) { // ALTERADO (1.4.13): almoço congela o crédito
        infoF.creditos -= 1;
        marcarAlteracao(estado, infoF, 'creditos');
        eventos.push(['', '', 'CREDITO_RODADA_CONSUMIDO', infoF.nome, 'Crédito de rodada consumido (vez já atendida fora de ordem). Restam: ' + infoF.creditos + '.']);
      }
    }

    // Quem vem logo depois dele, em ordem ascendente (com volta ao início), assume a
    // frente física — pulando quem não é um "próximo" válido:
    //  - Rodada a Pular (Novo Erro): consome 1 por passagem;
    //  - NOVO: Crédito de rodada (atendeu fora da vez): consome 1 por passagem;
    //  - AUSENTE: não consome nada, só não pode ser a frente física.
    // Só para quando achar alguém ATIVO sem rodadas e sem créditos.
    let k = (indice + 1) % todos.length;
    let voltas = 0;
    while (voltas < todos.length) {
      const info = todos[k];
      if (info.almoco) {
        // NOVO (1.4.13): no almoço — ignorado pelo relógio (não consome rodada nem crédito).
      } else if (info.rodadas > 0) {
        info.rodadas -= 1;
        marcarAlteracao(estado, info, 'rodadas');
        eventos.push(['', '', 'RODADA_PULADA', info.nome, 'Rodada (Novo Erro) consumida — preterido nesta passagem da fila.']);
      } else if (info.creditos > 0) {
        info.creditos -= 1;
        marcarAlteracao(estado, info, 'creditos');
        eventos.push(['', '', 'CREDITO_RODADA_CONSUMIDO', info.nome, 'Crédito de rodada consumido (vez já atendida fora de ordem). Restam: ' + info.creditos + '.']);
      } else if (info.status !== 'ATIVO') {
        // Ausente/pausado — não consome nada.
      } else {
        break;
      }
      k = (k + 1) % todos.length;
      voltas++;
    }

    reconstruirFilaComFrente(todos[k].nome, estado);
    gravarAlteracoesEquipe(estado);
    registrarEventosEmLote(eventos);
    res.proximo = calcularProximo(estado);
    return res;
  });
}

/*************************************************
 * 7a. ⚙️ MOTOR DA FILA — ESTADO EM MEMÓRIA (1.3.8)
 *************************************************/
// Antes cada pergunta "quem é o próximo?" lia a EQUIPE inteira uma vez POR PESSOA
// verificada (obterRodadasAPular), e o Pular fazia isso duas vezes, mais 3 leituras
// extras. Agora cada ação lê EQUIPE + FILA + Próximo Forçado UMA vez, decide tudo em
// memória e grava só o que mudou.

// Trava única do script (LockService). Reentrante dentro da mesma execução.
let TRAVA_SCRIPT_EM_USO = false;

/**
 * Executa fn() com a trava do script. Se outra ação estiver com a trava, espera até
 * esperaMs; sem conseguir: lança erro (padrão) ou devolve undefined (silencioso).
 */
function executarComTrava(fn, esperaMs, silencioso) {
  if (TRAVA_SCRIPT_EM_USO) return fn();
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(esperaMs || 15000)) {
    if (silencioso) return undefined;
    throw new Error('A fila está sendo atualizada por outra ação. Tente de novo em instantes.');
  }
  TRAVA_SCRIPT_EM_USO = true;
  try {
    return fn();
  } finally {
    TRAVA_SCRIPT_EM_USO = false;
    SpreadsheetApp.flush();
    lock.releaseLock();
  }
}

/** Garante que a aba tenha pelo menos "colunas" colunas físicas. */
function garantirColunas(sheet, colunas) {
  const faltam = colunas - sheet.getMaxColumns();
  if (faltam > 0) sheet.insertColumnsAfter(sheet.getMaxColumns(), faltam);
}

/**
 * Lê tudo o que o motor da fila precisa, uma vez só:
 *  porNome      -> info por nome normalizado (1ª ocorrência na EQUIPE)
 *  ordenados    -> todos da EQUIPE em ordem ascendente da Coluna A (Ordem)
 *  emOrdemLinha -> todos da EQUIPE na ordem das linhas (lista dos dropdowns)
 *  filaFisica   -> nomes da aba FILA, de cima pra baixo
 *  forcado      -> Próximo Forçado atual (ou null)
 */
function carregarEstadoFila() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const equipeSheet = ss.getSheetByName(CONFIG.ABA_EQUIPE);
  const filaSheet = ss.getSheetByName(CONFIG.ABA_FILA);
  const estado = {
    equipeSheet: equipeSheet, filaSheet: filaSheet,
    porNome: {}, ordenados: [], emOrdemLinha: [], filaFisica: [],
    forcado: obterProximoForcado(), alterados: [], viradaPendente: 0
  };

  const ultimaEquipe = equipeSheet ? equipeSheet.getLastRow() : 0;
  if (ultimaEquipe >= 2) {
    const larg = Math.min(COL_CREDITOS_RODADA, equipeSheet.getMaxColumns());
    const dados = equipeSheet.getRange(2, 1, ultimaEquipe - 1, larg).getValues();
    const agoraAlmoco = new Date(); // NOVO (1.4.13)
    const agoraMinAlmoco = agoraAlmoco.getHours() * 60 + agoraAlmoco.getMinutes();
    dados.forEach((l, i) => {
      if (!l[1] || String(l[1]).trim() === '') return;
      const info = {
        linha: i + 2, ordem: l[0], nome: l[1], chave: normalizarNome(l[1]),
        status: String(l[2]).toUpperCase().trim(),
        rodadas: Number(l[8]) || 0,
        creditos: larg >= COL_CREDITOS_RODADA ? (Number(l[COL_CREDITOS_RODADA - 1]) || 0) : 0,
        almoco: ehAlmocoAgora_(l, agoraMinAlmoco), // NOVO (1.4.13): ausente pelo almoço agora
        mudou: {}
      };
      if (!estado.porNome[info.chave]) estado.porNome[info.chave] = info;
      estado.emOrdemLinha.push(info);
    });
    estado.ordenados = estado.emOrdemLinha.slice().sort((a, b) => Number(a.ordem) - Number(b.ordem));
  }

  if (filaSheet && filaSheet.getLastRow() >= 2) {
    estado.filaFisica = filaSheet.getRange(2, 1, filaSheet.getLastRow() - 1, 2).getValues()
      .map(l => l[1])
      .filter(n => n && String(n).trim() !== '');
  }
  return estado;
}

/**
 * Quem é o próximo, calculado só em memória (não grava nada, exceto descartar um
 * Próximo Forçado que deixou de ser elegível — igual antes).
 *  1) Próximo Forçado, se ATIVO e sem Rodada a Pular;
 *  2) 1º da FILA física que esteja ATIVO, sem Rodada a Pular e sem Crédito;
 *  3) NOVO: se ninguém sobrou porque TODOS os ativos já têm crédito, a rodada está
 *     fechada — considera a "virada" (desconta o menor crédito de todos) e procura
 *     de novo. A virada só é gravada de fato quando alguém mexe na fila
 *     (aplicarViradaDeRodada).
 * ALTERADO (1.4.6): forçado descartado dá lugar ao 1º da espera (que também precisa
 * estar ATIVO e sem Rodada a Pular — senão é descartado e passa pro seguinte).
 */
function calcularProximo(estado) {
  estado.viradaPendente = 0;

  let guarda = 0;
  while (estado.forcado && guarda < 20) {
    const infoF = estado.porNome[normalizarNome(estado.forcado)];
    if (infoF && infoF.status === 'ATIVO' && infoF.rodadas === 0) return estado.forcado;
    estado.forcado = liberarProximoForcado(estado.forcado);
    guarda++;
  }

  const varrer = (desconto) => {
    for (let i = 0; i < estado.filaFisica.length; i++) {
      const info = estado.porNome[normalizarNome(estado.filaFisica[i])];
      if (info && info.status === 'ATIVO' && info.rodadas === 0 && (info.creditos - desconto) <= 0) {
        return estado.filaFisica[i];
      }
    }
    return null;
  };

  let nome = varrer(0);
  if (nome) return nome;

  let menor = Infinity;
  estado.filaFisica.forEach(n => {
    const info = estado.porNome[normalizarNome(n)];
    if (info && info.status === 'ATIVO' && info.rodadas === 0 && info.creditos > 0) {
      menor = Math.min(menor, info.creditos);
    }
  });
  if (menor === Infinity) return null;

  estado.viradaPendente = menor;
  return varrer(menor);
}

/** Grava a virada de rodada calculada em calcularProximo (se houver). */
function aplicarViradaDeRodada(estado, eventos) {
  const m = estado.viradaPendente;
  if (!m) return;
  estado.emOrdemLinha.forEach(info => {
    if (info.creditos > 0) {
      info.creditos = Math.max(0, info.creditos - m);
      marcarAlteracao(estado, info, 'creditos');
    }
  });
  estado.viradaPendente = 0;
  eventos.push(['', '', 'RODADA_FECHADA_CREDITOS', '', 'Todos os ativos já tinham atendido nesta rodada — créditos descontados em ' + m + ' para iniciar a próxima.']);
}

function marcarAlteracao(estado, info, campo) {
  info.mudou[campo] = true;
  if (estado.alterados.indexOf(info) === -1) estado.alterados.push(info);
}

/** Grava na EQUIPE só as células de Rodadas (I) / Créditos (L) que mudaram. */
function gravarAlteracoesEquipe(estado) {
  if (!estado.alterados.length) return;
  const sheet = estado.equipeSheet;
  if (estado.alterados.some(i => i.mudou.creditos)) garantirColunas(sheet, COL_CREDITOS_RODADA);
  estado.alterados.forEach(info => {
    if (info.mudou.rodadas) sheet.getRange(info.linha, 9).setValue(info.rodadas);
    if (info.mudou.creditos) sheet.getRange(info.linha, COL_CREDITOS_RODADA).setValue(info.creditos);
    info.mudou = {};
  });
  estado.alterados = [];
}

/**
 * Grava vários eventos de uma vez.
 * ALTERADO (1.3.15): cada item é [canal, protocolo, tipo, analista, descricao, chatId?];
 * o lote é separado pela aba de destino de cada tipo e gravado com UMA escrita por aba.
 * Se a aba não tiver linhas físicas suficientes, elas são criadas antes (getRange fora
 * do tamanho da grade dá erro — o appendRow cresce sozinho, o setValues não).
 */
function registrarEventosEmLote(lista) {
  return gravarEventosEmLote(lista);
}

// NOVO (1.4.11): corpo original de registrarEventosEmLote (o motor da fila usa uma versão
// local que carimba protocolo/chat_id antes de chamar esta).
function gravarEventosEmLote(lista) {
  if (!lista || !lista.length) return;
  const agora = new Date();
  const grupos = {};
  lista.forEach(e => {
    const aba = obterAbaDestinoEvento(e[2]);
    (grupos[aba] = grupos[aba] || []).push([agora, e[0] || '', e[1], e[2], e[3], e[4], e[5] ? String(e[5]) : '']);
  });
  Object.keys(grupos).forEach(nomeAba => {
    const sheet = obterAbaEventos(nomeAba);
    const linhas = grupos[nomeAba];
    const inicio = sheet.getLastRow() + 1;
    const faltam = (inicio + linhas.length - 1) - sheet.getMaxRows();
    if (faltam > 0) sheet.insertRowsAfter(sheet.getMaxRows(), faltam);
    sheet.getRange(inicio, 1, linhas.length, COLUNAS_EVENTOS).setValues(linhas);
  });
}

/**
 * NOVO (1.3.8): estorna 1 crédito de rodada (atendimento fora da vez que não contou:
 * ignorado pela tag ou virou Retorno). Se o crédito já tinha sido consumido pelo
 * relógio, só registra o evento.
 */
function estornarCreditoRodada(analista, protocolo, motivo) {
  try {
    executarComTrava(() => {
      const estado = carregarEstadoFila();
      const info = estado.porNome[normalizarNome(analista)];
      if (info && info.creditos > 0) {
        info.creditos -= 1;
        marcarAlteracao(estado, info, 'creditos');
        gravarAlteracoesEquipe(estado);
        registrarEvento('', protocolo, 'CREDITO_RODADA_ESTORNADO', info.nome, 'Crédito de rodada estornado (' + motivo + '). Restam: ' + info.creditos + '.');
      } else {
        registrarEvento('', protocolo, 'CREDITO_RODADA_JA_CONSUMIDO', analista, 'Crédito de rodada não estornado (' + motivo + '): já tinha sido consumido pelo relógio da fila.');
      }
    });
  } catch (e) {
    registrarEvento('', protocolo, 'CREDITO_RODADA_ERRO_ESTORNO', analista, 'Erro ao estornar crédito de rodada: ' + e.message);
  }
}

/** NOVO (1.3.8): zera os créditos de rodada (ausência via "Informar Ausência"). */
function zerarCreditosRodada(analista, motivo) {
  executarComTrava(() => {
    const estado = carregarEstadoFila();
    const info = estado.porNome[normalizarNome(analista)];
    if (!info || info.creditos <= 0) return;
    const tinha = info.creditos;
    info.creditos = 0;
    marcarAlteracao(estado, info, 'creditos');
    gravarAlteracoesEquipe(estado);
    registrarEvento('', '', 'CREDITOS_RODADA_ZERADOS', info.nome, tinha + ' crédito(s) de rodada zerado(s) — ' + motivo + '.');
  });
}

/*************************************************
 * 7b. 🎯 COLOCAR COMO PRÓXIMO (era "Voltar Próximo")
 *************************************************/
// Escolha manual — a Coordenação/analista escolhe QUALQUER analista ATIVO num
// modal e ele "fura a fila" por UMA rodada. Diferente da v1 desta função, NÃO
// reconstrói mais a fila física — só marca um "Próximo Forçado" (ver acima).
// Isso é o que garante que, quando essa pessoa for atendida (ou pulada), o
// relógio volta a valer exatamente de onde estava antes da interrupção — sem
// fazer quem já tinha sido chamado nessa rodada (ex: alguém que veio logo
// depois de quem foi pulado antes) ser chamado de novo à toa.
function colocarComoProximo(analista, motivo, quemAcionou) {
  if (!analista) return null;

  definirProximoForcado(analista);

  if (typeof registrarEvento === 'function') {
    const ehAutosselecao = quemAcionou && String(quemAcionou).trim().toLowerCase() === String(analista).trim().toLowerCase();
    if (ehAutosselecao) {
      // NOVO: autosseleção (o próprio analista logado se recolocando como
      // próximo) ganha um evento dedicado, pra dar pra rastrear depois se
      // alguém se ausentou e voltou pra fila por ter perdido a vez.
      registrarEvento('', '', 'ENTROU_FILA_MANUAL', analista, 'Analista ' + analista + ' retornou manualmente para fila. Motivo: ' + motivo);
    } else {
      registrarEvento('', '', 'ANALISTA_COLOCADO_COMO_PROXIMO', analista, 'Colocado manualmente como próximo' + (quemAcionou ? (' por ' + quemAcionou) : '') + ' (interrupção de uma rodada, sem mexer no relógio da fila). Motivo: ' + motivo);
    }
  }

  return analista;
}

/**
 * Ponte chamada pelo Widget Flutuante — abre a lista de ativos e coloca quem
 * for escolhido como o novo "próximo" da fila. NOVO: motivo agora é
 * obrigatório em qualquer uso (autosseleção ou escolhendo outro analista).
 */
function webColocarComoProximo(analista, motivo, quemAcionou, forcar) {
  if (!analista) throw new Error("Informe o analista.");
  if (!motivo || !String(motivo).trim()) throw new Error("Informe o motivo.");

  // NOVO: bloqueia colocar alguém como próximo se ele JÁ é o próximo (natural
  // ou por uma marca de forçado já existente) — fazer isso de novo duplicava
  // a vez dele (era exatamente a raiz do bug de repetição na Transferência).
  // `forcar` permite pular essa checagem em casos extremos, sem precisar
  // tocar em código — quem decide se oferece esse atalho é o Widget.
  if (!forcar && typeof obterProximoAnalista === 'function') {
    const proximoAtual = obterProximoAnalista();
    if (proximoAtual && normalizarNome(proximoAtual) === normalizarNome(analista)) {
      throw new Error("Não é possível colocar como próx. quando já é o próx. da lista");
    }
  }

  try {
    const nome = colocarComoProximo(analista, motivo, quemAcionou);
    if (!nome) {
      throw new Error("Não foi possível reorganizar a fila.");
    }
    return { sucesso: true, analista: nome };
  } catch (erro) {
    throw new Error("Erro ao colocar como próximo: " + erro.message);
  }
}

/*************************************************
 * WEBHOOK (UPDATE EM ATENDIMENTO & DURAÇÃO)
 *************************************************/

function doPost(e) {
  try {
    const conteudo = JSON.parse(e.postData.contents);

    // NOVO: ações vindas do Modo Mini (userscript externo) -- diferenciado do
    // payload do Jivo pelo campo "fonte", que o webhook do Jivo nunca envia.
    // Fica ANTES da checagem de evento pra não competir com o fluxo do Jivo.
    if (conteudo.fonte === 'modoMini') {
      return processarAcaoModoMini(conteudo);
    }

       // NOVO (1.4.15): entrada de e-mails vinda do FluxoContinuo (conta de suporte), com chave secreta.
       if (conteudo.fonte === 'fluxoEmails') {
         return processarLoteFluxoEmails(conteudo);
       }
    
    const evento = conteudo.event_name || conteudo.event;
    registrarWebhookLog(conteudo);

    if (evento === 'chat_accepted') {
      // NOVO: chat_accepted cria a linha direto como EM ATENDIMENTO (sem
      // estagio de triagem), porque o protocolo precisa existir na hora pro
      // analista passar ao cliente. Substitui o clique manual em "Assumir"
      // para os chats que chegam via webhook -- o botao Assumir continua
      // funcionando normalmente como fallback manual.
      processarWebhookSemDuplicar('chat_accepted', conteudo, () => iniciarAtendimentoPorChatAccepted(conteudo));
    }

    if (evento === 'chat_finished') {
      // O payload do chat_finished não usa "assigned_agent" (vem null nesse evento): o
      // agente que atendeu está no array "agents".
      // ALTERADO (1.3.16): o tópico vem de payload.topic ({ topic_id, title, parent_id }),
      // gravado sem o emoji do início. Antes lia payload.tags (sempre vazio) e a Coluna I
      // ficava "Sem Tópico". Tags não são mais lidas.
      const topicoInfo = obterTopicoDoPayload(conteudo);
      const topico = topicoInfo.titulo;

      const idAgent = (conteudo.agents && conteudo.agents.length > 0)
        ? String(conteudo.agents[0].id)
        : '';

      // NOVO: traduz o widget_id (se vier no payload) pro nome do canal, pra
      // usar como filtro extra na hora de achar a linha certa pra fechar
      // (resolve o caso de um analista com mais de um EM ATENDIMENTO ao mesmo tempo).
      const canalNome = conteudo.widget_id ? obterNomeCanal(conteudo.widget_id) : '';
      // NOVO: chat_id é o critério mais confiável de correlação -- sobrevive a
      // Transferência e Retorno, que nunca reescrevem a Coluna P.
      const chatId = conteudo.chat_id ? String(conteudo.chat_id) : '';

      // DESATIVADO (1.3.8): diagnóstico temporário da antiga tag "Cliente Agradeceu" — gravava
      // um DEBUG_TAG_CHAT_FINISHED a cada chat encerrado. Para reativar,
      // descomente as 4 linhas abaixo.
      // if (typeof registrarEvento === 'function') {
      //   const achadosTag = buscarTextoNoPayload(conteudo, /agradec/i);
      //   registrarEvento(canalNome, '', 'DEBUG_TAG_CHAT_FINISHED', '', 'Campos do payload: ' + Object.keys(conteudo).join(', ') + ' | Textos com "agradec": ' + (achadosTag.length ? achadosTag.join(' ; ') : 'nenhum'), chatId);
      // }

      // ALTERADO (1.3.10): protegido contra evento repetido do Jivo (mesmo chat_id).
      processarWebhookSemDuplicar('chat_finished', conteudo, () => {
        if (idAgent) {
          // NOVO (1.4.10): encerrado SEM tópico = possível queda do analista no Jivo. A linha
          // fica em espera de reconexão (não encerra agora). Se não der pra esperar (sem
          // chat_id / visitante / linha), segue o encerramento normal.
          if (chatFinalizadoSemTopico(conteudo) && colocarEmEsperaReconexaoJivo(conteudo, idAgent, canalNome, chatId)) return;
          finalizarAtendimentoPorIdAgent(idAgent, topico, canalNome, chatId, topicoQueIgnoraProtocolo(topicoInfo), topicoInfo);
        } else if (typeof registrarEvento === 'function') {
          // NOVO: loga quando o próprio Jivo não informou nenhum agente no array "agents"
          registrarEvento(canalNome, '', 'WEBHOOK_SEM_AGENTE', '', 'Webhook chat_finished recebido sem nenhum agente no array "agents". Tópico: ' + topico, chatId);
        }
      });
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (erro) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: erro.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/*************************************************
 * 🛡️ PROTEÇÃO CONTRA WEBHOOK DUPLICADO (1.3.9)
 *************************************************/
// O Jivo às vezes reenvia o mesmo evento segundos depois (ex.: chat 31643 em 29/09,
// 09:03:03 e 09:03:06). Cada evento é processado UMA vez por chat_id: a checagem e o
// processamento rodam dentro da trava do script e o chat_id fica marcado no cache por
// 6h. No chat_accepted também confere a Coluna P da PROTOCOLOS (cobre cache expirado).
// Sem chat_id no payload, segue como antes.
const WEBHOOK_DEDUP_SEGUNDOS = 21600; // 6h — máximo do CacheService

function processarWebhookSemDuplicar(evento, conteudo, executar) {
  const chatId = (conteudo && conteudo.chat_id) ? String(conteudo.chat_id).trim() : '';
  if (!chatId) {
    executar();
    return;
  }

  executarComTrava(() => {
    const cache = CacheService.getScriptCache();
    const chave = 'WH_' + evento + '_' + chatId;

    const jaProcessado = !!cache.get(chave) ||
      (evento === 'chat_accepted' && chatIdJaRegistradoEmProtocolos(chatId));

    if (jaProcessado) {
      const agente = evento === 'chat_accepted'
        ? conteudo.agent
        : (Array.isArray(conteudo.agents) ? conteudo.agents[0] : null);
      const agenteTexto = agente ? (String(agente.id) + ':' + (agente.name || '')) : 'não informado';
      const canalDup = conteudo.widget_id ? obterNomeCanal(conteudo.widget_id) : ''; // NOVO (1.3.15)
      registrarEvento(canalDup, '', 'WEBHOOK_DUPLICADO_IGNORADO', '',
        'Evento ' + evento + ' repetido para o chat_id ' + chatId + ' (agente ' + agenteTexto + ') — ignorado.', chatId);
      return;
    }

    executar();
    // Só marca depois de processar: se der erro no meio, um reenvio do Jivo ainda é aceito.
    cache.put(chave, '1', WEBHOOK_DEDUP_SEGUNDOS);
  }, 25000);
}

function chatIdJaRegistradoEmProtocolos(chatId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  if (!sheet || sheet.getLastRow() < 2 || sheet.getLastColumn() < 16) return false;
  const valores = sheet.getRange(2, 16, sheet.getLastRow() - 1, 1).getValues(); // Coluna P
  return valores.some(l => String(l[0]).trim() === chatId);
}

/**
 * NOVO: traduz um ID de agente do Jivo (Coluna D da aba EQUIPE) pro nome do
 * analista cadastrado. Reaproveitado tanto por chat_accepted quanto por
 * chat_finished, pra garantir que os dois usam exatamente a mesma logica de
 * traducao.
 */
function obterAnalistaPorIdAgent(idAgent) {
  const equipeSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  const dadosEquipe = equipeSheet.getDataRange().getValues();

  for (let i = 1; i < dadosEquipe.length; i++) {
    if (String(dadosEquipe[i][3]) === idAgent) {
      return dadosEquipe[i][1]; // Coluna B: Analista
    }
  }
  return '';
}

/**
 * NOVO: traduz um widget_id do Jivo (aba CANAIS) pro nome do canal. Se o
 * canal nao estiver cadastrado na aba CANAIS, devolve o proprio widget_id
 * como texto (fallback), pra nunca travar o fluxo por causa de um canal
 * novo que ainda nao foi cadastrado manualmente.
 */
function obterNomeCanal(widgetId) {
  const canaisSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_CANAIS);
  if (!canaisSheet || canaisSheet.getLastRow() < 2) return String(widgetId);

  const dadosCanais = canaisSheet.getDataRange().getValues();
  for (let i = 1; i < dadosCanais.length; i++) {
    if (String(dadosCanais[i][0]) === String(widgetId)) {
      return dadosCanais[i][1];
    }
  }
  return String(widgetId);
}

/**
 * NOVO: dispara no chat_accepted. Cria a linha em PROTOCOLOS ja como EM
 * ATENDIMENTO, com protocolo novo, canal (Coluna N) e nome do cliente
 * (Coluna O) -- substituindo o clique manual em "Assumir" para chats que
 * chegam via webhook. O botao Assumir continua funcionando normalmente
 * como fallback manual.
 * ALTERADO (1.3.15): todos os eventos daqui levam canal e chat_id.
 */
function iniciarAtendimentoPorChatAccepted(conteudo) {
  const chatIdEv = conteudo.chat_id ? String(conteudo.chat_id) : '';
  const nomeCanal = conteudo.widget_id ? obterNomeCanal(conteudo.widget_id) : '';

  const idAgent = conteudo.agent && conteudo.agent.id ? String(conteudo.agent.id) : '';
  if (!idAgent) {
    if (typeof registrarEvento === 'function') {
      registrarEvento(nomeCanal, '', 'WEBHOOK_CHAT_ACCEPTED_SEM_AGENTE', '', 'Webhook chat_accepted recebido sem "agent.id".', chatIdEv);
    }
    return;
  }

  const nomeAnalista = obterAnalistaPorIdAgent(idAgent);
  if (!nomeAnalista) {
    if (typeof registrarEvento === 'function') {
      registrarEvento(nomeCanal, '', 'WEBHOOK_AGENTE_NAO_ENCONTRADO', '', 'Webhook chat_accepted recebido com ID de agente "' + idAgent + '" que nao corresponde a nenhum analista na aba EQUIPE. Analistas cadastrados: ' + obterMapeamentoAnalistasEquipe(), chatIdEv);
    }
    return;
  }

  // NOVO (1.4.10): mesmo analista reassumindo o mesmo visitante logo após uma queda —
  // reaproveita a linha/protocolo original (sem linha nova, sem girar fila, sem crédito).
  if (tentarReconexaoJivo(conteudo, idAgent, nomeAnalista, nomeCanal)) return;

  const nomeCliente = (conteudo.visitor && conteudo.visitor.name) ? conteudo.visitor.name : '';

  const protocolo = gerarProtocolo();
  const agora = new Date();

  // ALTERADO (1.3.8): gira a fila ANTES de gravar a linha, numa passada só (antes
  // eram duas leituras completas: uma pra descobrir se ia girar, outra pra girar).
  // O resultado alimenta:
  //  - Coluna Q: quem girou a fila (era o próximo físico, sem Próximo Forçado) — é o
  //    que permite devolver a vez nos tópicos que não contam protocolo / Retorno;
  //  - Coluna R (NOVO): quem ganhou crédito de rodada por aceitar FORA da vez — é o
  //    que permite estornar o crédito nesses mesmos casos.
  // Uma falha na fila nunca derruba o webhook (a linha é criada de qualquer jeito).
    // NOVO (1.4.13): aplica a virada do almoço ANTES do giro — quem já devia ter voltado (ex.: 13h02,
  // almoço até 13h) entra como ATIVO e não ganha crédito por \"atender fora da vez\".
  try { sincronizarAlmocoAgora(true); } catch (e) {}
  let giro = { tipo: '', credito: false };
  try {
    giro = moverAnalistaParaFimDaFila(nomeAnalista, { gerarCredito: true, protocolo: protocolo, chatId: chatIdEv, canal: nomeCanal }) || giro; // ALTERADO (1.4.11)
  } catch (erroFila) {
    registrarEvento(nomeCanal, protocolo, 'FILA_NAO_GIROU', nomeAnalista, 'Erro ao girar a fila após chat_accepted: ' + erroFila.message, chatIdEv);
  }
  const quemGirouFila = giro.tipo === 'GIROU' ? nomeAnalista : '';
  const protSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  protSheet.appendRow([
    protocolo,                 // A: Protocolo
    agora,                     // B: Data (Chat Aceito) -- base do calculo de duracao
    nomeAnalista,               // C: Analista
    'Chat Aceito (Webhook)',     // D: Tipo
    'EM ATENDIMENTO',             // E: Status
    agora,                        // F: Iniciado
    '',                            // G: Encerrado
    '',                             // H: Duracao
    '',                              // I: Topico/Tag
    '',                               // J: Protocolo Fonte (Protocolo Multiplo -- nao se aplica aqui)
    '',                                // K: Motivo da Pausa
    '',                                 // L: Pausado Desde
    0,                                   // M: Pausas Acumuladas
    nomeCanal,                            // N: Canal (NOVO)
    nomeCliente,                           // O: Cliente (NOVO)
    conteudo.chat_id || '',                 // P: Chat ID do Jivo (NOVO)
    quemGirouFila,                           // Q: Quem girou a fila neste aceite (NOVO)
    giro.credito ? nomeAnalista : '',         // R: Crédito de rodada gerado neste aceite (1.3.8)
    nomeAnalista                               // S: quem aceitou o chat (NOVO 1.4.9 — 📜 Últimos)
  ]);

  registrarEvento(nomeCanal, protocolo, 'CHAT_ACCEPTED_WEBHOOK', nomeAnalista, 'Atendimento iniciado automaticamente via webhook. Canal: ' + nomeCanal + ' | Cliente: ' + (nomeCliente || 'nao informado') + (giro.credito ? ' | Fora da vez: +1 crédito de rodada.' : ''), chatIdEv);
}

/**
 * NOVO: retorna a lista "Analista (ID: xxx)" de todos os analistas cadastrados na
 * EQUIPE. Reutilizável em qualquer log que precise mostrar o mapeamento atual de
 * ID de agente Jivo x nome do analista (ex: quando um ID não bate com ninguém).
 */
function obterMapeamentoAnalistasEquipe() {
  const equipeSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  if (!equipeSheet || equipeSheet.getLastRow() < 2) return 'nenhum analista cadastrado';

  const dadosEquipe = equipeSheet.getDataRange().getValues();
  let mapeamento = [];

  for (let i = 1; i < dadosEquipe.length; i++) {
    const nomeEquipe = dadosEquipe[i][1]; // Coluna B: Analista
    const idEquipe = dadosEquipe[i][3];   // Coluna D: ID do Agente
    if (nomeEquipe) {
      mapeamento.push(nomeEquipe + ' (ID: ' + (idEquipe || 'sem ID') + ')');
    }
  }

  return mapeamento.length > 0 ? mapeamento.join(', ') : 'nenhum analista cadastrado';
}

// ALTERADO (1.4.9): 6º parâmetro opcional "topicoInfo" ({ titulo, id }) — usado pelos
// tópicos "Primeiro Contato" (encerra também a linha PAUSADA) e "Retorno Atendimento".
// ALTERADO (1.4.10): 7º parâmetro opcional "dataFimForcada" (Date) — usado pela reconexão
// expirada, que encerra com a hora da queda e não com a hora em que o gatilho rodou.
function finalizarAtendimentoPorIdAgent(idAgent, topico, canalNome, chatId, topicoIgnorado, topicoInfo, dataFimForcada) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  // ALTERADO: usa o helper obterAnalistaPorIdAgent (mesma logica de antes,
  // agora compartilhada com iniciarAtendimentoPorChatAccepted).
  const nomeAnalista = obterAnalistaPorIdAgent(idAgent);

  if (!nomeAnalista) {
    if (typeof registrarEvento === 'function') {
      registrarEvento(canalNome || '', '', 'WEBHOOK_AGENTE_NAO_ENCONTRADO', '', 'Webhook chat_finished recebido com ID de agente "' + idAgent + '" que não corresponde a nenhum analista na aba EQUIPE (Coluna D). Analistas cadastrados: ' + obterMapeamentoAnalistasEquipe() + '. Tópico: ' + topico, chatId);
    }
    return;
  }

  const protSheet = ss.getSheetByName(CONFIG.ABA_PROTOCOLOS);
  const dadosProt = protSheet.getDataRange().getValues();

  // NOVO: se veio canalNome, procura primeiro uma linha que bata tambem no
  // canal (Coluna N) -- resolve o caso de um analista com mais de um
  // atendimento EM ATENDIMENTO ao mesmo tempo. Se nenhuma linha bater no
  // canal (ex: canal nao veio no payload, ou nao esta cadastrado na aba
  // CANAIS), cai no comportamento antigo: so idAgent + status.
  let linhaEscolhida = -1;

  // NOVO: chat_id é a prioridade máxima -- sobrevive a Transferência e Retorno,
  // que só reescrevem Analista/Protocolo/Status, nunca a Coluna P.
  if (chatId) {
    for (let i = dadosProt.length - 1; i >= 1; i--) {
      if (String(dadosProt[i][15]) === chatId &&
          String(dadosProt[i][4]).toUpperCase() === 'EM ATENDIMENTO') {
        linhaEscolhida = i;
        break;
      }
    }
  }
  // ALTERADO (1.3.16): chat encerrado com um tópico de TOPICOS_IGNORAR_PROTOCOLO
  // (Cliente Agradeceu / Orientação Processos) — o atendimento não conta protocolo.
  // ALTERADO (1.4.6): a linha não é mais apagada — fica ENCERRADA como "ignorado" (o
  // tópico vai junto pra Coluna I).
  if (linhaEscolhida !== -1 && topicoIgnorado) {
    if (ignorarAtendimentoPorTopico(protSheet, dadosProt[linhaEscolhida], linhaEscolhida + 1, nomeAnalista, topicoIgnorado, topico)) {
      return;
    }
    // não pôde ignorar (ex.: era Retorno): segue o encerramento normal logo abaixo.
  }
  if (linhaEscolhida === -1 && canalNome) {
    for (let i = dadosProt.length - 1; i >= 1; i--) {
      if (String(dadosProt[i][2]).toLowerCase() === nomeAnalista.toLowerCase() &&
          String(dadosProt[i][4]).toUpperCase() === 'EM ATENDIMENTO' &&
          String(dadosProt[i][13]).toLowerCase() === canalNome.toLowerCase()) {
        linhaEscolhida = i;
        break;
      }
    }
  }
  if (linhaEscolhida === -1) {
    for (let i = dadosProt.length - 1; i >= 1; i--) {
      if (String(dadosProt[i][2]).toLowerCase() === nomeAnalista.toLowerCase() &&
          String(dadosProt[i][4]).toUpperCase() === 'EM ATENDIMENTO') {
        linhaEscolhida = i;
        break;
      }
    }
  }

  // NOVO (1.4.9): o analista encerrou no Jivo sem retomar a linha (PAUSADO / EM FILA). Só
  // quando o tópico é "Primeiro Contato": encerra a linha pausada do MESMO chat (chat_id;
  // sem chat_id no payload, a pausada do analista no mesmo canal) e deixa o log
  // ENCERRADO_PAUSADO_PRIMEIRO_CONTATO (base de um indicador futuro). Outros tópicos
  // seguem como antes (aviso de atendimento não encontrado).
  let encerrouPausado = false;
  if (linhaEscolhida === -1 && topicoBate(topicoInfo || { titulo: topico, id: null }, TOPICO_PRIMEIRO_CONTATO)) {
    for (let i = dadosProt.length - 1; i >= 1; i--) {
      if (String(dadosProt[i][4]).toUpperCase().trim() !== 'PAUSADO') continue;
      const bateChat = chatId ? String(dadosProt[i][15]) === chatId
        : (canalNome && String(dadosProt[i][2]).toLowerCase() === nomeAnalista.toLowerCase() &&
           String(dadosProt[i][13]).toLowerCase() === canalNome.toLowerCase());
      if (bateChat) {
        linhaEscolhida = i;
        encerrouPausado = true;
        break;
      }
    }
  }

  // NOVO (1.4.9): tópico "Retorno Atendimento" numa linha que ainda não é Retorno.
  const viraRetornoPorTopico = linhaEscolhida !== -1 &&
    topicoBate(topicoInfo || { titulo: topico, id: null }, TOPICO_RETORNO_ATENDIMENTO) &&
    String(dadosProt[linhaEscolhida][3]).trim().toLowerCase() !== 'retorno';

  if (linhaEscolhida !== -1) {
    const i = linhaEscolhida;

    // CORRIGIDO: antes contava a partir da Coluna F (Iniciado = momento do
    // Assumir), então o tempo em EM TRIAGEM/FILA antes de alguém assumir não
    // entrava na conta. Agora conta desde o Chat Aceito (Coluna B), refletindo
    // o tempo total do atendimento do início ao fim.
    const dataInicio = dadosProt[i][1]; // Coluna B (Data do Chat Aceito)
    const dataFim = (dataFimForcada instanceof Date) ? dataFimForcada : new Date(); // ALTERADO (1.4.10)
    const protocolo = dadosProt[i][0];
    // Coluna M guarda o total de segundos que esse atendimento passou
    // PAUSADO -- esse tempo e descontado da duracao final.
    let pausasAcumuladas = Number(dadosProt[i][12]) || 0;
    // NOVO (1.4.9): linha encerrada ainda PAUSADA — a pausa em andamento também sai da duração.
    const pausadoDesde = dadosProt[i][11]; // Coluna L
    if (encerrouPausado && pausadoDesde instanceof Date) {
      pausasAcumuladas += Math.max(0, Math.floor((dataFim - pausadoDesde) / 1000));
    }

    // NOVO (1.3.15): canal / chat_id do evento — o da linha, ou o do payload.
    const origemLinha = canalEChatDaLinhaProtocolo(dadosProt[i]);
    const canalEv = origemLinha.canal || canalNome || '';
    const chatEv = origemLinha.chatId || chatId || '';

    let duracaoTexto = '00:00:00';
    if (dataInicio instanceof Date) {
      const diffSegundos = Math.max(0, Math.floor((dataFim - dataInicio) / 1000) - pausasAcumuladas);
      const horas = Math.floor(diffSegundos / 3600).toString().padStart(2, '0');
      const minutos = Math.floor((diffSegundos % 3600) / 60).toString().padStart(2, '0');
      const segundos = (diffSegundos % 60).toString().padStart(2, '0');
      duracaoTexto = `${horas}:${minutos}:${segundos}`;
    }

    const linha = i + 1;
    protSheet.getRange(linha, 5).setValue('ENCERRADO'); // Coluna E: Status
    protSheet.getRange(linha, 7).setValue(dataFim);       // Coluna G: Encerrado
    // CORRIGIDO: força a célula a ficar como texto puro ('@'), senão o Sheets
    // detecta "00:04:15" como um horário e converte para um valor de data/hora
    // (com a data-zero do Sheets, 30/12/1899), quebrando a exibição no front.
    protSheet.getRange(linha, 8).setNumberFormat('@').setValue(duracaoTexto); // Coluna H: Duração
    protSheet.getRange(linha, 9).setValue(topico);        // Coluna I: Tópico (Jivo, sem emoji)
    if (encerrouPausado) {
      protSheet.getRange(linha, 12).clearContent();          // L: Pausado Desde
      protSheet.getRange(linha, 13).setValue(pausasAcumuladas); // M: Pausas Acumuladas
      registrarEvento(canalEv, protocolo, 'ENCERRADO_PAUSADO_PRIMEIRO_CONTATO', nomeAnalista,
        'Chat encerrado no Jivo com a linha ainda ' + (String(dadosProt[i][10] || '').trim().toLowerCase() === 'fila' ? 'EM FILA' : 'PAUSADA') +
        ' (motivo: ' + (dadosProt[i][10] || '—') + '). Encerrada automaticamente pelo tópico "' + topico + '".', chatEv);
    }

    // NOVO (1.4.9): tópico "Retorno Atendimento" — a linha vira Retorno (selo), com o mesmo
    // tratamento do botão 🔄 Retorno: devolve a vez (se o aceite girou a fila para quem
    // encerrou) e estorna o crédito de rodada do aceite. O RETORNO_REGISTRADO vem ANTES do
    // CHAT_FINISHED: o painel conta Retorno e não conta o encerramento como atendimento.
    if (viraRetornoPorTopico) {
      protSheet.getRange(linha, 4).setValue('Retorno');
      devolverVezPorRetorno(protSheet, linha, dadosProt[i][16], nomeAnalista, protocolo);
      const creditoDoAceite = String(dadosProt[i][COL_PROT_CREDITO - 1] || '').trim();
      if (creditoDoAceite) {
        estornarCreditoRodada(creditoDoAceite, protocolo, 'encerrado com o tópico "' + topico + '"');
        protSheet.getRange(linha, COL_PROT_CREDITO).clearContent();
      }
      registrarEvento(canalEv, protocolo, 'RETORNO_REGISTRADO', nomeAnalista,
        'Retorno pelo tópico "' + topico + '" (id ' + TOPICO_RETORNO_ATENDIMENTO.id + ') — protocolo mantido: ' + protocolo + '.', chatEv);
    }

    registrarEvento(canalEv, protocolo, 'CHAT_FINISHED', nomeAnalista, `Encerrado pelo Jivo. Duração: ${duracaoTexto} | Tópico: ${topico}`, chatEv);

    // Protocolo Multiplo: se esse chamado teve outros erros multiplicados
    // nele (Coluna J preenchida = protocolo base), encerra em cascata todas
    // as linhas "PRÓX. ERRO" que apontam pra essa mesma base.
    const baseProtocolo = dadosProt[i][9]; // Coluna J
    if (baseProtocolo && typeof encerrarDerivadosEmCascata === 'function') {
      encerrarDerivadosEmCascata(baseProtocolo, dataFim, topico, canalEv, chatEv);
    }
  } else {
    // NOVO: log quando o analista foi identificado, mas não havia nenhum atendimento
    // EM ATENDIMENTO para encerrar (ex: já fechado por outro caminho)
    if (typeof registrarEvento === 'function') {
      registrarEvento(canalNome || '', '', 'WEBHOOK_ATENDIMENTO_NAO_ENCONTRADO', '', nomeAnalista + ' não possuía nenhum atendimento EM ATENDIMENTO para encerrar via webhook. Tópico: ' + topico, chatId);
    }
  }
}



/*************************************************
 * 🔌 RECONEXÃO DO JIVO (1.4.10)
 *************************************************/
// Quando o analista cai, o Jivo encerra o chat sozinho (chat_finished SEM tópico) e, quando
// ele reassume, chega um chat_accepted com chat_id NOVO — antes isso virava um 2º
// atendimento (linha, protocolo, giro de fila e crédito duplicados).
// Agora:
//  1) chat_finished sem tópico → a linha continua EM ATENDIMENTO e fica "aguardando
//     reconexão" (registro guardado nas Propriedades do Script, chave RECON_JIVO_<chat_id>);
//  2) chat_accepted do MESMO analista (id Jivo) + MESMO canal (widget_id) + MESMO visitante
//     (visitor.number) em até RECONEXAO_JIVO_MINUTOS → reaproveita a linha: só troca o
//     chat_id (Coluna P). Fila e créditos não mudam;
//  3) ninguém reassumiu no prazo → o gatilho verificarReconexoesJivoVencidas (a cada 5 min)
//     encerra a linha com a hora da QUEDA (Coluna G) e tópico "Sem Tópico".
// Outro analista aceitando o mesmo visitante NÃO é reconexão: vira atendimento novo e a
// linha antiga só é encerrada pelo gatilho.
const RECONEXAO_JIVO_MINUTOS = 5;
const RECONEXAO_JIVO_PREFIXO = 'RECON_JIVO_';

/** true se o chat_finished veio sem tópico (topic null). */
function chatFinalizadoSemTopico(conteudo) {
  return !(conteudo && conteudo.topic && typeof conteudo.topic === 'object');
}

/** Número fixo do visitante no Jivo (visitor.number), como texto. '' se não veio. */
function numeroVisitanteJivo(conteudo) {
  const v = conteudo && conteudo.visitor;
  return (v && v.number !== null && v.number !== undefined && v.number !== '') ? String(v.number) : '';
}

/**
 * chat_finished sem tópico: deixa a linha do chat aguardando reconexão.
 * Devolve true se colocou em espera (aí o encerramento NÃO acontece agora).
 */
function colocarEmEsperaReconexaoJivo(conteudo, idAgent, canalNome, chatId) {
  const visitante = numeroVisitanteJivo(conteudo);
  if (!chatId || !idAgent || !visitante) return false;

  const protSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  const dados = protSheet.getDataRange().getValues();
  let i = dados.length - 1;
  for (; i >= 1; i--) {
    if (String(dados[i][15]) === chatId && String(dados[i][4]).toUpperCase().trim() === 'EM ATENDIMENTO') break;
  }
  if (i < 1) return false; // linha não está EM ATENDIMENTO: segue o fluxo normal

  const registro = {
    chatId: chatId,
    idAgent: String(idAgent),
    widgetId: String(conteudo.widget_id || ''),
    visitante: visitante,
    canalNome: canalNome || '',
    protocolo: String(dados[i][0]),
    quedaMs: Date.now()
  };
  PropertiesService.getScriptProperties().setProperty(RECONEXAO_JIVO_PREFIXO + chatId, JSON.stringify(registro));
  registrarEvento(registro.canalNome, registro.protocolo, 'ATENDIMENTO_AGUARDANDO_RECONEXAO', dados[i][2],
    'Chat encerrado pelo Jivo SEM tópico (possível queda do analista). Linha mantida EM ATENDIMENTO por até ' +
    RECONEXAO_JIVO_MINUTOS + ' min aguardando reconexão.', chatId);
  return true;
}

/**
 * chat_accepted: se for o mesmo analista + canal + visitante de uma linha aguardando
 * reconexão (dentro do prazo), reaproveita a linha e devolve true (não cria linha nova).
 */
function tentarReconexaoJivo(conteudo, idAgent, nomeAnalista, nomeCanal) {
  const novoChatId = conteudo.chat_id ? String(conteudo.chat_id) : '';
  const visitante = numeroVisitanteJivo(conteudo);
  if (!novoChatId || !visitante) return false;

  const props = PropertiesService.getScriptProperties();
  const todas = props.getProperties();
  const agora = Date.now();
  const limiteMs = RECONEXAO_JIVO_MINUTOS * 60000;
  const widgetId = String(conteudo.widget_id || '');

  let achado = null;
  let chave = '';
  Object.keys(todas).forEach(k => {
    if (k.indexOf(RECONEXAO_JIVO_PREFIXO) !== 0) return;
    let r;
    try { r = JSON.parse(todas[k]); } catch (e) { return; }
    if (r.idAgent === String(idAgent) && r.widgetId === widgetId && r.visitante === visitante &&
        (agora - r.quedaMs) <= limiteMs && (!achado || r.quedaMs > achado.quedaMs)) {
      achado = r;
      chave = k;
    }
  });
  if (!achado) return false;

  const protSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  const dados = protSheet.getDataRange().getValues();
  for (let i = dados.length - 1; i >= 1; i--) {
    if (String(dados[i][15]) !== achado.chatId || String(dados[i][4]).toUpperCase().trim() !== 'EM ATENDIMENTO') continue;
    protSheet.getRange(i + 1, 16).setValue(conteudo.chat_id); // Coluna P: chat_id novo
    props.deleteProperty(chave);
    const segundos = Math.round((agora - achado.quedaMs) / 1000);
    registrarEvento(nomeCanal, dados[i][0], 'ATENDIMENTO_RECONECTADO_JIVO', nomeAnalista,
      'Reassumiu o mesmo visitante ' + segundos + 's após a queda. Protocolo mantido (' + dados[i][0] +
      '); chat_id ' + achado.chatId + ' → ' + novoChatId + '. Fila e créditos não alterados.', novoChatId);
    return true;
  }

  // A linha já não está EM ATENDIMENTO (encerrada/revertida por outro caminho): descarta a espera.
  props.deleteProperty(chave);
  return false;
}

/**
 * GATILHO (a cada 5 min): encerra as linhas cuja espera de reconexão venceu, com a hora da
 * queda. Sem nada aguardando, sai na hora (não abre a planilha).
 */
function verificarReconexoesJivoVencidas() {
  const props = PropertiesService.getScriptProperties();
  const chaves = Object.keys(props.getProperties()).filter(k => k.indexOf(RECONEXAO_JIVO_PREFIXO) === 0);
  if (!chaves.length) return;

  executarComTrava(() => {
    const agora = Date.now();
    const protSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
    chaves.forEach(k => {
      const bruto = props.getProperty(k); // relê dentro da trava: pode ter reconectado agora
      if (!bruto) return;
      let r;
      try { r = JSON.parse(bruto); } catch (e) { props.deleteProperty(k); return; }
      if ((agora - r.quedaMs) < RECONEXAO_JIVO_MINUTOS * 60000) return; // ainda no prazo

      props.deleteProperty(k);
      const dados = protSheet.getDataRange().getValues();
      const aberta = dados.some((l, i) => i > 0 && String(l[15]) === r.chatId &&
        String(l[4]).toUpperCase().trim() === 'EM ATENDIMENTO');
      if (!aberta) return; // já encerrada por outro caminho

      registrarEvento(r.canalNome, r.protocolo, 'ATENDIMENTO_RECONEXAO_EXPIRADA', '',
        'Sem reconexão em ' + RECONEXAO_JIVO_MINUTOS + ' min — encerrado com a hora da queda (' +
        Utilities.formatDate(new Date(r.quedaMs), Session.getScriptTimeZone(), 'HH:mm:ss') + ').', r.chatId);
      finalizarAtendimentoPorIdAgent(r.idAgent, TOPICO_PADRAO_VAZIO, r.canalNome, r.chatId, null,
        { titulo: TOPICO_PADRAO_VAZIO, id: null }, new Date(r.quedaMs));
    });
  }, 25000, true);
}

/** Rodar UMA vez pelo editor: cria o gatilho de 5 em 5 min (sem duplicar). */
function instalarGatilhoReconexaoJivo() {
  ScriptApp.getProjectTriggers().forEach(g => {
    if (g.getHandlerFunction() === 'verificarReconexoesJivoVencidas') ScriptApp.deleteTrigger(g);
  });
  ScriptApp.newTrigger('verificarReconexoesJivoVencidas').timeBased().everyMinutes(5).create();
  Logger.log('OK — gatilho de reconexão do Jivo criado (a cada 5 min).');
}


/*************************************************
 * RELÓGIO DE AUSÊNCIAS AUTOMÁTICAS (ALMOÇO)
 *************************************************/

function criarGatilhoRelogio(silencioso) {
  desativarGatilhoRelogio(true);

  ScriptApp.newTrigger('temporizadorAusencias')
    .timeBased()
    .everyMinutes(5)
    .create();

  // CORRIGIDO: SpreadsheetApp.getUi() quebra se chamado por um gatilho de tempo
  // (sem contexto de edição do Sheets) — precisa desse parâmetro pra rodar sozinha.
  if (!silencioso) {
    SpreadsheetApp.getUi().alert('⏰ Relógio de Ausências ATIVADO!\n\nO sistema irá checar os horários de almoço automaticamente a cada 5 minutos.');
  }
}

/*************************************************
 * 11. 🕚 JANELA AUTOMÁTICA DO RELÓGIO DE ALMOÇO
 *************************************************/
// Em vez de precisar lembrar de ativar/desativar o relógio de 5 em 5 min
// manualmente todo dia, esses dois gatilhos diários fixos fazem isso sozinhos:
// um liga o relógio no horário de início, outro desliga no horário de fim.
// Horários configuráveis em CONFIG!C11 (início) e C12 (fim) — padrão 11h/14h
// se as células estiverem vazias.

/**
 * Acionado pelo Menu Admin: cria os dois gatilhos diários (liga/desliga).
 */
function configurarJanelaAutomaticaAlmoco() {
  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CONFIG');
  const horaInicio = (configSheet && Number(configSheet.getRange('C11').getValue())) || 8;
  const horaFim = (configSheet && Number(configSheet.getRange('C12').getValue())) || 19;

  // Remove gatilhos antigos desses handlers, pra não duplicar se rodar de novo
  const gatilhos = ScriptApp.getProjectTriggers();
  gatilhos.forEach(g => {
    const nome = g.getHandlerFunction();
    if (nome === 'ativarRelogioAlmocoAutomatico' || nome === 'desativarRelogioAlmocoAutomatico') {
      ScriptApp.deleteTrigger(g);
    }
  });

  ScriptApp.newTrigger('ativarRelogioAlmocoAutomatico')
    .timeBased()
    .atHour(horaInicio)
    .everyDays(1)
    .create();

  ScriptApp.newTrigger('desativarRelogioAlmocoAutomatico')
    .timeBased()
    .atHour(horaFim)
    .everyDays(1)
    .create();

  SpreadsheetApp.getUi().alert('✅ Janela automática configurada: o relógio de ausências liga sozinho às ' + horaInicio + 'h e desliga às ' + horaFim + 'h, todo dia. Pra mudar o horário, edite CONFIG!C11 (início) e C12 (fim) e rode esse menu de novo.');
}

/**
 * Acionado pelo Menu Admin: remove os dois gatilhos diários, voltando ao
 * controle 100% manual (os botões antigos de ativar/desativar continuam lá).
 */
function desativarJanelaAutomaticaAlmoco() {
  const gatilhos = ScriptApp.getProjectTriggers();
  let removidos = 0;

  gatilhos.forEach(g => {
    const nome = g.getHandlerFunction();
    if (nome === 'ativarRelogioAlmocoAutomatico' || nome === 'desativarRelogioAlmocoAutomatico') {
      ScriptApp.deleteTrigger(g);
      removidos++;
    }
  });

  // Se o relógio de 5 em 5 min estiver rodando nesse exato momento, desativa também
  desativarGatilhoRelogio(true);

  SpreadsheetApp.getUi().alert('🚫 Janela automática desativada (' + removidos + ' gatilho(s) removido(s)). Voltou ao controle manual.');
}

/**
 * Chamada pelo gatilho diário das 11h (ou o horário configurado) — sem
 * contexto de UI, por isso roda em modo silencioso.
 */
function ativarRelogioAlmocoAutomatico() {
  criarGatilhoRelogio(true);
}

/**
 * Chamada pelo gatilho diário das 14h (ou o horário configurado).
 */
function desativarRelogioAlmocoAutomatico() {
  desativarGatilhoRelogio(true);
}

function desativarGatilhoRelogio(silencioso) {
  const gatilhos = ScriptApp.getProjectTriggers();
  let removido = false;

  gatilhos.forEach(g => {
    if (g.getHandlerFunction() === 'temporizadorAusencias') {
      ScriptApp.deleteTrigger(g);
      removido = true;
    }
  });

  if (!silencioso) {
    if (removido) {
      SpreadsheetApp.getUi().alert('🚫 Relógio de Ausências DESATIVADO com sucesso!');
    } else {
      SpreadsheetApp.getUi().alert('ℹ️ Nenhum relógio ativo foi encontrado.');
    }
  }
}

/**
 * Temporizador automático de Ausências/Almoço (gatilho de 5 min).
 * ALTERADO (1.4.13): a virada do almoço usa sincronizarAlmocoAgora (o mesmo motor do polling e
 * do aceite), que também anda a frente da fila quando o próximo sai para o almoço.
 */
function temporizadorAusencias() {
  const diaSemana = new Date().getDay();
  if (diaSemana === 0 || diaSemana === 6) return;
  try { processarAgendaAusencias(); } catch (e) {}
  try { aplicarTrocasAlmocoDoDia(); } catch (e) {}
  sincronizarAlmocoAgora(false);
}

function converterParaMinutos(valor) {
  if (!valor) return null;

  if (valor instanceof Date) {
    return valor.getHours() * 60 + valor.getMinutes();
  }

  if (typeof valor === 'string' && valor.includes(':')) {
    const partes = valor.split(':');
    const horas = parseInt(partes[0], 10);
    const minutos = parseInt(partes[1], 10);
    if (!isNaN(horas) && !isNaN(minutos)) {
      return horas * 60 + minutos;
    }
  }

  return null;
}

/*************************************************
 * 🍽️ ALMOÇO SINCRONIZADO COM A FILA (1.4.13)
 *************************************************/
// Regras:
//  - quem está no almoço é IGNORADO pelo relógio (não é passado, não consome crédito/rodada);
//  - se o próximo (frente da fila) sai para o almoço, a frente anda na hora para o próximo
//    ATIVO em ordem numérica — quem volta do almoço NÃO retoma a vez, entra na roda no seu número;
//  - a virada do almoço (sair/voltar) roda no polling do painel (20s), em todo aceite de chat
//    (antes do giro) e no gatilho de 5 min — sem o atraso de até 5 min de antes.
const ALMOCO_TOLERANCIA_RETORNO_MIN = 10; // volta automática só até 10 min após o fim (como antes)

/** true se a linha da EQUIPE (getValues) está AUSENTE pelo almoço agora (sem outro prazo). */
function ehAlmocoAgora_(l, agoraMin) {
  if (String(l[2]).toUpperCase().trim() !== 'AUSENTE') return false;
  if ((l[6] instanceof Date) || (l[7] instanceof Date)) return false;                       // G/H: outra ausência
  if (String(l[COL_AUSENCIA_SEM_PREVISAO - 1] || '').trim() === MARCA_AUSENCIA_SEM_PREVISAO) return false;
  const ini = converterParaMinutos(l[4]);
  const fim = converterParaMinutos(l[5]);
  if (ini === null || fim === null) return false;
  return agoraMin >= ini && agoraMin < fim + ALMOCO_TOLERANCIA_RETORNO_MIN;
}

/** Quem precisa sair ou voltar do almoço agora: [{ linha, nome, novo, limparPrazos }]. */
function mudancasAlmocoPendentes_(dados) {
  const agora = new Date();
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  const lista = [];
  for (let i = 1; i < dados.length; i++) {
    const nome = dados[i][1];
    if (!nome) continue;
    const ini = converterParaMinutos(dados[i][4]);
    const fim = converterParaMinutos(dados[i][5]);
    if (ini === null || fim === null) continue;
    const status = String(dados[i][2]).toUpperCase().trim();
    const temPrazo = (dados[i][6] instanceof Date) || (dados[i][7] instanceof Date);
    const semPrevisao = String(dados[i][COL_AUSENCIA_SEM_PREVISAO - 1] || '').trim() === MARCA_AUSENCIA_SEM_PREVISAO;
    const noAlmoco = agoraMin >= ini && agoraMin < fim;
    if (noAlmoco && status === 'ATIVO') {
      lista.push({ linha: i + 1, nome: nome, novo: 'AUSENTE', limparPrazos: temPrazo || semPrevisao });
    } else if (!noAlmoco && status === 'AUSENTE' && !temPrazo && !semPrevisao) {
      const desdeFim = agoraMin - fim;
      if (desdeFim >= 0 && desdeFim <= ALMOCO_TOLERANCIA_RETORNO_MIN) {
        lista.push({ linha: i + 1, nome: nome, novo: 'ATIVO', limparPrazos: false });
      }
    }
  }
  return lista;
}

/**
 * Aplica a virada do almoço AGORA e, se o próximo saiu para o almoço, anda a frente da fila.
 * Sem nada a mudar, nem pega a trava (barato para rodar no polling).
 */
function sincronizarAlmocoAgora(silencioso) {
  const dia = new Date().getDay();
  if (dia === 0 || dia === 6) return false;
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  if (!sheet || sheet.getLastRow() < 2) return false;
  if (!mudancasAlmocoPendentes_(sheet.getDataRange().getValues()).length) return false;

  const r = executarComTrava(() => {
    const mudancas = mudancasAlmocoPendentes_(sheet.getDataRange().getValues()); // relê dentro da trava
    if (!mudancas.length) return false;
    const eventos = [];
    mudancas.forEach(m => {
      sheet.getRange(m.linha, 3).setValue(m.novo);
      if (m.limparPrazos) limparPrazosAusenciaNaLinha(sheet, m.linha);
      eventos.push(['', '', m.novo === 'AUSENTE' ? 'ALMOCO_INICIO_AUTO' : 'ALMOCO_FIM_AUTO', m.nome,
        m.novo === 'AUSENTE' ? 'Status alterado automaticamente para AUSENTE (Início do Almoço).'
          : 'Status alterado automaticamente para ATIVO (Retorno do Almoço).']);
    });
    gravarEventosEmLote(eventos);
    SpreadsheetApp.flush();
    avancarFrenteSeAlmoco_(); // depois de TODAS as viradas (quem volta e quem sai no mesmo minuto)
    return true;
  }, silencioso ? 3000 : 15000, silencioso);
  return !!r;
}

/**
 * Se quem está na FRENTE da fila está no almoço, a frente anda para o próximo ATIVO em ordem
 * numérica. Ausentes no caminho são ignorados (nada consumido); ATIVO com Rodada a Pular ou
 * Crédito no caminho consome 1 (a vez dele chegou — igual ao giro normal).
 */
function avancarFrenteSeAlmoco_() {
  const estado = carregarEstadoFila();
  if (!estado.filaFisica.length) return;
  const frente = estado.porNome[normalizarNome(estado.filaFisica[0])];
  if (!frente || !frente.almoco) return;

  const todos = estado.ordenados;
  const n = todos.length;
  const indice = todos.findIndex(i => i.chave === frente.chave);
  if (indice === -1) return;
  const eventos = [];
  let k = (indice + 1) % n;
  let voltas = 0;
  while (voltas < n - 1) {
    const info = todos[k];
    if (info.status !== 'ATIVO') {
      // ausente: ignorado
    } else if (info.rodadas > 0) {
      info.rodadas -= 1;
      marcarAlteracao(estado, info, 'rodadas');
      eventos.push(['', '', 'RODADA_PULADA', info.nome, 'Rodada (Novo Erro) consumida — a frente da fila andou porque ' + frente.nome + ' saiu para o almoço.']);
    } else if (info.creditos > 0) {
      info.creditos -= 1;
      marcarAlteracao(estado, info, 'creditos');
      eventos.push(['', '', 'CREDITO_RODADA_CONSUMIDO', info.nome, 'Crédito de rodada consumido (vez já atendida fora de ordem). Restam: ' + info.creditos + '. A frente da fila andou porque ' + frente.nome + ' saiu para o almoço.']);
    } else {
      break;
    }
    k = (k + 1) % n;
    voltas++;
  }
  if (voltas >= n - 1 && todos[k].status !== 'ATIVO') return; // ninguém ATIVO: não mexe

  reconstruirFilaComFrente(todos[k].nome, estado);
  gravarAlteracoesEquipe(estado);
  eventos.push(['', '', 'FILA_FRENTE_ANDOU_ALMOCO', todos[k].nome,
    frente.nome + ' era o próximo e saiu para o almoço — a vez passou para ' + todos[k].nome + ' (ausentes ignorados).']);
  gravarEventosEmLote(eventos);
}

/*************************************************
 * FUNÇÕES AUXILIARES DA FILA E EVENTOS
 *************************************************/

/**
 * CORREÇÃO PONTUAL: corrige a Coluna A (Ordem) da aba FILA para bater com a
 * Coluna A da aba EQUIPE, usando o nome (Coluna B) como chave de
 * correspondência. NÃO mexe na posição física das linhas — só corrige o
 * número da Ordem, caso tenha ficado incorreto (ex: por bug anterior).
 * Rode uma vez para consertar dados já corrompidos; depois disso, a Ordem
 * nunca mais é alterada por nenhuma outra função do sistema.
 */
function corrigirOrdemFila(silencioso) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const equipeSheet = ss.getSheetByName(CONFIG.ABA_EQUIPE);
  const filaSheet = ss.getSheetByName(CONFIG.ABA_FILA);

  const dadosEquipe = equipeSheet.getRange(2, 1, equipeSheet.getLastRow() - 1, 2).getValues(); // [Ordem, Nome]
  const mapaOrdem = {};
  dadosEquipe.forEach(l => {
    if (l[1]) mapaOrdem[String(l[1]).trim().toLowerCase()] = l[0];
  });

  const ultimaLinhaFila = filaSheet.getLastRow();
  if (ultimaLinhaFila < 2) {
    if (!silencioso) {
      SpreadsheetApp.getUi().alert('ℹ️ Aba FILA está vazia, nada para corrigir.');
    }
    return 0;
  }

  const dadosFila = filaSheet.getRange(2, 1, ultimaLinhaFila - 1, 2).getValues(); // [Ordem, Nome]
  let corrigidos = 0;

  dadosFila.forEach((l, i) => {
    const nome = String(l[1]).trim().toLowerCase();
    const ordemCorreta = mapaOrdem[nome];
    if (ordemCorreta !== undefined && Number(l[0]) !== Number(ordemCorreta)) {
      filaSheet.getRange(2 + i, 1).setValue(ordemCorreta);
      corrigidos++;
    }
  });

  // CORRIGIDO: SpreadsheetApp.getUi() quebra se chamado a partir do Widget.
  // Parâmetro "silencioso" permite reaproveitar essa mesma função sem o alerta.
  if (!silencioso) {
    SpreadsheetApp.getUi().alert('✅ Correção concluída: ' + corrigidos + ' linha(s) da FILA tiveram a Ordem corrigida para bater com a EQUIPE.');
  }
  return corrigidos;
}

/**
 * Ponte web segura (Nível 2 / Coordenação): mesma correção de ordem, sem depender do Sheets.
 */
function webCorrigirOrdemFila() {
  const corrigidos = corrigirOrdemFila(true);
  return { sucesso: true, corrigidos: corrigidos };
}

/**
 * Ponte web segura (Nível 2 / Coordenação): redefine a fila em ordem numérica.
 */
function webRedefinirFilaNumerica() {
  atualizarFila(true);
  return { sucesso: true };
}

/**
 * @param {boolean} redefinirOrdemNumerica - Se true, depois de sincronizar quem
 * está ATIVO, redefine a posição FÍSICA de toda a fila para seguir a ordem
 * numérica (Coluna A), começando pelo analista que é "o próximo" agora e dando
 * a volta pelos demais. Só roda quando pedido explicitamente — nunca no gatilho
 * automático onEdit, pra não apagar o histórico real de rotação a cada mudança
 * de status.
 */
function atualizarFila(redefinirOrdemNumerica) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const equipe = ss.getSheetByName(CONFIG.ABA_EQUIPE);
  const fila = ss.getSheetByName(CONFIG.ABA_FILA);

  if (equipe.getLastRow() < 2) return;

  const dadosEquipe = equipe.getRange(2, 1, equipe.getLastRow() - 1, 4).getValues();
  const ativos = dadosEquipe.filter(l => String(l[2]).toUpperCase() === 'ATIVO').map(l => l[1]);

  const ultimaLinhaFila = fila.getLastRow();
  const dadosFila = ultimaLinhaFila >= 2 ? fila.getRange(2, 1, ultimaLinhaFila - 1, 2).getValues() : [];

  // CORRIGIDO: antes essa função reescrevia a aba FILA inteira, e se algum nome não
  // batesse exatamente entre EQUIPE e FILA, a pessoa "sumia" e era recriada na
  // ordem da EQUIPE — resetando a rotação de todo mundo. Agora ela só ADICIONA
  // quem está ATIVO e ainda não tem linha na FILA; nunca mexe em quem já existe.
  let maiorOrdem = dadosFila.reduce((max, l) => {
    const n = Number(l[0]);
    return (!isNaN(n) && n > max) ? n : max;
  }, 0);

  const nomesNaFila = dadosFila.map(l => String(l[1]).trim().toLowerCase());
  const faltantes = ativos.filter(nome => !nomesNaFila.includes(String(nome).trim().toLowerCase()));

  if (faltantes.length > 0) {
    const novasLinhas = faltantes.map(nome => {
      maiorOrdem += 1;
      return [maiorOrdem, nome];
    });
    fila.getRange(fila.getLastRow() + 1, 1, novasLinhas.length, 2).setValues(novasLinhas);
  }

  // NOVO: redefinição opcional em ordem numérica — só roda se pedido explicitamente.
  if (redefinirOrdemNumerica) {
    redefinirFilaPorOrdemNumerica();
  }
}

/**
 * Redefine a posição FÍSICA de toda a fila para seguir a ordem numérica da
 * Coluna A (Ordem — identidade fixa de cada analista), começando por quem é
 * "o próximo" agora e dando a volta (wrap-around) pelos demais ATIVOS.
 * Não altera nenhum valor de Ordem — só reordena as linhas fisicamente.
 * Respeita a mesma regra de sempre: só entram analistas com status ATIVO
 * na aba EQUIPE no momento da execução.
 */
function redefinirFilaPorOrdemNumerica() {
  // Escape hatch manual: se por algum motivo a fila sair do padrão, isso força
  // a mesma reconstrução total que já roda sozinha em toda movimentação normal
  // (ver seção 7 — MOTOR ÚNICO DA FILA). Mantido como botão de segurança.
  const proximoAtual = (typeof obterProximoAnalista === 'function') ? obterProximoAnalista() : null;
  const sequencia = reconstruirFilaComFrente(proximoAtual || (obterEquipeOrdenadaPorOrdem()[0] || [])[1]);

  // Reset manual "zera tudo" — qualquer Próximo Forçado pendente deixa de
  // fazer sentido, já que a fila física agora já começa por ele mesmo (ou foi
  // substituída por completo).
  PropertiesService.getDocumentProperties().deleteProperty('PROXIMO_FORCADO');
  // NOVO (1.4.6): a espera de forçados também é zerada.
  PropertiesService.getDocumentProperties().deleteProperty(PROP_FORCADOS_PENDENTES);

  if (typeof registrarEvento === 'function') {
    registrarEvento('', '', 'FILA_REDEFINIDA_NUMERICA', proximoAtual || '', 'Fila redefinida manualmente em ordem numérica, começando por ' + (sequencia[0] ? sequencia[0][1] : '') + '.');
  }
}

/**
 * NOVO: espelho completo da fila real, para o Widget mostrar aos analistas
 * exatamente a mesma ordem física que o back-end usa para decidir quem é "o
 * próximo" — inclui quem está AUSENTE (marcado, mas fora da contagem de posição),
 * para ninguém ficar "às cegas" sobre por que alguém não é considerado próximo.
 */
function webObterFilaCompleta() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const filaSheet = ss.getSheetByName(CONFIG.ABA_FILA);
  const equipeSheet = ss.getSheetByName(CONFIG.ABA_EQUIPE);

  if (!filaSheet || !equipeSheet) return [];

  const ultimaLinhaFila = filaSheet.getLastRow();
  if (ultimaLinhaFila < 2) return [];

  const dadosFila = filaSheet.getRange(2, 1, ultimaLinhaFila - 1, 2).getValues(); // [Ordem, Nome]

  const dadosEquipe = equipeSheet.getDataRange().getValues();
  const infoPorNome = {};
  for (let i = 1; i < dadosEquipe.length; i++) {
    const nome = String(dadosEquipe[i][1]).trim().toLowerCase();
    infoPorNome[nome] = {
      status: String(dadosEquipe[i][2]).toUpperCase().trim(),
      inicioCurta: dadosEquipe[i][6], // Coluna G — Já Volto
      fimLonga: dadosEquipe[i][7],    // Coluna H — N2 / Ausência Longa
      rodadasAPular: Number(dadosEquipe[i][8]) || 0, // NOVO — Coluna I
      creditos: Number(dadosEquipe[i][COL_CREDITOS_RODADA - 1]) || 0 // NOVO (1.3.8) — Coluna L
    };
  }

  // NOVO (1.3.8): próxima ausência agendada de cada um (selo 🕒 no Ver Fila).
  const agendadas = obterProximasAgendadasPorNome();
  const retornos = obterRetornosPrevistosPorNome(); // NOVO (1.3.10)

  let posicaoAtiva = 0;
  return dadosFila.map(linha => {
    const nome = linha[1];
    const info = infoPorNome[String(nome).trim().toLowerCase()] || { status: 'DESCONHECIDO', rodadasAPular: 0, creditos: 0 };
    const status = info.status;
    const rodadasAPular = info.rodadasAPular || 0;
    const creditos = info.creditos || 0; // NOVO (1.3.8): atendeu fora da vez nesta rodada
    // NOVO: quem tem rodada(s) pendente(s) (Protocolo Múltiplo) é tratado como
    // "ATIVO, mas fora da contagem por enquanto" — igual obterProximoAnalista()
    // já faz na hora de decidir de verdade quem é o próximo. Continua marcado
    // como ativo=true (não é ausência), só não entra na numeração de posição.
    const elegivel = status === 'ATIVO' && rodadasAPular === 0 && creditos === 0;
    if (elegivel) posicaoAtiva++;

    // NOVO: contador regressivo coletivo (Ver Fila) — só aparece quando existe
    // um prazo real em andamento (Já Volto ou N2/Longa). Ausência manual "sem
    // prazo" (Definir Ausente direto) não tem nada em G/H, então não mostra nada.
    let minutosRestantes = null;
    if (status === 'AUSENTE') {
      minutosRestantes = obterMinutosRestantesDePrazos(info.inicioCurta, info.fimLonga);
    }

    return {
      ordem: linha[0],
      nome: nome,
      status: status,
      ativo: status === 'ATIVO',
      elegivel: elegivel,
      rodadasAPular: rodadasAPular,
      creditos: creditos,
      posicaoAtiva: elegivel ? posicaoAtiva : null,
      minutosRestantes: minutosRestantes,
      agendada: agendadas[normalizarNome(nome)] || null, // NOVO (1.3.8): período da próxima agendada
      retornoPrevisto: status === 'AUSENTE' ? (retornos[normalizarNome(nome)] || null) : null // NOVO (1.3.10)
    };
  });
}

/**
 * NOVO: contador regressivo individual, pro cabeçalho do próprio painel de
 * quem disparou a ausência (Já Volto ou N2/Longa). Só retorna algo quando há
 * mesmo um prazo em andamento — senão o front simplesmente não mostra nada.
 */
// ALTERADO (1.3.10): além da próxima agendada, informa o "retorno previsto" (fim informado)
// de quem está ausente agora — só informativo, nunca devolve pra ATIVO.
function webObterMinhaAusencia(analista) {
  if (!analista) return null;
  const info = obterMinhaAusenciaBase(analista);
  const chave = normalizarNome(analista);
  const agendada = obterProximasAgendadasPorNome()[chave] || null;
  if (!info) return agendada ? { ausente: false, minutosRestantes: null, tipo: null, agendada: agendada, retornoPrevisto: null } : null;
  info.agendada = agendada;
  info.retornoPrevisto = info.ausente ? (obterRetornosPrevistosPorNome()[chave] || null) : null;
  return info;
}

function obterMinhaAusenciaBase(analista) {

  const equipeSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  if (!equipeSheet || equipeSheet.getLastRow() < 2) return null;

  const dados = equipeSheet.getRange(2, 1, equipeSheet.getLastRow() - 1, 8).getValues();
  const nomeAlvo = String(analista).trim().toLowerCase();

  for (let i = 0; i < dados.length; i++) {
    if (String(dados[i][1]).trim().toLowerCase() !== nomeAlvo) continue;

    // ALTERADO: agora SEMPRE devolve o estado (antes devolvia null pra quem estava
    // ATIVO ou AUSENTE sem prazo). O Widget usa "ausente" pra decidir, direto do que
    // está escrito na Coluna C da EQUIPE, se mostra "Já Volto" ou "Já Voltei".
    //   ausente: true/false  -> status AUSENTE na EQUIPE (com ou sem prazo)
    //   minutosRestantes     -> só quando existe prazo real (G ou H); senão null
    //   tipo                 -> 'CURTA' (Já Volto) | 'LONGA' (N2/Longa) | 'SEM_PRAZO' | null
    const status = String(dados[i][2]).toUpperCase().trim();
    if (status !== 'AUSENTE') return { ausente: false, minutosRestantes: null, tipo: null };

    const inicioCurta = dados[i][6];
    const fimLonga = dados[i][7];
    const minutos = obterMinutosRestantesDePrazos(inicioCurta, fimLonga);
    if (minutos === null) return { ausente: true, minutosRestantes: null, tipo: 'SEM_PRAZO' };

    const soCurta = (inicioCurta instanceof Date) && !(fimLonga instanceof Date);
    return { ausente: true, minutosRestantes: minutos, tipo: soCurta ? 'CURTA' : 'LONGA' };
  }
  return null;
}

/**
 * ALTERADO (1.3.8): mesma regra de sempre (Próximo Forçado > 1º ATIVO da FILA física
 * sem Rodada a Pular), agora também sem Crédito de rodada — e calculada em memória a
 * partir de UMA leitura (carregarEstadoFila), em vez de uma leitura da EQUIPE inteira
 * por pessoa verificada. "estado" é opcional: quem já tem o estado carregado repassa.
 */
function obterProximoAnalista(estado) {
  return calcularProximo(estado || carregarEstadoFila());
}

function pularProximo() {
  try {
    const res = webPularProximo();
    SpreadsheetApp.getUi().alert('⏭️ ' + res.analista + ' foi para o fim da fila.\n\nPróximo: ' + (res.proximo || 'Fila vazia'));
  } catch (e) {
    SpreadsheetApp.getUi().alert('⚠️ ' + e.message);
  }
}

function abrirJanelaComOpcoes(titulo, callback, lista, extra) {
  let opcoes = lista.map(a => `<option value="${a}">${a}</option>`).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; padding: 12px; }
          select { width: 100%; padding: 8px; margin: 10px 0 20px 0; }
          button { padding: 8px 16px; margin-left: 5px; cursor: pointer; }
          .btn-ok { background: #0b57d0; color: white; border: none; }
        </style>
      </head>
      <body>
        <label>Selecione o Analista:</label>
        <select id="analista">${opcoes}</select>
        <div style="text-align:right;">
          <button onclick="google.script.host.close()">Cancelar</button>
          <button class="btn-ok" onclick="confirmar()">Confirmar</button>
        </div>
        <script>
          function confirmar() {
            var v = document.getElementById('analista').value;
            google.script.run.withSuccessHandler(() => google.script.host.close())
            .${callback}(v, "${extra || ''}");
          }
        </script>
      </body>
    </html>`;

  SpreadsheetApp.getUi().showModalDialog(HtmlService.createHtmlOutput(html).setWidth(320).setHeight(170), titulo);
}

function menuVoltarAFila() {
  const analistas = obterListaAnalistas(false);
  abrirJanelaComOpcoes('Voltar Analista para a Fila', 'executarVoltarAFila', analistas);
}

function executarVoltarAFila(analista) {
  alterarStatusAnalista(analista, 'ATIVO');
}

function menuAdminAtivar() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  if (sheet.getLastRow() < 2) return;

  const todos = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().flat();
  abrirJanelaComOpcoes('Marcar Analista como ATIVO', 'executarAdminAtivar', todos);
}

function executarAdminAtivar(analista) {
  alterarStatusAnalista(analista, 'ATIVO');
}

function menuAdminAusente() {
  const analistas = obterListaAnalistas(false);
  abrirJanelaComOpcoes('Marcar Analista como AUSENTE', 'executarAdminAusente', analistas);
}

function executarAdminAusente(analista) {
  alterarStatusAnalista(analista, 'AUSENTE');
}

function alterarStatusAnalista(analista, novoStatus, silencioso) {
  if (!analista) return false;

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  const dados = sheet.getDataRange().getValues();

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][1]).toLowerCase() === analista.toLowerCase()) {
      sheet.getRange(i + 1, 3).setValue(novoStatus);
      // NOVO: troca manual de status (Definir Ativo/Ausente, menus do Sheets) derruba
      // qualquer prazo de auto-serviço (Colunas G/H) — quem decide agora é a pessoa
      // que mexeu, então "ausente manual" é sempre uma ausência SEM prazo.
      limparPrazosAusenciaNaLinha(sheet, i + 1);
      registrarEvento('', '', 'STATUS_ANALISTA_ALTERADO', analista, 'Status alterado para ' + novoStatus);

      atualizarFila();
      // CORRIGIDO: SpreadsheetApp.getUi() quebra se chamado a partir do Widget
      // (fora do contexto de edição do Sheets). Parâmetro "silencioso" permite
      // reaproveitar essa mesma função sem o alerta nativo.
      if (!silencioso) {
        SpreadsheetApp.getUi().alert('✅ Analista ' + analista + ' alterado para ' + novoStatus);
      }
      return true;
    }
  }
  return false;
}

/**
 * Ponte web segura (Nível 2 / Coordenação): define o status de qualquer
 * analista direto pelo Widget, sem depender do menu do Sheets.
 */
function webDefinirStatusAnalista(analista, novoStatus) {
  const ok = alterarStatusAnalista(analista, novoStatus, true);
  if (!ok) throw new Error('Analista não encontrado na EQUIPE.');
  return { sucesso: true, analista: analista, novoStatus: novoStatus };
}

/**
 * NOVO (1.4.9): parte numérica do protocolo, sem o prefixo do canal e sem o sufixo do
 * Novo Erro: "J16465" -> 16465 | "J16465.2" -> 16465 | "16465" -> 16465 | "ignorado" -> NaN.
 */
function numeroDoProtocolo(p) {
  const m = /^\s*[A-Za-z]{0,3}\s*(\d+)/.exec(String(p === null || p === undefined ? '' : p));
  return m ? parseInt(m[1], 10) : NaN;
}

/**
 * NOVO (1.4.9): compara dois protocolos aceitando o "J" do Jivo ou não ("16465" = "J16465",
 * "16465.2" = "J16465.2"). Outros prefixos (ex.: "E" do e-mail) precisam bater exatamente.
 */
function mesmoProtocolo(a, b) {
  const tira = x => String(x === null || x === undefined ? '' : x).trim().toUpperCase().replace(/^J(?=\d)/, '');
  const ta = tira(a);
  return ta !== '' && ta === tira(b);
}

/**
 * ALTERADO (1.4.9): devolve o protocolo JÁ COM O PREFIXO do canal (padrão "J" — Jivo),
 * ex.: "J16465". O CONFIG!B2 continua guardando só o número.
 */
function gerarProtocolo(prefixo) {
  prefixo = (prefixo === undefined || prefixo === null) ? PREFIXO_PROTOCOLO_JIVO : String(prefixo);
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ABA_PROTOCOLOS);
  const sheetConfig = ss.getSheetByName('CONFIG');

  // Maior protocolo NOVO da aba — linhas de Retorno ficam de fora: a Coluna A delas
  // guarda o protocolo ANTIGO do chamado (não faz parte da sequência de hoje).
  // Ignora também o sufixo ".numeral" do Novo Erro (ex: "16154.2" conta como 16154).
  // (1.4.6: linhas "ignorado" não têm número — o parseInt dá NaN e elas ficam de fora.)
  let maiorHoje = 0;
  if (sheet.getLastRow() >= 2) {
    const linhas = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues(); // A..D
    linhas.forEach(l => {
      if (String(l[3]).trim().toLowerCase() === 'retorno') return;
      // ALTERADO (1.4.9): só a sequência do mesmo prefixo (o "J16465" conta como 16465).
      const txt = String(l[0]).trim().toUpperCase();
      if (prefixo && txt.indexOf(prefixo.toUpperCase()) !== 0 && !/^\d/.test(txt)) return;
      const n = numeroDoProtocolo(txt);
      if (!isNaN(n) && n > maiorHoje) maiorHoje = n;
    });
  }

  // CONFIG!B2 = último protocolo já gerado (a limpeza diária também grava aqui).
  // Serve de PISO: mesmo que a linha mais alta de hoje tenha virado Retorno (e perdido
  // o número novo), a sequência nunca volta atrás.
  let piso = 0;
  if (sheetConfig) {
    const salvo = Math.floor(Number(sheetConfig.getRange('B2').getValue()));
    if (!isNaN(salvo) && salvo > 0) piso = salvo;
  }

  const base = Math.max(maiorHoje, piso);
  const proximo = base > 0 ? base + 1 : CONFIG.PROTOCOLO_INICIAL;

  // Guarda já no B2 o número que acabou de ser reservado: se essa linha virar Retorno
  // e perder o número, ele não é reaproveitado por outro chat.
  if (sheetConfig) sheetConfig.getRange('B2').setValue(proximo);

  return prefixo + proximo; // NOVO (1.4.9): "J16465"

}

function registrarProtocolo(p, a, tipo, status, marcarInício = false) {
  const hoje = new Date();
  const hInicio = marcarInício ? hoje : '';
  SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS).appendRow([p, hoje, a, tipo, status, hInicio, '', '', '']);
}

/**
 * Registra UM evento na aba da categoria do tipo (EV_ATENDIMENTOS, EV_FILA,
 * EV_AUSENCIAS, EV_WEBHOOK ou EV_SISTEMA — ver REGRAS_ABAS_EVENTOS).
 * c = canal | p = protocolo | e = tipo | a = analista | d = descrição |
 * chatId = chat_id do Jivo (NOVO 1.3.15, opcional).
 * ALTERADO (1.3.15): antes gravava tudo na aba EVENTOS.
 */
function registrarEvento(c, p, e, a, d, chatId) {
  const sheet = obterAbaEventos(obterAbaDestinoEvento(e));
  sheet.appendRow([new Date(), c || '', p, e, a, d, chatId ? String(chatId) : '']);
}

/*************************************************
 * 11. 🔁 PROTOCOLO MÚLTIPLO (mais de um erro no mesmo chamado)
 *************************************************/
// Aba PROTOCOLOS ganhou 4 colunas novas, só ADICIONADAS no fim (não mexem em
// nada que já existia nas colunas A-I):
//   J = Protocolo Fonte  — preenchido só nas linhas derivadas (e na própria
//       linha "X.1"), aponta pro número BASE (sem sufixo), usado pra achar
//       "quem mais pertence a esse chamado" na hora da cascata de encerramento.
//   K = Motivo Pausa      — usado pela seção 12 (ATENDIMENTO PAUSADO)
//   L = Pausado Desde     — idem
//   M = Pausas Acumuladas — idem (segundos)
//
// Status novo usado aqui: "PRÓX. ERRO" — linha derivada, aguardando o
// encerramento do chamado fonte pra ser fechada junto (cascata no webhook).

/**
 * Analista clica em "Multiplicar Protocolo" num atendimento que já está EM
 * ATENDIMENTO. Se for a primeira vez nesse chamado, a linha fonte vira
 * "N.1"; a nova linha derivada entra como "N.2", "N.3"... com status
 * "PRÓX. ERRO" e Hora Início = agora (é a partir dela que a duração dessa
 * linha específica vai ser calculada, do jeito que já é hoje).
 */
function webMultiplicarProtocolo(protocolo, analista) {
  if (!protocolo || !analista) throw new Error("Dados incompletos para registrar o novo erro.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  const dados = sheet.getDataRange().getValues();

  // CORRIGIDO: aceita como "fonte" tanto a linha original (EM ATENDIMENTO)
  // quanto qualquer linha já derivada (PRÓX. ERRO) — assim dá pra multiplicar
  // de novo a partir de um "X.2", não só do "X.1".
  let linhaFonte = -1;
  for (let i = dados.length - 1; i >= 1; i--) {
    const statusLinha = String(dados[i][4]).toUpperCase().trim();
    if (mesmoProtocolo(dados[i][0], protocolo) /* 1.4.9: com ou sem "J" */ &&
        String(dados[i][2]).toLowerCase() === String(analista).toLowerCase() &&
        (statusLinha === 'EM ATENDIMENTO' || statusLinha === 'PRÓX. ERRO')) {
      linhaFonte = i + 1;
      break;
    }
  }
  if (linhaFonte === -1) {
    throw new Error('Não foi encontrado um atendimento EM ATENDIMENTO ou PRÓX. ERRO com o protocolo ' + protocolo + ' para ' + analista + '.');
  }

  const origemEv = canalEChatDaLinhaProtocolo(dados[linhaFonte - 1]); // NOVO (1.3.15)
  const protocoloAtual = String(sheet.getRange(linhaFonte, 1).getValue()).trim();
  const jaTinhaSufixo = protocoloAtual.includes('.');
  const base = jaTinhaSufixo ? protocoloAtual.split('.')[0] : protocoloAtual;

  let novoProtocolo;

  if (!jaTinhaSufixo) {
    // CORRIGIDO: primeira multiplicação deste chamado — a linha FONTE sempre
    // assume ".1" (é o primeiro atendimento desse chamado) e o novo erro
    // sempre assume ".2". Não precisa escanear nada pra descobrir isso: nesse
    // ponto é IMPOSSÍVEL já existir qualquer outro sufixo pra essa base, então
    // não há ambiguidade nem dependência de reler o que acabamos de escrever.
    sheet.getRange(linhaFonte, 1).setValue(base + '.1');
    sheet.getRange(linhaFonte, 10).setValue(base); // Coluna J
    novoProtocolo = base + '.2';
  } else {
    // Já existe pelo menos um "base.N" — descobre o maior sufixo já usado
    // usando o "dados" lido no INÍCIO desta função (antes de qualquer escrita
    // nesta chamada), então nunca depende de reler algo recém-gravado.
    if (!sheet.getRange(linhaFonte, 10).getValue()) {
      sheet.getRange(linhaFonte, 10).setValue(base);
    }
    let maiorSufixo = 0;
    dados.forEach(l => {
      const p = String(l[0]).trim();
      if (p.indexOf(base + '.') === 0) {
        const n = Number(p.split('.')[1]);
        if (!isNaN(n) && n > maiorSufixo) maiorSufixo = n;
      }
    });
    novoProtocolo = base + '.' + (maiorSufixo + 1);
  }

  const agora = new Date();
  // A-I no padrão de sempre + J (protocolo fonte) preenchido; K/L/M (pausa) em branco.
  sheet.appendRow([novoProtocolo, agora, analista, 'Múltiplo', 'PRÓX. ERRO', '', '', '', '', base]);

  // CORRIGIDO: os dois efeitos abaixo são "extras" (log e rodada a pular) —
  // se algum deles falhar por qualquer motivo, isso não pode travar a resposta
  // pro front (a linha já foi criada; o front precisa saber disso de qualquer jeito).
  try {
    if (typeof registrarEvento === 'function') {
      registrarEvento(origemEv.canal, novoProtocolo, 'PROTOCOLO_MULTIPLICADO', analista, 'Novo erro no mesmo chamado — protocolo derivado de ' + (base + '.1') + '.', origemEv.chatId);
    }

    // O analista "é pulado" na próxima rodada da fila — cada multiplicação
    // acumula mais uma rodada de ausência programada.
    if (typeof adicionarRodadaAPular === 'function') {
      adicionarRodadaAPular(analista, 1);
    }
  } catch (erroSecundario) {
    if (typeof registrarEvento === 'function') {
      registrarEvento(origemEv.canal, novoProtocolo, 'PROTOCOLO_MULTIPLICADO_AVISO', analista, 'Linha criada, mas houve um erro no log/rodada a pular: ' + erroSecundario.message, origemEv.chatId);
    }
  }

  // CORRIGIDO: evita devolver um objeto Date cru pela ponte google.script.run
  // (fonte suspeita do "travamento" da mensagem no front) — manda só texto simples.
  return { sucesso: true, protocoloFonte: base + '.1', novoProtocolo: novoProtocolo };
}

// EQUIPE Coluna I: "Rodadas a Pular" — quantas vezes esse analista ainda deve
// ser tratado como indisponível na hora de calcular "quem é o próximo" (igual
// um ausente, mas sem sair de ATIVO). Cada vez que a rodada da fila passa
// pela posição dele sem poder chamá-lo, consome 1 dessa contagem.

function adicionarRodadaAPular(analista, quantidade) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  const dados = sheet.getDataRange().getValues();
  const nomeAlvo = String(analista).trim().toLowerCase();

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][1]).trim().toLowerCase() === nomeAlvo) {
      const atual = Number(dados[i][8]) || 0; // Coluna I
      sheet.getRange(i + 1, 9).setValue(atual + quantidade);
      return true;
    }
  }
  return false;
}

function obterRodadasAPular(nome) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  const dados = sheet.getDataRange().getValues();
  const nomeAlvo = String(nome).trim().toLowerCase();
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][1]).trim().toLowerCase() === nomeAlvo) {
      return Number(dados[i][8]) || 0;
    }
  }
  return 0;
}

function consumirRodadaAPular(nome) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  const dados = sheet.getDataRange().getValues();
  const nomeAlvo = String(nome).trim().toLowerCase();
  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][1]).trim().toLowerCase() === nomeAlvo) {
      const atual = Number(dados[i][8]) || 0;
      if (atual > 0) sheet.getRange(i + 1, 9).setValue(atual - 1);
      return;
    }
  }
}

/**
 * NOVO: ponte web pro próprio analista ver, no cabeçalho do painel, se ele
 * está pulando rodada(s) por causa de um Protocolo Múltiplo (Novo Erro) — pra
 * ele ficar tranquilo de que a próxima rodada mesmo não vai ser chamada nele.
 * Retorna 0 quando não há nada pendente (o front simplesmente não mostra nada).
 */
function webObterMinhasRodadasAPular(analista) {
  if (!analista) return 0;
  return obterRodadasAPular(analista);
}

/**
 * Fecha em cascata todas as linhas "PRÓX. ERRO" derivadas de um mesmo
 * chamado (Coluna J = base) quando o protocolo fonte é encerrado pelo webhook.
 * Cada linha derivada já tem sua própria Hora Início (o clique em "Multiplicar
 * Protocolo"), então a duração de cada uma sai calculada igual a qualquer
 * outra — só o horário de encerramento e o tópico são os mesmos do chamado fonte.
 * ALTERADO (1.3.15): canal / chat_id (opcionais) do chamado fonte seguem pros eventos.
 */
function encerrarDerivadosEmCascata(baseProtocolo, dataFim, topico, canal, chatId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  const dados = sheet.getDataRange().getValues();
  const base = String(baseProtocolo).trim();

  for (let i = 1; i < dados.length; i++) {
    const status = String(dados[i][4]).toUpperCase().trim();
    const fonteLinha = String(dados[i][9]).trim(); // Coluna J
    if (status !== 'PRÓX. ERRO' || fonteLinha !== base) continue;

    const linha = i + 1;
    const dataInicio = dados[i][1];
    const protocolo = dados[i][0];

    let duracaoTexto = '00:00:00';
    if (dataInicio instanceof Date) {
      const diffSegundos = Math.max(0, Math.floor((dataFim - dataInicio) / 1000));
      const horas = Math.floor(diffSegundos / 3600).toString().padStart(2, '0');
      const minutos = Math.floor((diffSegundos % 3600) / 60).toString().padStart(2, '0');
      const segundos = (diffSegundos % 60).toString().padStart(2, '0');
      duracaoTexto = `${horas}:${minutos}:${segundos}`;
    }

    sheet.getRange(linha, 5).setValue('ENCERRADO');
    sheet.getRange(linha, 7).setValue(dataFim);
    sheet.getRange(linha, 8).setNumberFormat('@').setValue(duracaoTexto);
    sheet.getRange(linha, 9).setValue(topico);

    if (typeof registrarEvento === 'function') {
      registrarEvento(canal || '', protocolo, 'CHAT_FINISHED_CASCATA', dados[i][2], 'Encerrado em cascata junto com o protocolo fonte ' + base + '.1. Duração: ' + duracaoTexto, chatId || '');
    }
  }
}

/*************************************************
 * 12. ⏸️ ATENDIMENTO PAUSADO
 *************************************************/
// Pausa interrompe a contagem de duração de UM atendimento específico (a
// aba EQUIPE não é tocada — o analista continua ATIVO, na rotação normal).
// Guarda o motivo (pro log e pra Coluna K, exibido como tooltip no front) e o
// horário da pausa (Coluna L), pra somar o tempo pausado quando ele retomar.

function webPausarAtendimento(protocolo, analista, motivo) {
  if (!protocolo || !analista) throw new Error("Dados incompletos para pausar o atendimento.");
  if (!motivo || !String(motivo).trim()) throw new Error("Informe o motivo da pausa.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  const dados = sheet.getDataRange().getValues();

  for (let i = dados.length - 1; i >= 1; i--) {
    if (mesmoProtocolo(dados[i][0], protocolo) /* 1.4.9: com ou sem "J" */ &&
        String(dados[i][2]).toLowerCase() === String(analista).toLowerCase() &&
        String(dados[i][4]).toUpperCase() === 'EM ATENDIMENTO') {

      const linha = i + 1;
      sheet.getRange(linha, 5).setValue('PAUSADO');       // Coluna E: Status
      sheet.getRange(linha, 11).setValue(String(motivo)); // Coluna K: Motivo Pausa
      sheet.getRange(linha, 12).setValue(new Date());     // Coluna L: Pausado Desde

      // NOVO: motivo "Fila" também rotaciona o analista pro fim da fila de
      // rotação -- herda o comportamento da extinta processarEnviarParaFilaCore.
      const ehFila = String(motivo).trim().toLowerCase() === 'fila';
      if (ehFila && typeof moverAnalistaParaFimDaFila === 'function') {
        moverAnalistaParaFimDaFila(analista);
      }

      if (typeof registrarEvento === 'function') {
        const origemEv = canalEChatDaLinhaProtocolo(dados[i]); // NOVO (1.3.15)
        registrarEvento(origemEv.canal, protocolo, 'ATENDIMENTO_PAUSADO', analista, ehFila ? 'Enviado para Fila.' : 'Pausou o atendimento. Motivo: ' + motivo, origemEv.chatId);
      }

      return { sucesso: true, protocolo: protocolo, ehFila: ehFila };
    }
  }
  throw new Error('Não foi encontrado um atendimento EM ATENDIMENTO com o protocolo ' + protocolo + ' para ' + analista + '.');
}

/**
 * NOVO (1.3.14): só a Coordenação (Nível 3) age em atendimento de OUTRO analista.
 * quemAcionou vazio (Mini antigo / chamada interna) = ação própria, segue normal.
 */
function validarAcaoEmNomeDeOutro(dono, quemAcionou) {
  if (!quemAcionou || normalizarNome(quemAcionou) === normalizarNome(dono)) return;
  if (obterNivelUsuario(quemAcionou) < 3) {
    throw new Error('Só a Coordenação pode agir em atendimentos de outro analista.');
  }
}

/**
 * NOVO (1.3.14): ▶️ Retomar pelo protocolo (Modo Mini e painel N1/N2). Vale para qualquer
 * linha PAUSADA — motivo "Fila" (selo EM FILA) ou outro motivo. Reaproveita o motor do
 * Assumir: mantém o protocolo, soma o tempo parado (Coluna M), limpa a Coluna L e volta
 * para EM ATENDIMENTO. NÃO mexe na rotação da fila.
 */
function webRetomarAtendimentoPorProtocolo(protocolo, analista, quemAcionou) {
  protocolo = (protocolo === null || protocolo === undefined) ? '' : String(protocolo).trim();
  if (!protocolo || !analista) throw new Error('Dados incompletos para retomar o atendimento.');
  validarAcaoEmNomeDeOutro(analista, quemAcionou);

  return executarComTrava(() => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
    const dados = sheet.getDataRange().getValues();

    for (let i = dados.length - 1; i >= 1; i--) {
      if (mesmoProtocolo(dados[i][0], protocolo) && // 1.4.9: com ou sem "J"
          normalizarNome(dados[i][2]) === normalizarNome(analista) &&
          String(dados[i][4]).toUpperCase().trim() === 'PAUSADO') {

        const res = assumirOuRetomarLinha(i + 1, dados[i][2]);
        if (!ehAcaoPropria(analista, quemAcionou)) {
          const origemEv = canalEChatDaLinhaProtocolo(dados[i]); // NOVO (1.3.15)
          registrarEvento(origemEv.canal, res.protocolo, 'ATENDIMENTO_RETOMADO_COORDENACAO', dados[i][2],
            'Retomado pela Coordenação (' + quemAcionou + ').', origemEv.chatId);
        }
        return res;
      }
    }
    throw new Error('O protocolo ' + protocolo + ' não está pausado (talvez já tenha sido retomado).');
  });
}

/**
 * NOVO (1.3.14): atendimentos ativos do próprio analista (EM ATENDIMENTO e PAUSADO), do mais
 * recente para o mais antigo — alimenta o ⏳ Fila/Pausar/▶️ Retomar do painel (Nível 1 e 2).
 */
function webBuscarMeusAtendimentosAtivos(analista) {
  if (!analista) return [];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const dados = sheet.getDataRange().getValues();
  const alvo = normalizarNome(analista);
  const lista = [];

  for (let i = dados.length - 1; i >= 1; i--) {
    const status = String(dados[i][4]).toUpperCase().trim();
    if ((status === 'EM ATENDIMENTO' || status === 'PAUSADO') &&
        normalizarNome(dados[i][2]) === alvo &&
        String(dados[i][0]).trim() !== '') {
      lista.push({
        protocolo: String(dados[i][0]).trim(),
        status: status,
        motivoPausa: status === 'PAUSADO' ? String(dados[i][10] || '') : ''
      });
    }
  }
  return lista;
}

/**
 * NOVO (1.4.8): linhas EM ATENDIMENTO de um analista (qualquer um — Retorno e Transferir podem
 * ser feitos em nome de outro), da mais recente para a mais antiga. Alimenta a escolha da
 * linha no 🔄 Retorno e no 🔀 Transferir do Widget ("Canal | Visitante — HH:mm").
 */
function webBuscarLinhasEmAtendimento(analista) {
  if (!analista) return [];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const dados = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  const alvo = normalizarNome(analista);
  const lista = [];

  for (let i = dados.length - 1; i >= 1; i--) {
    if (String(dados[i][4]).toUpperCase().trim() !== 'EM ATENDIMENTO') continue;
    if (normalizarNome(dados[i][2]) !== alvo) continue;
    const protocolo = String(dados[i][0]).trim();
    if (!protocolo) continue;
    const inicio = (dados[i][5] instanceof Date) ? dados[i][5] : ((dados[i][1] instanceof Date) ? dados[i][1] : null);
    lista.push({
      protocolo: protocolo,
      canal: String(dados[i][13] || '').trim(),   // N: Canal (cliente)
      cliente: String(dados[i][14] || '').trim(), // O: Visitante do Jivo (usuário)
      inicio: inicio ? Utilities.formatDate(inicio, tz, 'HH:mm') : ''
    });
  }
  return lista;
}

/**
 * NOVO (1.4.9): linhas de hoje de um analista para as ações do Widget, da mais recente para
 * a mais antiga.
 *  modo 'acao'     (🔄 Retorno / 🔀 Transferir): EM ATENDIMENTO, PAUSADO e ENCERRADO
 *                  (sem as linhas "ignorado" e sem as que ainda não têm protocolo);
 *  modo 'reverter' (⏮️ Reverter Status, Coordenação): todas as linhas do analista.
 * Cada item: { linha, protocolo, status, statusTexto, canal, cliente, inicio, ehRetorno }.
 */
function webBuscarLinhasDoAnalista(analista, modo) {
  if (!analista) return [];
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const dados = sheet.getDataRange().getValues();
  const tz = Session.getScriptTimeZone();
  const alvo = normalizarNome(analista);
  const paraAcao = modo !== 'reverter';
  const lista = [];

  for (let i = dados.length - 1; i >= 1; i--) {
    if (normalizarNome(dados[i][2]) !== alvo) continue;
    const status = String(dados[i][4]).toUpperCase().trim();
    const protocolo = String(dados[i][0]).trim();
    const ignorado = protocolo.toLowerCase() === PROTOCOLO_IGNORADO_TEXTO;
    if (paraAcao) {
      if (['EM ATENDIMENTO', 'PAUSADO', 'ENCERRADO'].indexOf(status) === -1) continue;
      if (!protocolo || ignorado) continue;
    } else if (!status) {
      continue;
    }
    const inicio = (dados[i][5] instanceof Date) ? dados[i][5] : ((dados[i][1] instanceof Date) ? dados[i][1] : null);
    let statusTexto = status;
    if (status === 'PAUSADO') statusTexto = String(dados[i][10] || '').trim().toLowerCase() === 'fila' ? 'EM FILA' : 'PAUSADO';
    lista.push({
      linha: i + 1,
      protocolo: protocolo,
      status: status,
      statusTexto: statusTexto,
      canal: String(dados[i][13] || '').trim(),   // N: Canal (cliente)
      cliente: String(dados[i][14] || '').trim(), // O: Visitante do Jivo (usuário)
      inicio: inicio ? Utilities.formatDate(inicio, tz, 'HH:mm') : '',
      ehRetorno: String(dados[i][3]).trim().toLowerCase() === 'retorno'
    });
  }
  return lista;
}

/**
 * NOVO (1.4.9): ⏮️ Reverter Status pela linha escolhida (Coordenação). Troca SÓ o status:
 * não mexe em hora de início/fim, duração, fila, créditos nem na contagem de atendimentos.
 * "protocoloEsperado" confere se a linha ainda é a mesma da lista (a aba pode ter mudado).
 */
function webReverterStatusLinha(linha, protocoloEsperado, novoStatus, quemAcionou) {
  const statusValidos = ['FILA', 'EM TRIAGEM', 'EM ATENDIMENTO', 'ENCERRADO'];
  const statusNovo = String(novoStatus || '').toUpperCase().trim();
  if (statusValidos.indexOf(statusNovo) === -1) {
    throw new Error('Status inválido. Use: ' + statusValidos.join(', ') + '.');
  }
  if (quemAcionou && obterNivelUsuario(quemAcionou) < 3) {
    throw new Error('Só a Coordenação pode reverter status.');
  }

  return executarComTrava(() => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS);
    const num = Number(linha);
    if (!sheet || !num || num < 2 || num > sheet.getLastRow()) throw new Error('Linha não encontrada. Atualize e tente de novo.');
    const larg = Math.max(sheet.getLastColumn(), 16);
    const v = sheet.getRange(num, 1, 1, larg).getValues()[0];
    if (String(v[0]).trim() !== String(protocoloEsperado || '').trim()) {
      throw new Error('Essa linha mudou desde que a lista foi aberta. Atualize e tente de novo.');
    }
    const statusAntes = String(v[4]).toUpperCase().trim();
    if (statusAntes === statusNovo) return { sucesso: true, protocolo: v[0], novoStatus: statusNovo, semMudanca: true };

    sheet.getRange(num, 5).setValue(statusNovo);
    const origemEv = canalEChatDaLinhaProtocolo(v);
    registrarEvento(origemEv.canal, v[0], 'STATUS_REVERTIDO', v[2],
      'Status alterado de ' + statusAntes + ' para ' + statusNovo + ' via Painel Coordenação' +
      (quemAcionou ? ' (' + quemAcionou + ')' : '') + '. Hora de fim, duração, fila e contagem não foram alteradas.',
      origemEv.chatId);
    return { sucesso: true, protocolo: v[0], novoStatus: statusNovo };
  });
}

/*************************************************
 * LIMPEZA DIÁRIA DE PROTOCOLOS E SEQUÊNCIA
 *************************************************/

function executarLimpezaDiariaProtocolos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetProt = ss.getSheetByName(CONFIG.ABA_PROTOCOLOS || 'PROTOCOLOS');
  const sheetConfig = ss.getSheetByName('CONFIG');

  if (!sheetProt) {
    Logger.log('⚠️ Aba PROTOCOLOS não foi encontrada.');
    return;
  }

  const ultLinha = sheetProt.getLastRow();

  if (ultLinha > 1) {
    // CORRIGIDO: antes pegava só a Coluna A da ÚLTIMA LINHA FÍSICA, assumindo que
    // ela sempre teria o maior protocolo. Mas o protocolo só é gerado no momento
    // do "Assumir" (não na ordem de criação da linha) — então a última linha podia
    // estar com a Coluna A vazia (ainda em triagem/fila), fazendo a função salvar
    // vazio em CONFIG!B2 mesmo havendo protocolos bem maiores em linhas anteriores.
    // Agora calcula o MAIOR valor entre TODAS as linhas, igual gerarProtocolo() já faz.
    const linhasProt = sheetProt.getRange(2, 1, ultLinha - 1, 4).getValues(); // A..D
    // Linhas de Retorno ficam de fora (a Coluna A delas é o protocolo ANTIGO do chamado).
    const numsProt = linhasProt
      .filter(l => String(l[3]).trim().toLowerCase() !== 'retorno')
      .map(l => numeroDoProtocolo(l[0])) // ALTERADO (1.4.9): ignora o prefixo "J"
      .filter(n => !isNaN(n) && n > 0);
    const ultimoProtocolo = numsProt.length > 0 ? Math.max(...numsProt) : null;

    // O B2 só SOBE, nunca volta atrás (o gerarProtocolo já grava aqui a cada protocolo novo).
    const b2Atual = sheetConfig ? (Math.floor(Number(sheetConfig.getRange('B2').getValue())) || 0) : 0;
    if (sheetConfig && ultimoProtocolo && ultimoProtocolo > b2Atual) {
      sheetConfig.getRange('B2').setValue(ultimoProtocolo);
      Logger.log('✅ Último protocolo salvo na CONFIG (B2): ' + ultimoProtocolo);
    }

    sheetProt.getRange(2, 1, ultLinha - 1, sheetProt.getLastColumn()).clearContent();

    if (typeof registrarEvento === 'function') {
      registrarEvento('', '', 'LIMPEZA_DIARIA', 'SISTEMA', 'Aba PROTOCOLOS limpa com sucesso. Sequência salva: ' + (ultimoProtocolo || 'nenhum protocolo gerado hoje'));
    }
  } else {
    Logger.log('ℹ️ A aba PROTOCOLOS já estava vazia.');
  }
}

function obterProximoProtocolo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetProt = ss.getSheetByName(CONFIG.ABA_PROTOCOLOS || 'PROTOCOLOS');
  const sheetConfig = ss.getSheetByName('CONFIG');

  let proximoNumero = 1;

  if (sheetProt && sheetProt.getLastRow() > 1) {
    const ultimoHoje = sheetProt.getRange(sheetProt.getLastRow(), 1).getValue();
    // CORRIGIDO: ignora o sufixo ".numeral" do Novo Erro (ex: "16154.2") ao
    // calcular o próximo protocolo — antes o Number() entendia isso como
    // ponto flutuante (16154.2 + 1 = 16155.2), contaminando pra sempre os
    // protocolos seguintes. Agora pega só a parte inteira antes do ponto.
    const baseNumero = numeroDoProtocolo(ultimoHoje); // ALTERADO (1.4.9): ignora o prefixo
    if (!isNaN(baseNumero) && baseNumero > 0) {
      return baseNumero + 1;
    }
  }

  if (sheetConfig) {
    const ultimoSalvoConfig = sheetConfig.getRange('B2').getValue();
    if (!isNaN(ultimoSalvoConfig) && Number(ultimoSalvoConfig) > 0) {
      return Number(ultimoSalvoConfig) + 1;
    }
  }

  return proximoNumero;
}


/*************************************************
 * 8. 🔁 PRÓXIMO N2 (interruptor manual entre 2 analistas)
 *************************************************/
// Aba CONFIG: A3/C3 = Analista N2 - 1 | A4/C4 = Analista N2 - 2 | A5/C5 = Próximo N2 atual
// (Coluna B já é usada para o contador de protocolo, por isso o N2 ficou na Coluna C)
// Editável direto na planilha — se um dia trocar quem é do N2, só editar C3/C4, sem mexer em código.

/**
 * Lê quem é o Próximo N2 agora. Se a célula C5 estiver vazia (primeira vez),
 * usa o nome de C3 como padrão inicial.
 */
function obterProximoN2() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CONFIG');
  if (!sheet) return null;

  let atual = String(sheet.getRange('C5').getValue() || '').trim();

  if (!atual) {
    const primeiro = String(sheet.getRange('C3').getValue() || '').trim();
    if (primeiro) {
      sheet.getRange('C5').setValue(primeiro);
      atual = primeiro;
    }
  }

  return atual || null;
}

/**
 * Ponte chamada pelo Widget para exibir o Próximo N2
 */
function webObterProximoN2() {
  return obterProximoN2();
}

/**
 * Alterna o Próximo N2 entre os dois nomes cadastrados em C3/C4.
 */
function webAlternarProximoN2() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CONFIG');
  if (!sheet) throw new Error("Aba CONFIG não encontrada.");

  const nome1 = String(sheet.getRange('C3').getValue() || '').trim();
  const nome2 = String(sheet.getRange('C4').getValue() || '').trim();

  if (!nome1 || !nome2) {
    throw new Error("Cadastre os dois nomes do N2 nas células C3 e C4 da aba CONFIG.");
  }

  const atual = String(sheet.getRange('C5').getValue() || '').trim();
  const novo = (atual === nome1) ? nome2 : nome1;

  sheet.getRange('C5').setValue(novo);

  if (typeof registrarEvento === 'function') {
    registrarEvento('', '', 'PROXIMO_N2_ALTERADO', novo, 'Próximo N2 alterado para ' + novo);
  }

  return novo;
}


/**
 * Função para retornar dados dos analistas para o Widget
 */
function obterDadosWidget() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheetEquipe = ss.getSheetByName('EQUIPE');
  if (!sheetEquipe) return [];

  const dados = sheetEquipe.getDataRange().getValues();
  const analistas = [];

  for (let i = 1; i < dados.length; i++) {
    analistas.push({
      ordem: dados[i][0],
      nome: dados[i][1],
      status: dados[i][2],
      idAgent: dados[i][3]
    });
  }

  return analistas;
}


/**
 * Servidor do Web App Flutuante
 */
/**
 * NOVO: processa ações de escrita disparadas pelo Modo Mini (Transferir,
 * Fila/Pausar, Retorno) -- todas restritas a linhas que já pertencem a quem
 * está agindo (o "origem"/"analista" vem sempre do próprio usuário logado no
 * Widget, nunca de texto digitado no Mini, então não dá pra agir em nome de
 * outro analista por aqui). Reaproveita exatamente as mesmas funções que os
 * botões do Widget principal já chamam -- zero lógica duplicada.
 */

     function processarAcaoModoMini(conteudo) {
  try {
    const acao = conteudo.acao;
    // ALTERADO (1.3.14): a Coordenação pode agir na linha de qualquer analista. O Mini manda
    // o DONO da linha em origem/analista e quem está logado em quemAcionou; se forem pessoas
    // diferentes, o servidor confere na USUARIOS se quem acionou é Nível 3.
    validarAcaoEmNomeDeOutro(conteudo.analista || conteudo.origem, conteudo.quemAcionou);

    let resultado = null;
    if (acao === 'transferir') {
      resultado = webTransferirAtendimento(conteudo.origem, conteudo.destino, conteudo.protocolo);
    } else if (acao === 'pausar') {
      resultado = webPausarAtendimento(conteudo.protocolo, conteudo.analista, conteudo.motivo);
    } else if (acao === 'retorno') {
      // ALTERADO (1.3.19): passa o protocolo da linha clicada no Mini
      resultado = webRegistrarRetorno(conteudo.origem, conteudo.responsavel, conteudo.protocoloOriginal, conteudo.protocolo);
    } else if (acao === 'retomar') {
      // NOVO (1.3.14): ▶️ Retomar (linha PAUSADA — EM FILA ou PAUSADO)
      resultado = webRetomarAtendimentoPorProtocolo(conteudo.protocolo, conteudo.analista, conteudo.quemAcionou);
    } else {
      throw new Error('Ação desconhecida: ' + acao);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: 'success', resultado: resultado }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (erro) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: erro.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
    // NOVO (1.4.0): painel CHAMADOS DO SUPORTE (página própria, em tela cheia).
  if (e && e.parameter && e.parameter.pagina === 'chamados') {
    return paginaPainelChamados();
  }
    // NOVO (1.4.0): formulário do card do Trello.
  if (e && e.parameter && e.parameter.pagina === 'card') {
    return paginaFormCard(e);
  }
  // NOVO: rota de dados puros (JSON) pro Modo Mini externo (userscript).
  // Existe porque o Apps Script sempre serve o Widget dentro de um iframe
  // obrigatório (sandbox IFRAME, sem opção de desativar) -- isso impede a API
  // de Picture-in-Picture de funcionar de dentro do próprio Widget. Essa rota
  // não devolve HTML nenhum, só dado, pra ser consumida de fora.
  if (e && e.parameter && e.parameter.action === 'atendimentosFila') {
    // ALTERADO: não filtra mais por analista digitado (esse conceito foi
    // removido -- era frágil, dependia do texto bater exatamente com quem
    // estava logado). Agora só espelha os 5 mais recentes da mesma lista que
    // já aparece no Widget principal (webObterProtocolosAtivos já devolve
    // mais recentes primeiro).
    // ALTERADO (1.4.6): linhas "ignorado" (tópicos que não contam protocolo) não vão pro
    // Mini — assim o Mini não precisa mudar (ele não sabe tratar essas linhas).
    const todos = webObterProtocolosAtivos().filter(p => !p.ignorado);
    // ALTERADO (1.3.14): atendimentos PAUSADOS (EM FILA ou PAUSADO) ficam fixos no topo do Mini,
    // mesmo fora dos 5 mais recentes — os do próprio usuário; para a Coordenação, os de todos.
    // O nível é conferido aqui na USUARIOS (não confia no que o Mini mandar).
    const usuarioMini = String(e.parameter.usuario || '').trim();
    const ehCoordenacaoMini = !!usuarioMini && obterNivelUsuario(usuarioMini) >= 3;
    const fixados = usuarioMini
      ? todos.filter(p => String(p.status).toUpperCase().trim() === 'PAUSADO' &&
          (ehCoordenacaoMini || normalizarNome(p.analista) === normalizarNome(usuarioMini)))
      : [];
    const ultimos = fixados.concat(todos.slice(0, 5).filter(p => fixados.indexOf(p) === -1));

    let dadosFila = { proximo: 'Fila Vazia', proximoForcado: false, analistasOrdenados: [] };
    try {
      const df = webObterDadosFila();
      // ALTERADO (1.4.9): os selects do Mini (Transferir / Retorno) também listam os AUSENTES,
      // depois dos ativos — ausente pode receber Retorno e Transferência.
      const ativosMini = df.analistasOrdenados || [];
      const ausentesMini = (df.analistasOrigem || []).filter(a => a.ausente).map(a => a.nome)
        .filter(n => !ativosMini.some(x => normalizarNome(x) === normalizarNome(n)));
      dadosFila = { proximo: df.proximo, proximoForcado: df.proximoForcado, analistasOrdenados: ativosMini.concat(ausentesMini) };
    } catch (err) {}

    return ContentService.createTextOutput(JSON.stringify({
      ultimos: ultimos,
      ehCoordenacao: ehCoordenacaoMini, // NOVO (1.3.14): o Mini mostra os botões em todas as linhas
      proximo: dadosFila.proximo,
      proximoForcado: dadosFila.proximoForcado,
      // NOVO: lista de analistas ativos, pros selects de Transferir/Retorno
      // dentro do próprio Modo Mini (mesma fonte que o Widget principal usa).
      analistas: dadosFila.analistasOrdenados
    })).setMimeType(ContentService.MimeType.JSON);
  }

  return HtmlService.createTemplateFromFile('Widget')
    .evaluate()
    .setTitle('Lista Ai')
    // Ícone customizado abandonado: setFaviconUrl() rejeitou SVG, PNG em base64 e
    // até uma URL https real terminando em .png, sempre com o mesmo erro
    // "tipo de imagem incompatível" — parece ser uma limitação atual da própria
    // API do Apps Script, não algo contornável pelo nosso lado. O ícone padrão
    // do Apps Script fica valendo; o título "Lista Ai" já identifica o app.
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Retorna os dados da fila (B2 da aba FILA) e os últimos atendimentos (aba PROTOCOLOS)
 */
/*************************************************
 * 9. 🚶 AUSÊNCIA TEMPORÁRIA (auto-serviço do analista, com auto-retorno)
 *************************************************/
// Aba EQUIPE, Coluna G: "Início Ausência Temporária" (timestamp). Vazio = não está
// numa ausência de auto-serviço. Usada só por este fluxo — não mexe nas colunas
// E/F (horário de almoço fixo), que continuam com sua própria lógica separada.
//
// Aba CONFIG: C7 = Limite de ausências temporárias por DIA (padrão 3, se vazio)
//             C8 = Limite de ausências temporárias por SEMANA (padrão 10, se vazio)

// NOVO: duração (em minutos) do "Já Volto" — migrado de constante fixa pra
// CONFIG!C10, no mesmo padrão dos outros limites configuráveis (C7/C8/C9).
// Fallback em 10 se a célula estiver vazia/zerada.
function obterMinutosAutoRetornoAusencia() {
  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CONFIG');
  const valor = configSheet ? Number(configSheet.getRange('C10').getValue()) : 0;
  return valor > 0 ? valor : 10;
}
// NOVO: Ausente N2 — auto-serviço exclusivo do Nível 2 (e 3), 2h30 fixas,
// reaproveita a mesma Coluna H (e o mesmo relógio de auto-retorno) que a
// Ausência Longa da Coordenação usa — a diferença é só a duração fixa e o
// limite diário próprio (CONFIG!C9, padrão 2 se vazio).
// ALTERADO (1_2_12): o horário de ALMOÇO do analista (EQUIPE Colunas E/F) NÃO conta
// nas 2h30 — o fim previsto (Coluna H) já é gravado com o almoço somado, ver
// calcularFimAusenciaN2(). REGRA GERAL: quem já está AUSENTE (com ou sem prazo,
// inclusive pela Coordenação ou pelo almoço) não pode iniciar Já Volto nem N2 —
// só registrar o retorno ("Já Voltei").
const MINUTOS_AUSENCIA_N2 = 150; // 2h30 — duração MÁXIMA de cada uso do Ausente N2

/*************************************************
 * 9b. ⏱️ SALDO DO AUSENTE N2 (1.4.7)
 *************************************************/
// Saldo do dia = CONFIG!C9 (janelas por dia, padrão 2) × 2h30. Cada uso:
//  - dura min(2h30, saldo) — o almoço do analista continua fora da contagem;
//  - ao terminar (Já Voltei, auto-retorno, Definir Ativo/Ausente, edição na planilha,
//    Informar Ausência), desconta do saldo SÓ o tempo usado de verdade (sem o almoço);
//  - com menos de N2_MINIMO_MIN de saldo, não abre ([LIMITE] -> "Preciso de mais SLA").
// Fica em Document Property (N2_CONTROLE), zerada na virada do dia:
//   { dia: 'AAAA-MM-DD', p: { nomeNormalizado: { nome, usado, usos,
//       ativo: { ini, fim, aIni, aFim, prot } | null } } }
// A Ausência Longa usa a mesma Coluna H, mas nunca cria "ativo" aqui — não entra no saldo.
const PROP_N2_CONTROLE = 'N2_CONTROLE';
const N2_MINIMO_MIN = 30;

function diaHojeN2() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}

function lerControleN2() {
  let c = null;
  try { c = JSON.parse(PropertiesService.getDocumentProperties().getProperty(PROP_N2_CONTROLE) || 'null'); } catch (e) {}
  const hoje = diaHojeN2();
  if (!c || c.dia !== hoje || !c.p) c = { dia: hoje, p: {} };
  return c;
}

function gravarControleN2(c) {
  PropertiesService.getDocumentProperties().setProperty(PROP_N2_CONTROLE, JSON.stringify(c));
}

/** Total do dia, em minutos (CONFIG!C9 × 2h30). */
function obterTotalDiaN2Min() {
  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CONFIG');
  const janelas = configSheet ? Number(configSheet.getRange('C9').getValue()) : 0;
  return (janelas > 0 ? janelas : 2) * MINUTOS_AUSENCIA_N2;
}

/** Minutos entre iniMs e fimMs, sem o pedaço que cai no almoço (aIni/aFim em minutos do dia). */
function minutosUsadosN2(iniMs, fimMs, aIni, aFim) {
  if (!(fimMs > iniMs)) return 0;
  let ms = fimMs - iniMs;
  if (aIni !== null && aIni !== undefined && aFim !== null && aFim !== undefined && aFim > aIni) {
    const d = new Date(iniMs);
    const almIni = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(aIni / 60), aIni % 60).getTime();
    const almFim = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(aFim / 60), aFim % 60).getTime();
    ms -= Math.max(0, Math.min(fimMs, almFim) - Math.max(iniMs, almIni));
  }
  return Math.max(0, Math.round(ms / 60000));
}

/**
 * Fecha o uso ativo de "chave" no controle (em memória — quem chama grava). O fim
 * considerado é o menor entre "momentoMs" e o fim previsto. Devolve o resumo ou null.
 */
function fecharUsoN2NoControle(c, chave, momentoMs) {
  const info = c.p[chave];
  if (!info || !info.ativo) return null;
  const a = info.ativo;
  const fimReal = Math.min(momentoMs, a.fim);
  const usadoAgora = minutosUsadosN2(a.ini, fimReal, a.aIni, a.aFim);
  info.usado = (Number(info.usado) || 0) + usadoAgora;
  info.ativo = null;
  return { nome: info.nome, prot: a.prot || '', usadoAgora: usadoAgora, usadoDia: info.usado, antesDoPrazo: momentoMs < a.fim };
}

function registrarFimUsoN2(r, motivo) {
  const total = obterTotalDiaN2Min();
  registrarEvento('', r.prot, 'AUSENCIA_N2_ENCERRADA', r.nome,
    'Ausente N2 encerrada (' + (r.antesDoPrazo ? motivo : 'prazo concluído') + '). Usado neste período: ' +
    formatarMinutosTexto(r.usadoAgora) + ' | Usado hoje: ' + formatarMinutosTexto(r.usadoDia) + ' de ' +
    formatarMinutosTexto(total) + ' | Saldo: ' + formatarMinutosTexto(Math.max(0, total - r.usadoDia)) + '.');
}

/**
 * Encerra o Ausente N2 em andamento de "nome" (se houver), descontando do saldo só o tempo
 * usado. Chamada sempre que o prazo da Coluna H é limpo (ver limparPrazosAusenciaNaLinha).
 */
function finalizarUsoN2(nome, motivo) {
  const chave = normalizarNome(nome);
  if (!chave) return;
  const previa = lerControleN2();
  if (!previa.p[chave] || !previa.p[chave].ativo) return; // nada em andamento: nem pega a trava
  executarComTrava(() => {
    const c = lerControleN2();
    const r = fecharUsoN2NoControle(c, chave, Date.now());
    if (!r) return;
    gravarControleN2(c);
    registrarFimUsoN2(r, motivo || 'retorno antes do prazo');
  }, 10000, true);
}

/**
 * Situação do saldo de "nome" hoje: { total, usado, saldo, usos, ativo }.
 * Uso ativo cujo prazo já passou (o fechamento normal não rodou) é fechado no fim previsto.
 */
function obterSaldoN2(nome) {
  const chave = normalizarNome(nome);
  let c = lerControleN2();
  let info = c.p[chave];
  if (info && info.ativo && info.ativo.fim <= Date.now()) {
    executarComTrava(() => {
      c = lerControleN2();
      const r = fecharUsoN2NoControle(c, chave, Date.now());
      if (r) { gravarControleN2(c); registrarFimUsoN2(r, 'prazo concluído'); }
    }, 10000, true);
    info = c.p[chave];
  }
  const total = obterTotalDiaN2Min();
  const usado = info ? (Number(info.usado) || 0) : 0;
  return {
    total: total,
    usado: usado,
    saldo: Math.max(0, total - usado),
    usos: info ? (Number(info.usos) || 0) : 0,
    ativo: !!(info && info.ativo)
  };
}

/**
 * Protocolos digitados ("16050, 16072" / "16050.2" / "JIVO16050") -> lista limpa e sem
 * repetição. "estrito" = lança erro se vazio ou se algum trecho for inválido.
 */
function normalizarListaProtocolos(texto, estrito) {
  const partes = String(texto || '').split(/[,;\s]+/).map(p => p.trim()).filter(Boolean);
  const lista = [];
  partes.forEach(p => {
    if (!/^[A-Za-z]{0,6}\d+(\.\d+)?$/.test(p)) {
      if (estrito) throw new Error('Protocolo inválido: "' + p + '". Use os números separados por vírgula (ex.: 16050, 16072).');
      return;
    }
    if (lista.indexOf(p.toUpperCase()) === -1) lista.push(p.toUpperCase());
  });
  if (estrito && !lista.length) throw new Error('Informe o protocolo do chamado em análise.');
  return lista;
}

/**
 * NOVO (1.4.18): protocolo em texto livre (Ausente N2 e SLA de chamado) — sem validação de
 * formato nem consulta ao Trello. Espaços repetidos viram um só; limite de 200 caracteres.
 */
const PROTOCOLO_LIVRE_MAX = 200;
function normalizarProtocoloLivre(texto, obrigatorio) {
  const t = String(texto === null || texto === undefined ? '' : texto).replace(/\s+/g, ' ').trim();
  if (obrigatorio && !t) throw new Error('Informe o protocolo do chamado em análise.');
  if (t.length > PROTOCOLO_LIVRE_MAX) throw new Error('O protocolo passa de ' + PROTOCOLO_LIVRE_MAX + ' caracteres.');
  return t;
}

/**
 * NOVO: limpa os dois prazos de ausência de auto-serviço de uma linha da EQUIPE:
 * Coluna G (início do Já Volto) e Coluna H (fim do Ausente N2 / Ausência Longa).
 * Sempre que o status muda por um caminho que NÃO é o fluxo que gravou o prazo
 * (troca manual, almoço, retorno), esse horário velho precisa sair — senão ele
 * desfaz, no polling seguinte, a próxima ausência da pessoa.
 * ALTERADO (1.4.7): se havia um Ausente N2 em andamento, ele é encerrado aqui (desconta do
 * saldo só o tempo usado). Cobre Já Voltei, auto-retorno, Definir Ativo/Ausente e almoço.
 */
function limparPrazosAusenciaNaLinha(sheet, linhaPlanilha) {
  try {
    const c = lerControleN2();
    if (Object.keys(c.p).some(k => c.p[k] && c.p[k].ativo)) {
      const nomeLinha = sheet.getRange(linhaPlanilha, 2).getValue();
      if (nomeLinha) finalizarUsoN2(nomeLinha, 'retorno antes do prazo');
    }
  } catch (erroN2) {}
  sheet.getRange(linhaPlanilha, 7, 1, 2).clearContent(); // G e H
  // CORRIGIDO (1.3.10): a marca SEM_PREVISAO (Coluna J) também sai. Antes ela ficava pra
  // sempre e travava o retorno automático do almoço de quem já usou "Informar Ausência".
  sheet.getRange(linhaPlanilha, COL_AUSENCIA_SEM_PREVISAO).clearContent();
}

/**
 * NOVO: texto curto de duração pra mensagens ("48 min", "2h 28min").
 */
function formatarMinutosTexto(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  if (m < 60) return m + ' min';
  const h = Math.floor(m / 60);
  const r = m % 60;
  return r === 0 ? (h + 'h') : (h + 'h ' + r + 'min');
}

/**
 * NOVO: minutos restantes até o auto-retorno, olhando G (Já Volto) e H (N2/Longa)
 * de uma linha da EQUIPE. Devolve null quando não há prazo nenhum (ausência
 * manual/almoço). Se por algum motivo existirem os dois, vale o que termina por
 * último — é o mesmo critério do processarAutoRetornoAusencias().
 */
function obterMinutosRestantesDePrazos(inicioCurta, fimLonga) {
  let restante = null;
  if (inicioCurta instanceof Date) {
    restante = calcularMinutosRestantesAusencia(inicioCurta, true);
  }
  if (fimLonga instanceof Date) {
    const m = calcularMinutosRestantesAusencia(fimLonga, false);
    if (restante === null || m > restante) restante = m;
  }
  return restante;
}

/**
 * NOVO: true quando quem acionou é o próprio analista (ou não foi informado).
 * Usado só pra acertar o sujeito das mensagens ("Você já..." x "Fulano já...").
 */
function ehAcaoPropria(analista, quemAcionou) {
  return !quemAcionou || normalizarNome(quemAcionou) === normalizarNome(analista);
}

/**
 * NOVO: trava única do "já está ausente", usada por Já Volto, Ausente N2 e
 * Ausência Longa. "linha" é a linha da EQUIPE (getValues) do analista.
 *   - AUSENTE com prazo (G ou H): recusa e diz quanto falta — vale pros três
 *     fluxos, o que também impede G e H preenchidos ao mesmo tempo.
 *   - AUSENTE sem prazo (Definido pela Coordenação, editado na planilha ou
 *     almoço automático): recusa Já Volto e N2 — já está ausente, só pode
 *     registrar o retorno. A Ausência Longa da Coordenação passa
 *     "permitirSemPrazo" pra poder dar um prazo a quem já está ausente.
 */
function verificarSePodeIniciarAusencia(linha, analista, quemAcionou, permitirSemPrazo) {
  const status = String(linha[2]).toUpperCase().trim();
  if (status !== 'AUSENTE') return;

  const propria = ehAcaoPropria(analista, quemAcionou);
  const sujeito = propria ? 'Você já está ausente' : (linha[1] + ' já está ausente');
  const restam = obterMinutosRestantesDePrazos(linha[6], linha[7]);

  if (restam !== null) {
    throw new Error(sujeito + '. Volta em ' + formatarMinutosTexto(restam) + '.');
  }
  if (permitirSemPrazo) return;

  throw new Error(sujeito + '. ' + (propria
    ? 'Quando voltar, use "Já Voltei".'
    : 'Registre o retorno antes (Já Voltei ou "Definir Ativo").'));
}

/**
 * NOVO: fim previsto do Ausente N2 descontando o almoço do analista.
 * "inicio" é um Date; "almocoIniMin"/"almocoFimMin" são os minutos do dia
 * (mesmo formato do converterParaMinutos, fuso do script) ou null se a pessoa
 * não tem almoço cadastrado. As 2h30 só correm fora do horário de almoço:
 *   - começou DENTRO do almoço  -> a contagem só começa quando o almoço acaba;
 *   - as 2h30 atravessam o início do almoço -> o almoço inteiro fica de fora;
 *   - almoço já passou, ou as 2h30 terminam antes dele -> nada muda.
 * Devolve { fim: Date, minutosAlmoco: number } (minutosAlmoco = quanto do almoço
 * foi somado ao prazo, pra mostrar na tela).
 */
// ALTERADO (1.4.7): 4º parâmetro opcional "duracaoMin" (o saldo pode ser menor que 2h30).
function calcularFimAusenciaN2(inicio, almocoIniMin, almocoFimMin, duracaoMin) {
  const duracaoMs = (Number(duracaoMin) > 0 ? Number(duracaoMin) : MINUTOS_AUSENCIA_N2) * 60000;
  const semAlmoco = { fim: new Date(inicio.getTime() + duracaoMs), minutosAlmoco: 0 };

  if (almocoIniMin === null || almocoFimMin === null || almocoFimMin <= almocoIniMin) {
    return semAlmoco;
  }

  const noDia = (min) => new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate(), Math.floor(min / 60), min % 60, 0, 0);
  const almocoIni = noDia(almocoIniMin);
  const almocoFim = noDia(almocoFimMin);

  if (inicio >= almocoIni && inicio < almocoFim) {
    return {
      fim: new Date(almocoFim.getTime() + duracaoMs),
      minutosAlmoco: Math.round((almocoFim - inicio) / 60000)
    };
  }
  if (inicio < almocoIni && semAlmoco.fim > almocoIni) {
    const almocoMs = almocoFim - almocoIni;
    return {
      fim: new Date(semAlmoco.fim.getTime() + almocoMs),
      minutosAlmoco: Math.round(almocoMs / 60000)
    };
  }
  return semAlmoco;
}

/**
 * Conta quantas vezes o analista já usou a Ausente N2 HOJE (sem limite
 * semanal — só o diário faz sentido pra esse SLA específico).
 * ALTERADO (1.3.15): lê a EV_AUSENCIAS (antes, a EVENTOS).
 */
function contarUsosAusenciaN2(analista) {
  const sheet = obterAbaEventosLeitura(ABAS_EVENTOS.AUSENCIAS);
  if (!sheet || sheet.getLastRow() < 2) return 0;

  const dados = sheet.getDataRange().getValues();
  const agora = new Date();
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const nomeAlvo = String(analista).trim().toLowerCase();

  let hoje = 0;
  for (let i = 1; i < dados.length; i++) {
    const tipo = String(dados[i][3]).toUpperCase().trim();
    const nome = String(dados[i][4]).trim().toLowerCase();
    const data = dados[i][0];
    if (tipo === 'AUSENCIA_N2_INICIADA' && nome === nomeAlvo && data instanceof Date && data >= inicioHoje) {
      hoje++;
    }
  }
  return hoje;
}

/**
 * Ponte web: analista de Nível 2 (ou 3) se marca ausente pelo SLA do N2 —
 * 2h30 fixas, auto-retorno, limite diário configurável em CONFIG!C9.
 */
/**
 * Ponte web: retorna os nomes de todos os usuários cadastrados como Nível 2
 * na aba USUARIOS (Coluna C = 2). Usado pra Coordenação (Nível 3) escolher
 * quem ausentar via "Ausente N2", em vez de ausentar a si mesma.
 */
function webObterAnalistasNivel2() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_USUARIOS);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const dados = sheet.getDataRange().getValues();
  let nomes = [];

  for (let i = 1; i < dados.length; i++) {
    const nivel = Number(dados[i][2]) || 1;
    if (nivel === 2) {
      nomes.push(dados[i][0]);
    }
  }

  return nomes;
}

/**
 * Quantos minutos faltam até "fimOuInicio" virar auto-retorno. Pra Já Volto
 * (10 min fixos), passe o horário de INÍCIO salvo; pra N2/Longa, passe direto
 * o horário de FIM já salvo na Coluna H. Sempre arredonda pra cima (pelo
 * menos 1 min), pra nunca mostrar "0 min" pra quem ainda está ausente.
 */
// ALTERADO (1.4.9): a Coluna G agora guarda o FIM previsto do Já Volto (o tempo é escolhido
// a cada uso: 5/10/20/30 min). Por isso "timestamp" é sempre o fim — o 2º parâmetro ficou
// só por compatibilidade com quem chama.
function calcularMinutosRestantesAusencia(timestamp, ehInicioDe10Min) {
  if (!(timestamp instanceof Date)) return 0;
  const fimReal = timestamp;
  const restanteMs = fimReal - new Date();
  return Math.max(1, Math.ceil(restanteMs / 60000));
}

/**
 * NOVO: posição de "analista" contando só quem é elegível (ATIVO e sem
 * Rodadas a Pular pendentes) na ordem física da FILA — a mesma régua usada
 * pelo "Ver Fila" pra numerar quem é 1º, 2º, 3º... Usado só pelo aviso de
 * "perto da vez" do Já Volto (ver webIniciarAusenciaTemporaria). Devolve null
 * se o analista não for encontrado ou já não for elegível ele mesmo.
 */
function obterPosicaoElegivelNaFila(analista) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const filaSheet = ss.getSheetByName(CONFIG.ABA_FILA);
  const equipeSheet = ss.getSheetByName(CONFIG.ABA_EQUIPE);
  if (!filaSheet || !equipeSheet) return null;

  const ultimaLinhaFila = filaSheet.getLastRow();
  if (ultimaLinhaFila < 2) return null;

  const dadosFila = filaSheet.getRange(2, 1, ultimaLinhaFila - 1, 2).getValues();
  const dadosEquipe = equipeSheet.getDataRange().getValues();

  const infoPorNome = {};
  for (let i = 1; i < dadosEquipe.length; i++) {
    const nome = normalizarNome(dadosEquipe[i][1]);
    infoPorNome[nome] = {
      status: String(dadosEquipe[i][2]).toUpperCase().trim(),
      rodadasAPular: Number(dadosEquipe[i][8]) || 0,
      creditos: Number(dadosEquipe[i][COL_CREDITOS_RODADA - 1]) || 0 // NOVO (1.3.8)
    };
  }

  const alvo = normalizarNome(analista);
  let posicao = 0;
  for (let i = 0; i < dadosFila.length; i++) {
    const nomeLinha = dadosFila[i][1];
    const info = infoPorNome[normalizarNome(nomeLinha)] || { status: '', rodadasAPular: 0, creditos: 0 };
    const elegivel = info.status === 'ATIVO' && info.rodadasAPular === 0 && info.creditos === 0;
    if (!elegivel) continue;
    posicao++;
    if (normalizarNome(nomeLinha) === alvo) return posicao;
  }
  return null;
}

/**
 * NOVO: validações comuns do Ausente N2 (já ausente? limite do dia?). Devolve a
 * linha do analista na EQUIPE pronta pra gravar. Usada pela pré-checagem
 * (webObterAvisoAusenteN2) e pelo registro (webIniciarAusenciaN2), pra os dois
 * sempre concordarem.
 */
function validarInicioAusenciaN2(analista, quemAcionou) {
  if (!analista) throw new Error("Informe quem está se ausentando.");

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ABA_EQUIPE);
  const dados = sheet.getDataRange().getValues();
  const nomeAlvo = String(analista).trim().toLowerCase();

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][1]).trim().toLowerCase() !== nomeAlvo) continue;

    // 1) Já está ausente (com ou sem prazo)? Não pode se ausentar de novo.
    verificarSePodeIniciarAusencia(dados[i], analista, quemAcionou, false);

    // 2) ALTERADO (1.4.7): SALDO do dia (CONFIG!C9 × 2h30), não mais quantidade de usos.
    //    Com menos de 30 min de saldo, não abre. O marcador [LIMITE] é lido pelo Widget
    //    pra abrir o aviso com o atalho "Preciso de mais SLA".
    const s = obterSaldoN2(dados[i][1]);
    if (s.saldo < N2_MINIMO_MIN) {
      const propria = ehAcaoPropria(analista, quemAcionou);
      throw new Error('[LIMITE] ' + (propria ? 'Você já usou' : dados[i][1] + ' já usou') + ' ' +
        formatarMinutosTexto(s.usado) + ' do SLA desse nível hoje (de ' + formatarMinutosTexto(s.total) + ').' +
        (s.saldo > 0 ? ' O saldo (' + formatarMinutosTexto(s.saldo) + ') é menor que o mínimo de ' + N2_MINIMO_MIN + ' min.' : '') +
        ' Precisa de mais tempo? Fale com a Coordenação.');
    }

    return {
      sheet: sheet, linhaPlanilha: i + 1, linha: dados[i],
      total: s.total, usado: s.usado, saldo: s.saldo, usos: s.usos,
      duracao: Math.min(MINUTOS_AUSENCIA_N2, s.saldo)
    };
  }
  throw new Error('Analista não encontrado na EQUIPE.');
}

/**
 * NOVO: pré-checagem do Ausente N2 — só CONSULTA (não grava nada). Faz as mesmas
 * validações do registro (já ausente? saldo do dia?) e devolve o fim previsto já
 * com o almoço descontado, pro Widget montar a caixa de confirmação.
 * ALTERADO (1.4.7): devolve o saldo do dia e a duração deste uso (min(2h30, saldo)).
 */
function webObterAvisoAusenteN2(analista, quemAcionou) {
  const v = validarInicioAusenciaN2(analista, quemAcionou);
  const calc = calcularFimAusenciaN2(new Date(), converterParaMinutos(v.linha[4]), converterParaMinutos(v.linha[5]), v.duracao);

  return {
    fimPrevisto: Utilities.formatDate(calc.fim, Session.getScriptTimeZone(), 'dd/MM HH:mm'),
    minutosAlmoco: calc.minutosAlmoco,
    minutos: v.duracao,
    saldo: v.saldo,
    usado: v.usado,
    total: v.total,
    usos: v.usos
  };
}

// ALTERADO (1.4.18): 3º parâmetro "protocolos" — opcional, texto livre (sem validação de formato).
function webIniciarAusenciaN2(analista, quemAcionou, protocolos) {
  const protTexto = normalizarProtocoloLivre(protocolos, false);
  const v = validarInicioAusenciaN2(analista, quemAcionou);

  const inicio = new Date();
  const aIni = converterParaMinutos(v.linha[4]);
  const aFim = converterParaMinutos(v.linha[5]);
  const calc = calcularFimAusenciaN2(inicio, aIni, aFim, v.duracao);

  v.sheet.getRange(v.linhaPlanilha, 3).setValue('AUSENTE');
  v.sheet.getRange(v.linhaPlanilha, 7).clearContent();   // defensivo: N2 não convive com Já Volto
  v.sheet.getRange(v.linhaPlanilha, 8).setValue(calc.fim); // Coluna H (reaproveitada)

  // NOVO (1.4.7): marca o uso em andamento (é o que permite descontar só o tempo usado).
  const nomeEquipe = v.linha[1];
  const chave = normalizarNome(nomeEquipe);
  executarComTrava(() => {
    const c = lerControleN2();
    const info = c.p[chave] || { nome: String(nomeEquipe), usado: 0, usos: 0, ativo: null };
    info.nome = String(nomeEquipe);
    info.usos = (Number(info.usos) || 0) + 1;
    info.ativo = { ini: inicio.getTime(), fim: calc.fim.getTime(), aIni: aIni, aFim: aFim, prot: protTexto };
    c.p[chave] = info;
    gravarControleN2(c);
  });

  const fimFormatado = Utilities.formatDate(calc.fim, Session.getScriptTimeZone(), 'dd/MM HH:mm');
  const acionadoPor = quemAcionou && !ehAcaoPropria(analista, quemAcionou) ? (' (acionado por ' + quemAcionou + ')') : '';
  const notaAlmoco = calc.minutosAlmoco > 0 ? (' + ' + calc.minutosAlmoco + ' min de almoço fora da contagem') : '';

  if (typeof registrarEvento === 'function') {
    registrarEvento('', protTexto, 'AUSENCIA_N2_INICIADA', analista, 'Ausente N2 iniciada (' + formatarMinutosTexto(v.duracao) + notaAlmoco +
      '). Protocolo(s): ' + (protTexto || 'não informado') + ' | Saldo antes: ' + formatarMinutosTexto(v.saldo) + ' de ' + formatarMinutosTexto(v.total) +
      '. Retorno automático previsto para ' + fimFormatado + '.' + acionadoPor);
  }
  if (typeof atualizarFila === 'function') {
    atualizarFila();
  }
  return {
    sucesso: true, analista: analista, fimPrevisto: fimFormatado, minutosAlmoco: calc.minutosAlmoco,
    minutos: v.duracao, protocolos: protTexto
  };
}

/*************************************************
 * 9c. 🆘 "SLA DE CHAMADO" + 🔗 CARDS DOS PROTOCOLOS (1.4.7)
 *************************************************/

/**
 * Ponte do Falar com Coordenação, motivo "SLA de chamado" (também aberto pelo botão
 * "Preciso de mais SLA" do Ausente N2). Protocolo e resumo (até 500) obrigatórios.
 * ALTERADO (1.4.18): protocolo em texto livre (sem validação de formato) e sem os links
 * dos cards do Trello no e-mail.
 */
function webSolicitarSlaChamado(nome, protocolos, resumo, quemAcionou) {
  if (!nome) throw new Error('Informe o analista.');
  const protTexto = normalizarProtocoloLivre(protocolos, true);
  const texto = String(resumo || '').trim();
  if (!texto) throw new Error('Informe o resumo da análise.');
  if (texto.length > 500) throw new Error('O resumo da análise passa de 500 caracteres (' + texto.length + ').');

  const nomeEquipe = obterNomeNaEquipe(nome) || nome;
  const propria = ehAcaoPropria(nomeEquipe, quemAcionou);
  const partes = [];
  if (!propria) partes.push('[Registrado pela Coordenação (' + quemAcionou + ') em nome do analista]');
  try {
    const s = obterSaldoN2(nomeEquipe);
    partes.push('[SLA N2 hoje: usado ' + formatarMinutosTexto(s.usado) + ' de ' + formatarMinutosTexto(s.total) +
      ' — saldo ' + formatarMinutosTexto(s.saldo) + (s.ativo ? ' (Ausente N2 em andamento)' : '') + ']');
  } catch (e) {}
  partes.push(texto);

  webEnviarMensagemCoordenacao(nomeEquipe, 'SLA de chamado', partes.join('\n\n'), null,
    { protocolo: protTexto, rotuloMensagem: 'Resumo da análise' });
  return { sucesso: true, protocolos: protTexto };
}

const CACHE_INDICE_CARDS_PROT = 'INDICE_CARDS_PROTOCOLO_V1';

/** Chave de busca: "16050" / "16050.2" -> "JIVO16050"; "WPP031" -> "WPP031". */
function chaveProtocoloCard(p) {
  const s = String(p || '').trim().toUpperCase().split('.')[0];
  // ALTERADO (1.4.9): "J16465" (novo formato do Jivo) também vira "JIVO16465".
  if (/^J\d+$/.test(s)) return 'JIVO' + s.substring(1);
  return /^\d+$/.test(s) ? 'JIVO' + s : s.replace(/\s+/g, '');
}

/** { chave: [{ l: link, t: título, s: status }] } — BASE da planilha de chamados + CARDS_TRELLO. */
function obterIndiceCardsPorProtocolo() {
  const cache = CacheService.getScriptCache();
  const salvo = cache.get(CACHE_INDICE_CARDS_PROT);
  if (salvo) {
    try { return JSON.parse(salvo); } catch (e) {}
  }
  const indice = {};
  const add = (chave, item) => {
    if (!chave || !item.l) return;
    const lista = indice[chave] = indice[chave] || [];
    if (!lista.some(x => x.l === item.l)) lista.push(item);
  };

  // 1) BASE da planilha de chamados (coluna "Protocolos": "JIVO12531, WPP031").
  try {
    const aba = SpreadsheetApp.openById(PLANILHA_CHAMADOS_ID).getSheetByName('BASE');
    if (aba && aba.getLastRow() >= 2) {
      const dados = aba.getDataRange().getValues();
      const cab = dados[0].map(h => normalizarTexto(h));
      const cP = cab.indexOf(normalizarTexto('Protocolos'));
      const cL = cab.indexOf(normalizarTexto('Link do card'));
      const cT = cab.indexOf(normalizarTexto('Título'));
      const cS = cab.indexOf(normalizarTexto('Status'));
      if (cP !== -1 && cL !== -1) {
        for (let i = 1; i < dados.length; i++) {
          const link = String(dados[i][cL] || '').trim();
          if (!link) continue;
          const item = {
            l: link,
            t: cT !== -1 ? String(dados[i][cT] || '').substring(0, 50) : '',
            s: cS !== -1 ? String(dados[i][cS] || '') : ''
          };
          String(dados[i][cP] || '').split(/[,;]/).forEach(p => add(chaveProtocoloCard(p), item));
        }
      }
    }
  } catch (e) {}

  // 2) Cards criados pelo Lista Ai (ainda podem não ter entrado na BASE).
  try {
    const mapa = (typeof obterMapaCardsTrello === 'function') ? obterMapaCardsTrello() : {};
    Object.keys(mapa).forEach(p => add(chaveProtocoloCard(p), { l: mapa[p], t: 'Jivo ' + p, s: 'criado pelo Lista Ai' }));
  } catch (e) {}

  try { cache.put(CACHE_INDICE_CARDS_PROT, JSON.stringify(indice), 600); } catch (e) {}
  return indice;
}

/**
 * Ponte: links dos cards do Trello dos protocolos digitados. Só informa — não trava nada.
 * [{ protocolo, cards: [{ link, titulo, status }] }]
 */
function webBuscarCardsDosProtocolos(texto) {
  const lista = normalizarListaProtocolos(texto, false);
  if (!lista.length) return [];
  const indice = obterIndiceCardsPorProtocolo();
  return lista.map(p => ({
    protocolo: p,
    cards: (indice[chaveProtocoloCard(p)] || []).map(x => ({ link: x.l, titulo: x.t, status: x.s }))
  }));
}

/**
 * Verifica quem está AUSENTE por auto-serviço — Já Volto (Coluna G, vence após
 * CONFIG!C10 minutos) ou Ausente N2 / Ausência Longa (Coluna H, vence no horário
 * gravado) — e devolve pra ATIVO automaticamente. Também descarta prazos velhos
 * de quem já não está AUSENTE. Chamada no início de webObterDadosFila() — como o
 * front já faz polling, o auto-retorno acontece "sozinho" sem precisar de
 * gatilho de tempo dedicado.
 */
function processarAutoRetornoAusencias() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  if (!sheet || sheet.getLastRow() < 2) return;

  const dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues(); // A-H
  const agora = new Date();

  dados.forEach((linha, i) => {
    const status = String(linha[2]).toUpperCase().trim();
    const inicioAusenciaCurta = linha[6]; // Coluna G — "Já Volto": FIM previsto (1.4.9)
    const fimAusenciaLonga = linha[7];    // Coluna H — Ausente N2 / Ausência Longa

    const temCurta = inicioAusenciaCurta instanceof Date;
    const temLonga = fimAusenciaLonga instanceof Date;
    if (!temCurta && !temLonga) return;

    const linhaPlanilha = i + 2;

    // NOVO: prazo gravado em quem NÃO está AUSENTE é resto de uma troca de status
    // feita por outro caminho — descarta, senão a próxima ausência dessa pessoa
    // (almoço, "Definir Ausente") seria desfeita logo no polling seguinte.
    if (status !== 'AUSENTE') {
      limparPrazosAusenciaNaLinha(sheet, linhaPlanilha);
      return;
    }

    // Fim previsto: Já Volto = Coluna G (ALTERADO 1.4.9: já é o fim); N2/Longa = Coluna H.
    // Se (por dado antigo) existirem os dois, espera o que termina por último.
    let fimPrevisto = temCurta ? inicioAusenciaCurta : null;
    if (temLonga && (!fimPrevisto || fimAusenciaLonga > fimPrevisto)) {
      fimPrevisto = fimAusenciaLonga;
    }
    if (agora < fimPrevisto) return;

    const nome = linha[1];
    sheet.getRange(linhaPlanilha, 3).setValue('ATIVO');
    limparPrazosAusenciaNaLinha(sheet, linhaPlanilha);

    if (typeof registrarEvento === 'function') {
      if (temLonga) {
        registrarEvento('', '', 'AUSENCIA_LONGA_AUTO_RETORNO', nome, 'Retornou automaticamente para ATIVO após o período de ausência de longa duração previsto (Ausência Longa ou Ausente N2).');
      } else {
        registrarEvento('', '', 'AUSENCIA_TEMPORARIA_AUTO_RETORNO', nome, 'Retornou automaticamente para ATIVO no fim do Já Volto.');
      }
    }
  });
}

/**
 * Conta quantas vezes o analista já usou a Ausência Temporária hoje e nesta
 * semana (domingo a sábado), para aplicar os limites do CONFIG.
 * ALTERADO (1.3.15): lê a EV_AUSENCIAS (antes, a EVENTOS).
 */
function contarUsosAusenciaTemporaria(analista) {
  const sheet = obterAbaEventosLeitura(ABAS_EVENTOS.AUSENCIAS);
  if (!sheet || sheet.getLastRow() < 2) return { hoje: 0, semana: 0 };

  const dados = sheet.getDataRange().getValues();
  const agora = new Date();
  const inicioHoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
  const inicioSemana = new Date(inicioHoje);
  inicioSemana.setDate(inicioSemana.getDate() - inicioHoje.getDay());

  let hoje = 0, semana = 0;
  const nomeAlvo = String(analista).trim().toLowerCase();

  for (let i = 1; i < dados.length; i++) {
    const tipo = String(dados[i][3]).toUpperCase().trim();
    const nome = String(dados[i][4]).trim().toLowerCase();
    const data = dados[i][0];

    if (tipo === 'AUSENCIA_TEMPORARIA_INICIADA' && nome === nomeAlvo && data instanceof Date) {
      if (data >= inicioSemana) semana++;
      if (data >= inicioHoje) hoje++;
    }
  }
  return { hoje, semana };
}

/**
 * Ponte web: o analista marca A SI MESMO como ausente por até 10 minutos.
 * Respeita os limites diário/semanal configurados em CONFIG!C7/C8. Ausências
 * maiores que 10 min continuam exigindo contato direto com o Admin, que altera
 * manualmente na planilha — esse fluxo é só para o "já volto" rápido.
 */
/**
 * NOVO: pré-checagem do "Já Volto" — só CONSULTA a posição do analista na
 * fila e monta o aviso correspondente, sem registrar nada. O Widget chama
 * isso ANTES de decidir qual caixa mostrar (a de posição 1-4, ou a genérica
 * "Isso te ausenta da fila por X minutos"), e só registra a ausência de
 * verdade (webIniciarAusenciaTemporaria) depois que a pessoa confirmar.
 */
function webObterAvisoAusenciaRapida(analista, quemAcionou) {
  if (!analista) throw new Error("Informe o analista.");

  const propria = ehAcaoPropria(analista, quemAcionou);

  // Quem já está AUSENTE (com ou sem prazo) nem chega a ver a caixa de confirmação.
  const equipeSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  if (equipeSheet) {
    const dadosEquipe = equipeSheet.getDataRange().getValues();
    const alvo = normalizarNome(analista);
    for (let i = 1; i < dadosEquipe.length; i++) {
      if (normalizarNome(dadosEquipe[i][1]) === alvo) {
        verificarSePodeIniciarAusencia(dadosEquipe[i], analista, quemAcionou || '', false);
        break;
      }
    }
  }

  let posicao = null;
  let aviso = null;
  if (typeof obterPosicaoElegivelNaFila === 'function') {
    posicao = obterPosicaoElegivelNaFila(analista);
    if (posicao === 1) {
      aviso = propria
        ? 'Ao se ausentar agora, você sai do topo da fila caso o próx. assumir um chamado. Se isso acontecer, verifique a possibilidade de voltar para a fila.'
        : 'Ao se ausentar agora, ' + analista + ' sai do topo da fila caso o próx. assumir um chamado. Se isso acontecer, verifique a possibilidade de voltar para a fila.';
    } else if (posicao === 2) {
      aviso = propria
        ? 'Está perto da sua vez, fique atento! Você sai do topo da fila caso for necessário pular sua vez. Se isso acontecer, verifique a possibilidade de voltar para a fila.'
        : analista + ' está perto da vez, fique atento! ' + analista + ' sai do topo da fila caso seja necessário pular a vez. Se isso acontecer, verifique a possibilidade de voltar para a fila.';
    } else if (posicao === 3 || posicao === 4) {
      aviso = propria
        ? 'Está perto da sua vez, fique atento, ou avise a coordenação caso precise de uma pausa.'
        : analista + ' está perto da vez, fique atento.';
    }
  }

  // ALTERADO (1.4.9): opções de tempo do Já Volto (o Widget pergunta antes de confirmar).
  return { posicao: posicao, aviso: aviso, minutos: obterMinutosAutoRetornoAusencia(), opcoes: JA_VOLTO_OPCOES_MIN };
}

// ALTERADO (1.4.9): 3º parâmetro "minutos" — 5, 10, 20 ou 30 (JA_VOLTO_OPCOES_MIN). Sem ele
// (Modo Mini / chamadas antigas), vale CONFIG!C10. A Coluna G grava o FIM previsto.
function webIniciarAusenciaTemporaria(analista, quemAcionou, minutos) {
  if (!analista) throw new Error("Informe quem está se ausentando.");
  const minutosJaVolto = (minutos === undefined || minutos === null || String(minutos).trim() === '')
    ? obterMinutosAutoRetornoAusencia() : Number(minutos);
  if (JA_VOLTO_OPCOES_MIN.indexOf(minutosJaVolto) === -1 && minutosJaVolto !== obterMinutosAutoRetornoAusencia()) {
    throw new Error('Escolha ' + JA_VOLTO_OPCOES_MIN.join(', ') + ' minutos. Para mais tempo, fale com a Coordenação.');
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ABA_EQUIPE);
  const dados = sheet.getDataRange().getValues();
  const nomeAlvo = String(analista).trim().toLowerCase();

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][1]).trim().toLowerCase() !== nomeAlvo) continue;

    // ALTERADO: quem já está AUSENTE — com prazo (não reinicia a contagem em
    // silêncio) ou SEM prazo (Definido pela Coordenação, editado na planilha,
    // almoço) — não pode se ausentar de novo; só registrar o retorno.
    verificarSePodeIniciarAusencia(dados[i], analista, quemAcionou, false);

    const configSheet = ss.getSheetByName('CONFIG');
    // ALTERADO (1.4.9): padrão 4 por dia e 20 por semana (CONFIG!C7 / C8 mandam, se preenchidas).
    const limiteDia = Number(configSheet.getRange('C7').getValue()) || 4;
    const limiteSemana = Number(configSheet.getRange('C8').getValue()) || 20;

    const propria = ehAcaoPropria(analista, quemAcionou);
    const usos = contarUsosAusenciaTemporaria(analista);
    // O marcador [LIMITE] é lido pelo Widget pra abrir o aviso com o atalho "Preciso de uma pausa".
    if (usos.hoje >= limiteDia) {
      throw new Error('[LIMITE] ' + (propria
        ? 'Você já usou o Já Volto ' + limiteDia + 'x hoje. Tudo bem? Se precisar de mais tempo, é só falar com a Coordenação.'
        : dados[i][1] + ' já usou o Já Volto ' + limiteDia + 'x hoje (limite diário).'));
    }
    if (usos.semana >= limiteSemana) {
      throw new Error('[LIMITE] ' + (propria
        ? 'Você já usou o Já Volto ' + limiteSemana + 'x essa semana. Tudo bem? Se precisar de mais tempo, é só falar com a Coordenação.'
        : dados[i][1] + ' já usou o Já Volto ' + limiteSemana + 'x essa semana (limite semanal).'));
    }

    sheet.getRange(i + 1, 3).setValue('AUSENTE');
    sheet.getRange(i + 1, 7).setValue(new Date(Date.now() + minutosJaVolto * 60000)); // G: FIM previsto (1.4.9)
    sheet.getRange(i + 1, 8).clearContent(); // defensivo: Já Volto não convive com prazo da Coluna H

    const acionadoPor = (quemAcionou && !propria) ? (' (acionado por ' + quemAcionou + ')') : '';
    if (typeof registrarEvento === 'function') {
      registrarEvento('', '', 'AUSENCIA_TEMPORARIA_INICIADA', analista, 'Ausência temporária iniciada (retorno automático em ' + minutosJaVolto + ' min).' + acionadoPor);
    }
    if (typeof atualizarFila === 'function') {
      atualizarFila();
    }
    return { sucesso: true, analista: analista, minutos: minutosJaVolto };
  }
  throw new Error('Analista não encontrado na EQUIPE.');
}

/**
 * Ponte web segura (Nível 2 / Coordenação): marca QUALQUER analista como
 * ausente por um período longo (horas), com auto-retorno no horário previsto.
 * Substitui a edição manual na planilha para ausências de 2h+.
 */
// ALTERADO (1.4.9): 4º parâmetro opcional "minutos" (o Widget manda a duração em minutos:
// 30 min, 40 min, 1h15...). Sem ele, vale "horas" como antes (aceita decimal).
function webIniciarAusenciaLonga(analista, horas, quemAcionou, minutos) {
  if (!analista) throw new Error("Informe o analista.");
  const totalMin = (minutos !== undefined && minutos !== null && String(minutos).trim() !== '')
    ? Math.round(Number(minutos))
    : Math.round(Number(horas) * 60);
  if (!totalMin || totalMin <= 0) throw new Error("Informe uma duração válida.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  const dados = sheet.getDataRange().getValues();
  const nomeAlvo = String(analista).trim().toLowerCase();

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][1]).trim().toLowerCase() === nomeAlvo) {
      // ALTERADO: mesma trava dos outros dois fluxos — recusa quem já está AUSENTE
      // com QUALQUER prazo (G ou H). Só a Ausência Longa da Coordenação pode dar
      // um prazo a quem está AUSENTE sem prazo (ausência manual ou almoço).
      verificarSePodeIniciarAusencia(dados[i], analista, quemAcionou, true);

      const fimPrevisto = new Date(Date.now() + totalMin * 60 * 1000);

      sheet.getRange(i + 1, 3).setValue('AUSENTE');
      sheet.getRange(i + 1, 7).clearContent();          // defensivo: nunca convive com o Já Volto
      sheet.getRange(i + 1, 8).setValue(fimPrevisto);   // Coluna H

      const fimFormatado = Utilities.formatDate(fimPrevisto, Session.getScriptTimeZone(), 'dd/MM HH:mm');
      const acionadoPor = quemAcionou ? (' (acionado por ' + quemAcionou + ')') : '';

      if (typeof registrarEvento === 'function') {
        registrarEvento('', '', 'AUSENCIA_LONGA_INICIADA', analista, 'Ausência longa de ' + formatarMinutosTexto(totalMin) + ' iniciada pela Coordenação. Retorno automático previsto para ' + fimFormatado + '.' + acionadoPor);
      }
      if (typeof atualizarFila === 'function') {
        atualizarFila();
      }
      return { sucesso: true, analista: analista, fimPrevisto: fimFormatado };
    }
  }
  throw new Error('Analista não encontrado na EQUIPE.');
}
// Retorna quem está AUSENTE por auto-serviço agora — "Já Volto" (Coluna G) OU
// Ausência Longa da Coordenação (Coluna H). Usado pra popular o "Já Voltei".
// ALTERADO (1.4.9): "todos" = true devolve TODOS os ausentes (com ou sem prazo) — usado pelo
// ✅ Já Voltei da Coordenação, que escolhe qualquer analista ausente.
function webObterAusentesTemporarios(todos) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, 8).getValues();
  let nomes = [];

  dados.forEach(linha => {
    const status = String(linha[2]).toUpperCase().trim();
    const inicioAusenciaCurta = linha[6];
    const fimAusenciaLonga = linha[7];
    if (status === 'AUSENTE' && (todos || inicioAusenciaCurta instanceof Date || fimAusenciaLonga instanceof Date)) {
      nomes.push(linha[1]);
    }
  });

  return nomes;
}

/**
 * Ponte web: analista registra que JÁ VOLTOU ("Já Voltei") de qualquer ausência —
 * curta, N2, longa ou sem prazo — antes do auto-retorno previsto (se houver).
 * Limpa as duas colunas de prazo. Se a pessoa já estava ATIVA, não faz nada.
 */
function webVoltarDaAusenciaTemporaria(analista) {
  if (!analista) throw new Error("Informe quem está voltando.");

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  const dados = sheet.getDataRange().getValues();
  const nomeAlvo = String(analista).trim().toLowerCase();

  for (let i = 1; i < dados.length; i++) {
    if (String(dados[i][1]).trim().toLowerCase() === nomeAlvo) {
      const statusAtual = String(dados[i][2]).toUpperCase().trim();
      const tinhaPrazo = (dados[i][6] instanceof Date) || (dados[i][7] instanceof Date);

      // NOVO: só "volta" quem realmente está AUSENTE. Se já estava ATIVO (tela
      // desatualizada, auto-retorno que aconteceu antes do clique), não grava
      // nada nem cria evento à toa — só descarta algum prazo velho.
      if (statusAtual !== 'AUSENTE') {
        if (tinhaPrazo) limparPrazosAusenciaNaLinha(sheet, i + 1);
        return { sucesso: true, analista: analista, jaAtivo: true };
      }

      // ALTERADO: vale pra QUALQUER ausência — Já Volto, N2, Ausência Longa ou
      // ausência sem prazo (Definida pela Coordenação / planilha / almoço).
      sheet.getRange(i + 1, 3).setValue('ATIVO');
      limparPrazosAusenciaNaLinha(sheet, i + 1); // Colunas G e H

      if (typeof registrarEvento === 'function') {
        if (tinhaPrazo) {
          registrarEvento('', '', 'AUSENCIA_TEMPORARIA_RETORNO_MANUAL', analista, 'Retornou manualmente de uma ausência (curta ou longa), antes do auto-retorno previsto.');
        } else {
          registrarEvento('', '', 'AUSENCIA_RETORNO_MANUAL', analista, 'Retornou manualmente de uma ausência sem prazo (definida pela Coordenação, pela planilha ou pelo almoço).');
        }
      }
      if (typeof atualizarFila === 'function') {
        atualizarFila();
      }
      return { sucesso: true, analista: analista };
    }
  }
  throw new Error('Analista não encontrado na EQUIPE.');
}


function webObterDadosFila() {
  // NOVO: processa auto-retorno de ausências temporárias a cada busca (20s) —
  // piggyback no polling que o front já faz, sem precisar de gatilho dedicado.
  if (typeof processarAutoRetornoAusencias === 'function') {
    processarAutoRetornoAusencias();
  }

  // NOVO (1.3.8): executa as ausências agendadas cujo horário já chegou (Agenda).
  try {
    processarAgendaAusencias();
  } catch (e) {}
    // NOVO (1.4.13): virada do almoço na hora (sem esperar o gatilho de 5 min).
  try { sincronizarAlmocoAgora(true); } catch (e) {}

  // NOVO (1.3.8): uma leitura só da EQUIPE/FILA para o ciclo inteiro do polling.
  let estado = null;
  try {
    estado = carregarEstadoFila();
  } catch (e) {}

  let proximo = 'Fila Vazia';

  // CORRIGIDO: antes essa lógica lia direto a Coluna B da FILA e pegava a
  // primeira célula não-vazia, SEM filtrar quem está ATIVO — uma implementação
  // duplicada e desatualizada de obterProximoAnalista(), que nunca recebeu a
  // correção de pular AUSENTES. Isso fazia a caixa "Próximo" mostrar alguém
  // ausente, enquanto o modal "Ver Fila" (que já usava obterProximoAnalista())
  // mostrava certo. Agora usa a mesma fonte única e correta.
  try {
    const proximoReal = estado ? calcularProximo(estado) : obterProximoAnalista();
    if (proximoReal) proximo = proximoReal;
  } catch (e) {
    try {
      const analistas = obterListaAnalistas(false);
      if (analistas && analistas.length > 0) proximo = analistas[0];
    } catch(err) {}
  }

  // NOVO: inclui a lista de analistas (já na ordem certa, com o "próximo" primeiro)
  // na mesma resposta. Como o front já busca esses dados a cada 20s, ele pode
  // cachear essa lista e abrir os modais de seleção instantaneamente, sem precisar
  // de uma chamada extra ao servidor (e sua latência) na hora do clique.
  let analistasOrdenados = [];
  try {
    analistasOrdenados = obterListaAnalistasParaDropdown(estado || undefined);
  } catch (e) {}

  // NOVO (1.4.6): lista da ORIGEM dos modais de Retorno/Transferir (ativos + ausentes).
  let analistasOrigem = [];
  try {
    analistasOrigem = obterAnalistasOrigem(estado || undefined);
  } catch (e) {}

  // NOVO: inclui o Próximo N2 na mesma resposta, reaproveitando o polling
  // periódico que o front já faz a cada 20s — sem custo extra de round-trip.
  let proximoN2 = null;
  try {
    proximoN2 = (typeof obterProximoN2 === 'function') ? obterProximoN2() : null;
  } catch (e) {}

  // NOVO (1.4.9): frase do 📋 copiar protocolo (CONFIG!C15). Vazia = frase padrão.
  let textoCopiaProtocolo = 'O protocolo deste atendimento é:';
  try {
    const cfg = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CONFIG');
    const t = cfg ? String(cfg.getRange('C15').getValue() || '').trim() : '';
    if (t) textoCopiaProtocolo = t;
  } catch (e) {}

  return {
    textoCopiaProtocolo: textoCopiaProtocolo, // NOVO (1.4.9)
    proximo: proximo,
    analistasOrdenados: analistasOrdenados,
    analistasOrigem: analistasOrigem, // NOVO (1.4.6)
    proximoN2: proximoN2,
    // NOVO: sinaliza se o "próximo" atual veio de uma reinserção manual
    // (Colocar como Próximo) — o front usa isso pra avisar na tela "Ver Fila"
    // que essa posição é uma interrupção de uma rodada, não a ordem física real.
    proximoForcado: estado ? !!estado.forcado : !!obterProximoForcado()
  };
}

/**
 * ALTERADO (1.4.9): 📜 Últimos = só ACEITES de chat (aceite pelo Jivo ou Chat Aceito manual),
 * do mais recente para o mais antigo, até 10 nomes sem repetir. Linhas criadas por Novo
 * Erro, Finalizar Órfão ou Retorno sem linha aberta NÃO entram. Mostra o analista ATUAL da
 * linha (Coluna C): se o chat foi transferido, aparece o Destino.
 * Linha de aceite = Coluna S preenchida (gravada a partir da 1.4.9); linhas antigas, sem a
 * Coluna S, entram pelo Tipo ("Chat Aceito (Webhook)" ou "Primeiro Contato").
 */
function webObterUltimosAnalistas() {
  const sheetProtocolos = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS || 'PROTOCOLOS');
  const ultimos = [];
  if (!sheetProtocolos) return ultimos;

  const ultimaLinha = sheetProtocolos.getLastRow();
  if (ultimaLinha < 2) return ultimos;

  const larg = Math.min(Math.max(sheetProtocolos.getLastColumn(), 4), COL_PROT_ACEITO_POR);
  const dados = sheetProtocolos.getRange(2, 1, ultimaLinha - 1, larg).getValues();
  const vistos = {};

  for (let i = dados.length - 1; i >= 0; i--) {
    const aceitoPor = larg >= COL_PROT_ACEITO_POR ? String(dados[i][COL_PROT_ACEITO_POR - 1] || '').trim() : '';
    const tipo = String(dados[i][3] || '').trim();
    const ehAceite = !!aceitoPor || tipo === 'Chat Aceito (Webhook)' || tipo === 'Primeiro Contato';
    if (!ehAceite) continue;
    const analista = String(dados[i][2] || '').trim();
    if (!analista || vistos[normalizarNome(analista)]) continue;
    vistos[normalizarNome(analista)] = true;
    ultimos.push(analista);
    if (ultimos.length >= 10) break;
  }

  return ultimos;
}

/*************************************************
 * 🧾 TELA DE LOG (1.4.11)
 *************************************************/
// Eventos de hoje e ontem das abas EV_ATENDIMENTOS, EV_FILA e EV_AUSENCIAS, do mais recente
// para o mais antigo. Lê cada aba de baixo para cima, em blocos, e para ao chegar antes de
// ontem 00:00 (as abas crescem só no fim). Visível para todos os níveis.
const LOG_TELA_ABAS = [ABAS_EVENTOS.ATENDIMENTOS, ABAS_EVENTOS.FILA, ABAS_EVENTOS.AUSENCIAS];
const LOG_TELA_MAX = 3000; // teto de segurança da resposta

function webObterLogEventos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const agora = new Date();
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - 1); // ontem 00:00
  const BLOCO = 500;
  const lista = [];

  LOG_TELA_ABAS.forEach(nomeAba => {
    const sh = ss.getSheetByName(nomeAba);
    if (!sh) return;
    let fim = sh.getLastRow();
    const largura = Math.min(Math.max(sh.getLastColumn(), 6), COLUNAS_EVENTOS);
    while (fim >= 2) {
      const ini = Math.max(2, fim - BLOCO + 1);
      const vals = sh.getRange(ini, 1, fim - ini + 1, largura).getValues();
      let passou = false;
      for (let i = vals.length - 1; i >= 0; i--) {
        const d = vals[i][0];
        if (!(d instanceof Date)) continue;
        if (d < inicio) { passou = true; break; }
        lista.push({
          ms: d.getTime(),
          quando: Utilities.formatDate(d, tz, 'dd/MM HH:mm:ss'),
          protocolo: String(vals[i][2] || ''),
          tipo: String(vals[i][3] || ''),
          analista: String(vals[i][4] || ''),
          descricao: String(vals[i][5] || ''),
          chatId: largura >= 7 ? String(vals[i][6] || '') : '',
          aba: nomeAba
        });
      }
      if (passou) break;
      fim = ini - 1;
    }
  });

  lista.sort((a, b) => b.ms - a.ms);
  const cortado = lista.length > LOG_TELA_MAX;
  return { eventos: cortado ? lista.slice(0, LOG_TELA_MAX) : lista, cortado: cortado, total: lista.length };
}

/*************************************************
 * 🧾 LOG — BUSCA NO MÊS (NOVO 1.4.22)
 *************************************************/
// Modo "Mês atual" / "Mês anterior" da tela 🧾 Log. A pesquisa roda aqui (botão 🔎 do Widget):
//  - lê EV_ATENDIMENTOS e EV_FILA do mês do calendário (só Jivo; ausências e e-mails ficam de fora);
//  - termo com cara de protocolo (J16465, 16465, 15618K026): acha os eventos do protocolo, dos
//    derivados do Novo Erro (J16465.1, .2) e os que citam o número na descrição (ex.: Retorno);
//    J16465.1 digitado acha só aquele derivado;
//  - qualquer outro texto (analista, usuário do chat, tipo, frase): todas as palavras precisam
//    aparecer no evento (sem acento, sem maiúsculas);
//  - depois completa a linha do tempo: entram todos os eventos do mês dos protocolos e chats achados;
//  - "apenas protocolos": evento sem protocolo e sem chat ligado a um protocolo não entra.
// Devolve { eventos (mesmo formato do Log de hoje e ontem), cards, de, ate, rotulo, cortado, total }.
const LOG_MES_ABAS = [ABAS_EVENTOS.ATENDIMENTOS, ABAS_EVENTOS.FILA];
const LOG_MES_MAX = 4000;          // teto de eventos devolvidos
const LOG_MES_MIN_CARACTERES = 3;

function webBuscarLogMes(termo, qualMes) {
  termo = String(termo === null || termo === undefined ? '' : termo).trim();
  if (termo.replace(/\s+/g, '').length < LOG_MES_MIN_CARACTERES) {
    throw new Error('Digite pelo menos ' + LOG_MES_MIN_CARACTERES + ' caracteres para pesquisar no mês.');
  }
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const agora = new Date();
  const anterior = String(qualMes || '') === 'anterior';
  const de = new Date(agora.getFullYear(), agora.getMonth() - (anterior ? 1 : 0), 1);
  const ate = anterior ? new Date(agora.getFullYear(), agora.getMonth(), 1) : new Date(agora.getTime() + 60000);
  const BLOCO = 500;

  // 1) Eventos do mês (das duas abas), lidos de baixo para cima.
  const todos = [];
  LOG_MES_ABAS.forEach(nomeAba => {
    const sh = ss.getSheetByName(nomeAba);
    if (!sh) return;
    let fim = sh.getLastRow();
    const largura = Math.min(Math.max(sh.getLastColumn(), 6), COLUNAS_EVENTOS);
    while (fim >= 2) {
      const ini = Math.max(2, fim - BLOCO + 1);
      const vals = sh.getRange(ini, 1, fim - ini + 1, largura).getValues();
      let passou = false;
      for (let i = vals.length - 1; i >= 0; i--) {
        const d = vals[i][0];
        if (!(d instanceof Date)) continue;
        if (d < de) { passou = true; break; }
        if (d >= ate) continue;
        todos.push({
          ms: d.getTime(),
          quando: Utilities.formatDate(d, tz, 'dd/MM HH:mm:ss'),
          canal: String(vals[i][1] || ''),
          protocolo: String(vals[i][2] === null || vals[i][2] === undefined ? '' : vals[i][2]).trim(),
          tipo: String(vals[i][3] || ''),
          analista: String(vals[i][4] || ''),
          descricao: String(vals[i][5] || ''),
          chatId: largura >= 7 ? String(vals[i][6] || '').trim() : '',
          aba: nomeAba
        });
      }
      if (passou) break;
      fim = ini - 1;
    }
  });

  // 2) Quais eventos batem com o termo.
  const prot = protocoloDoTermoLogMes_(termo);
  let bate;
  if (prot) {
    const reDesc = new RegExp('(^|[^0-9.])J?' + prot.numero + (prot.derivado ? '\\.' + prot.derivado : '(\\.\\d+)?') + '(?![0-9])', 'i');
    bate = ev => {
      const p = protocoloDoTermoLogMes_(ev.protocolo);
      if (p && p.numero === prot.numero && (!prot.derivado || p.derivado === prot.derivado)) return true;
      return reDesc.test(ev.descricao);
    };
  } else {
    const palavras = normalizarTexto(termo).split(' ').filter(Boolean);
    bate = ev => {
      const txt = normalizarTexto([ev.protocolo, ev.chatId, ev.analista, ev.tipo, ev.descricao, ev.canal, ev.quando].join(' '));
      return palavras.every(w => txt.indexOf(w) !== -1);
    };
  }

  // 3) Chat -> protocolo (para ligar eventos que só têm o chat ao protocolo do atendimento).
  const protDoChat = {};
  todos.slice().sort((a, b) => a.ms - b.ms).forEach(ev => {
    if (ev.chatId && protocoloValidoLogMes_(ev.protocolo) && !protDoChat[ev.chatId]) protDoChat[ev.chatId] = ev.protocolo;
  });
  const grupoDe = ev => protocoloValidoLogMes_(ev.protocolo) ? ev.protocolo.toUpperCase() : (ev.chatId && protDoChat[ev.chatId] ? String(protDoChat[ev.chatId]).toUpperCase() : '');

  // 4) Protocolos e chats achados -> linha do tempo completa de cada um.
  const grupos = {}, chats = {};
  todos.forEach(ev => {
    if (!bate(ev)) return;
    const g = grupoDe(ev);
    if (g) grupos[g] = true;
    if (ev.chatId) chats[ev.chatId] = true;
  });
  // Termo de protocolo: o grupo também pode ser só citado (Retorno do protocolo antigo).
  if (prot) {
    todos.forEach(ev => {
      const p = protocoloDoTermoLogMes_(ev.protocolo);
      if (p && p.numero === prot.numero && (!prot.derivado || p.derivado === prot.derivado)) grupos[ev.protocolo.toUpperCase()] = true;
    });
  }

  // Chat achado sem protocolo no próprio evento: o protocolo do chat entra também.
  todos.forEach(ev => {
    if (!ev.chatId || !chats[ev.chatId]) return;
    const g = grupoDe(ev);
    if (g) grupos[g] = true;
  });

  const lista = [];
  todos.forEach(ev => {
    const g = grupoDe(ev);
    if (!g || !grupos[g]) return; // apenas protocolos
    ev.grupo = g;
    lista.push(ev);
  });

  lista.sort((a, b) => b.ms - a.ms);
  const cortado = lista.length > LOG_MES_MAX;
  // ALTERADO (1.4.22a): devolve TEXTO JSON (o Widget faz o JSON.parse) — evita a resposta chegar vazia ao navegador.
  return JSON.stringify({
    eventos: cortado ? lista.slice(0, LOG_MES_MAX) : lista,
    cards: (typeof obterMapaCardsTrello === 'function') ? obterMapaCardsTrello() : {},
    de: de.getTime(),
    ate: Math.min(ate.getTime(), agora.getTime()),
    rotulo: Utilities.formatDate(de, tz, 'MM/yyyy'),
    cortado: cortado,
    total: lista.length
  });
}

/** "J16465" | "16465" | "J16465.2" | "15618K026" -> { numero: '16465', derivado: '2' | '' }; outro texto -> null. */
function protocoloDoTermoLogMes_(t) {
  const s = String(t === null || t === undefined ? '' : t).toUpperCase().replace(/\s+/g, '');
  const m = /^(?:JIVO|J)?(\d{3,})(?:[A-Z]\d{0,4})?(?:\.(\d+))?$/.exec(s);
  return m ? { numero: String(parseInt(m[1], 10)), derivado: m[2] || '' } : null;
}

/** Protocolo que serve de grupo no Log do mês (número de atendimento; "TRIAGEM", "ignorado" e vazio não). */
function protocoloValidoLogMes_(p) {
  return !!protocoloDoTermoLogMes_(p);
}

/** Rodar pelo editor: confere a busca do mês. */
function testarBuscaLogMes(termo) {
  const r = JSON.parse(webBuscarLogMes(termo || 'chat accepted', 'atual'));
  Logger.log('Mês ' + r.rotulo + ': ' + r.total + ' evento(s)' + (r.cortado ? ' (cortado)' : ''));
}

function testarLeituraFila() {
  try {
    const resultado = webObterDadosFila();
    Logger.log("SUCESSO: " + JSON.stringify(resultado));
  } catch (err) {
    Logger.log("ERRO CAPTURADO: " + err.message + " | Linha: " + err.stack);
  }
}

/**
 * TESTE MANUAL DO WEBHOOK — roda o doPost() direto no editor, sem precisar de
 * curl/Postman nem de um chat real no Jivo. Simula o payload oficial de chat_finished.
 * Depois de rodar, confira a aba PROTOCOLOS (deve ter uma linha FINALIZADA) e as abas
 * EV_ATENDIMENTOS (deve ter um CHAT_FINISHED) ou EV_WEBHOOK (um dos logs WEBHOOK_* se
 * algo não bateu).
 *
 * Ajuste os valores abaixo antes de rodar:
 * - "id" em "agents" precisa bater com a Coluna D da aba EQUIPE (ID do Agente Jivo)
 * - Precisa existir uma linha em PROTOCOLOS com esse analista e status EM ATENDIMENTO
 *   (rode primeiro o fluxo Chat Aceito -> Assumir no Widget, ou insira manualmente)
 */
function testarWebhookChatFinished() {
  const payloadFalso = {
    postData: {
      contents: JSON.stringify({
        event_name: "chat_finished",
        chat_id: 7607,
        topic: { topic_id: 7, title: "🐞 Dúvida sobre pedido", parent_id: 0 }, // 1.3.16: troque por 3 ou 4 pra testar o "não conta protocolo"
        agents: [{ id: "2016", name: "Thomas Anderson" }]
      })
    }
  };

  const resultado = doPost(payloadFalso);
  Logger.log("Resposta do doPost: " + resultado.getContent());
}

/**
 * Retorna os protocolos ativos (Em Triagem ou Em Atendimento) para exibir no Widget
 */
function webObterProtocolosAtivos() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ABA_PROTOCOLOS || "PROTOCOLOS");
  if (!sheet) return [];

  const ultimaLinha = sheet.getLastRow();
  if (ultimaLinha < 2) return [];

  // ALTERADO: leitura vai até a Coluna O (15 colunas — inclui Protocolo Fonte,
  // Motivo Pausa, Pausado Desde, Pausas Acumuladas, e agora Canal e Cliente)
  const ultimaColuna = Math.max(sheet.getLastColumn(), 15);
  const dados = sheet.getRange(2, 1, ultimaLinha - 1, ultimaColuna).getValues();
  let resultados = [];
  // NOVO (1.4.0): protocolos que já têm card no Trello (troca 🗂️ por 🔗 no Widget).
  const mapaCardsTrello = (typeof obterMapaCardsTrello === 'function') ? obterMapaCardsTrello() : {};

  // Função interna para formatar data/hora para "HH:mm"
  function formatarHora(valor) {
    if (!valor) return '';
    try {
      let data = new Date(valor);
      if (isNaN(data.getTime())) return String(valor);
      let horas = String(data.getHours()).padStart(2, '0');
      let minutos = String(data.getMinutes()).padStart(2, '0');
      return horas + ':' + minutos;
    } catch (e) {
      return String(valor);
    }
  }

  // NOVO: formata a Duração como "HH:mm" (sem segundos). Cobre dois casos:
  // 1) texto puro "HH:MM:SS" (linhas novas, gravadas com setNumberFormat('@'))
  // 2) objeto Date (linhas antigas que o Sheets converteu antes da correção)
  function formatarDuracao(valor) {
    if (!valor) return '';
    if (valor instanceof Date) {
      let horas = String(valor.getHours()).padStart(2, '0');
      let minutos = String(valor.getMinutes()).padStart(2, '0');
      return horas + ':' + minutos;
    }
    const partes = String(valor).split(':');
    if (partes.length >= 2) {
      return partes[0].padStart(2, '0') + ':' + partes[1].padStart(2, '0');
    }
    return String(valor);
  }

  for (let i = 0; i < dados.length; i++) {
    let protocolo = dados[i][0]; // Coluna A
    let analista = dados[i][2];  // Coluna C
    let tipo = dados[i][3];      // Coluna D — trazido de volta só para identificar Retorno
    let status = dados[i][4];    // Coluna E

    // CORRIGIDO: horário início não deve aparecer para status FILA (standby) —
    // esse atendimento ainda não começou a ser tratado de verdade, só foi
    // colocado em espera. Só mostra a partir de EM TRIAGEM, EM ATENDIMENTO ou
    // FINALIZADO (que já passou por um desses estágios).
    let horarioInicio = '';
    if (String(status).toUpperCase() !== 'FILA') {
      horarioInicio = formatarHora(dados[i][1]); // Coluna B (Data)
    }
    let encerrado     = formatarHora(dados[i][6]); // Coluna G (Encerrado)
    let duracao       = formatarDuracao(dados[i][7]); // Coluna H (Duração)

    // NOVO (1.4.6): linha encerrada com um tópico que não conta protocolo (Coluna A = "ignorado").
    const ignorado = String(protocolo || '').trim().toLowerCase() === PROTOCOLO_IGNORADO_TEXTO;

    // CORRIGIDO: antes excluía quem já estava FINALIZADO, então Encerrado/Duração
    // nunca apareciam no front (o item nem chegava até lá). A aba PROTOCOLOS é
    // limpa diariamente de qualquer forma, então não há risco de acúmulo.
    if (analista && status) {
      resultados.push({
        protocolo: (protocolo && String(protocolo).trim() !== '') ? protocolo : 'pendente',
        analista: analista,
        status: status,
        // NOVO: sinaliza se é um Retorno, sem reintroduzir o Tipo genérico no front
        ehRetorno: String(tipo).trim().toLowerCase() === 'retorno',
        horarioInicio: horarioInicio,
        encerrado: encerrado,
        duracao: duracao,
        // NOVO (Atendimento Pausado): motivo só vem preenchido quando o status
        // atual é PAUSADO — o front usa isso pra montar o tooltip.
        motivoPausa: String(status).toUpperCase() === 'PAUSADO' ? (dados[i][10] || '') : '',
        // NOVO: Canal e Cliente, preenchidos pelo chat_accepted via webhook
        canal: dados[i][13] || '',
        cliente: dados[i][14] || '',
        cardLink: ignorado ? '' : (mapaCardsTrello[String(protocolo || '').trim()] || ''), // NOVO (1.4.0)
        // NOVO (1.4.6): linha "ignorado" + o tópico (Coluna I) que fez ela não contar.
        ignorado: ignorado,
        topico: ignorado ? String(dados[i][8] || '') : ''
      });
    }
  }

  resultados.reverse();
  return resultados;
}

/**
 * Ponte chamada pelo Widget Flutuante para Pular Próximo
 */
// ALTERADO (1.3.8): uma leitura só + trava. "proximoEsperado" (opcional) é quem o
// painel mostrava como próximo no momento do clique: se a fila já mudou (outro clique,
// outro painel, um aceite do Jivo), NÃO pula ninguém e avisa — é o que impede pular
// vários analistas seguidos por causa da demora. Devolve o novo próximo, pro painel
// atualizar na hora. O atualizarFila() saiu: a reconstrução da fila já grava todos.
function webPularProximo(proximoEsperado) {
  try {
    return executarComTrava(() => {
      const estado = carregarEstadoFila();
      const atual = calcularProximo(estado);
      if (!atual) throw new Error("Nenhum analista na fila para pular.");

      if (proximoEsperado && normalizarNome(proximoEsperado) !== normalizarNome(atual)) {
        throw new Error("a fila já mudou — o próximo agora é " + atual + ". Confira antes de pular de novo.");
      }

      const res = moverAnalistaParaFimDaFila(atual, { estado: estado });
      registrarEvento('', '', 'ANALISTA_PULADO', atual, 'Analista pulado na fila.');

      return { status: 'sucesso', analista: atual, proximo: (res && res.proximo) || null };
    }, 8000);
  } catch (e) {
    throw new Error("Erro ao pular: " + e.message);
  }
}

/**
 * Retorna a lista de analistas, mas coloca o "Próximo" da fila no topo do Dropdown
 */
function obterListaAnalistasParaDropdown(estado) {
  // ALTERADO (1.3.8): reaproveita o estado já lido (sem novas leituras da planilha).
  estado = estado || carregarEstadoFila();
  const proximo = calcularProximo(estado);

  const todos = estado.emOrdemLinha.filter(i => i.status === 'ATIVO').map(i => i.nome);

  if (!proximo) return todos;

  const listaOrdenada = [proximo, ...todos.filter(a => a.toLowerCase() !== proximo.toLowerCase())];

  return listaOrdenada;
}

function webBuscarTodasPendenciasFila() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.ABA_PROTOCOLOS || 'PROTOCOLOS');
  if (!sheet) return [];

  const dados = sheet.getDataRange().getValues();
  let lista = [];

  for (let i = 1; i < dados.length; i++) {
    const linha = dados[i];
    const protocolo = linha[0];
    const analistaLinha = linha[2];
    const statusLinha = String(linha[4]).trim().toUpperCase();

    // ALTERADO (1.4.9): inclui PAUSADO (EM FILA ou outro motivo) para a Coordenação retomar.
    if (analistaLinha && (statusLinha === 'EM TRIAGEM' || statusLinha === 'FILA' || statusLinha === 'PAUSADO')) {
      lista.push({
        linha: i + 1,
        analista: analistaLinha,
        protocolo: protocolo,
        status: statusLinha,
        motivoPausa: statusLinha === 'PAUSADO' ? String(linha[10] || '') : ''
      });
    }
  }
  return lista;
}

/**
 * Retorna lista única de analistas que possuem atendimentos EM TRIAGEM ou FILA (para Origem do Retorno)
 */
function obterAnalistasComTriagemOuFila() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_PROTOCOLOS || 'PROTOCOLOS');
  if (!sheet) return [];
  const dados = sheet.getDataRange().getValues();
  let analistas = [];

  for (let i = 1; i < dados.length; i++) {
    const analista = dados[i][2];
    const status = String(dados[i][4]).trim().toUpperCase();
    if (analista && (status === 'EM TRIAGEM' || status === 'FILA')) {
      if (!analistas.includes(analista)) analistas.push(analista);
    }
  }
  return analistas;
}

/**
 * Retorna apenas analistas com status ATIVO na aba EQUIPE (para Origem da Transferência)
 */
function obterAnalistasAtivosEquipe() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('EQUIPE') || ss.getSheetByName('ANALISTAS');
  if (!sheet) {
    return (typeof obterListaAnalistas === 'function') ? obterListaAnalistas(false) : [];
  }

  const dados = sheet.getDataRange().getValues();
  let ativos = [];

  for (let i = 1; i < dados.length; i++) {
    const nome = dados[i][0];
    const status = String(dados[i][1]).trim().toUpperCase();
    if (nome && (status === 'ATIVO' || status === 'SIM' || status === 'TRUE')) {
      ativos.push(nome);
    }
  }

  if (ativos.length === 0 && typeof obterListaAnalistas === 'function') {
    return obterListaAnalistas(false);
  }
  return ativos;
}


/*************************************************
 * 🆗 TÓPICOS QUE NÃO CONTAM PROTOCOLO (1.3.16 — antes: tag "Cliente Agradeceu")
 *************************************************/
// Alguns chats não são atendimentos novos (ex.: o cliente volta só pra agradecer, ou é a
// continuação de um caso que já tem protocolo), mas o analista precisa aceitar o chat pra
// encerrá-lo — e isso gera uma linha e um protocolo à toa. Se o chat for encerrado no Jivo
// com um destes tópicos, a linha é marcada como "ignorado" no chat_finished (1.4.6; antes
// era apagada).
// Reconhece pelo ID do tópico (sobrevive a renomear no Jivo) OU pelo nome (ignora emoji,
// acento e maiúsculas). Pra incluir/tirar um tópico, só editar a lista.
const TOPICOS_IGNORAR_PROTOCOLO = [
  { id: 2, nome: 'Cliente Agradeceu' },
  { id: 4, nome: 'Orientação Processos' }
];
const TOPICO_PADRAO_VAZIO = 'Sem Tópico';
// NOVO (1.4.9): tópicos com tratamento próprio no encerramento (reconhecidos pelo ID ou nome).
const TOPICO_RETORNO_ATENDIMENTO = { id: 1, nome: 'Retorno Atendimento' };
const TOPICO_PRIMEIRO_CONTATO = { id: 3, nome: 'Primeiro Contato' }; // ALTERADO (1.4.10): id 3

/** NOVO (1.4.9): true se o tópico do chat é o "item" (pelo ID, quando o item tem, ou pelo nome). */
function topicoBate(topicoInfo, item) {
  if (!topicoInfo || !item) return false;
  if (item.id !== null && item.id !== undefined && topicoInfo.id !== null && topicoInfo.id !== undefined &&
      Number(item.id) === Number(topicoInfo.id)) return true;
  const nome = normalizarTexto(topicoInfo.titulo);
  return !!nome && nome === normalizarTexto(item.nome);
}
// NOVO (1.4.6): texto gravado na Coluna A da PROTOCOLOS no lugar do número.
const PROTOCOLO_IGNORADO_TEXTO = 'ignorado';

function normalizarTexto(t) {
  return String(t || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * NOVO (1.3.16): tira emoji/símbolos do início do título do tópico.
 * "⁉️ Orientação Processos" -> "Orientação Processos" | "🆗 Cliente Agradeceu" -> "Cliente Agradeceu"
 */
function limparTituloTopico(titulo) {
  return String(titulo || '')
    .replace(/^[^\p{L}\p{N}]+/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * NOVO (1.3.16): lê o tópico do payload do Jivo (campo "topic": { topic_id, title, parent_id }).
 * Devolve { titulo, id, tituloOriginal }. Sem tópico: titulo = "Sem Tópico", id = null.
 */
function obterTopicoDoPayload(conteudo) {
  const t = (conteudo && conteudo.topic && typeof conteudo.topic === 'object') ? conteudo.topic : null;
  const original = t ? String(t.title || '').trim() : '';
  const titulo = limparTituloTopico(original);
  const idNum = t ? Number(t.topic_id) : NaN;
  return {
    titulo: titulo || TOPICO_PADRAO_VAZIO,
    id: isNaN(idNum) ? null : idNum,
    tituloOriginal: original
  };
}

/**
 * NOVO (1.3.16): devolve o item de TOPICOS_IGNORAR_PROTOCOLO que bate com o tópico do chat
 * (pelo ID ou pelo nome), ou null se o chat conta protocolo normalmente.
 */
function topicoQueIgnoraProtocolo(topicoInfo) {
  if (!topicoInfo) return null;
  const nomeAlvo = normalizarTexto(topicoInfo.titulo);
  for (let i = 0; i < TOPICOS_IGNORAR_PROTOCOLO.length; i++) {
    const item = TOPICOS_IGNORAR_PROTOCOLO[i];
    if (topicoInfo.id !== null && Number(item.id) === topicoInfo.id) return item;
    if (nomeAlvo && normalizarTexto(item.nome) === nomeAlvo) return item;
  }
  return null;
}

/**
 * Trata o atendimento encerrado com um tópico que não conta protocolo.
 * Devolve true se tratou (o chamador não deve encerrar a linha de novo), false se não pôde
 * (aí o encerramento normal segue).
 *
 * Só vale para atendimento "puro" do webhook (Tipo "Chat Aceito (Webhook)" e sem protocolos
 * derivados). Retorno / Múltiplo com esses tópicos são tratados como erro humano no
 * encerramento: encerram normalmente e a linha fica (evento TOPICO_IGNORAR_NAO_APLICADO).
 * NOVO (1.4.6): no Retorno, se ainda sobrou crédito de rodada na Coluna R, ele é estornado
 * (o caso típico: o analista virou o próprio chat em Retorno pra ele mesmo — não conta
 * crédito e não gera protocolo novo).
 *
 * ALTERADO (1.4.6) — a linha NÃO é mais apagada:
 *  1) fica ENCERRADA (G = hora, H = duração), com "ignorado" na Coluna A no lugar do número
 *     e o tópico na Coluna I. O NÚMERO NÃO VOLTA pra sequência (o cliente pode já ter
 *     recebido esse protocolo) — ele fica registrado no evento ATENDIMENTO_IGNORADO_TOPICO;
 *  2) DEVOLVE A VEZ NA FILA — só se o aceite desse chat foi o que girou a fila (Coluna Q).
 *     Quem aceitou vira o Próximo Forçado; se já existir outro, entra na ESPERA e assume
 *     quando o atual for resolvido. Se não girou (aceitou fora de ordem), a fila não muda;
 *  2b) aceite fora da vez: estorna o crédito de rodada (Coluna R);
 *  3) Q e R são limpas (não devolvem duas vezes) e o rastro vai pra EV_ATENDIMENTOS.
 *     O painel CHAMADOS DO SUPORTE continua sem contar essas linhas (não há CHAT_FINISHED).
 */
function ignorarAtendimentoPorTopico(protSheet, linhaDados, linhaPlanilha, nomeAnalista, topicoIgnorado, topicoTitulo) {
  const protocolo = linhaDados[0];
  const tipo = String(linhaDados[3]).trim();
  const temDerivados = String(linhaDados[9] || '').trim() !== ''; // Coluna J
  const origemEv = canalEChatDaLinhaProtocolo(linhaDados); // 1.3.15
  const nomeTopico = topicoIgnorado.nome + ' (id ' + topicoIgnorado.id + ')';
  const creditoDoAceite = String(linhaDados[COL_PROT_CREDITO - 1] || '').trim(); // Coluna R

  if (tipo !== 'Chat Aceito (Webhook)' || temDerivados) {
    // NOVO (1.4.6): Retorno com tópico que não conta — garante que o crédito não fique contando.
    if (tipo.toLowerCase() === 'retorno' && creditoDoAceite) {
      estornarCreditoRodada(creditoDoAceite, protocolo, 'retorno encerrado com o tópico "' + topicoIgnorado.nome + '"');
      protSheet.getRange(linhaPlanilha, COL_PROT_CREDITO).clearContent();
    }
    registrarEvento(origemEv.canal, protocolo, 'TOPICO_IGNORAR_NAO_APLICADO', nomeAnalista,
      'Chat encerrado com o tópico "' + nomeTopico + '", mas o atendimento é do tipo "' + tipo + '"' +
      (temDerivados ? ' e tem protocolos derivados' : '') + ' — encerrado normalmente, linha mantida (provável erro no tópico).', origemEv.chatId);
    return false;
  }

  const canal = linhaDados[13] || '';
  const cliente = linhaDados[14] || '';
  const quemGirou = String(linhaDados[16] || '').trim(); // Coluna Q

  // 1) número: NÃO volta pra sequência (ver comentário acima).

  // 2) vez na fila — ALTERADO (1.4.6): com outro forçado ativo, entra na espera.
  let vezTexto = 'não alterada (o aceite não girou a fila)';
  if (quemGirou) {
    const r = enfileirarProximoForcado(quemGirou);
    if (r === 'AGORA') vezTexto = 'devolvida a ' + quemGirou + ' (Próximo Forçado)';
    else if (r === 'ESPERA') vezTexto = 'devolvida a ' + quemGirou + ' (na espera: já havia outro Próximo Forçado)';
    else vezTexto = quemGirou + ' já estava como Próximo Forçado / na espera';
  }

  // 2b) aceite fora da vez que não contou — estorna o crédito de rodada
  if (creditoDoAceite) {
    estornarCreditoRodada(creditoDoAceite, protocolo, 'atendimento ignorado pelo tópico "' + topicoIgnorado.nome + '"');
  }

  // 3) encerra a linha marcada como "ignorado" (antes: deleteRow)
  const dataInicio = linhaDados[1]; // Coluna B (Chat Aceito)
  const dataFim = new Date();
  const pausasAcumuladas = Number(linhaDados[12]) || 0; // Coluna M
  let duracaoTexto = '00:00:00';
  if (dataInicio instanceof Date) {
    const diffSegundos = Math.max(0, Math.floor((dataFim - dataInicio) / 1000) - pausasAcumuladas);
    const horas = Math.floor(diffSegundos / 3600).toString().padStart(2, '0');
    const minutos = Math.floor((diffSegundos % 3600) / 60).toString().padStart(2, '0');
    const segundos = (diffSegundos % 60).toString().padStart(2, '0');
    duracaoTexto = `${horas}:${minutos}:${segundos}`;
  }
  protSheet.getRange(linhaPlanilha, 1).setValue(PROTOCOLO_IGNORADO_TEXTO);        // A
  protSheet.getRange(linhaPlanilha, 5).setValue('ENCERRADO');                      // E
  protSheet.getRange(linhaPlanilha, 7).setValue(dataFim);                          // G
  protSheet.getRange(linhaPlanilha, 8).setNumberFormat('@').setValue(duracaoTexto); // H
  protSheet.getRange(linhaPlanilha, 9).setValue(topicoTitulo || topicoIgnorado.nome); // I
  if (quemGirou) protSheet.getRange(linhaPlanilha, 17).clearContent();             // Q: consumida
  if (creditoDoAceite) protSheet.getRange(linhaPlanilha, COL_PROT_CREDITO).clearContent(); // R

  registrarEvento(origemEv.canal, protocolo, 'ATENDIMENTO_IGNORADO_TOPICO', nomeAnalista,
    'Atendimento não conta protocolo — tópico "' + nomeTopico + '". Linha mantida como "' + PROTOCOLO_IGNORADO_TEXTO +
    '" (encerrada, duração ' + duracaoTexto + '); protocolo ' + protocolo + ' não volta pra sequência' +
    ' | Vez na fila: ' + vezTexto +
    ' | Canal: ' + canal + ' | Cliente: ' + (cliente || 'nao informado'), origemEv.chatId);

  return true;
}

/**
 * DIAGNÓSTICO TEMPORÁRIO — procura no payload do chat_finished qualquer texto com
 * "agradec" e diz em que campo ele veio (sem gravar dados do cliente). Remover depois.
 */
function buscarTextoNoPayload(obj, regex, caminho, achados) {
  achados = achados || [];
  caminho = caminho || 'payload';
  if (obj === null || obj === undefined) return achados;
  if (typeof obj === 'string') {
    if (regex.test(obj)) achados.push(caminho + ' = "' + obj.substring(0, 60) + '"');
    return achados;
  }
  if (typeof obj === 'object') {
    Object.keys(obj).forEach(k => buscarTextoNoPayload(obj[k], regex, caminho + '.' + k, achados));
  }
  return achados;
}


/**
 * NOVO: ao registrar um Retorno, devolve a vez de quem aceitou o chat pelo Jivo.
 * Como o aceite já girou a fila (e o analista só nota o retorno depois), ele volta ao
 * topo como EXCEÇÃO — o mesmo mecanismo do botão "Colocar como Próx." (Próximo Forçado):
 * não olha quem veio antes ou depois e NÃO mexe na ordem física da fila. Quando ele
 * assumir o próximo atendimento, a marca some e a ordem segue como estava.
 *
 * Só devolve quando:
 *  - a Coluna Q da linha tem nome (o aceite pelo webhook realmente girou a fila);
 *  - quem registra o retorno (origem) é quem girou (se o chat foi transferido antes,
 *    quem registra não é quem gastou a vez — fica só o evento);
 *  - não há OUTRO "Próximo Forçado" ativo (só existe uma exceção por vez).
 */
function devolverVezPorRetorno(sheet, linhaPlanilha, quemGirou, origem, protocoloOriginal) {
  const girou = String(quemGirou || '').trim();
  if (!girou) return; // o aceite não girou a fila (ou não veio pelo webhook): nada foi gasto

  if (normalizarNome(girou) !== normalizarNome(origem)) {
    registrarEvento('', protocoloOriginal, 'VEZ_NAO_DEVOLVIDA_RETORNO', origem,
      'O aceite desse chat girou a fila para ' + girou + ', mas o retorno foi registrado por ' + origem + ' — vez não devolvida.');
    return;
  }

  // ALTERADO (1.4.9): igual à Transferência — se já existir outro Próximo Forçado, quem
  // perdeu a vez entra na ESPERA logo atrás dele (antes a vez simplesmente não voltava).
  const r = enfileirarProximoForcado(girou);
  if (sheet && linhaPlanilha) sheet.getRange(linhaPlanilha, 17).clearContent(); // Coluna Q: consumida
  registrarEvento('', protocoloOriginal, 'VEZ_DEVOLVIDA_RETORNO', girou,
    girou + (r === 'ESPERA' ? ' entrou na espera do Próximo Forçado' : (r === 'JA_ESTAVA' ? ' já estava como Próximo Forçado / na espera' : ' voltou ao topo como Próximo Forçado')) +
    ' (retorno do protocolo ' + protocoloOriginal + '). A ordem da fila não foi alterada.');
}


// REMOVIDO (1.3.8): registrarWebhookLog() — log temporário que gravava todo POST do
// Jivo na aba WEBHOOK_LOG (a aba foi excluída e o mapeamento não é mais necessário).

/*************************************************
 * 14. 🚶 INFORMAR AUSÊNCIA + 📅 AGENDA DE AUSÊNCIAS (1.3.8)
 *************************************************/
// "Informar Ausência" (Falar com Coordenação) agora aceita data e hora:
//  - sem data/hora  -> ausenta AGORA, sem previsão de retorno (como antes) + e-mail;
//  - data futura    -> AGENDADA: linha na aba AGENDA + evento no Google Agenda (lembrete
//                      pop-up 1h antes) + e-mail. No horário, o polling do painel ausenta
//                      o analista sem previsão (processarAgendaAusencias);
//  - data passada   -> INFORMATIVA: linha na AGENDA + e-mail; NÃO ausenta ninguém.
// Em todos os casos em que a ausência é aplicada, os créditos de rodada são zerados.
// Aba AGENDA: A=ID | B=Analista | C=Início | D=Mensagem | E=Criado por | F=Criado em |
//             G=Status (AGENDADA/EXECUTADA/CANCELADA/INFORMATIVA) | H=ID Evento Agenda |
//             I=Atualizado em
// O evento é criado na agenda da conta dona do script (a que publica o Web App), com o
// analista (USUARIOS Coluna D) e a Coordenação (CONFIG!C14) como convidados.

// true = Coordenação (Nível 3) pode cancelar agendamentos de qualquer analista.
// false = cada um (inclusive a Coordenação) só cancela os próprios.
const AGENDA_COORDENACAO_CANCELA_TODOS = true;

/**
 * Aplica a ausência SEM previsão de retorno na EQUIPE (lógica que era do corpo do
 * webInformarAusenciaComMensagem) e zera os créditos de rodada do analista.
 *  - ATIVO: vira AUSENTE;
 *  - AUSENTE com prazo (Já Volto / N2 / Longa): o prazo é descartado -> sem previsão;
 *  - AUSENTE sem prazo (almoço, Coordenação, planilha): continua AUSENTE, mas ganha a
 *    marca que o protege do retorno automático do almoço.
 * Devolve { registrada, nomeEquipe }.
 */
function aplicarAusenciaSemPrevisao(analista, origemTexto) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  const dados = sheet.getDataRange().getValues();
  const alvo = normalizarNome(analista);

  for (let i = 1; i < dados.length; i++) {
    if (normalizarNome(dados[i][1]) !== alvo) continue;

    const linha = i + 1;
    const nomeEquipe = dados[i][1];
    const statusAtual = String(dados[i][2]).toUpperCase().trim();
    const tinhaPrazo = (dados[i][6] instanceof Date) || (dados[i][7] instanceof Date);
    const jaMarcada = String(dados[i][COL_AUSENCIA_SEM_PREVISAO - 1] || '').trim() === MARCA_AUSENCIA_SEM_PREVISAO;

    if (statusAtual !== 'AUSENTE') sheet.getRange(linha, 3).setValue('AUSENTE');
    // NOVO (1.4.7): se era um Ausente N2 em andamento, fecha (desconta só o tempo usado).
    if (tinhaPrazo) { try { finalizarUsoN2(nomeEquipe, 'convertida em ausência sem previsão'); } catch (e) {} }
    sheet.getRange(linha, 7, 1, 2).clearContent(); // G e H: sem prazo
    sheet.getRange(linha, COL_AUSENCIA_SEM_PREVISAO).setValue(MARCA_AUSENCIA_SEM_PREVISAO);

    if (!(statusAtual === 'AUSENTE' && jaMarcada)) {
      const origem = (statusAtual !== 'AUSENTE')
        ? ''
        : (tinhaPrazo ? ' (convertida de uma ausência com prazo)' : ' (já estava ausente sem prazo)');
      registrarEvento('', '', 'AUSENCIA_SEM_PREVISAO_INICIADA', nomeEquipe, 'Ausência sem previsão de retorno iniciada via ' + origemTexto + '.' + origem);
    }
    if (statusAtual !== 'AUSENTE' && typeof atualizarFila === 'function') {
      atualizarFila();
    }

    // NOVO (1.3.8): ausência informada à Coordenação zera os créditos de rodada.
    try {
      zerarCreditosRodada(nomeEquipe, 'ausência informada à Coordenação');
    } catch (e) {}

    return { registrada: true, nomeEquipe: nomeEquipe };
  }
  return { registrada: false, nomeEquipe: analista };
}

/**
 * Ponte do modal "Falar com Coordenação", motivo "Informar Ausência".
 * ALTERADO (1.3.10): recebe início, fim (opcional) e "dia inteiro".
 *  - dataHora / dataHoraFim: "AAAA-MM-DDTHH:MM" (ou "AAAA-MM-DD" no dia inteiro);
 *  - início vazio = agora (mantém o painel antigo funcionando).
 * Classificação:
 *  - início no futuro (+1 min)                          -> AGENDADA (relógio/polling ausenta no horário);
 *  - fim informado e já passado                         -> INFORMATIVA (só registra);
 *  - início até 30 min atrás, ou fim ainda no futuro    -> IMEDIATA (ausenta agora);
 *  - início há mais de 30 min, sem fim                  -> INFORMATIVA.
 * Dia inteiro: início = 09:00 do dia (sáb/dom -> segunda); fim = 18:00 do dia final (vazio = mesmo dia).
 * O fim NUNCA devolve o analista pra ATIVO: só o "Já Voltei".
 */
function webInformarAusenciaComMensagem(analista, mensagem, quemAcionou, dataHora, dataHoraFim, diaInteiro, anexos) {
  if (!analista) throw new Error("Informe quem está se ausentando.");
  // NOVO (1.3.12): anexos opcionais (PDF/JPG/PNG, até 10 MB) — validados ANTES de gravar qualquer coisa.
  const blobsAnexos = montarAnexosEmail(anexos);

  const texto = String(mensagem || '').trim();
  const propria = ehAcaoPropria(analista, quemAcionou);
  const agora = new Date();
  const periodo = montarPeriodoAusencia(dataHora, dataHoraFim, !!diaInteiro, agora);

  let tipo;
  if (periodo.inicio.getTime() > agora.getTime() + 60000) tipo = 'AGENDADA';
  else if (periodo.fim && periodo.fim.getTime() <= agora.getTime()) tipo = 'INFORMATIVA';
  else if (agora.getTime() - periodo.inicio.getTime() <= AUSENCIA_TOLERANCIA_IMEDIATA_MIN * 60000) tipo = 'IMEDIATA';
  else if (periodo.fim) tipo = 'IMEDIATA';
  else tipo = 'INFORMATIVA';

  const nomeEquipe = obterNomeNaEquipe(analista);
  if (tipo === 'AGENDADA' && !nomeEquipe) {
    throw new Error('"' + analista + '" não foi encontrado na EQUIPE — não é possível agendar a ausência.');
  }
  const nome = nomeEquipe || analista;
  const criadoPor = quemAcionou || nome;
  const periodoTexto = formatarPeriodoAgenda(periodo.inicio, periodo.fim, periodo.diaInteiro);
  const acionadoPor = propria ? '' : ' (acionado por ' + quemAcionou + ')';

  // Ausência imediata: aplica agora.
  let ausenciaRegistrada = false;
  if (tipo === 'IMEDIATA') {
    ausenciaRegistrada = aplicarAusenciaSemPrevisao(nome, '"Informar Ausência"' + acionadoPor).registrada;
  }
  const statusLinha = tipo === 'AGENDADA' ? 'AGENDADA' : ((tipo === 'IMEDIATA' && ausenciaRegistrada) ? 'EXECUTADA' : 'INFORMATIVA');

  // Grava na AGENDA com a trava (bloqueia agendamento duplicado no mesmo minuto).
  const registro = executarComTrava(() => {
    const sheet = obterAbaAgenda();
    if (tipo === 'AGENDADA' && sheet.getLastRow() >= 2) {
      const minuto = Math.floor(periodo.inicio.getTime() / 60000);
      const duplicado = lerLinhasAgenda(sheet).some(l =>
        String(l[6]).trim() === 'AGENDADA' && tipoDaLinhaAgenda(l) === TIPO_AUSENCIA &&
        normalizarNome(l[1]) === normalizarNome(nome) &&
        (l[2] instanceof Date) && Math.floor(l[2].getTime() / 60000) === minuto);
      if (duplicado) throw new Error('Já existe uma ausência agendada para ' + nome + ' em ' + periodoTexto + '.');
    }
    const id = 'AG' + agora.getTime();
    sheet.appendRow([id, nome, periodo.inicio, texto, criadoPor, agora, statusLinha, '', agora,
      periodo.fim || '', TIPO_AUSENCIA, periodo.diaInteiro ? 'SIM' : '']);
    return { id: id, linha: sheet.getLastRow() };
  });

  // Evento no Google Agenda (agendada ou imediata). Fora da trava: pode demorar.
  let evento = { id: '', erro: '' };
  if (statusLinha !== 'INFORMATIVA') {
    evento = criarEventoAusenciaNaAgenda(nome, periodo, texto, criadoPor, propria);
    if (evento.id) {
      try { obterAbaAgenda().getRange(registro.linha, 8).setValue(evento.id); } catch (e) {}
    }
  }
  executarComTrava(() => reconstruirCacheAgenda());

  if (tipo !== 'IMEDIATA') {
    registrarEvento('', '', tipo === 'AGENDADA' ? 'AUSENCIA_AGENDADA' : 'AUSENCIA_INFORMATIVA', nome,
      (tipo === 'AGENDADA'
        ? 'Ausência agendada: ' + periodoTexto + '.' + (evento.id ? ' Evento criado na agenda.' : ' Evento NÃO criado na agenda: ' + evento.erro)
        : 'Informe de ausência já passada (' + periodoTexto + ') — só informativo, não ausentou.') + acionadoPor);
  }

  // E-mail de rastreabilidade (sempre).
  let emailEnviado = true;
  let erroEmail = '';
  try {
    const quemRegistrou = propria ? '' : ' — registrada pela Coordenação (' + quemAcionou + ') em nome do analista';
    const semRetorno = periodo.fim ? '' : ' — SEM previsão de retorno (só volta pelo "Já Voltei")';
    let aviso;
    if (tipo === 'AGENDADA') {
      aviso = '[Ausência AGENDADA: ' + periodoTexto + semRetorno + quemRegistrou + ']\n' +
        (evento.id ? '[Evento criado no Google Agenda, com lembrete ' + AGENDA_LEMBRETE_MIN + ' min antes]'
                   : '[⚠️ Não foi possível criar o evento no Google Agenda: ' + evento.erro + ']');
    } else if (tipo === 'IMEDIATA') {
      aviso = ausenciaRegistrada
        ? '[Analista colocado como AUSENTE agora: ' + periodoTexto + semRetorno + quemRegistrou + ']'
        : '[Ausência NÃO registrada no painel: analista não encontrado na EQUIPE. Período: ' + periodoTexto + quemRegistrou + ']';
    } else {
      aviso = '[Informe de ausência: ' + periodoTexto + ' (já passou). O analista NÃO foi ausentado no painel.' + quemRegistrou + ']';
    }
    webEnviarMensagemCoordenacao(nome, 'Informar Ausência', aviso + (texto ? '\n\n' + texto : ''), blobsAnexos);
  } catch (e) {
    emailEnviado = false;
    erroEmail = e.message;
  }

  return {
    sucesso: true, tipo: tipo, id: registro.id, analista: nome,
    inicioTexto: periodoTexto, periodoTexto: periodoTexto, temFim: !!periodo.fim,
    ausenciaRegistrada: ausenciaRegistrada, emailEnviado: emailEnviado, erroEmail: erroEmail,
    qtdAnexos: blobsAnexos.length,
    eventoCriado: !!evento.id, erroEvento: evento.erro
  };
}

/** NOVO (1.3.10): monta { inicio, fim, diaInteiro } a partir dos campos do painel. */
function montarPeriodoAusencia(txtInicio, txtFim, diaInteiro, agora) {
  if (diaInteiro) {
    const diaIni = interpretarDataLocal(txtInicio);
    if (!diaIni) throw new Error('Informe a data de início da ausência.');
    const diaFim = String(txtFim || '').trim() ? interpretarDataLocal(txtFim) : new Date(diaIni.getTime());
    if (!diaFim) throw new Error('Data de fim inválida.');
    if (diaFim < diaIni) throw new Error('A data de fim não pode ser antes da data de início.');

    const inicio = proximoDiaUtil(diaIni);
    inicio.setHours(Math.floor(HORA_ABERTURA_MIN / 60), HORA_ABERTURA_MIN % 60, 0, 0);
    const fim = new Date(diaFim.getFullYear(), diaFim.getMonth(), diaFim.getDate(),
      Math.floor(HORA_FECHAMENTO_MIN / 60), HORA_FECHAMENTO_MIN % 60, 0, 0);
    if (fim <= inicio) throw new Error('O período informado cai inteiro num fim de semana.');
    return { inicio: inicio, fim: fim, diaInteiro: true };
  }

  const inicio = String(txtInicio || '').trim() ? interpretarDataHoraLocal(txtInicio) : new Date(agora.getTime());
  if (!inicio) throw new Error('Data e hora de início inválidas.');
  let fim = null;
  if (String(txtFim || '').trim()) {
    fim = interpretarDataHoraLocal(txtFim);
    if (!fim) throw new Error('Data e hora de fim inválidas.');
    if (fim.getTime() <= inicio.getTime()) throw new Error('O fim da ausência precisa ser depois do início.');
  }
  return { inicio: inicio, fim: fim, diaInteiro: false };
}

/**
 * Chamado pelo polling (webObterDadosFila) e pelo relógio (temporizadorAusencias). Só lê a
 * aba AGENDA quando o cache diz que alguma ausência agendada já venceu. Trava em modo
 * silencioso: se outra ação estiver com ela, tenta no próximo ciclo.
 * ALTERADO (1.3.10): só ausências (trocas de almoço têm rotina própria); se o fim informado
 * já passou quando o relógio chegar (sistema parado), marca EXPIRADA sem ausentar.
 */
function processarAgendaAusencias() {
  const cache = lerCacheAgenda();
  const agoraMs = Date.now();
  if (!cache.some(a => (a.st || 'A') === 'A' && a.inicio <= agoraMs)) return;

  executarComTrava(() => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_AGENDA);
    if (!sheet || sheet.getLastRow() < 2) { gravarCacheAgenda([]); return; }

    const dados = lerLinhasAgenda(sheet);
    const momento = new Date();
    dados.forEach((l, i) => {
      if (String(l[6]).trim() !== 'AGENDADA' || tipoDaLinhaAgenda(l) !== TIPO_AUSENCIA) return;
      if (!(l[2] instanceof Date) || l[2].getTime() > momento.getTime()) return;

      const fim = (l[9] instanceof Date) ? l[9] : null;
      let novoStatus = 'EXECUTADA';
      if (fim && fim.getTime() <= momento.getTime()) {
        novoStatus = 'EXPIRADA';
      } else {
        const quem = String(l[4] || '').trim();
        const propria = ehAcaoPropria(l[1], quem);
        aplicarAusenciaSemPrevisao(l[1], 'ausência agendada (' + formatarPeriodoAgenda(l[2], fim, String(l[11] || '').trim() === 'SIM') + ')' + (propria ? '' : ' (registrada por ' + quem + ')'));
      }
      sheet.getRange(i + 2, 7).setValue(novoStatus);
      sheet.getRange(i + 2, 9).setValue(momento);
      l[6] = novoStatus;
    });
    gravarCacheAgenda(montarCacheAgenda(dados));
  }, 1500, true);
}

/**
 * Ponte do modal 📅 Agenda: próximas (AGENDADA) de todos + histórico dos últimos dias.
 * ALTERADO (1.3.10): traz o período completo (início/fim/dia inteiro) em "inicioTexto",
 * o tipo (ausência ou troca de almoço) e o ícone.
 */
function webObterAgendaAusencias() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_AGENDA);
  if (!sheet || sheet.getLastRow() < 2) {
    gravarCacheAgenda([]);
    return { proximas: [], historico: [] };
  }

  const dados = lerLinhasAgenda(sheet);
  gravarCacheAgenda(montarCacheAgenda(dados));

  const limite = Date.now() - AGENDA_HISTORICO_DIAS * 86400000;
  const itens = dados
    .filter(l => l[0] && (l[2] instanceof Date))
    .map(l => {
      const tipo = tipoDaLinhaAgenda(l);
      const fim = (l[9] instanceof Date) ? l[9] : null;
      return {
        id: String(l[0]),
        analista: String(l[1]),
        inicioMs: l[2].getTime(),
        inicioTexto: formatarPeriodoAgenda(l[2], fim, String(l[11] || '').trim() === 'SIM'),
        tipo: tipo,
        icone: tipo === TIPO_TROCA_ALMOCO ? '🍽️' : '🚶',
        mensagem: String(l[3] || ''),
        criadoPor: String(l[4] || ''),
        status: String(l[6] || '').trim(),
        atualizadoMs: (l[8] instanceof Date) ? l[8].getTime() : 0
      };
    });

  const proximas = itens.filter(x => x.status === 'AGENDADA').sort((a, b) => a.inicioMs - b.inicioMs);
  const historico = itens
    .filter(x => x.status !== 'AGENDADA' && (x.inicioMs >= limite || x.atualizadoMs >= limite))
    .sort((a, b) => b.inicioMs - a.inicioMs)
    .slice(0, 30);

  return { proximas: proximas, historico: historico };
}

/**
 * Ponte do modal 📅 Agenda: cancela um agendamento AINDA NÃO EXECUTADO (ausência ou troca
 * de almoço). Cada um cancela os próprios; a Coordenação, qualquer um. Apaga o evento da
 * agenda e avisa a Coordenação por e-mail.
 */
function webCancelarAgendamentoAusencia(id, quemAcionou) {
  if (!id) throw new Error('Agendamento não informado.');
  if (!quemAcionou) throw new Error('Faça login para cancelar.');

  const r = executarComTrava(() => {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_AGENDA);
    if (!sheet || sheet.getLastRow() < 2) throw new Error('Agendamento não encontrado.');

    const dados = lerLinhasAgenda(sheet);
    const idx = dados.findIndex(l => String(l[0]) === String(id));
    if (idx === -1) throw new Error('Agendamento não encontrado.');

    const l = dados[idx];
    const status = String(l[6]).trim();
    if (status !== 'AGENDADA') {
      throw new Error('Este agendamento não pode mais ser cancelado (situação: ' + status + ').');
    }

    const dono = normalizarNome(l[1]) === normalizarNome(quemAcionou);
    const coordenacao = AGENDA_COORDENACAO_CANCELA_TODOS && obterNivelUsuario(quemAcionou) >= 3;
    if (!dono && !coordenacao) throw new Error('Você só pode cancelar os seus próprios agendamentos.');

    const agora = new Date();
    sheet.getRange(idx + 2, 7).setValue('CANCELADA');
    sheet.getRange(idx + 2, 9).setValue(agora);
    l[6] = 'CANCELADA';
    gravarCacheAgenda(montarCacheAgenda(dados));

    const ehTroca = tipoDaLinhaAgenda(l) === TIPO_TROCA_ALMOCO;
    const fim = (l[9] instanceof Date) ? l[9] : null;
    const periodoTexto = (l[2] instanceof Date) ? formatarPeriodoAgenda(l[2], fim, String(l[11] || '').trim() === 'SIM') : String(l[2]);
    const rotulo = ehTroca ? 'Troca de almoço' : 'Ausência';
    registrarEvento('', '', ehTroca ? 'TROCA_ALMOCO_CANCELADA' : 'AUSENCIA_AGENDADA_CANCELADA', l[1],
      rotulo + ' agendada (' + periodoTexto + ') cancelada' + (dono ? '' : ' por ' + quemAcionou) + '.');

    return {
      analista: String(l[1]), inicioTexto: periodoTexto, eventoId: String(l[7] || ''), dono: dono,
      rotulo: rotulo, motivo: ehTroca ? 'Informar Troca de Almoço' : 'Informar Ausência'
    };
  });

  let eventoApagado = false;
  if (r.eventoId) eventoApagado = apagarEventoAusenciaNaAgenda(r.eventoId);

  try {
    webEnviarMensagemCoordenacao(r.analista, r.motivo,
      '[' + r.rotulo + ' agendada (' + r.inicioTexto + ') foi CANCELADA' + (r.dono ? '' : ' pela Coordenação (' + quemAcionou + ')') + ']');
  } catch (e) {}

  return { sucesso: true, analista: r.analista, inicioTexto: r.inicioTexto, eventoApagado: eventoApagado };
}

/* ---------- Apoio da Agenda ---------- */

function obterAbaAgenda() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ABA_AGENDA);
  if (!sheet) {
    sheet = ss.insertSheet(ABA_AGENDA);
    sheet.appendRow(['ID', 'Analista', 'Início', 'Mensagem', 'Criado por', 'Criado em', 'Status', 'ID Evento Agenda', 'Atualizado em']);
    sheet.setFrozenRows(1);
  }
  garantirColunas(sheet, AGENDA_COLUNAS);
  // NOVO (1.3.10): cabeçalhos J/K/L criados uma vez só, sem mexer nas linhas existentes.
  if (!String(sheet.getRange(1, 10).getValue()).trim()) {
    sheet.getRange(1, 10, 1, 3).setValues([['Fim', 'Tipo', 'Dia inteiro']]);
    ['C:C', 'F:F', 'I:I', 'J:J'].forEach(c => sheet.getRange(c).setNumberFormat('dd/MM/yyyy HH:mm'));
  }
  return sheet;
}

/** NOVO (1.3.10): lê as linhas da AGENDA (A..L), sem o cabeçalho. */
function lerLinhasAgenda(sheet) {
  garantirColunas(sheet, AGENDA_COLUNAS);
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, AGENDA_COLUNAS).getValues();
}

/** NOVO (1.3.10): tipo da linha (linhas antigas, sem tipo, são ausências). */
function tipoDaLinhaAgenda(l) {
  return String(l[10] || '').trim() || TIPO_AUSENCIA;
}

/** "AAAA-MM-DDTHH:MM" (datetime-local) -> Date no fuso do script. */
function interpretarDataHoraLocal(txt) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(txt || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5]), 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

/** NOVO (1.3.10): "AAAA-MM-DD" (campo date) -> Date à meia-noite, no fuso do script. */
function interpretarDataLocal(txt) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(txt || '').trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

/** NOVO (1.3.10): o próprio dia, ou a segunda seguinte se cair no sábado/domingo. */
function proximoDiaUtil(d) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  while (r.getDay() === 0 || r.getDay() === 6) r.setDate(r.getDate() + 1);
  return r;
}

function formatarDataHoraAgenda(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), "dd/MM 'às' HH:mm");
}

/** NOVO (1.3.10): "HH:mm". */
function formatarHoraCurta(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'HH:mm');
}

/** NOVO (1.3.10): minutos do dia -> "HH:mm". */
function formatarMinutosHHMM(min) {
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
}

/**
 * NOVO (1.3.10): período legível — "05/10 às 12:00 até 13:00", "05/10 às 12:00 até 06/10 às 10:00",
 * "05/10 às 12:00" (sem fim), "05/10 (dia inteiro)", "05/10 a 07/10 (dia inteiro)".
 */
function formatarPeriodoAgenda(inicio, fim, diaInteiro) {
  const tz = Session.getScriptTimeZone();
  const dia = d => Utilities.formatDate(d, tz, 'dd/MM');
  if (diaInteiro) {
    return (fim && dia(fim) !== dia(inicio))
      ? dia(inicio) + ' a ' + dia(fim) + ' (dia inteiro)'
      : dia(inicio) + ' (dia inteiro)';
  }
  let txt = dia(inicio) + ' às ' + formatarHoraCurta(inicio);
  if (fim) txt += ' até ' + (dia(fim) === dia(inicio) ? formatarHoraCurta(fim) : dia(fim) + ' às ' + formatarHoraCurta(fim));
  return txt;
}

function obterNomeNaEquipe(analista) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  if (!sheet || sheet.getLastRow() < 2) return '';
  const nomes = sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues();
  const alvo = normalizarNome(analista);
  for (let i = 0; i < nomes.length; i++) {
    if (normalizarNome(nomes[i][0]) === alvo) return nomes[i][0];
  }
  return '';
}

/** Nível do usuário na aba USUARIOS (Coluna C). 0 se não achar. */
function obterNivelUsuario(nome) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_USUARIOS);
  if (!sheet || sheet.getLastRow() < 2) return 0;
  const dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  const alvo = normalizarNome(nome);
  for (let i = 0; i < dados.length; i++) {
    if (normalizarNome(dados[i][0]) === alvo) return Number(dados[i][2]) || 0;
  }
  return 0;
}

/** E-mail do usuário na aba USUARIOS (Coluna D), ou ''. */
function obterEmailUsuario(nome) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_USUARIOS);
  if (!sheet || sheet.getLastRow() < 2) return '';
  const dados = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
  const alvo = normalizarNome(nome);
  for (let i = 0; i < dados.length; i++) {
    if (normalizarNome(dados[i][0]) === alvo) return String(dados[i][3] || '').trim();
  }
  return '';
}

/** Mesmo destino do e-mail do "Falar com Coordenação" (CONFIG!C14). */
function obterEmailCoordenacao() {
  const configSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('CONFIG');
  return String((configSheet && configSheet.getRange('C14').getValue()) || '').trim() || 'coordenacao@exemplo.com';
}

/**
 * NOVO (1.3.10): cria um evento na agenda da conta dona do script, com o analista e a
 * Coordenação como convidados. lembreteMin = 0 -> sem lembrete.
 */
function criarEventoListaAi(titulo, inicio, fim, descricao, analista, lembreteMin) {
  try {
    const convidados = [obterEmailUsuario(analista), obterEmailCoordenacao()]
      .filter(e => e && e.indexOf('@') > 0)
      .filter((e, i, arr) => arr.findIndex(x => x.toLowerCase() === e.toLowerCase()) === i);

    const ev = CalendarApp.getDefaultCalendar().createEvent(titulo, inicio, fim, {
      description: descricao,
      guests: convidados.join(','),
      sendInvites: true
    });
    ev.removeAllReminders();
    if (lembreteMin > 0) ev.addPopupReminder(lembreteMin);
    return { id: ev.getId(), erro: '' };
  } catch (e) {
    return { id: '', erro: e.message };
  }
}

/**
 * ALTERADO (1.3.10): evento do início ao fim informado. Sem fim: até as 18:00 do dia.
 * Lembrete 30 min antes do início (no dia inteiro, 08:30), só se o início ainda não passou.
 */
function criarEventoAusenciaNaAgenda(nome, periodo, texto, criadoPor, propria) {
  const inicio = periodo.inicio;
  let fim = periodo.fim;
  if (!fim) {
    fim = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate(),
      Math.floor(HORA_FECHAMENTO_MIN / 60), HORA_FECHAMENTO_MIN % 60, 0, 0);
    if (fim <= inicio) fim = new Date(inicio.getTime() + AGENDA_DURACAO_EVENTO_MIN * 60000);
  }

  const descricao =
    'Ausência informada no Lista Ai.\n' +
    'Analista: ' + nome + '\n' +
    (propria ? '' : 'Registrada por: ' + criadoPor + '\n') +
    (periodo.fim
      ? 'Retorno previsto: ' + formatarDataHoraAgenda(periodo.fim) + ' (só informativo — o retorno é pelo "Já Voltei").\n'
      : 'Sem previsão de retorno — o retorno é pelo "Já Voltei".\n') +
    'No horário marcado o analista sai da fila automaticamente.\n' +
    'Para cancelar: painel > 📅 Agenda.' +
    (texto ? '\n\nMensagem: ' + texto : '');

  const lembrete = inicio.getTime() > Date.now() ? AGENDA_LEMBRETE_MIN : 0;
  return criarEventoListaAi('🚶 Ausência — ' + nome, inicio, fim, descricao, nome, lembrete);
}

function apagarEventoAusenciaNaAgenda(eventoId) {
  try {
    const ev = CalendarApp.getDefaultCalendar().getEventById(eventoId) || CalendarApp.getEventById(eventoId);
    if (!ev) return false;
    ev.deleteEvent();
    return true;
  } catch (e) {
    return false;
  }
}

/* Cache das ausências (DocumentProperties) — evita ler a aba AGENDA a cada ciclo.
   ALTERADO (1.3.10): [{ id, analista, inicio (ms), fim (ms ou 0), dia (1 = dia inteiro),
   st: 'A' (agendada) | 'E' (executada, com fim ainda no futuro) }]. */
function lerCacheAgenda() {
  try {
    return JSON.parse(PropertiesService.getDocumentProperties().getProperty(PROP_AGENDA_CACHE) || '[]');
  } catch (e) {
    return [];
  }
}

function gravarCacheAgenda(lista) {
  PropertiesService.getDocumentProperties().setProperty(PROP_AGENDA_CACHE, JSON.stringify(lista || []));
}

function montarCacheAgenda(dados) {
  const agoraMs = Date.now();
  return dados
    .filter(l => tipoDaLinhaAgenda(l) === TIPO_AUSENCIA && (l[2] instanceof Date))
    .map(l => {
      const status = String(l[6]).trim();
      return {
        id: String(l[0]),
        analista: String(l[1]),
        inicio: l[2].getTime(),
        fim: (l[9] instanceof Date) ? l[9].getTime() : 0,
        dia: String(l[11] || '').trim() === 'SIM' ? 1 : 0,
        st: status === 'AGENDADA' ? 'A' : (status === 'EXECUTADA' ? 'E' : '')
      };
    })
    .filter(a => a.st === 'A' || (a.st === 'E' && a.fim > agoraMs));
}

function reconstruirCacheAgenda() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_AGENDA);
  if (!sheet || sheet.getLastRow() < 2) { gravarCacheAgenda([]); return; }
  gravarCacheAgenda(montarCacheAgenda(lerLinhasAgenda(sheet)));
}

/** { nomeNormalizado: período da próxima ausência agendada de cada um }. */
function obterProximasAgendadasPorNome() {
  const porNome = {};
  lerCacheAgenda().forEach(a => {
    if ((a.st || 'A') !== 'A') return;
    const chave = normalizarNome(a.analista);
    if (!porNome[chave] || a.inicio < porNome[chave].inicio) porNome[chave] = a;
  });
  const saida = {};
  Object.keys(porNome).forEach(k => {
    const a = porNome[k];
    saida[k] = formatarPeriodoAgenda(new Date(a.inicio), a.fim ? new Date(a.fim) : null, !!a.dia);
  });
  return saida;
}

/** NOVO (1.3.10): { nomeNormalizado: "HH:mm" (hoje) ou "dd/MM às HH:mm" } — retorno previsto. */
function obterRetornosPrevistosPorNome() {
  const agoraMs = Date.now();
  const porNome = {};
  lerCacheAgenda().forEach(a => {
    if (a.st !== 'E' || !a.fim || a.fim <= agoraMs) return;
    const chave = normalizarNome(a.analista);
    if (!porNome[chave] || a.fim > porNome[chave]) porNome[chave] = a.fim;
  });
  const hojeTxt = new Date().toDateString();
  const saida = {};
  Object.keys(porNome).forEach(k => {
    const d = new Date(porNome[k]);
    saida[k] = d.toDateString() === hojeTxt ? formatarHoraCurta(d) : formatarDataHoraAgenda(d);
  });
  return saida;
}

/*************************************************
 * 15. 🍽️ TROCA DE ALMOÇO + ROTINA DIÁRIA (1.3.10)
 *************************************************/
// Almoço padrão de cada analista: EQUIPE Colunas M/N (copiadas uma vez do E/F por
// copiarAlmocoAtualParaPadrao). E/F passam a ser o almoço VIGENTE do dia.
//  - Troca para hoje: aplica E/F na hora, se faltar >= 1h pro almoço vigente
//    (a Coordenação não tem esse bloqueio nem a regra de duração);
//  - Troca para outro dia: AGENDADA na AGENDA; aplicada pela rotina das 6h;
//  - Rotina diária (6h): M/N -> E/F de todos, aplica as trocas do dia e devolve pra
//    ATIVO quem terminou o dia anterior ausente só por causa do almoço.
// Evento no Google Agenda com lembrete 1 dia antes (registrada com >= 24h) ou 1h antes.

function webInformarTrocaAlmoco(analista, mensagem, quemAcionou, dataHoraInicio, dataHoraFim) {
  if (!analista) throw new Error('Informe o analista.');
  const inicio = interpretarDataHoraLocal(dataHoraInicio);
  const fim = interpretarDataHoraLocal(dataHoraFim);
  if (!inicio || !fim) throw new Error('Informe o início e o fim do novo horário de almoço.');
  if (inicio.toDateString() !== fim.toDateString()) throw new Error('Início e fim do almoço precisam ser no mesmo dia.');
  if (fim.getTime() <= inicio.getTime()) throw new Error('O fim do almoço precisa ser depois do início.');

  const agora = new Date();
  if (inicio.getTime() <= agora.getTime()) throw new Error('O novo horário de almoço já começou ou já passou.');

  const texto = String(mensagem || '').trim();
  const propria = ehAcaoPropria(analista, quemAcionou);
  const coordenacao = !!quemAcionou && obterNivelUsuario(quemAcionou) >= 3;

  const sheetEquipe = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  garantirColunas(sheetEquipe, COL_ALMOCO_PADRAO_FIM);
  const exib = sheetEquipe.getRange(2, 1, sheetEquipe.getLastRow() - 1, COL_ALMOCO_PADRAO_FIM).getDisplayValues();
  const idx = exib.findIndex(l => normalizarNome(l[1]) === normalizarNome(analista));
  if (idx === -1) throw new Error('"' + analista + '" não foi encontrado na EQUIPE.');
  const linhaEquipe = idx + 2;
  const nome = exib[idx][1];

  // Duração igual à do almoço padrão (M/N; se vazio, o E/F atual).
  if (!coordenacao) {
    const pIni = primeiroMinutoValido(converterParaMinutos(exib[idx][COL_ALMOCO_PADRAO_INI - 1]), converterParaMinutos(exib[idx][4]));
    const pFim = primeiroMinutoValido(converterParaMinutos(exib[idx][COL_ALMOCO_PADRAO_FIM - 1]), converterParaMinutos(exib[idx][5]));
    if (pIni !== null && pFim !== null && pFim > pIni) {
      const duracaoPadrao = pFim - pIni;
      if (Math.round((fim - inicio) / 60000) !== duracaoPadrao) {
        throw new Error('O novo almoço precisa ter a mesma duração do almoço padrão (' + formatarMinutosTexto(duracaoPadrao) + ').');
      }
    }
  }

  // ALTERADO (1.4.9): sem bloqueio de 1h — troca para hoje vale a qualquer momento
  // (desde que o novo almoço ainda não tenha começado). A regra de mesma duração continua.
  const ehHoje = inicio.toDateString() === agora.toDateString();

  const periodoTexto = formatarPeriodoAgenda(inicio, fim, false);
  const registro = executarComTrava(() => {
    const sheet = obterAbaAgenda();
    if (sheet.getLastRow() >= 2) {
      const duplicada = lerLinhasAgenda(sheet).some(l =>
        String(l[6]).trim() === 'AGENDADA' && tipoDaLinhaAgenda(l) === TIPO_TROCA_ALMOCO &&
        normalizarNome(l[1]) === normalizarNome(nome) &&
        (l[2] instanceof Date) && l[2].toDateString() === inicio.toDateString());
      if (duplicada) throw new Error('Já existe uma troca de almoço agendada para ' + nome + ' nesse dia. Cancele a anterior na 📅 Agenda.');
    }
    if (ehHoje) aplicarAlmocoNaEquipe(sheetEquipe, linhaEquipe, nome, inicio, fim);
    const id = 'AG' + agora.getTime();
    sheet.appendRow([id, nome, inicio, texto, quemAcionou || nome, agora, ehHoje ? 'EXECUTADA' : 'AGENDADA', '', agora,
      fim, TIPO_TROCA_ALMOCO, '']);
    return { id: id, linha: sheet.getLastRow() };
  });
  if (ehHoje) { try { atualizarFila(); } catch (e) {} }

  // Evento: lembrete 1 dia antes se registrada com >= 24h; senão 1h antes (se ainda der tempo).
  const antecedenciaMin = (inicio.getTime() - agora.getTime()) / 60000;
  const lembrete = antecedenciaMin >= 1440 ? 1440 : (antecedenciaMin > 60 ? 60 : 0);
  const descricao =
    'Troca de almoço informada no Lista Ai.\n' +
    'Analista: ' + nome + '\n' +
    (propria ? '' : 'Registrada por: ' + quemAcionou + '\n') +
    'Novo almoço: ' + periodoTexto + '. No dia seguinte volta o almoço padrão.\n' +
    'Para cancelar (antes de valer): painel > 📅 Agenda.' +
    (texto ? '\n\nMensagem: ' + texto : '');
  const evento = criarEventoListaAi('🍽️ Troca de almoço — ' + nome, inicio, fim, descricao, nome, lembrete);
  if (evento.id) {
    try { obterAbaAgenda().getRange(registro.linha, 8).setValue(evento.id); } catch (e) {}
  }

  if (!ehHoje) {
    registrarEvento('', '', 'TROCA_ALMOCO_AGENDADA', nome, 'Troca de almoço agendada: ' + periodoTexto + '.' +
      (propria ? '' : ' (acionado por ' + quemAcionou + ')'));
  }

  let emailEnviado = true;
  let erroEmail = '';
  try {
    webEnviarMensagemCoordenacao(nome, 'Informar Troca de Almoço',
      '[Troca de almoço ' + (ehHoje ? 'APLICADA para hoje' : 'AGENDADA') + ': ' + periodoTexto +
      (propria ? '' : ' — registrada pela Coordenação (' + quemAcionou + ')') + ']' +
      (evento.id ? '' : '\n[⚠️ Evento não criado no Google Agenda: ' + evento.erro + ']') +
      (texto ? '\n\n' + texto : ''));
  } catch (e) {
    emailEnviado = false;
    erroEmail = e.message;
  }

  return {
    sucesso: true, tipo: ehHoje ? 'TROCA_APLICADA' : 'TROCA_AGENDADA', analista: nome,
    periodoTexto: periodoTexto, emailEnviado: emailEnviado, erroEmail: erroEmail,
    eventoCriado: !!evento.id, erroEvento: evento.erro
  };
}

/**
 * Grava o almoço de hoje em E/F (como texto "HH:mm"). Se a pessoa estiver AUSENTE só por
 * causa do almoço antigo (caso da Coordenação trocando com o almoço em andamento), volta
 * pra ATIVO — senão ficaria presa até o fim do novo almoço.
 */
function aplicarAlmocoNaEquipe(sheet, linha, nome, inicio, fim) {
  sheet.getRange(linha, 5, 1, 2).setNumberFormat('@').setValues([[formatarHoraCurta(inicio), formatarHoraCurta(fim)]]);
  registrarEvento('', '', 'TROCA_ALMOCO_APLICADA', nome, 'Almoço de hoje trocado para ' + formatarHoraCurta(inicio) + '–' + formatarHoraCurta(fim) + '.');

  const l = sheet.getRange(linha, 1, 1, COL_AUSENCIA_SEM_PREVISAO).getValues()[0];
  const ausenteSoPeloAlmoco =
    String(l[2]).toUpperCase().trim() === 'AUSENTE' &&
    !(l[6] instanceof Date) && !(l[7] instanceof Date) &&
    String(l[COL_AUSENCIA_SEM_PREVISAO - 1] || '').trim() !== MARCA_AUSENCIA_SEM_PREVISAO &&
    mapaUltimoEventoStatus()[normalizarNome(nome)] === 'ALMOCO_INICIO_AUTO';
  if (ausenteSoPeloAlmoco) {
    sheet.getRange(linha, 3).setValue('ATIVO');
    registrarEvento('', '', 'ALMOCO_RETORNO_TROCA', nome, 'Voltou para ATIVO: o almoço em andamento foi trocado para ' + formatarHoraCurta(inicio) + '–' + formatarHoraCurta(fim) + '.');
  }
}

/** Primeiro valor que não é null (minutos do dia). */
function primeiroMinutoValido(a, b) {
  return a !== null ? a : b;
}

/**
 * { nomeNormalizado: tipo do último evento que mudou o status } — lê só os últimos
 * 3000 registros da aba EV_AUSENCIAS. Usado pra saber se a ausência atual é do almoço.
 * ALTERADO (1.3.15): lê a EV_AUSENCIAS (antes, a EVENTOS). Como ela só tem eventos de
 * status/ausência/almoço, as 3000 linhas agora cobrem um período bem maior.
 */
function mapaUltimoEventoStatus() {
  const sheet = obterAbaEventosLeitura(ABAS_EVENTOS.AUSENCIAS);
  if (!sheet || sheet.getLastRow() < 2) return {};
  const ultima = sheet.getLastRow();
  const qtd = Math.min(ultima - 1, 3000);
  const dados = sheet.getRange(ultima - qtd + 1, 4, qtd, 2).getValues(); // D = Tipo, E = Analista
  const mapa = {};
  for (let i = dados.length - 1; i >= 0; i--) {
    const tipo = String(dados[i][0]).toUpperCase().trim();
    if (TIPOS_EVENTO_STATUS.indexOf(tipo) === -1) continue;
    const chave = normalizarNome(dados[i][1]);
    if (chave && !(chave in mapa)) mapa[chave] = tipo;
  }
  return mapa;
}

/**
 * Rotina diária (gatilho às 6h — instalarRotinaDiariaAlmoco):
 *  1) almoço padrão (M/N) volta para E/F de todos;
 *  2) aplica as trocas AGENDADAS para hoje (e marca EXPIRADA as de dias que já passaram);
 *  3) devolve pra ATIVO quem terminou o dia anterior ausente SÓ por causa do almoço
 *     (sem Já Volto, N2, Longa nem ausência sem previsão).
 */
function executarRotinaDiariaAlmoco() {
  executarComTrava(() => {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const equipe = ss.getSheetByName(CONFIG.ABA_EQUIPE);
    if (!equipe || equipe.getLastRow() < 2) return;
    garantirColunas(equipe, COL_ALMOCO_PADRAO_FIM);

    const n = equipe.getLastRow() - 1;
    const exib = equipe.getRange(2, 1, n, COL_ALMOCO_PADRAO_FIM).getDisplayValues();
    const vals = equipe.getRange(2, 1, n, COL_AUSENCIA_SEM_PREVISAO).getValues();
    const agora = new Date();
    const hojeTxt = agora.toDateString();
    const eventos = [];

    // 1) Almoço padrão -> vigente
    const novosEF = exib.map(l => {
      const pi = String(l[COL_ALMOCO_PADRAO_INI - 1]).trim();
      const pf = String(l[COL_ALMOCO_PADRAO_FIM - 1]).trim();
      return (pi && pf) ? [pi, pf] : [l[4], l[5]];
    });

    // 2) Trocas do dia
    const agenda = ss.getSheetByName(ABA_AGENDA);
    if (agenda && agenda.getLastRow() >= 2) {
      lerLinhasAgenda(agenda).forEach((l, i) => {
        if (String(l[6]).trim() !== 'AGENDADA' || tipoDaLinhaAgenda(l) !== TIPO_TROCA_ALMOCO) return;
        if (!(l[2] instanceof Date) || !(l[9] instanceof Date)) return;
        const linhaAg = i + 2;
        if (l[2].toDateString() === hojeTxt) {
          const idx = exib.findIndex(e => normalizarNome(e[1]) === normalizarNome(l[1]));
          if (idx !== -1) {
            novosEF[idx] = [formatarHoraCurta(l[2]), formatarHoraCurta(l[9])];
            agenda.getRange(linhaAg, 7).setValue('EXECUTADA');
            eventos.push(['', '', 'TROCA_ALMOCO_APLICADA', exib[idx][1], 'Almoço de hoje trocado para ' + formatarHoraCurta(l[2]) + '–' + formatarHoraCurta(l[9]) + ' (troca agendada).']);
          } else {
            agenda.getRange(linhaAg, 7).setValue('EXPIRADA');
          }
          agenda.getRange(linhaAg, 9).setValue(agora);
        } else if (l[2].getTime() < agora.getTime()) {
          agenda.getRange(linhaAg, 7).setValue('EXPIRADA');
          agenda.getRange(linhaAg, 9).setValue(agora);
        }
      });
    }
    equipe.getRange(2, 5, n, 2).setNumberFormat('@').setValues(novosEF);

    // 3) Quem terminou o dia anterior ausente só pelo almoço volta pra ATIVO
    const ultimos = mapaUltimoEventoStatus();
    vals.forEach((l, i) => {
      if (!l[1]) return;
      if (String(l[2]).toUpperCase().trim() !== 'AUSENTE') return;
      if ((l[6] instanceof Date) || (l[7] instanceof Date)) return;
      if (String(l[COL_AUSENCIA_SEM_PREVISAO - 1] || '').trim() === MARCA_AUSENCIA_SEM_PREVISAO) return;
      if (ultimos[normalizarNome(l[1])] !== 'ALMOCO_INICIO_AUTO') return;
      equipe.getRange(i + 2, 3).setValue('ATIVO');
      eventos.push(['', '', 'ALMOCO_RETORNO_DIARIO', l[1], 'Voltou para ATIVO na rotina diária: tinha terminado o dia anterior ausente só pelo almoço.']);
    });

    eventos.push(['', '', 'ROTINA_DIARIA_ALMOCO', 'SISTEMA', 'Almoço padrão restaurado (M/N → E/F) e trocas do dia aplicadas.']);
    registrarEventosEmLote(eventos);
  }, 60000);

  try { atualizarFila(); } catch (e) {}
}

/**
 * NOVO (1.4.9): aplica as trocas de almoço AGENDADAS para hoje que a rotina das 6h não
 * aplicou (gatilho ausente ou com falha). Chamada pelo relógio a cada 5 min.
 * Troca cujo fim já passou -> EXPIRADA, sem mexer no almoço.
 */
function aplicarTrocasAlmocoDoDia() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const agenda = ss.getSheetByName(ABA_AGENDA);
  if (!agenda || agenda.getLastRow() < 2) return;

  executarComTrava(() => {
    const agora = new Date();
    const hojeTxt = agora.toDateString();
    const pendentes = [];
    lerLinhasAgenda(agenda).forEach((l, i) => {
      if (String(l[6]).trim() !== 'AGENDADA' || tipoDaLinhaAgenda(l) !== TIPO_TROCA_ALMOCO) return;
      if (!(l[2] instanceof Date) || !(l[9] instanceof Date)) return;
      if (l[2].toDateString() !== hojeTxt) return;
      pendentes.push({ l: l, linhaAg: i + 2 });
    });
    if (!pendentes.length) return;

    const equipe = ss.getSheetByName(CONFIG.ABA_EQUIPE);
    const nomes = equipe.getRange(2, 2, equipe.getLastRow() - 1, 1).getValues();
    pendentes.forEach(p => {
      let status = 'EXPIRADA';
      if (p.l[9].getTime() > agora.getTime()) {
        const idx = nomes.findIndex(n => normalizarNome(n[0]) === normalizarNome(p.l[1]));
        if (idx !== -1) {
          aplicarAlmocoNaEquipe(equipe, idx + 2, nomes[idx][0], p.l[2], p.l[9]); // já registra TROCA_ALMOCO_APLICADA
          status = 'EXECUTADA';
        }
      }
      agenda.getRange(p.linhaAg, 7).setValue(status);
      agenda.getRange(p.linhaAg, 9).setValue(agora);
    });
  }, 5000, true);
}

/** Rodar UMA vez pelo editor: cria o gatilho diário da rotina do almoço (entre 6h e 7h). */
function instalarRotinaDiariaAlmoco() {
  ScriptApp.getProjectTriggers().forEach(g => {
    if (g.getHandlerFunction() === 'executarRotinaDiariaAlmoco') ScriptApp.deleteTrigger(g);
  });
  ScriptApp.newTrigger('executarRotinaDiariaAlmoco').timeBased().atHour(6).everyDays(1).create();
  Logger.log('✅ Rotina diária do almoço instalada (roda entre 6h e 7h).');
}

/**
 * Rodar UMA vez pelo editor, ANTES da primeira troca: copia o almoço atual (E/F) para o
 * almoço padrão (M/N) de quem ainda não tem padrão. Não sobrescreve M/N já preenchidos.
 */
function copiarAlmocoAtualParaPadrao() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.ABA_EQUIPE);
  garantirColunas(sheet, COL_ALMOCO_PADRAO_FIM);
  if (!String(sheet.getRange(1, COL_ALMOCO_PADRAO_INI).getValue()).trim()) {
    sheet.getRange(1, COL_ALMOCO_PADRAO_INI, 1, 2).setValues([['Almoço Padrão Início', 'Almoço Padrão Fim']]);
  }
  const n = sheet.getLastRow() - 1;
  if (n < 1) return;
  const exib = sheet.getRange(2, 1, n, COL_ALMOCO_PADRAO_FIM).getDisplayValues();
  const saida = exib.map(l => [
    String(l[COL_ALMOCO_PADRAO_INI - 1]).trim() || l[4],
    String(l[COL_ALMOCO_PADRAO_FIM - 1]).trim() || l[5]
  ]);
  sheet.getRange(2, COL_ALMOCO_PADRAO_INI, n, 2).setNumberFormat('@').setValues(saida);
  Logger.log('✅ Almoço padrão (M/N) preenchido a partir do E/F atual.');
}

/*************************************************
 * 16. 📎 ANEXOS DO "INFORMAR AUSÊNCIA" (1.3.12)
 *************************************************/
// O painel lê os arquivos no navegador e manda [{ nome, tipo, base64 }]. Aqui viram Blob e
// vão anexados ao e-mail da Coordenação (não ficam salvos em lugar nenhum além do Gmail).
const ANEXO_TIPOS_PERMITIDOS = ['application/pdf', 'image/jpeg', 'image/png'];
const ANEXO_LIMITE_BYTES = 10 * 1024 * 1024; // 10 MB no total
const ANEXO_MAX_ARQUIVOS = 10;

function montarAnexosEmail(anexos) {
  if (!Array.isArray(anexos) || !anexos.length) return [];
  if (anexos.length > ANEXO_MAX_ARQUIVOS) throw new Error('No máximo ' + ANEXO_MAX_ARQUIVOS + ' anexos por informe.');

  let total = 0;
  return anexos.map(a => {
    const tipo = String((a && a.tipo) || '').toLowerCase();
    const nome = String((a && a.nome) || 'anexo').replace(/[\\\/:*?"<>|]/g, '_').substring(0, 120);
    if (ANEXO_TIPOS_PERMITIDOS.indexOf(tipo) === -1) {
      throw new Error('Anexo "' + nome + '" não permitido: envie só PDF, JPG ou PNG.');
    }
    const bytes = Utilities.base64Decode(String(a.base64 || ''));
    total += bytes.length;
    if (total > ANEXO_LIMITE_BYTES) throw new Error('Os anexos passam de 10 MB no total.');
    return Utilities.newBlob(bytes, tipo, nome);
  });
}

/*************************************************
 * 17. ✅ TAREFAS DA COORDENAÇÃO (1.3.12)
 *************************************************/
// Só Nível 3. Cada tarefa vira uma tarefa no Google Tasks da conta do script (lista
// padrão "Minhas tarefas") com prazo = a data escolhida (o Tasks só guarda a DATA; a
// hora é descartada pelo próprio Google). Cada usuário N3 só vê as tarefas que criou.
// Aba TAREFAS: A=ID | B=Criado por | C=Data | D=Motivo | E=Cliente | F=Protocolo |
//              G=Status (PENDENTE/CONCLUIDA/EXCLUIDA) | H=ID Google Tasks |
//              I=Criado em | J=Atualizado em | K=Concluída em
// Clientes: labels da categoria "Cliente" da aba DICIONARIO da planilha de chamados do
// Trello (E=Categoria, F=Nome exibido, G=Ativo), com cache de 6h.
// ATIVAR UMA VEZ: Editor > Serviços (+) > "Google Tasks API" > Adicionar (identificador Tasks).
const ABA_TAREFAS = 'TAREFAS';
const TAREFAS_LISTA_GOOGLE = '@default';
const TAREFAS_HISTORICO_DIAS = 14;
const PLANILHA_CHAMADOS_ID = 'COLE_AQUI_O_ID_DA_PLANILHA_DE_CHAMADOS';
const ABA_DICIONARIO_CHAMADOS = 'DICIONARIO';
const CATEGORIA_CLIENTE_CHAMADOS = 'Cliente';
const CACHE_CLIENTES_CHAVE = 'CLIENTES_TAREFAS';

function exigirCoordenacao(quemAcionou) {
  if (!quemAcionou || obterNivelUsuario(quemAcionou) < 3) {
    throw new Error('Tarefas são exclusivas da Coordenação (Nível 3).');
  }
}

function exigirServicoTasks() {
  if (typeof Tasks === 'undefined') {
    throw new Error('O serviço "Google Tasks API" não está ativado no projeto (Editor > Serviços > Google Tasks API).');
  }
}

function obterAbaTarefas() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(ABA_TAREFAS);
  if (!sheet) {
    sheet = ss.insertSheet(ABA_TAREFAS);
    sheet.appendRow(['ID', 'Criado por', 'Data', 'Motivo', 'Cliente', 'Protocolo', 'Status', 'ID Google Tasks', 'Criado em', 'Atualizado em', 'Concluída em']);
    sheet.setFrozenRows(1);
    sheet.getRange('C:C').setNumberFormat('dd/MM/yyyy');
    ['I:I', 'J:J', 'K:K'].forEach(c => sheet.getRange(c).setNumberFormat('dd/MM/yyyy HH:mm'));
    sheet.getRange('F:F').setNumberFormat('@');
  }
  return sheet;
}

function lerLinhasTarefas(sheet) {
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 11).getValues();
}

/** Ponte: lista de clientes (labels "Cliente" ativas do DICIONARIO da planilha de chamados). */
function webObterClientesTarefas(quemAcionou) {
  exigirCoordenacao(quemAcionou);
  return lerClientesChamados();
}

function lerClientesChamados() {
  const cache = CacheService.getScriptCache();
  const salvo = cache.get(CACHE_CLIENTES_CHAVE);
  if (salvo) {
    try { return JSON.parse(salvo); } catch (e) {}
  }

  let aba;
  try {
    aba = SpreadsheetApp.openById(PLANILHA_CHAMADOS_ID).getSheetByName(ABA_DICIONARIO_CHAMADOS);
  } catch (e) {
    throw new Error('Não foi possível abrir a planilha de chamados: ' + e.message);
  }
  if (!aba || aba.getLastRow() < 2) return [];

  const alvo = normalizarTexto(CATEGORIA_CLIENTE_CHAMADOS);
  const nomes = {};
  aba.getRange(2, 1, aba.getLastRow() - 1, 7).getValues().forEach(l => {
    if (normalizarTexto(l[4]) !== alvo) return;                 // E = Categoria
    if (String(l[6]).trim().toUpperCase() === 'NÃO') return;   // G = Ativo
    const nome = String(l[5] || '').trim() || String(l[0] || '').trim(); // F = Nome exibido (ou A = Label)
    if (nome) nomes[nome.toLowerCase()] = nome;
  });
  const lista = Object.keys(nomes).map(k => nomes[k]).sort((a, b) => a.localeCompare(b, 'pt-BR'));
  try { cache.put(CACHE_CLIENTES_CHAVE, JSON.stringify(lista), 21600); } catch (e) {}
  return lista;
}

/** Ponte: tarefas do usuário N3 logado — pendentes + concluídas dos últimos dias. */
function webObterTarefasCoordenador(quemAcionou) {
  exigirCoordenacao(quemAcionou);
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ABA_TAREFAS);
  if (!sheet) return { pendentes: [], concluidas: [] };

  const tz = Session.getScriptTimeZone();
  const limite = Date.now() - TAREFAS_HISTORICO_DIAS * 86400000;
  const minhas = lerLinhasTarefas(sheet)
    .filter(l => l[0] && normalizarNome(l[1]) === normalizarNome(quemAcionou))
    .map(l => ({
      id: String(l[0]),
      data: (l[2] instanceof Date) ? Utilities.formatDate(l[2], tz, 'yyyy-MM-dd') : '',
      dataTexto: (l[2] instanceof Date) ? Utilities.formatDate(l[2], tz, 'dd/MM/yyyy') : '',
      dataMs: (l[2] instanceof Date) ? l[2].getTime() : 0,
      motivo: String(l[3] || ''),
      cliente: String(l[4] || ''),
      protocolo: String(l[5] || ''),
      status: String(l[6] || '').trim(),
      concluidaMs: (l[10] instanceof Date) ? l[10].getTime() : 0
    }));

  return {
    pendentes: minhas.filter(t => t.status === 'PENDENTE').sort((a, b) => a.dataMs - b.dataMs),
    concluidas: minhas.filter(t => t.status === 'CONCLUIDA' && t.concluidaMs >= limite)
      .sort((a, b) => b.concluidaMs - a.concluidaMs).slice(0, 20)
  };
}

/** Monta o recurso do Google Tasks a partir dos campos da tarefa. */
function montarRecursoTarefa(quemAcionou, data, motivo, cliente, protocolo) {
  const due = Utilities.formatDate(data, Session.getScriptTimeZone(), 'yyyy-MM-dd') + 'T00:00:00.000Z';
  const notas = [
    'Cliente: ' + (cliente || 'não informado'),
    'Protocolo: ' + (protocolo || 'não relacionado'),
    'Criada no Lista Ai por ' + quemAcionou
  ].join('\n');
  return { title: motivo, notes: notas, due: due };
}

/**
 * Ponte: cria (sem id) ou edita (com id) uma tarefa.
 * dados = { id?, data: "AAAA-MM-DD", motivo, cliente, protocolo }
 */
function webSalvarTarefaCoordenador(quemAcionou, dados) {
  exigirCoordenacao(quemAcionou);
  exigirServicoTasks();
  dados = dados || {};

  const data = interpretarDataLocal(dados.data);
  if (!data) throw new Error('Informe a data da tarefa.');
  const motivo = String(dados.motivo || '').trim();
  if (!motivo) throw new Error('Informe o motivo da tarefa.');
  const cliente = String(dados.cliente || '').trim();
  const protocolo = String(dados.protocolo || '').trim();
  const recurso = montarRecursoTarefa(quemAcionou, data, motivo, cliente, protocolo);
  const agora = new Date();

  // Edição
  if (dados.id) {
    return executarComTrava(() => {
      const sheet = obterAbaTarefas();
      const linhas = lerLinhasTarefas(sheet);
      const idx = linhas.findIndex(l => String(l[0]) === String(dados.id));
      if (idx === -1) throw new Error('Tarefa não encontrada.');
      const l = linhas[idx];
      if (normalizarNome(l[1]) !== normalizarNome(quemAcionou)) throw new Error('Você só pode editar as suas tarefas.');
      if (String(l[6]).trim() !== 'PENDENTE') throw new Error('Só tarefas pendentes podem ser editadas.');

      if (l[7]) Tasks.Tasks.patch(recurso, TAREFAS_LISTA_GOOGLE, String(l[7]));
      sheet.getRange(idx + 2, 3, 1, 4).setValues([[data, motivo, cliente, protocolo]]);
      sheet.getRange(idx + 2, 10).setValue(agora);
      registrarEvento('', protocolo, 'TAREFA_EDITADA', quemAcionou, 'Tarefa editada: ' + motivo);
      return { sucesso: true, id: String(dados.id) };
    });
  }

  // Criação (o Google primeiro: se falhar, nada é gravado na planilha)
  const task = Tasks.Tasks.insert(recurso, TAREFAS_LISTA_GOOGLE);
  const id = 'TF' + agora.getTime();
  executarComTrava(() => {
    obterAbaTarefas().appendRow([id, quemAcionou, data, motivo, cliente, protocolo, 'PENDENTE', task.id, agora, agora, '']);
  });
  registrarEvento('', protocolo, 'TAREFA_CRIADA', quemAcionou, 'Tarefa criada para ' +
    Utilities.formatDate(data, Session.getScriptTimeZone(), 'dd/MM/yyyy') + ': ' + motivo + (cliente ? ' | Cliente: ' + cliente : ''));
  return { sucesso: true, id: id };
}

/** Ponte: conclui (acao = 'concluir') ou exclui (acao = 'excluir') uma tarefa. */
function webAlterarStatusTarefaCoordenador(quemAcionou, id, acao) {
  exigirCoordenacao(quemAcionou);
  exigirServicoTasks();
  if (acao !== 'concluir' && acao !== 'excluir') throw new Error('Ação inválida.');

  return executarComTrava(() => {
    const sheet = obterAbaTarefas();
    const linhas = lerLinhasTarefas(sheet);
    const idx = linhas.findIndex(l => String(l[0]) === String(id));
    if (idx === -1) throw new Error('Tarefa não encontrada.');
    const l = linhas[idx];
    if (normalizarNome(l[1]) !== normalizarNome(quemAcionou)) throw new Error('Você só pode alterar as suas tarefas.');

    const agora = new Date();
    let avisoGoogle = '';
    try {
      if (l[7]) {
        if (acao === 'concluir') Tasks.Tasks.patch({ status: 'completed' }, TAREFAS_LISTA_GOOGLE, String(l[7]));
        else Tasks.Tasks.remove(TAREFAS_LISTA_GOOGLE, String(l[7]));
      }
    } catch (e) {
      // Ex.: a tarefa foi apagada direto no Gmail — o painel segue e só avisa.
      avisoGoogle = 'A tarefa não foi encontrada no Google Tasks (pode ter sido apagada lá).';
    }

    const novoStatus = acao === 'concluir' ? 'CONCLUIDA' : 'EXCLUIDA';
    sheet.getRange(idx + 2, 7).setValue(novoStatus);
    sheet.getRange(idx + 2, 10).setValue(agora);
    if (acao === 'concluir') sheet.getRange(idx + 2, 11).setValue(agora);
    registrarEvento('', String(l[5] || ''), acao === 'concluir' ? 'TAREFA_CONCLUIDA' : 'TAREFA_EXCLUIDA', quemAcionou,
      'Tarefa ' + (acao === 'concluir' ? 'concluída' : 'excluída') + ': ' + l[3] + (avisoGoogle ? ' (' + avisoGoogle + ')' : ''));
    return { sucesso: true, aviso: avisoGoogle };
  });
}

/**
 * Rodar UMA vez pelo editor depois de ativar o serviço: pede as autorizações novas
 * (Google Tasks e leitura da planilha de chamados) e mostra no log o que encontrou.
 */
function testarTarefasCoordenacao() {
  exigirServicoTasks();
  const listas = (Tasks.Tasklists.list().items || []).map(l => l.title);
  Logger.log('Listas do Google Tasks: ' + listas.join(', '));
  CacheService.getScriptCache().remove(CACHE_CLIENTES_CHAVE);
  const clientes = lerClientesChamados();
  Logger.log(clientes.length + ' cliente(s) na categoria "' + CATEGORIA_CLIENTE_CHAMADOS + '": ' + clientes.join(', '));
}

/**
 * DIAGNÓSTICO (1.3.8): confirma a permissão de Agenda. Cria um evento de teste
 * daqui a 1h, mostra o resultado no log e apaga o evento em seguida.
 */
function testarPermissaoAgenda() {
  const cal = CalendarApp.getDefaultCalendar();
  Logger.log('Agenda usada: ' + cal.getName());
  const inicio = new Date(Date.now() + 3600000);
  const ev = cal.createEvent('Teste Lista Ai', inicio, new Date(inicio.getTime() + 600000));
  Logger.log('Evento criado: ' + ev.getId());
  ev.deleteEvent();
  Logger.log('OK — permissão de Agenda funcionando.');
}

/**
 * DIAGNÓSTICO: registra todo POST do Jivo na aba WEBHOOK_LOG.
 * Nunca derruba o webhook e guarda só os últimos ~500 registros.
 */
function registrarWebhookLog(conteudo) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName('WEBHOOK_LOG');
    if (!sh) {
      sh = ss.insertSheet('WEBHOOK_LOG');
      sh.appendRow(['Recebido em', 'Evento', 'chat_id', 'agent (quem aceitou)', 'agents[] (lista do chat)', 'Canal (widget_id)', 'Cliente', 'Tags', 'Campos do payload', 'Payload (compacto)', 'Tópico', 'ID Tópico', 'Nº Visitante']);
      sh.getRange('C2:C').setNumberFormat('@');
    }
    // NOVO (1.3.16): colunas K/L (Tópico / ID Tópico) — criadas uma vez na aba que já existia.
    if (sh.getMaxColumns() < 12) sh.insertColumnsAfter(sh.getMaxColumns(), 12 - sh.getMaxColumns());
    if (!String(sh.getRange(1, 11).getValue()).trim()) sh.getRange(1, 11, 1, 2).setValues([['Tópico', 'ID Tópico']]);
    // NOVO (1.4.10): Coluna M = Nº do visitante (visitor.number), chave da reconexão.
    if (sh.getMaxColumns() < 13) sh.insertColumnsAfter(sh.getMaxColumns(), 13 - sh.getMaxColumns());
    if (!String(sh.getRange(1, 13).getValue()).trim()) sh.getRange(1, 13).setValue('Nº Visitante');
    const topicoLog = obterTopicoDoPayload(conteudo);

    const idNome = a => a ? (String(a.id) + ':' + (a.name || a.email || '')) : '';
    const agentes = Array.isArray(conteudo.agents) ? conteudo.agents.map(idNome).join(' | ') : '';
    const tags = Array.isArray(conteudo.tags) ? conteudo.tags.map(t => (t && (t.title || t.name)) || String(t)).join(' | ') : '';
    let bruto = '';
    // ALTERADO (1.4.10): grava só o resumo do payload (sem e-mail, telefone, IP, localização,
    // navegador, página e mensagens do chat).
    try { bruto = JSON.stringify(resumirPayloadJivoParaLog(conteudo)); } catch (e) {}

    sh.appendRow([
      new Date(),
      conteudo.event_name || conteudo.event || '',
      conteudo.chat_id ? String(conteudo.chat_id) : '',
      idNome(conteudo.agent),
      agentes,
      conteudo.widget_id ? String(conteudo.widget_id) : '',
      (conteudo.visitor && conteudo.visitor.name) || '',
      tags,
      Object.keys(conteudo).join(', '),
      bruto.substring(0, 10000),
      conteudo.topic ? topicoLog.titulo : '',
      topicoLog.id !== null ? topicoLog.id : '',
      numeroVisitanteJivo(conteudo) // M: Nº Visitante (NOVO 1.4.10)
    ]);

    const ultima = sh.getLastRow();
    if (ultima > 600) sh.deleteRows(2, ultima - 501);
  } catch (erroLog) {}
}

/** NOVO (1.4.10): só os campos do payload que o sistema usa (sem dados pessoais do cliente). */
function resumirPayloadJivoParaLog(c) {
  const ag = a => a ? { id: a.id, name: a.name || '' } : null;
  const v = c.visitor || null;
  return {
    event_name: c.event_name || c.event || '',
    event_timestamp: c.event_timestamp || '',
    chat_id: c.chat_id || '',
    widget_id: c.widget_id || '',
    agent: ag(c.agent),
    assigned_agent: ag(c.assigned_agent),
    agents: Array.isArray(c.agents) ? c.agents.map(ag) : [],
    visitor: v ? { name: v.name || '', number: numeroVisitanteJivo(c), chats_count: v.chats_count != null ? v.chats_count : '' } : null,
    topic: c.topic || null,
    tags: c.tags || [],
    status: c.status || null
  };
}