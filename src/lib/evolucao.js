/*
  Cálculos da tela de Evolução do aluno.

  Tudo aqui sai de `execucoes/{aluno}` — o registro real do que foi levantado.
  Nada é estimado: métrica que o banco não sustenta simplesmente não existe neste
  arquivo, e a tela mostra outra coisa no lugar em vez de inventar número.

  O que NÃO dá para calcular hoje, e por quê:
    volume (carga x reps)  — as repetições feitas não são gravadas; vivem no plano
    frequência em %        — só com `diasSemana` definido pelo personal
*/

export const diaISO = (d = new Date()) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')

const inicioDoDia = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d }
const numero = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }

/** Execuções viram uma lista ordenada e limpa, do mais antigo para o mais novo. */
export function ordenar(execucoes) {
  return Object.values(execucoes || {})
    .filter(e => e?.ts && e?.exercicio)
    .sort((a, b) => a.ts - b.ts)
}

/* ============================ dias ============================ */

/** Set de dias (YYYY-MM-DD) em que houve pelo menos uma série. */
export function diasTreinados(lista) {
  return new Set(lista.map(e => diaISO(new Date(e.ts))))
}

/**
 * Dias seguidos treinados, contando de hoje para trás.
 * Ainda não treinou hoje? Conta a partir de ontem — o dia não acabou.
 */
export function sequenciaAtual(dias, hoje = new Date()) {
  if (dias.size === 0) return 0
  const cursor = inicioDoDia(hoje)
  if (!dias.has(diaISO(cursor))) {
    cursor.setDate(cursor.getDate() - 1)
    if (!dias.has(diaISO(cursor))) return 0
  }
  let n = 0
  while (dias.has(diaISO(cursor))) {
    n++
    cursor.setDate(cursor.getDate() - 1)
  }
  return n
}

/** Dias treinados dentro do mês corrente. */
export function treinosNoMes(dias, hoje = new Date()) {
  const prefixo = hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0')
  return [...dias].filter(d => d.startsWith(prefixo)).length
}

/**
 * Frequência do mês.
 *
 * Com `diasSemana` definido pelo personal, devolve percentual real: dias
 * treinados sobre dias previstos até hoje. Sem isso devolve a média semanal,
 * que é honesta e não precisa de meta — percentual sem denominador seria invenção.
 */
export function frequenciaDoMes(dias, diasSemana, hoje = new Date()) {
  const ano = hoje.getFullYear()
  const mes = hoje.getMonth()
  const feitos = treinosNoMes(dias, hoje)

  if (Array.isArray(diasSemana) && diasSemana.length > 0) {
    let previstos = 0
    const cursor = new Date(ano, mes, 1)
    while (cursor <= hoje) {
      if (diasSemana.includes(cursor.getDay())) previstos++
      cursor.setDate(cursor.getDate() + 1)
    }
    if (previstos === 0) return { tipo: 'pct', valor: null }
    return { tipo: 'pct', valor: Math.round((feitos / previstos) * 100), feitos, previstos }
  }

  // Semanas já decorridas no mês, com no mínimo uma para não dividir por zero.
  const semanas = Math.max(1, hoje.getDate() / 7)
  return { tipo: 'media', valor: Math.round((feitos / semanas) * 10) / 10 }
}

/* ============================ força ============================ */

/**
 * Recordes por exercício: o maior peso já registrado e quando aconteceu.
 * Uma série só vira recorde se superar tudo que veio antes dela.
 */
export function recordes(lista) {
  const melhor = {}
  const marcos = []

  lista.forEach(e => {
    const peso = numero(e.peso)
    if (!peso) return
    const atual = melhor[e.exercicio]
    if (atual === undefined) {
      // A primeira carga registrada é a linha de base, não um recorde.
      melhor[e.exercicio] = { primeiro: peso, maximo: peso, ts: e.ts }
      return
    }
    if (peso > atual.maximo) {
      melhor[e.exercicio] = { ...atual, maximo: peso, ts: e.ts }
      marcos.push({ exercicio: e.exercicio, peso, ts: e.ts })
    }
  })

  return { melhor, marcos }
}

