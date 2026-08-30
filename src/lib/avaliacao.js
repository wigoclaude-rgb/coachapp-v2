/*
  Avaliação física.

  Estende o formato que já existia — `avaliacoes/{alunoId}/{id} = { ts, medidas }` —
  em vez de trocá-lo. `medidas` continua PLANO e `ts` continua sendo a data: quatro
  telas já leem assim, e registros antigos precisam continuar aparecendo no gráfico.
  Os blocos novos (anamnese, dobras, bio, resumo, visibilidade) entram ao lado.

  Avaliação parcial é normal: ninguém preenche tudo toda vez. Todo cálculo aqui
  devolve `null` quando falta entrada, e a tela omite o que for nulo.
*/

import { CAMPOS_MEDIDAS } from './medidas'

export const TIPOS = [
  { id: 'inicial', rotulo: 'Inicial' },
  { id: 'reavaliacao', rotulo: 'Reavaliação' },
  { id: 'parcial', rotulo: 'Parcial' }
]

export const BLOCOS = [
  { id: 'anamnese', rotulo: 'Anamnese' },
  { id: 'medidas', rotulo: 'Medidas' },
  { id: 'dobras', rotulo: 'Dobras' },
  { id: 'bio', rotulo: 'Bioimpedância' },
  { id: 'resumo', rotulo: 'Resumo' },
  { id: 'observacoesGerais', rotulo: 'Observações' }
]

/* ---------------- anamnese ---------------- */

export const CAMPOS_ANAMNESE = [
  { id: 'objetivoPrincipal', rotulo: 'Objetivo principal', tipo: 'opcoes', secao: 'Objetivo',
    opcoes: ['Emagrecer', 'Ganhar massa', 'Condicionamento', 'Saúde e qualidade de vida', 'Reabilitação'] },
  { id: 'objetivoDetalhe', rotulo: 'Detalhe do objetivo', tipo: 'texto', secao: 'Objetivo' },
  { id: 'experienciaTreino', rotulo: 'Experiência com treino', tipo: 'opcoes', secao: 'Objetivo',
    opcoes: ['Nunca treinei', 'Menos de 6 meses', 'De 6 meses a 2 anos', 'Mais de 2 anos'] },
  { id: 'frequenciaSemanalDesejada', rotulo: 'Frequência semanal desejada', tipo: 'opcoes', secao: 'Objetivo',
    opcoes: ['1 a 2x', '3x', '4x', '5x', '6x ou mais'] },
  { id: 'localTreino', rotulo: 'Onde vai treinar', tipo: 'opcoes', secao: 'Objetivo',
    opcoes: ['Academia', 'Em casa', 'Ao ar livre', 'Misto'] },

  { id: 'temLesao', rotulo: 'Tem alguma lesão?', tipo: 'sim_nao', secao: 'Saúde' },
  { id: 'lesoesDescricao', rotulo: 'Quais lesões', tipo: 'texto', secao: 'Saúde', dependeDe: 'temLesao' },
  { id: 'dorAtual', rotulo: 'Sente dor hoje?', tipo: 'sim_nao', secao: 'Saúde' },
  { id: 'dorLocal', rotulo: 'Onde dói', tipo: 'curto', secao: 'Saúde', dependeDe: 'dorAtual' },
  { id: 'cirurgias', rotulo: 'Cirurgias', tipo: 'texto', secao: 'Saúde' },
  { id: 'doencasDiagnosticas', rotulo: 'Doenças diagnosticadas', tipo: 'texto', secao: 'Saúde' },
  { id: 'medicamentosEmUso', rotulo: 'Medicamentos em uso', tipo: 'texto', secao: 'Saúde' },
  { id: 'restricoesMedicas', rotulo: 'Restrições médicas', tipo: 'texto', secao: 'Saúde' },
  { id: 'liberacaoMedica', rotulo: 'Tem liberação médica?', tipo: 'sim_nao', secao: 'Saúde' },
  { id: 'gestante', rotulo: 'Gestante', tipo: 'sim_nao', secao: 'Saúde' },
  { id: 'observacaoSaude', rotulo: 'Outras observações de saúde', tipo: 'texto', secao: 'Saúde' },

  { id: 'fumante', rotulo: 'Fumante', tipo: 'sim_nao', secao: 'Rotina' },
  { id: 'consumoAlcool', rotulo: 'Consumo de álcool', tipo: 'opcoes', secao: 'Rotina',
    opcoes: ['Não bebo', 'Socialmente', 'Toda semana', 'Diariamente'] },
  { id: 'qualidadeSono', rotulo: 'Qualidade do sono', tipo: 'opcoes', secao: 'Rotina',
    opcoes: ['Ruim', 'Regular', 'Boa', 'Ótima'] },
  { id: 'nivelEstresse', rotulo: 'Nível de estresse', tipo: 'opcoes', secao: 'Rotina',
    opcoes: ['Baixo', 'Médio', 'Alto'] },
  { id: 'profissao', rotulo: 'Profissão', tipo: 'curto', secao: 'Rotina' },
  { id: 'passaMuitoTempoSentado', rotulo: 'Passa muito tempo sentado', tipo: 'sim_nao', secao: 'Rotina' },
  { id: 'alimentacaoResumo', rotulo: 'Como é a alimentação', tipo: 'texto', secao: 'Rotina' },
  { id: 'usaSuplemento', rotulo: 'Usa suplemento', tipo: 'sim_nao', secao: 'Rotina' },
  { id: 'suplementosLista', rotulo: 'Quais suplementos', tipo: 'texto', secao: 'Rotina', dependeDe: 'usaSuplemento' }
]

