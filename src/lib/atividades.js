/*
  Atividades do check-in.

  `distancia: true` marca o que se mede em quilômetro. Musculação e yoga não têm
  km, e mostrar o campo mesmo assim ensina a pessoa a ignorar formulário — pior
  que não ter o campo. O formulário só pede o que faz sentido para o que ela marcou.

  Os ids nunca mudam: eles ficam gravados nos registros antigos.

  O emoji entra dessaturado por CSS (.atv-icone), para virar silhueta cinza em vez
  de mancha colorida no meio de uma interface de traço fino.
*/

export const ATIVIDADES = [
  { id: 'musculacao', rotulo: 'Musculação', emoji: '🏋️' },
  { id: 'corrida', rotulo: 'Corrida', emoji: '🏃', distancia: true },
  { id: 'caminhada', rotulo: 'Caminhada', emoji: '🚶', distancia: true },
  { id: 'ciclismo', rotulo: 'Bike', emoji: '🚴', distancia: true },
  { id: 'funcional', rotulo: 'Funcional', emoji: '🤸' },
  { id: 'esporte', rotulo: 'Esporte', emoji: '⚽' }
]

export const atividadeDe = id => ATIVIDADES.find(a => a.id === id) || null

export const temDistancia = id => !!atividadeDe(id)?.distancia

/** "1h 15min" — hora só aparece quando existe. */
export function duracao(minutos) {
  const m = Math.round(Number(minutos) || 0)
  if (m <= 0) return ''
  if (m < 60) return m + ' min'
  const h = Math.floor(m / 60)
  const resto = m % 60
  return resto ? `${h}h ${resto}min` : `${h}h`
}

export const distancia = km => {
  const n = Number(km)
  if (!Number.isFinite(n) || n <= 0) return ''
  return n.toFixed(n < 10 ? 1 : 0).replace('.', ',') + ' km'
}

/** "Corrida · 5,2 km · 32 min" — o que der, na ordem que se lê. */
export function resumoAtividade(r) {
  const a = atividadeDe(r?.atividade)
  const partes = []
  // A lista já encolheu uma vez; sem esta saída, registro antigo vira "· 32 min".
  if (a) partes.push(a.rotulo)
  else if (r?.atividadeNome) partes.push(r.atividadeNome)
  else if (r?.atividade) partes.push('Atividade')
  const d = distancia(r?.km)
  if (d) partes.push(d)
  const t = duracao(r?.minutos)
  if (t) partes.push(t)
  return partes.join(' · ')
}

/**
 * Somatório do mês corrente: quantas atividades, quantos km e quantos minutos.
 * Só conta registro que tem atividade marcada — nota solta não é treino.
 */
export function totaisDoMes(lista, agora = new Date()) {
  const mes = agora.getMonth()
  const ano = agora.getFullYear()
  let sessoes = 0, km = 0, minutos = 0

  lista.forEach(r => {
    if (!r.atividade) return
    const d = new Date(r.ts)
    if (d.getMonth() !== mes || d.getFullYear() !== ano) return
    sessoes++
    km += Number(r.km) || 0
    minutos += Number(r.minutos) || 0
  })

  return { sessoes, km: Math.round(km * 10) / 10, minutos }
}
