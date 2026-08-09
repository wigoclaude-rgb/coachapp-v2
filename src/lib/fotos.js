import { ref as sRef, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '../firebase'
import { redimensionarParaBlob } from './util'

/*
  Fotos ficam no Firebase Storage; o banco guarda só a URL.

  Antes de Ago/2026 as fotos eram data URLs base64 gravadas dentro do Realtime
  Database. Elas continuam sendo exibidas normalmente (um <img src> não sabe a
  diferença) — só não dá para apagá-las do Storage, porque nunca estiveram lá.
*/

/** true se o valor é uma foto antiga embutida no banco. */
export const ehBase64 = url => typeof url === 'string' && url.startsWith('data:')

const idUnico = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8)

/**
 * Redimensiona e envia a foto. Devolve a URL pública.
 * `pasta` é o caminho no Storage, ex: 'progresso/UID' ou 'exercicios/UID'.
 */
export async function enviarFoto(file, pasta, maxLado = 1080) {
  const blob = await redimensionarParaBlob(file, maxLado)
  const caminho = `${pasta}/${idUnico()}.jpg`
  const alvo = sRef(storage, caminho)
  await uploadBytes(alvo, blob, { contentType: 'image/jpeg' })
  return await getDownloadURL(alvo)
}

/**
 * Apaga a foto do Storage. Silencioso para base64 antigo e para arquivo
 * que já não existe — apagar o registro no banco é o que importa.
 */
export async function apagarFoto(url) {
  if (!url || ehBase64(url)) return
  try {
    await deleteObject(sRef(storage, url))
  } catch (err) {
    if (err?.code !== 'storage/object-not-found') {
      console.warn('Não foi possível apagar a foto do Storage:', err?.code || err)
    }
  }
}