/** PAR-Q resumido. Qualquer "sim" aqui pede atenção antes de liberar treino. */
export const CAMPOS_PARQ = [
  ['dorPeitoEsforco', 'Sente dor no peito ao fazer esforço?'],
  ['dorPeitoRepouso', 'Sente dor no peito em repouso?'],
  ['tonturaOuPerdaEquilibrio', 'Tem tontura ou perda de equilíbrio?'],
  ['problemaOsseoArticular', 'Tem problema ósseo ou articular?'],
  ['medicacaoPressaoCoracao', 'Toma remédio para pressão ou coração?'],
  ['outroMotivoNaoFazerAtividade', 'Há outro motivo para não fazer atividade física?']
]

/* ---------------- dobras e bio ---------------- */

export const PONTOS_DOBRAS = [
  ['tricipital', 'Tricipital'], ['subescapular', 'Subescapular'], ['peitoral', 'Peitoral'],
  ['axilarMedia', 'Axilar média'], ['suprailiaca', 'Supra-ilíaca'],
  ['abdominal', 'Abdominal'], ['coxa', 'Coxa']
]

/** Pontos que cada protocolo usa — o formulário destaca os exigidos. */
export const PONTOS_POR_PROTOCOLO = {
  '3': { M: ['peitoral', 'abdominal', 'coxa'], F: ['tricipital', 'suprailiaca', 'coxa'] },
  '7': {
    M: ['peitoral', 'axilarMedia', 'tricipital', 'subescapular', 'abdominal', 'suprailiaca', 'coxa'],
    F: ['peitoral', 'axilarMedia', 'tricipital', 'subescapular', 'abdominal', 'suprailiaca', 'coxa']
  }
}

export const CAMPOS_BIO = [
  ['gorduraPct', 'Gordura (%)'], ['massaGorda', 'Massa gorda (kg)'],
  ['massaMagra', 'Massa magra (kg)'], ['massaMuscular', 'Massa muscular (kg)'],
  ['aguaPct', 'Água (%)'], ['aguaKg', 'Água (kg)'], ['ossoKg', 'Massa óssea (kg)'],
  ['tmb', 'Metabolismo basal (kcal)'], ['visceral', 'Gordura visceral'],
  ['idadeMetabolica', 'Idade metabólica']
]

/* ---------------- números ---------------- */

const num = v => {
  if (v === '' || v === null || v === undefined) return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isFinite(n) && n > 0 ? n : null
}

