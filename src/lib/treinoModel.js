/*
  Modelo compartilhado de treinos e templates.

  Plano (canônico):
    { nome, lista: [{ nome, exercicios: [...] }], indiceAtual }

  Exercício (canônico, desde Jul/2026):
    {
      nome, video, obs,
      imagem: string,           // URL no Storage; vazio cai na capa do vídeo
      grupo: string | null,     // exercícios vizinhos com o mesmo grupo formam um bi-set
      linhas: [{ reps, carga, descanso }]   // uma linha por série
    }

  Formatos antigos ainda lidos:
    - plano com `exercicios[]` na raiz (treino único, sem ciclo)
    - exercício com `series: 3, reps: 12, carga, descanso` (vira 3 linhas iguais)
*/

export const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F']
export const MAX_DIAS = 6

export const linhaVazia = (base = {}) => ({
  reps: base.reps ?? '12',
  carga: base.carga ?? '',
  descanso: base.descanso ?? 60
})

export const exercicioVazio = () => ({
  nome: '', video: '', obs: '', imagem: '', grupo: null, linhas: [linhaVazia()]
})

export const diaVazio = (i = 0) => ({
  nome: 'Treino ' + (LETRAS[i] || i + 1),
  exercicios: [exercicioVazio()]
})

/** Converte um exercício para o formato canônico, migrando o formato antigo. */
export function normalizarExercicio(ex) {
  if (!ex) return exercicioVazio()

  let linhas
  if (Array.isArray(ex.linhas) && ex.linhas.length > 0) {
    linhas = ex.linhas.map(l => ({
      reps: String(l?.reps ?? ''),
      carga: String(l?.carga ?? ''),
      descanso: Number(l?.descanso) || 0
    }))
  } else {
    // formato antigo: series (quantidade) + reps/carga/descanso únicos
    const qtd = Math.max(1, Number(ex.series) || 1)
    const modelo = {
      reps: String(ex.reps ?? '12'),
      carga: String(ex.carga ?? ''),
      descanso: Number(ex.descanso) || 0
    }
    linhas = Array.from({ length: qtd }, () => ({ ...modelo }))
  }

  return {
    nome: ex.nome || '',
    video: ex.video || '',
    obs: ex.obs || '',
    imagem: ex.imagem || '',
    grupo: ex.grupo || null,
    linhas
  }
}

/** Normaliza a lista e desfaz grupos que sobraram com um único exercício. */
export function normalizarExercicios(exercicios) {
  const lista = (exercicios || []).map(normalizarExercicio)
  const contagem = {}
  lista.forEach(ex => { if (ex.grupo) contagem[ex.grupo] = (contagem[ex.grupo] || 0) + 1 })
  return lista.map(ex => (ex.grupo && contagem[ex.grupo] < 2 ? { ...ex, grupo: null } : ex))
}

/**
 * Converte um plano em `{ nome, lista, indiceAtual }`, aceitando o formato antigo.
 * Retorna null se não houver nada aproveitável.
 */
export function normalizarPlano(plano) {
  if (!plano) return null

  if (Array.isArray(plano.lista) && plano.lista.length > 0) {
    return {
      ...plano,
      nome: plano.nome || 'Plano de treino',
      lista: plano.lista.map((d, i) => ({
        nome: d?.nome || 'Treino ' + (LETRAS[i] || i + 1),
        exercicios: normalizarExercicios(d?.exercicios)
      })),
      indiceAtual: Number(plano.indiceAtual) || 0
    }
  }

  if (Array.isArray(plano.exercicios) && plano.exercicios.length > 0) {
    return {
      ...plano,
      nome: plano.nome || 'Plano de treino',
      lista: [{ nome: plano.nome || 'Treino A', exercicios: normalizarExercicios(plano.exercicios) }],
      indiceAtual: 0
    }
  }

  return null
}

/** Igual a normalizarPlano, mas sempre devolve um objeto utilizável (para templates). */
export function normalizarTemplate(t) {
  return normalizarPlano(t) || { nome: t?.nome || 'Template', lista: [diaVazio(0)], indiceAtual: 0 }
}

/** Índice do dia ativo, sempre dentro dos limites da lista. */
export function indiceSeguro(indice, total) {
  if (!total) return 0
  return (((Number(indice) || 0) % total) + total) % total
}

/**
 * Agrupa exercícios em blocos de execução.
 * Exercícios vizinhos com o mesmo `grupo` viram um bloco só (bi-set).
 */
export function agruparBlocos(exercicios) {
  const blocos = []
  ;(exercicios || []).forEach(ex => {
    const ultimo = blocos[blocos.length - 1]
    if (ex.grupo && ultimo && ultimo.grupo === ex.grupo) ultimo.exercicios.push(ex)
    else blocos.push({ grupo: ex.grupo || null, exercicios: [ex] })
  })
  return blocos.map(b => ({
    ...b,
    combinado: b.exercicios.length > 1,
    series: Math.max(1, ...b.exercicios.map(e => e.linhas.length)),
    titulo: b.exercicios.map(e => e.nome).join(' + ')
  }))
}

/** Chave usada para marcar uma série concluída. */
export const chaveSerie = (nomeExercicio, serie) => nomeExercicio + '_' + serie

/** Volume total (séries) de um treino. */
export function totalSeries(exercicios) {
  return (exercicios || []).reduce((s, ex) => s + (ex.linhas?.length || 0), 0)
}

/** Estimativa de duração do treino em minutos (execução + descanso). */
export function duracaoEstimada(exercicios) {
  const seg = (exercicios || []).reduce((total, ex) => (
    total + (ex.linhas || []).reduce((t, l) => t + 40 + (Number(l.descanso) || 0), 0)
  ), 0)
  return Math.max(1, Math.round(seg / 60))
}

/** Resumo curto das séries, ex: "3x12" ou "12 / 10 / 8". */
export function resumoLinhas(linhas) {
  if (!linhas?.length) return ''
  const reps = linhas.map(l => String(l.reps || '').trim())
  const todasIguais = reps.every(r => r === reps[0])
  return todasIguais ? `${linhas.length}x${reps[0]}` : reps.join(' / ')
}

/** Número escondido num texto livre de carga: "60Kg" -> 60. */
export function cargaNumero(valor) {
  const n = Number(String(valor ?? '').replace(/[^\d.,]/g, '').replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Resumo de uma linha só para o cabeçalho do exercício: quantas séries e a
 * faixa de carga. Quando as repetições variam de série para série, enfileirá-las
 * ("20 / 15 / 12 / 12-10") não diz nada — o que interessa ali é o peso.
 * As reps detalhadas aparecem ao abrir o exercício.
 */
export function resumoExercicio(ex) {
  const linhas = ex?.linhas || []
  if (!linhas.length) return ''

  const n = linhas.length
  const partes = [`${n} série${n === 1 ? '' : 's'}`]

  const reps = linhas.map(l => String(l.reps || '').trim())
  if (reps[0] && reps.every(r => r === reps[0])) partes.push(`${reps[0]} reps`)

  const nums = linhas.map(l => cargaNumero(l.carga)).filter(Boolean)
  if (nums.length) {
    const min = Math.min(...nums)
    const max = Math.max(...nums)
    partes.push(min === max ? `${min} kg` : `${min} a ${max} kg`)
  }

  return partes.join(' · ')
}
