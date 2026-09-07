/*
  Quem decide se um lembrete deve ser enviado agora.

  Roda nos dois lados: no navegador, para a tela mostrar o que está programado;
  e na função agendada do Netlify, que é quem de fato dispara o push. Por isso
  aqui não há acesso a banco, nem a `Date.now()` implícito — tudo entra por
  parâmetro. É o que torna esta regra testável sem servidor e sem celular.

  MODELO
    suplementos/{aluno}/{id}.lembrete = {
      ativo: bool,
      horarios: ['05:00', '20:00'],   // um por dose do dia
      antecedencia: 0 | 5 | 10 | 15,  // minutos antes do horário
      cobrar: bool                    // segunda tentativa se não registrar
    }

  FUSO
    O servidor roda em UTC; o aluno configurou "05:00" no relógio dele. Quem
    resolve isso é o fuso gravado junto com a inscrição de push (`tz`), aplicado
    em `agoraNoFuso()`. Sem isso, um aluno em Brasília receberia às 02:00.

  UM LIMITE HONESTO
    `suplementosTomados` guarda `vezes` e um `ts` por DIA, não por dose. Com 2x
    ao dia não dá para saber qual das duas foi registrada. A aproximação usada
    aqui: uma dose é considerada coberta quando o número de registros do dia já
    alcança a quantidade de horários que já passaram. Erra a favor do silêncio —
    prefiro não avisar de uma dose já tomada a cobrar quem tomou.
*/

export const ANTECEDENCIAS = [
  { id: 0, rotulo: 'No horário' },
  { id: 5, rotulo: '5 minutos antes' },
  { id: 10, rotulo: '10 minutos antes' },
  { id: 15, rotulo: '15 minutos antes' }
]

/** Minutos após o horário para a segunda tentativa. */
export const ATRASO_COBRANCA = 60

/** Teto de lembretes por dose e por dia: o principal e uma cobrança. Nada além. */
export const MAX_POR_DOSE = 2

export const lembreteVazio = () => ({
  ativo: false, horarios: [], antecedencia: 0, cobrar: true
})

const ehHorario = h => typeof h === 'string' && /^\d{2}:\d{2}$/.test(h)

/**
 * Completa o lembrete e migra o formato antigo.
 * Antes de Set/2026 existia um único campo `horario` no suplemento; ele vira o
 * primeiro item da lista, para quem já tinha um horário não perder nada.
 */
export function normalizarLembrete(sup) {
  const bruto = sup?.lembrete || {}
  let horarios = Array.isArray(bruto.horarios) ? bruto.horarios.filter(ehHorario) : []
  if (horarios.length === 0 && ehHorario(sup?.horario)) horarios = [sup.horario]

  const antecedencia = ANTECEDENCIAS.some(a => a.id === Number(bruto.antecedencia))
    ? Number(bruto.antecedencia) : 0

  return {
    ativo: bruto.ativo === true && horarios.length > 0,
    horarios: [...new Set(horarios)].sort(),
    antecedencia,
    cobrar: bruto.cobrar !== false
  }
}

/** "05:00" -> 300. Null quando não é horário. */
export const emMinutos = h => {
  if (!ehHorario(h)) return null
  const [hh, mm] = h.split(':').map(Number)
  return hh > 23 || mm > 59 ? null : hh * 60 + mm
}

/** 300 -> "05:00" */
export const emTexto = min => {
  const m = ((min % 1440) + 1440) % 1440
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0')
}

/** Chave do registro de envio. Sem ':' para não depender do que a key aceita. */
export const chaveEnvio = (supId, horario) => supId + '_' + horario.replace(':', '')

/**
 * O relógio do aluno, a partir de um fuso IANA.
 * Devolve o dia (YYYY-MM-DD), o minuto do dia e o dia da semana LOCAIS — que é
 * o que as regras de frequência e de horário precisam.
 */
export function agoraNoFuso(instante, tz) {
  let partes
  try {
    partes = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || 'UTC', hour12: false,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', weekday: 'short'
    }).formatToParts(instante)
  } catch {
    // Fuso inválido não pode derrubar o envio de todo mundo.
    return agoraNoFuso(instante, 'UTC')
  }
  const p = Object.fromEntries(partes.map(x => [x.type, x.value]))
  const semana = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const hora = p.hour === '24' ? '00' : p.hour
  return {
    dia: `${p.year}-${p.month}-${p.day}`,
    minutos: Number(hora) * 60 + Number(p.minute),
    diaSemana: semana[p.weekday] ?? 0
  }
}

/** O suplemento entra neste dia da semana? Espelha `tocaHoje`, sem depender de Date. */
export function valeNoDia(sup, diaSemana, treinou) {
  if (!sup) return false
  if (sup.ativo === false) return false
  if (sup.frequencia === 'dias') return (sup.dias || []).includes(diaSemana)
  if (sup.frequencia === 'treino') return !!treinou
  return true
}