const arred = (v, casas = 1) =>
  v === null || v === undefined ? null : Math.round(v * 10 ** casas) / 10 ** casas

/** Idade em anos a partir de 'AAAA-MM-DD'. */
export function idadeDe(nascimento) {
  if (!nascimento) return null
  const d = new Date(nascimento)
  if (Number.isNaN(d.getTime())) return null
  const hoje = new Date()
  let anos = hoje.getFullYear() - d.getFullYear()
  const m = hoje.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) anos--
  return anos > 0 && anos < 120 ? anos : null
}

export const sexoLetra = s =>
  String(s || '').trim().toUpperCase().startsWith('M') ? 'M'
    : String(s || '').trim().toUpperCase().startsWith('F') ? 'F' : null

export function calcularIMC(peso, alturaCm) {
  const p = num(peso), a = num(alturaCm)
  if (!p || !a) return null
  const m = a > 3 ? a / 100 : a          // aceita 175 ou 1,75
  return arred(p / (m * m), 1)
}

export function classificarIMC(imc) {
  if (!imc) return ''
  if (imc < 18.5) return 'Abaixo do peso'
  if (imc < 25) return 'Peso normal'
  if (imc < 30) return 'Sobrepeso'
  if (imc < 35) return 'Obesidade grau I'
  if (imc < 40) return 'Obesidade grau II'
  return 'Obesidade grau III'
}

export function calcularRCQ(cintura, quadril) {
  const c = num(cintura), q = num(quadril)
  if (!c || !q) return null
  return arred(c / q, 2)
}

/**
 * Percentual de gordura por dobras — Jackson & Pollock, densidade convertida por Siri.
 * Precisa de sexo, idade e das dobras do protocolo escolhido; sem isso devolve null
 * e a tela pede o valor à mão em vez de inventar um número.
 */
export function gorduraPorDobras({ protocolo, pontos, sexo, idade }) {
  const s = sexoLetra(sexo)
  const i = num(idade)
  const exigidos = PONTOS_POR_PROTOCOLO[protocolo]?.[s]
  if (!s || !i || !exigidos) return { soma: null, percentual: null }

  const valores = exigidos.map(p => num(pontos?.[p]))
  if (valores.some(v => v === null)) return { soma: null, percentual: null }

  const soma = valores.reduce((a, b) => a + b, 0)
  let d
  if (protocolo === '3') {
    d = s === 'M'
      ? 1.10938 - 0.0008267 * soma + 0.0000016 * soma * soma - 0.0002574 * i
      : 1.0994921 - 0.0009929 * soma + 0.0000023 * soma * soma - 0.0001392 * i
  } else {
    d = s === 'M'
      ? 1.112 - 0.00043499 * soma + 0.00000055 * soma * soma - 0.00028826 * i
      : 1.097 - 0.00046971 * soma + 0.00000056 * soma * soma - 0.00012828 * i
  }
  const pct = 495 / d - 450
  if (!Number.isFinite(pct) || pct <= 0 || pct >= 70) return { soma: arred(soma), percentual: null }
  return { soma: arred(soma), percentual: arred(pct, 1) }
}

/** Massa gorda e magra a partir do peso e do percentual. */
export function composicao(peso, percentual) {
  const p = num(peso), g = num(percentual)
  if (!p || !g) return { massaGordaKg: null, massaMagraKg: null }
  const gorda = (p * g) / 100
  return { massaGordaKg: arred(gorda, 1), massaMagraKg: arred(p - gorda, 1) }
}

/* ---------------- documento ---------------- */

export const visibilidadePadrao = () => ({
  alunoPodeVer: true,
  blocos: {
    anamnese: false,      // a anamnese tem dado clínico; entra fechada por padrão
    medidas: true,
    dobras: true,
    bio: true,
    resumo: true,
    observacoesGerais: true
  }
})

export const avaliacaoVazia = (primeira = false) => ({
  ts: Date.now(),
  tipo: primeira ? 'inicial' : 'reavaliacao',
  observacoesGerais: '',
  medidas: {},
  anamnese: { parq: {} },
  dobras: { protocolo: '3', equacao: 'Pollock 3 dobras · Siri', pontos: {} },
  bio: {},
  resumo: { fonteGordura: 'dobras' },
  visibilidade: visibilidadePadrao()
})

