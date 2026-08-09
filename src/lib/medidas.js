/** Medidas corporais, na ordem de cima para baixo do corpo. */
export const CAMPOS_MEDIDAS = [
  ['peso', 'Peso (kg)'], ['altura', 'Altura (cm)'], ['pescoco', 'Pescoço (cm)'],
  ['ombro', 'Ombro (cm)'], ['peito', 'Peito (cm)'], ['cintura', 'Cintura (cm)'],
  ['abdomen', 'Abdômen (cm)'], ['quadril', 'Quadril (cm)'],
  ['bracoD', 'Braço dir. (cm)'], ['bracoE', 'Braço esq. (cm)'],
  ['antebracoD', 'Antebraço dir. (cm)'], ['antebracoE', 'Antebraço esq. (cm)'],
  ['coxaD', 'Coxa dir. (cm)'], ['coxaE', 'Coxa esq. (cm)'],
  ['panturrilhaD', 'Panturrilha dir. (cm)'], ['panturrilhaE', 'Panturrilha esq. (cm)']
]

/** As que o aluno vê primeiro no diário — o resto fica atrás de "mais medidas". */
export const MEDIDAS_RAPIDAS = ['peso', 'cintura', 'quadril', 'bracoD']

export const rotuloMedida = campo =>
  CAMPOS_MEDIDAS.find(c => c[0] === campo)?.[1] || campo

/** Converte o formulário em números, descartando vazios e valores inválidos. */
export function medidasPreenchidas(bruto) {
  const saida = {}
  Object.entries(bruto || {}).forEach(([campo, valor]) => {
    if (valor === '' || valor === null || valor === undefined) return
    const n = Number(valor)
    if (Number.isFinite(n) && n > 0) saida[campo] = n
  })
  return saida
}
