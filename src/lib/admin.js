/*
  O que o painel administrativo mostra, calculado fora do React.

  LIMITE QUE DEFINE ESTE ARQUIVO
    As regras do Realtime Database dão ao admin leitura de exatamente quatro nós:
    `users`, `personals`, `planos` e `adminLogs` — mais `presenca` e `config`, que
    são abertos a qualquer autenticado.

    Tudo que pertence ao par personal↔aluno (cobranças, execuções, treinos,
    suplementos, avaliações, diário) é ilegível para o admin, de propósito: são
    dados de saúde e de dinheiro de terceiros, e abrir isso para uma conta de
    plataforma seria uma decisão de privacidade, não um detalhe técnico.

    Por isso aqui NÃO existe "alunos que treinaram esta semana" nem "pagamentos
    atrasados dos alunos". Não é esquecimento: o dado não chega, e inventar um
    número plausível seria pior do que não mostrar.

  O QUE DÁ PARA SABER, E COMO
    - último acesso: `presenca/{uid}.visto`, gravado por `lib/presenca.js`
    - contagem de alunos: `personals/{uid}/alunos`, nunca um campo em `users`
      (campo ali é gravável pelo próprio personal e furaria o limite do Free)
    - entradas no período: `users/{uid}.criadoEm` — existe no aluno desde sempre;
      no personal, só a partir de Set/2026 (ver `montarPersonais`)
    - histórico de ações do admin: `adminLogs`
*/

import { normalizarAssinatura, PLANOS, assinaturaVencida, contaBloqueada } from './planos'

const DIA = 86400000

export const PERIODOS = [
  { id: '7', rotulo: '7 dias', dias: 7 },
  { id: '30', rotulo: '30 dias', dias: 30 },
  { id: '90', rotulo: '90 dias', dias: 90 },
  { id: 'tudo', rotulo: 'Tudo', dias: null }
]

/* ---------------- último acesso ---------------- */

/**
 * Quando a pessoa apareceu por último. `presenca` é escrita pelo próprio
 * usuário ao conectar; quem nunca abriu o app depois de Ago/2026 não tem registro,
 * e aí a resposta honesta é "nunca visto", não "há muito tempo".
 */
export function ultimoAcesso(presenca, uid, agora = Date.now()) {
  const p = presenca?.[uid]
  if (!p?.visto) return { visto: null, dias: null, online: false }
  const dias = Math.floor((agora - p.visto) / DIA)
  return { visto: p.visto, dias, online: p.online === true }
}

/**
 * O selo de último acesso, já resolvido: as duas listas mostravam o mesmo dado
 * e cada uma montava o texto por conta própria — as duas escreviam "1 dias", e
 * quem nunca entrou era "Nunca entrou" numa e "Nunca visto" na outra.
 *
 * `tom` é a classe do selo, não uma cor: quem some há 30 dias é aviso porque
 * está prestes a virar churn, não porque errou alguma coisa.
 */
export function rotuloAcesso(acesso, temPresenca = true) {
  // Sem o nó de presença não dá para distinguir "nunca entrou" de "não sei".
  if (!temPresenca) return { texto: '—', tom: 'neutro' }
  if (!acesso || acesso.visto === null) return { texto: 'Nunca entrou', tom: 'neutro' }
  if (acesso.online) return { texto: 'Online', tom: 'ok' }
  if (acesso.dias === 0) return { texto: 'Hoje', tom: 'ok' }
  if (acesso.dias === 1) return { texto: 'Ontem', tom: '' }
  return { texto: acesso.dias + ' dias', tom: acesso.dias >= 30 ? 'aviso' : '' }
}

/* ---------------- as duas listas ---------------- */

