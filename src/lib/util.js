export function fmtData(ts) {
  return new Date(ts).toLocaleDateString('pt-BR')
}
export function fmtHora(ts) {
  return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
export function fmtMoeda(v) {
  return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** Data por extenso, com "Hoje" e "Ontem" — separador das conversas. */
export function fmtDataLonga(ts) {
  const d = new Date(ts)
  const zerar = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const dias = Math.round((zerar(new Date()) - zerar(d)) / 86400000)
  if (dias === 0) return 'Hoje'
  if (dias === 1) return 'Ontem'
  return d.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Hora se for hoje, "Ontem" se for ontem, senão dd/mm — usado na lista de conversas. */
export function fmtQuando(ts) {
  if (!ts) return ''
  const rotulo = fmtDataLonga(ts)
  if (rotulo === 'Hoje') return fmtHora(ts)
  if (rotulo === 'Ontem') return 'Ontem'
  return new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

/** Iniciais para o avatar quando não há foto. */
export function iniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return '?'
  if (partes.length === 1) return partes[0][0].toUpperCase()
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase()
}
export function hojeISO() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
export function vencida(cobranca) {
  if (cobranca.status === 'pago') return false
  return cobranca.vencimento < hojeISO()
}
export function youtubeId(url) {
  if (!url) return null
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/)
  return m ? m[1] : null
}

/** Capa do vídeo do YouTube — usada quando o exercício não tem imagem própria. */
export const capaYoutube = id => (id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null)

/**
 * Imagem de demonstração do exercício.
 * Prioridade: a que o personal enviou, senão a capa do vídeo, senão nada.
 */
export const imagemExercicio = ex => ex?.imagem || capaYoutube(youtubeId(ex?.video)) || null

/*
  A carga é texto livre: o personal tanto digita "30" quanto "30Kg". Só acrescenta
  a unidade quando ela ainda não está lá, senão sai "30Kg kg".
*/
export function comKg(valor) {
  const txt = String(valor ?? '').trim()
  if (!txt) return ''
  return /kg\s*$/i.test(txt) ? txt : txt + ' kg'
}
export function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    osc.start()
    osc.stop(ctx.currentTime + 0.6)
  } catch (e) { /* sem som */ }
}
/** Lê o arquivo e devolve um canvas já redimensionado (lado maior = maxLado). */
function desenharRedimensionado(file, maxLado) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const escala = Math.min(1, maxLado / Math.max(img.width, img.height))
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(img.width * escala)
        canvas.height = Math.round(img.height * escala)
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
        resolve(canvas)
      }
      img.onerror = reject
      img.src = reader.result
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

/** Data URL base64 — formato antigo, guardado direto no banco. */
export async function redimensionarImagem(file, maxLado = 480) {
  const canvas = await desenharRedimensionado(file, maxLado)
  return canvas.toDataURL('image/jpeg', 0.7)
}

/** Blob para enviar ao Storage. Aceita resolução maior porque não pesa no banco. */
export async function redimensionarParaBlob(file, maxLado = 1080, qualidade = 0.82) {
  const canvas = await desenharRedimensionado(file, maxLado)
  const blob = await new Promise(r => canvas.toBlob(r, 'image/jpeg', qualidade))
  if (!blob) throw new Error('Não foi possível processar a imagem.')
  return blob
}
