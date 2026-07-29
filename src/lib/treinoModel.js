/*
  Modelo compartilhado de treinos e templates.

  Formato canônico (plano cíclico):
    { nome, lista: [{ nome, exercicios: [...] }], indiceAtual }

  Formato antigo (treino único), ainda lido para retrocompatibilidade:
    { nome, exercicios: [...] }
*/

export const LETRAS = ['A', 'B', 'C', 'D', 'E', 'F']
export const MAX_DIAS = 6

export const exercicioVazio = () => ({ nome: '', series: 3, reps: 12, carga: '', descanso: 60, video: '' })

export const diaVazio = (i = 0) => ({
  nome: 'Treino ' + (LETRAS[i] || i + 1),
  exercicios: [exercicioVazio()]
})

/** Garante que todo exercício tenha todos os campos. */
export function normalizarExercicios(exercicios) {
  return (exercicios || []).map(ex => ({ ...exercicioVazio(), ...ex }))
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

/** Estimativa de duração do treino em minutos (execução + descanso). */
export function duracaoEstimada(exercicios) {
  const seg = (exercicios || []).reduce((total, ex) => {
    const series = Number(ex.series) || 0
    const descanso = Number(ex.descanso) || 60
    return total + series * (40 + descanso)
  }, 0)
  return Math.max(1, Math.round(seg / 60))
}

/** Volume total (séries) de um treino. */
export function totalSeries(exercicios) {
  return (exercicios || []).reduce((s, ex) => s + (Number(ex.series) || 0), 0)
}