/**
 * Registro antigo (só `ts` + `medidas`) não tem `visibilidade`. Tratar a ausência
 * como visível preserva o que o aluno já enxergava — mudar isso faria histórico
 * sumir da tela dele sem ninguém ter pedido.
 */
export function normalizarAvaliacao(a) {
  if (!a) return null
  const vis = a.visibilidade || {}
  const padrao = visibilidadePadrao()
  return {
    ...a,
    tipo: a.tipo || 'reavaliacao',
    medidas: a.medidas || {},
    anamnese: a.anamnese || {},
    dobras: a.dobras || {},
    bio: a.bio || {},
    resumo: a.resumo || {},
    visibilidade: {
      alunoPodeVer: vis.alunoPodeVer !== false,
      blocos: { ...padrao.blocos, ...(vis.blocos || {}) }
    }
  }
}

export const alunoVe = (aval, bloco) => {
  const a = normalizarAvaliacao(aval)
  return !!a && a.visibilidade.alunoPodeVer && a.visibilidade.blocos[bloco] !== false
}

/**
 * Recalcula o que dá e monta o resumo. Roda no save, sempre — assim um registro
 * salvo pela metade e completado depois fica consistente sem passo manual.
 */
export function prepararParaSalvar(form, { personalId, sexo, nascimento }) {
  const medidas = {}
  CAMPOS_MEDIDAS.forEach(([campo]) => {
    const v = num(form.medidas?.[campo])
    if (v !== null) medidas[campo] = v
  })
  const pa = String(form.medidas?.pressaoArterial || '').trim()
  if (pa) medidas.pressaoArterial = pa
  const fc = num(form.medidas?.fcRepouso)
  if (fc !== null) medidas.fcRepouso = fc

  const imc = calcularIMC(medidas.peso, medidas.altura)
  const rcq = calcularRCQ(medidas.cintura, medidas.quadril)
  if (imc !== null) medidas.imc = imc
  if (rcq !== null) medidas.rcq = rcq

  // Dobras
  const dSexo = form.dobras?.sexo || sexo
  const dIdade = num(form.dobras?.idade) ?? idadeDe(nascimento)
  const pontos = {}
  PONTOS_DOBRAS.forEach(([p]) => {
    const v = num(form.dobras?.pontos?.[p])
    if (v !== null) pontos[p] = v
  })
  const { soma, percentual } = gorduraPorDobras({
    protocolo: form.dobras?.protocolo || '3', pontos, sexo: dSexo, idade: dIdade
  })
  const pctDobras = percentual ?? num(form.dobras?.percentualGordura)
  const compDobras = composicao(medidas.peso, pctDobras)

  const dobras = {}
  if (Object.keys(pontos).length || pctDobras !== null) {
    Object.assign(dobras, {
      protocolo: form.dobras?.protocolo || '3',
      equacao: form.dobras?.equacao || 'Pollock · Siri',
      pontos
    })
    if (dSexo) dobras.sexo = dSexo
    if (dIdade !== null) dobras.idade = dIdade
    if (soma !== null) dobras.soma = soma
    if (pctDobras !== null) dobras.percentualGordura = pctDobras
    if (compDobras.massaGordaKg !== null) dobras.massaGordaKg = compDobras.massaGordaKg
    if (compDobras.massaMagraKg !== null) dobras.massaMagraKg = compDobras.massaMagraKg
  }

  // Bioimpedância
  const bio = {}
  const aparelho = String(form.bio?.aparelho || '').trim()
  if (aparelho) bio.aparelho = aparelho
  CAMPOS_BIO.forEach(([campo]) => {
    const v = num(form.bio?.[campo])
    if (v !== null) bio[campo] = v
  })
  const obsBio = String(form.bio?.obs || '').trim()
  if (obsBio) bio.obs = obsBio

  // Resumo: a fonte escolhida manda; se ela estiver vazia, cai na outra.
  const fonte = form.resumo?.fonteGordura || 'dobras'
  const pctManual = num(form.resumo?.percentualGordura)
  const pct = fonte === 'bio' ? (bio.gorduraPct ?? pctDobras)
    : fonte === 'manual' ? (pctManual ?? pctDobras ?? bio.gorduraPct)
      : (pctDobras ?? bio.gorduraPct)

  const magraFonte = fonte === 'bio' ? (bio.massaMagra ?? compDobras.massaMagraKg)
    : (compDobras.massaMagraKg ?? bio.massaMagra)
  const magra = magraFonte ?? composicao(medidas.peso, pct).massaMagraKg

  const resumo = { fonteGordura: fonte }
  if (medidas.peso) resumo.peso = medidas.peso
  if (imc !== null) resumo.imc = imc
  if (pct !== null && pct !== undefined) resumo.percentualGordura = pct
  if (magra !== null && magra !== undefined) resumo.massaMagra = magra
  if (medidas.cintura) resumo.cintura = medidas.cintura
  if (rcq !== null) resumo.rcq = rcq

  const anamnese = limparVazios(form.anamnese || {})

  const doc = {
    ts: Number(form.ts) || Date.now(),
    tipo: form.tipo || 'reavaliacao',
    personalId,
    medidas,
    resumo,
    visibilidade: form.visibilidade || visibilidadePadrao(),
    atualizadoEm: Date.now()
  }
  const obs = String(form.observacoesGerais || '').trim()
  if (obs) doc.observacoesGerais = obs
  if (Object.keys(anamnese).length) doc.anamnese = anamnese
  if (Object.keys(dobras).length) doc.dobras = dobras
  if (Object.keys(bio).length) doc.bio = bio
  if (!form.criadoEm) doc.criadoEm = Date.now()
  else doc.criadoEm = form.criadoEm
  return doc
}