/** Recordes batidos no mês corrente. */
export function prsNoMes(marcos, hoje = new Date()) {
  return marcos.filter(m => {
    const d = new Date(m.ts)
    return d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear()
  }).length
}

/**
 * Exercícios que mais evoluíram: do primeiro peso registrado até o melhor.
 * Sem evolução (ganho zero) fica de fora — a seção é sobre o que melhorou.
 */
export function melhoresResultados(melhor, limite = 5) {
  return Object.entries(melhor)
    .map(([exercicio, m]) => ({
      exercicio,
      de: m.primeiro,
      para: m.maximo,
      ganho: Math.round((m.maximo - m.primeiro) * 10) / 10
    }))
    .filter(r => r.ganho > 0)
    .sort((a, b) => b.ganho - a.ganho)
    .slice(0, limite)
}

/* ============================ séries no tempo ============================ */

/** Segunda-feira da semana de uma data. */
function inicioDaSemana(d) {
  const c = inicioDoDia(d)
  const dow = (c.getDay() + 6) % 7   // 0 = segunda
  c.setDate(c.getDate() - dow)
  return c
}

/**
 * Série semanal para o gráfico, das últimas `semanas` semanas.
 *
 * `carga`  — maior peso levantado na semana (a força de pico)
 * `series` — quantas séries foram registradas
 * `dias`   — quantos dias distintos teve treino
 *
 * Não existe "volume" aqui de propósito: volume é carga x repetições, e as
 * repetições feitas não são gravadas. Estimá-las pelo plano daria um número
 * bonito e errado sempre que a pessoa fizesse a mais ou a menos.
 */
export function porSemana(lista, semanas = 12, hoje = new Date()) {
  const baldes = []
  const cursor = inicioDaSemana(hoje)
  cursor.setDate(cursor.getDate() - (semanas - 1) * 7)

  for (let i = 0; i < semanas; i++) {
    baldes.push({ inicio: new Date(cursor), carga: 0, series: 0, dias: new Set() })
    cursor.setDate(cursor.getDate() + 7)
  }

  lista.forEach(e => {
    const ini = inicioDaSemana(new Date(e.ts)).getTime()
    const b = baldes.find(x => x.inicio.getTime() === ini)
    if (!b) return
    b.series++
    b.dias.add(diaISO(new Date(e.ts)))
    const peso = numero(e.peso)
    if (peso && peso > b.carga) b.carga = peso
  })

  return baldes.map(b => ({
    inicio: b.inicio,
    rotulo: String(b.inicio.getDate()).padStart(2, '0') + '/' + String(b.inicio.getMonth() + 1).padStart(2, '0'),
    carga: b.carga,
    series: b.series,
    dias: b.dias.size
  }))
}

/* ============================ o dia ============================ */

/**
 * Resumo de um dia treinado: exercícios, séries, recordes e a duração estimada.
 *
 * A duração é o intervalo entre a primeira e a última série marcadas — não é
 * cronômetro, é o que o registro permite dizer. Quem marca tudo no fim do treino
 * aparece com poucos minutos, e por isso ela só é mostrada acima de 5.
 */
export function resumoDoDia(lista, dia, marcos) {
  const doDia = lista.filter(e => diaISO(new Date(e.ts)) === dia)
  if (doDia.length === 0) return null

  const exercicios = [...new Set(doDia.map(e => e.exercicio))]
  const ts = doDia.map(e => e.ts)
  const minutos = Math.round((Math.max(...ts) - Math.min(...ts)) / 60000)

  return {
    dia,
    series: doDia.length,
    exercicios,
    minutos: minutos >= 5 ? minutos : null,
    prs: (marcos || []).filter(m => diaISO(new Date(m.ts)) === dia).length,
    reduzidas: doDia.filter(e => e.alvo).length
  }
}

/* ============================ calendário ============================ */