/** Personais, com assinatura normalizada, contagem real de alunos e presença. */
export function montarPersonais({ users = {}, planos = {}, personals = {}, presenca = {} }, agora = Date.now()) {
  return Object.entries(users)
    .filter(([, u]) => u?.role === 'personal')
    .map(([uid, u]) => {
      const assinatura = normalizarAssinatura(planos[uid])
      const alunos = Object.keys(personals[uid]?.alunos || {}).length
      return {
        uid,
        nome: u.nome || '(sem nome)',
        email: u.email || '',
        telefone: u.telefone || '',
        // Conta antiga não tem `criadoEm`: o cadastro só passou a gravar em
        // Set/2026. `null` significa "não dá para saber", não "hoje".
        criadoEm: u.criadoEm || null,
        assinatura,
        alunos,
        limite: assinatura.studentLimit,
        vagas: Math.max(0, assinatura.studentLimit - alunos),
        // "Perto do limite" é relativo ao plano: 4 de 4 no Free aperta, 4 de 999 não.
        noLimite: alunos >= assinatura.studentLimit,
        quaseNoLimite: assinatura.studentLimit <= 20 && alunos >= assinatura.studentLimit - 1 && alunos < assinatura.studentLimit,
        vencida: assinaturaVencida(assinatura),
        bloqueado: contaBloqueada(assinatura),
        acesso: ultimoAcesso(presenca, uid, agora)
      }
    })
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

/** Alunos de toda a plataforma, com o personal responsável resolvido. */
export function montarAlunos({ users = {}, presenca = {} }, agora = Date.now()) {
  const nomeDe = uid => users[uid]?.nome || null
  return Object.entries(users)
    .filter(([, u]) => u?.role === 'aluno')
    .map(([uid, u]) => ({
      uid,
      nome: u.nome || '(sem nome)',
      email: u.emailContato || u.email || '',
      codigo: u.codigo || '',
      personalId: u.personalId || null,
      // Aluno cujo personal sumiu do `users` fica órfão — e isso é um problema
      // operacional de verdade, não um detalhe de exibição.
      personalNome: u.personalId ? nomeDe(u.personalId) : null,
      semPersonal: !u.personalId || !nomeDe(u.personalId),
      criadoEm: u.criadoEm || null,
      precisaTrocarSenha: u.precisaTrocarSenha === true,
      acesso: ultimoAcesso(presenca, uid, agora)
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome))
}

/* ---------------- visão geral ---------------- */

const dentroDoPeriodo = (ts, dias, agora) => !!ts && (dias === null || ts >= agora - dias * DIA)

/**
 * Os números do topo.
 *
 * O período só afeta o que tem data: entradas novas. Os demais são o retrato de
 * agora — "quantos estão bloqueados HOJE" não muda com o filtro de 7 dias, e
 * fingir que muda daria a impressão de uma série histórica que não existe.
 */
export function visaoGeral({ personais = [], alunos = [], dias = 30, agora = Date.now() }) {
  const pro = personais.filter(p => p.assinatura.plan === 'pro')
  const proAtivos = pro.filter(p => p.assinatura.planStatus === 'active')
  const semData = personais.filter(p => !p.criadoEm).length

  return {
    personais: {
      total: personais.length,
      ativos: personais.filter(p => p.assinatura.planStatus === 'active').length,
      emAtraso: personais.filter(p => p.assinatura.planStatus === 'past_due').length,
      cancelados: personais.filter(p => p.assinatura.planStatus === 'canceled').length,
      bloqueados: personais.filter(p => p.bloqueado).length,
      novos: personais.filter(p => dentroDoPeriodo(p.criadoEm, dias, agora)).length,
      // Quantos não têm data de cadastro — a tela precisa dizer isso ao lado de "novos".
      semDataCadastro: semData
    },
    alunos: {
      total: alunos.length,
      novos: alunos.filter(a => dentroDoPeriodo(a.criadoEm, dias, agora)).length,
      semPersonal: alunos.filter(a => a.semPersonal).length,
      nuncaEntraram: alunos.filter(a => a.acesso.visto === null).length,
      // Proxy honesto de "ativo": abriu o app. Não é "treinou" — execuções são
      // ilegíveis para o admin.
      ativos7d: alunos.filter(a => a.acesso.dias !== null && a.acesso.dias <= 7).length
    },
    assinaturas: {
      free: personais.filter(p => p.assinatura.plan === 'free').length,
      pro: pro.length,
      proAtivos: proAtivos.length,
      vencendo7d: pro.filter(p => {
        const q = p.assinatura.planExpiresAt
        return q && q > agora && q <= agora + 7 * DIA
      }).length,
      vencidas: personais.filter(p => p.vencida).length
    },
    receita: {
      // Projeção, não caixa. Não existe registro de pagamento da plataforma em
      // lugar nenhum do banco — ver o cabeçalho deste arquivo.
      mrrProjetado: proAtivos.length * PLANOS.pro.preco,
      emRisco: pro.filter(p => p.assinatura.planStatus !== 'active').length * PLANOS.pro.preco,
      conversao: personais.length ? Math.round((pro.length / personais.length) * 100) : 0
    }
  }
}

/* ---------------- o que pede ação ---------------- */

/**
 * Alerta sem botão é só um número que estraga o dia de alguém. Cada item aqui
 * carrega o link para a lista já filtrada — é o que separa "ver" de "resolver".
 */
export function alertas({ personais = [], alunos = [], suportePendente = 0 }) {
  const itens = []
  /*
    O número fica num selo à parte do texto, então o texto precisa concordar com
    ele: "1 | assinaturas vencidas" fica errado na tela. Cada alerta traz as duas
    formas e `add` escolhe.
  */
  const add = (id, n, um, varios, detalhe, rota, urgente = false) => {
    if (n > 0) itens.push({ id, n, titulo: n === 1 ? um : varios, detalhe, rota, urgente })
  }

  add('vencidas', personais.filter(p => p.vencida).length,
    'assinatura vencida', 'assinaturas vencidas',
    'A data de vencimento já passou', '/admin/personals?venc=expired', true)

  add('bloqueados', personais.filter(p => p.bloqueado).length,
    'conta bloqueada', 'contas bloqueadas',
    'Sem acesso ao app até liberar', '/admin/personals?status=blocked', true)

  add('suporte', suportePendente,
    'conversa de suporte sem resposta', 'conversas de suporte sem resposta',
    'O personal escreveu e ninguém respondeu', '/admin/suporte', true)

  add('limite', personais.filter(p => p.noLimite).length,
    'personal no limite de alunos', 'personais no limite de alunos',
    'Sem espaço para cadastrar mais alunos', '/admin/personals?alunos=limite')

  add('vencendo', personais.filter(p => {
    const q = p.assinatura.planExpiresAt
    return q && q > Date.now() && q <= Date.now() + 7 * DIA
  }).length, 'assinatura vence em 7 dias', 'assinaturas vencem em 7 dias',
    'Vale avisar antes de bloquear', '/admin/personals?venc=next_7d')

  add('orfaos', alunos.filter(a => a.semPersonal).length,
    'aluno sem personal', 'alunos sem personal',
    'Sem responsável desde que o personal saiu', '/admin/alunos?filtro=sem_personal')

  add('semAlunos', personais.filter(p => p.alunos === 0).length,
    'personal sem nenhum aluno', 'personais sem nenhum aluno',
    'Conta criada, nenhum aluno cadastrado', '/admin/personals?alunos=0')

  return itens.sort((a, b) => (b.urgente - a.urgente) || (b.n - a.n))
}

/* ---------------- busca global ---------------- */

const semAcento = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Busca por nome, e-mail ou código, nas duas listas de uma vez. */
export function buscar(termo, { personais = [], alunos = [] }, limite = 6) {
  const q = semAcento(termo).trim()
  if (q.length < 2) return { personais: [], alunos: [], vazio: true }

  const bate = campos => campos.some(c => semAcento(c).includes(q))
  return {
    personais: personais.filter(p => bate([p.nome, p.email, p.uid])).slice(0, limite),
    alunos: alunos.filter(a => bate([a.nome, a.email, a.codigo, a.uid])).slice(0, limite),
    vazio: false
  }
}

/* ---------------- histórico de ações ---------------- */

const ROTULO_ACAO = {
  set_plan: 'alterou o plano', set_status: 'alterou o status',
  set_limit: 'alterou o limite', set_expiry: 'alterou o vencimento',
  set_note: 'anotou algo em'
}

/** "Alterou o plano de João — de Free para Pro." Log cru não se lê. */
export function descreverLog(log, nomePorUid = {}) {
  const quem = nomePorUid[log.targetPersonalId] || 'um personal'
  const acao = ROTULO_ACAO[log.action] || log.action
  const de = log.from === null || log.from === undefined ? null : String(log.from)
  const para = log.to === null || log.to === undefined ? null : String(log.to)
  const mudanca = de !== null && para !== null ? ` — de ${de} para ${para}`
    : para !== null ? ` — para ${para}` : ''
  return `${acao.charAt(0).toUpperCase() + acao.slice(1)} de ${quem}${mudanca}`
}

/** Os últimos registros, do mais recente. */
export function historicoAdmin(logs = {}, limite = 8) {
  return Object.entries(logs)
    .map(([id, l]) => ({ id, ...l }))
    .sort((a, b) => (b.at || 0) - (a.at || 0))
    .slice(0, limite)
}
