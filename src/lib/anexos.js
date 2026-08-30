/*
  Anexos da avaliação física.

  Dois nós, de propósito:
    anexos/{alunoId}/{id}      → { nome, tipo, tamanho, ts, avaliacaoId? }
    anexosDados/{alunoId}/{id} → "data:application/pdf;base64,..."

  O peso não pode viver junto do metadado. Um `onValue` na lista traria todos os
  arquivos em base64 de uma vez — três PDFs de 1 MB e a tela trava antes de
  desenhar. Assim a lista custa alguns bytes e o arquivo só é lido quando alguém
  clica para abrir.

  `avaliacaoId` presente = anexo daquela avaliação; ausente = documento do aluno
  (atestado, exame), que vale independente de avaliação.
*/

import { ref, push, get, remove, update } from 'firebase/database'
import { db } from '../firebase'

/*
  1,5 MB é o teto prático, não um número redondo. O Realtime Database aceita bem
  mais, mas base64 infla o arquivo em ~33% e tudo isso trafega no plano gratuito
  a cada leitura. Acima disso, o caminho certo é o Storage.
*/
export const TAMANHO_MAX = 1.5 * 1024 * 1024

export const TIPOS_ACEITOS = [
  'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'
]

export const ACCEPT = '.jpg,.jpeg,.png,.webp,.heic,.pdf'

export const ehImagem = tipo => String(tipo || '').startsWith('image/')

export function tamanhoLegivel(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB'
  return (n / 1024 / 1024).toFixed(1).replace('.', ',') + ' MB'
}

/** Recusa antes de ler o arquivo — validar depois de carregar 5 MB não ajuda ninguém. */
export function validarArquivo(file) {
  if (!file) return 'Nenhum arquivo escolhido.'
  if (!TIPOS_ACEITOS.includes(file.type)) {
    return 'Formato não aceito. Envie imagem (JPG, PNG, WEBP) ou PDF.'
  }
  if (file.size > TAMANHO_MAX) {
    return `Arquivo de ${tamanhoLegivel(file.size)}. O limite é ${tamanhoLegivel(TAMANHO_MAX)} — `
      + 'tire uma foto com menos resolução ou comprima o PDF.'
  }
  return ''
}

const lerComoDataURL = file => new Promise((ok, falha) => {
  const leitor = new FileReader()
  leitor.onload = () => ok(leitor.result)
  leitor.onerror = () => falha(new Error('Falha ao ler o arquivo.'))
  leitor.readAsDataURL(file)
})

/**
 * Sobe um anexo. Grava o metadado primeiro e o conteúdo depois, com a mesma chave:
 * se a segunda escrita falhar, sobra um item visível que dá para apagar — melhor
 * que um arquivo órfão que ninguém enxerga e que continua ocupando espaço.
 */
export async function enviarAnexo(alunoId, file, { avaliacaoId = null } = {}) {
  const erro = validarArquivo(file)
  if (erro) throw new Error(erro)

  const dados = await lerComoDataURL(file)

  const meta = {
    nome: file.name || 'arquivo',
    tipo: file.type,
    tamanho: file.size,
    ts: Date.now()
  }
  if (avaliacaoId) meta.avaliacaoId = avaliacaoId

  const criado = await push(ref(db, 'anexos/' + alunoId), meta)
  await update(ref(db, 'anexosDados/' + alunoId), { [criado.key]: dados })
  return { id: criado.key, ...meta }
}

/** Conteúdo em base64. Só chamado ao abrir — nunca na montagem da lista. */
export async function lerAnexo(alunoId, id) {
  const s = await get(ref(db, `anexosDados/${alunoId}/${id}`))
  return s.exists() ? s.val() : null
}

/** Apaga o conteúdo antes do metadado: falhando no meio, o item continua na lista. */
export async function apagarAnexo(alunoId, id) {
  await remove(ref(db, `anexosDados/${alunoId}/${id}`))
  await remove(ref(db, `anexos/${alunoId}/${id}`))
}

/** Separa a lista bruta em documentos do aluno e anexos por avaliação. */
export function organizar(bruto) {
  const todos = Object.entries(bruto || {})
    .map(([id, a]) => ({ id, ...a }))
    .sort((a, b) => (b.ts || 0) - (a.ts || 0))

  const doAluno = todos.filter(a => !a.avaliacaoId)
  const porAvaliacao = {}
  todos.forEach(a => {
    if (!a.avaliacaoId) return
    ;(porAvaliacao[a.avaliacaoId] ||= []).push(a)
  })
  return { todos, doAluno, porAvaliacao }
}