export const ESTADOS = {
  treinou: 'treinou',
  previsto: 'previsto',   // era dia de treino e ainda não passou
  perdido: 'perdido',     // era dia de treino e passou sem treino
  livre: 'livre'
}

/**
 * Grade de um mês, domingo a sábado, com o número do dia visível.
 *
 * Substituiu o mapa de calor de 17 semanas: lá o dia era um quadrado de 13px
 * sem rótulo, e só dava para saber a data passando o mouse — no celular,
 * impossível. Aqui a data está escrita, ao custo de ver um mês por vez.
 *
 * As bordas vêm preenchidas com os dias vizinhos (`doMes: false`) para a semana
 * nunca aparecer quebrada.
 */
export function mesGrade(ano, mes, dias, diasSemana, hoje = new Date()) {
  const temAgenda = Array.isArray(diasSemana) && diasSemana.length > 0
  const hojeISO = diaISO(inicioDoDia(hoje))

  const inicio = new Date(ano, mes, 1)
  inicio.setDate(inicio.getDate() - inicio.getDay())          // volta ao domingo
  const fim = new Date(ano, mes + 1, 0)
  fim.setDate(fim.getDate() + (6 - fim.getDay()))             // avança ao sábado

  const celulas = []
  const cursor = new Date(inicio)
  while (cursor <= fim) {
    const iso = diaISO(cursor)
    const treinou = dias.has(iso)
    const futuro = iso > hojeISO
    const naAgenda = temAgenda && diasSemana.includes(cursor.getDay())

    let estado = ESTADOS.livre
    if (treinou) estado = ESTADOS.treinou
    else if (naAgenda) estado = futuro || iso === hojeISO ? ESTADOS.previsto : ESTADOS.perdido

    celulas.push({
      iso,
      dia: cursor.getDate(),
      doMes: cursor.getMonth() === mes,
      estado, treinou, futuro,
      ehHoje: iso === hojeISO
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return celulas
}

/* ============================ conquistas ============================ */

/**
 * Marcos já alcançados, do mais recente para o mais antigo.
 * Só o que aconteceu de verdade — nada de "próxima conquista" com barrinha,
 * que transforma o histórico em vitrine do que a pessoa ainda não fez.
 */
export function conquistas(dias, marcos, semanasSeguidas) {
  const total = dias.size
  const lista = []

  if (total >= 1) lista.push({ id: 'primeiro', titulo: 'Primeiro treino', desc: 'Você começou.' })
  ;[10, 25, 50, 100, 200].forEach(n => {
    if (total >= n) lista.push({ id: 'treinos' + n, titulo: `${n} treinos`, desc: 'Dias registrados no app.' })
  })
  if (marcos.length >= 1) lista.push({ id: 'pr1', titulo: 'Primeiro recorde', desc: 'Você superou uma carga anterior.' })
  if (marcos.length >= 10) lista.push({ id: 'pr10', titulo: '10 recordes', desc: 'Dez cargas superadas.' })
  if (semanasSeguidas >= 4) lista.push({ id: 'sem4', titulo: '4 semanas seguidas', desc: 'Sem furar nenhuma semana.' })
  if (semanasSeguidas >= 12) lista.push({ id: 'sem12', titulo: '12 semanas seguidas', desc: 'Três meses de constância.' })

  return lista.reverse()
}

/** Semanas consecutivas, até agora, com pelo menos um treino. */
export function semanasSeguidas(dias, hoje = new Date()) {
  if (dias.size === 0) return 0
  const cursor = inicioDaSemana(hoje)
  let n = 0
  for (let i = 0; i < 260; i++) {
    const fim = new Date(cursor); fim.setDate(fim.getDate() + 6)
    const teve = [...dias].some(d => {
      const t = new Date(d + 'T12:00:00').getTime()
      return t >= cursor.getTime() && t <= fim.getTime()
    })
    // A semana corrente ainda pode ser salva; não quebra a conta.
    if (!teve) { if (i === 0) { cursor.setDate(cursor.getDate() - 7); continue } break }
    n++
    cursor.setDate(cursor.getDate() - 7)
  }
  return n
}