/** Tira strings vazias e objetos vazios — o Realtime DB não guarda undefined. */
function limparVazios(obj) {
  const saida = {}
  Object.entries(obj).forEach(([k, v]) => {
    if (v === '' || v === null || v === undefined) return
    if (typeof v === 'object' && !Array.isArray(v)) {
      const dentro = limparVazios(v)
      if (Object.keys(dentro).length) saida[k] = dentro
      return
    }
    saida[k] = v
  })
  return saida
}

/* ---------------- evolução ---------------- */

export const METRICAS = [
  { id: 'peso', rotulo: 'Peso', unidade: ' kg', casas: 1, melhor: null },
  { id: 'percentualGordura', rotulo: '% de gordura', unidade: '%', casas: 1, melhor: 'menor' },
  { id: 'cintura', rotulo: 'Cintura', unidade: ' cm', casas: 1, melhor: 'menor' },
  { id: 'massaMagra', rotulo: 'Massa magra', unidade: ' kg', casas: 1, melhor: 'maior' }
]

/**
 * Série de uma métrica ao longo das avaliações.
 * Lê de `resumo` e cai para `medidas` — registros antigos só têm `medidas`, e sem
 * essa queda o histórico anterior ao módulo sumiria do gráfico.
 */
export function serieMetrica(lista, metrica) {
  return lista
    .map(a => {
      const n = normalizarAvaliacao(a)
      let v = n.resumo?.[metrica]
      if (v === undefined || v === null) v = n.medidas?.[metrica]
      const valor = num(v)
      return valor === null ? null : { ts: n.ts, valor, fonte: n.resumo?.fonteGordura || null }
    })
    .filter(Boolean)
    .sort((a, b) => a.ts - b.ts)
}

/** Primeiro → último, para o cartão de variação. */
export function variacao(serie) {
  if (!serie || serie.length < 2) return null
  const delta = serie[serie.length - 1].valor - serie[0].valor
  return arred(delta, 1)
}

/** Verdadeiro quando a série de % de gordura mistura dobras e bioimpedância. */
export function fontesMisturadas(serie) {
  const fontes = new Set(serie.map(p => p.fonte).filter(Boolean))
  return fontes.size > 1
}
