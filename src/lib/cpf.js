/*
  CPF do aluno. Guardado só com dígitos (11 caracteres); a máscara é de exibição.
  Serve como chave única — o nó `cpfs/{cpf}` impede a mesma pessoa entrar duas vezes.
*/

/** Deixa só os dígitos. */
export const soDigitos = valor => String(valor || '').replace(/\D/g, '')

/** 000.000.000-00, formatando parcialmente enquanto o usuário digita. */
export function formatarCPF(valor) {
  const d = soDigitos(valor).slice(0, 11)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

/** Dígito verificador: soma ponderada, resto 11. */
function digito(base, pesoInicial) {
  const soma = base
    .split('')
    .reduce((total, n, i) => total + Number(n) * (pesoInicial - i), 0)
  const resto = (soma * 10) % 11
  return resto === 10 ? 0 : resto
}

/**
 * Valida os dois dígitos verificadores.
 * Rejeita também os repetidos (111.111.111-11), que passam na conta mas não existem.
 */
export function cpfValido(valor) {
  const d = soDigitos(valor)
  if (d.length !== 11) return false
  if (/^(\d)\1{10}$/.test(d)) return false
  if (digito(d.slice(0, 9), 10) !== Number(d[9])) return false
  return digito(d.slice(0, 10), 11) === Number(d[10])
}