/** Pausa temporária, comparando strings de data — não precisa de fuso. */
export const pausadoNoDia = (sup, dia) => !!sup?.pausadoAte && dia <= sup.pausadoAte

/**
 * A dose deste horário já está coberta pelos registros do dia?
 *
 * Ver o limite explicado no topo: sem `ts` por dose, o critério é posicional —
 * o horário é a n-ésima dose do dia, então está coberta se já houve n registros.
 */
export function doseCoberta(horarios, horario, vezesRegistradas) {
  const posicao = horarios.indexOf(horario) + 1
  if (posicao === 0) return false
  return vezesRegistradas >= posicao
}

/**
 * Tudo que deve ser notificado neste instante, para UM aluno.
 *
 * `jaEnviados` é o log do dia (`lembretesEnviados/{uid}/{dia}`), e é ele que
 * impede a duplicata: a função roda de minuto em minuto, então sem esse registro
 * a mesma dose seria cobrada em toda passagem dentro da janela.
 *
 * `janela` existe porque uma execução pode atrasar ou falhar; olhar alguns
 * minutos para trás recupera o lembrete perdido em vez de silenciá-lo. O log
 * garante que recuperar não vira repetir.
 */
export function lembretesDevidos({
  suplementos = {}, tomados = {}, treinouHoje = false,
  instante = new Date(), tz = 'UTC', jaEnviados = {}, prefs = {}, janela = 5
}) {
  if (prefs.suplementos === false) return []

  const { dia, minutos, diaSemana } = agoraNoFuso(instante, tz)
  if (prefs.silenciarAte && dia <= prefs.silenciarAte) return []

  const doDia = tomados[dia] || {}
  const devidos = []

  Object.entries(suplementos).forEach(([id, bruto]) => {
    const sup = bruto || {}
    const lembrete = normalizarLembrete(sup)
    if (!lembrete.ativo) return
    if (pausadoNoDia(sup, dia)) return
    if (!valeNoDia(sup, diaSemana, treinouHoje)) return

    const registradas = Number(doDia[id]?.vezes) || 0
    const vezesAoDia = Math.max(1, Number(sup.vezesAoDia) || 1)
    if (registradas >= vezesAoDia) return   // dia inteiro concluído

    lembrete.horarios.forEach(horario => {
      const alvo = emMinutos(horario)
      if (alvo === null) return
      if (doseCoberta(lembrete.horarios, horario, registradas)) return

      const chave = chaveEnvio(id, horario)
      const enviados = jaEnviados[chave]?.n || 0
      if (enviados >= MAX_POR_DOSE) return

      const principal = alvo - lembrete.antecedencia
      const cobranca = alvo + ATRASO_COBRANCA
      const dentro = alvoMin => minutos >= alvoMin && minutos < alvoMin + janela

      // A cobrança só existe depois que o principal saiu — senão o primeiro
      // aviso do aluno seria "você tomou?", de uma dose que nunca foi lembrada.
      if (enviados === 0 && dentro(principal)) {
        devidos.push({ id, sup, horario, chave, tipo: 'principal' })
      } else if (enviados === 1 && lembrete.cobrar && dentro(cobranca)) {
        devidos.push({ id, sup, horario, chave, tipo: 'cobranca' })
      }
    })
  })

  return devidos
}

/**
 * Junta o que sai no mesmo instante numa notificação só.
 *
 * Três suplementos às 05:00 são três vibrações no bolso da pessoa e um motivo
 * para ela desligar tudo. Vira uma: "Você tem 3 doses programadas para agora".
 */
export function agrupar(devidos) {
  const grupos = new Map()
  devidos.forEach(d => {
    const g = d.tipo + '_' + d.horario
    if (!grupos.has(g)) grupos.set(g, [])
    grupos.get(g).push(d)
  })

  return [...grupos.values()].map(itens => {
    const cobranca = itens[0].tipo === 'cobranca'
    const um = itens.length === 1 ? itens[0] : null

    /*
      Sem possessivo, de propósito. "Hora do seu creatina" e "Hora da sua whey"
      são os dois erros possíveis, e o gênero não dá para deduzir do nome —
      "Ômega" termina em A e é masculino. "Hora de tomar X" serve para todos.
    */
    const nome = String(um?.sup?.nome || '').trim() || 'suplemento'
    const titulo = um
      ? (cobranca ? `Você já tomou ${nome}?` : `Hora de tomar ${nome}`)
      : (cobranca ? 'Doses não registradas' : 'Hora da suplementação')

    const corpo = um
      ? [um.sup.dose, um.sup.marca].filter(Boolean).join(' · ')
      : itens.map(i => i.sup.nome).join(', ')

    return {
      tipo: itens[0].tipo,
      horario: itens[0].horario,
      titulo,
      corpo: corpo || (um ? '' : `${itens.length} doses programadas para agora`),
      // Uma dose só abre nela; várias abrem a lista do horário.
      rota: um ? `/aluno?aba=suplementos&sup=${um.id}` : '/aluno?aba=suplementos',
      chaves: itens.map(i => i.chave),
      itens
    }
  })
}
