/*
  A lista de conversas do personal: prévia, horário, não lidas e ordenação.

  Por que isto existe fora da tela: a mesma pergunta — "quantas mensagens o
  aluno mandou e eu não li?" — vale para o item do menu (badge), para o filtro
  e para cada linha da lista. Com a conta inline em cada lugar, "não lida"
  passaria a significar coisas diferentes em cada canto, que é exatamente o que
  aconteceu com "vencida" antes de `filtroCobrancas.js` existir.

  LIMITE DE 30 MENSAGENS POR CONVERSA
  A tela assina `limitToLast(30)` em cada conversa, não o histórico inteiro:
  um personal com 40 alunos baixaria tudo que já foi dito a cada abertura do
  app. A consequência honesta é que o contador satura: quem tem mais de 30
  mensagens sem ler vê "30+", e `saturado` diz isso à tela em vez de fingir
  um número exato. Para decidir "abro esta conversa agora?", 30+ já responde.
*/

export const LIMITE_MENSAGENS = 30

/** Mensagem do outro lado que ainda não recebeu recibo de leitura. */
const naoLida = (m, meuUid) => m.de !== meuUid && !m.lidaEm

/**
 * Resume uma conversa já carregada.
 *
 * `mensagens` é o objeto cru do nó `chats/{conversaId}` (no máximo as últimas
 * `LIMITE_MENSAGENS`). Devolve sempre o mesmo formato, inclusive para conversa
 * vazia — assim a tela não precisa de dois caminhos.
 */
export function resumir(mensagens, meuUid) {
  const lista = Object.values(mensagens || {})
    .filter(m => m && typeof m.ts === 'number')
    .sort((a, b) => a.ts - b.ts)

  if (lista.length === 0) {
    return { ultima: '', ts: 0, deMim: false, naoLidas: 0, saturado: false, semResposta: false, vazia: true }
  }

  const ultima = lista[lista.length - 1]
  const naoLidas = lista.filter(m => naoLida(m, meuUid)).length

  return {
    ultima: previa(ultima.texto),
    ts: ultima.ts,
    deMim: ultima.de === meuUid,
    naoLidas,
    // Todas as carregadas sem ler significa que pode haver mais atrás do limite.
    saturado: naoLidas >= LIMITE_MENSAGENS,
    // "Sem resposta" é sobre quem falou por último, não sobre recibo: dá para
    // ter lido e mesmo assim dever uma resposta.
    semResposta: ultima.de !== meuUid,
    vazia: false
  }
}

/* Quebra de linha vira espaço: a prévia é uma linha só, e um "\n" no meio
   deixaria a lista com alturas diferentes sem motivo. */
function previa(texto) {
  const limpo = String(texto || '').replace(/\s+/g, ' ').trim()
  return limpo.length > 80 ? limpo.slice(0, 79) + '…' : limpo
}

/**
 * Junta as fichas dos alunos com o resumo de cada conversa e ordena.
 *
 * Ordem: conversa mais recente primeiro. Quem nunca trocou mensagem vai para
 * o fim, em ordem alfabética — não é "a conversa mais antiga", é conversa que
 * não existe, e misturar as duas coisas pelo ts=0 embaralharia a lista.
 */
export function montar(fichas, porAluno, meuUid) {
  return (fichas || [])
    .map(f => ({ ...f, ...resumir(porAluno?.[f.uid], meuUid) }))
    .sort((a, b) => {
      if (a.vazia !== b.vazia) return a.vazia ? 1 : -1
      if (a.vazia) return (a.nome || '').localeCompare(b.nome || '', 'pt-BR')
      return b.ts - a.ts
    })
}

export const FILTROS = [
  { id: 'todas', rotulo: 'Todas' },
  { id: 'nao_lidas', rotulo: 'Não lidas' },
  { id: 'sem_resposta', rotulo: 'Sem resposta' }
]

export function filtrar(lista, filtro) {
  if (filtro === 'nao_lidas') return lista.filter(c => c.naoLidas > 0)
  if (filtro === 'sem_resposta') return lista.filter(c => c.semResposta)
  return lista
}

/** Soma para o badge do menu. Satura junto com as conversas. */
export function totalNaoLidas(lista) {
  const total = (lista || []).reduce((n, c) => n + c.naoLidas, 0)
  return { total, saturado: (lista || []).some(c => c.saturado) }
}

/** Quantas conversas cada filtro traria — para a contagem na pílula. */
export function contarPorFiltro(lista) {
  return {
    todas: lista.length,
    nao_lidas: lista.filter(c => c.naoLidas > 0).length,
    sem_resposta: lista.filter(c => c.semResposta).length
  }
}
