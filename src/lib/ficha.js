/*
  Ficha de cadastro que o personal envia para o aluno preencher antes de virar conta.

  Fluxo:
    1. personal manda o link /ficha/{codigoPersonal}
    2. aluno preenche sem login  ->  grava em fichas/{personalId}/{id}
    3. personal abre "Fichas recebidas" e clica em Criar aluno com estes dados
*/

/** Campos da ficha. `secao` agrupa na tela; `obrigatorio` valida no envio. */
export const CAMPOS_FICHA = [
  { id: 'nome', rotulo: 'Nome completo', tipo: 'texto', secao: 'Seus dados', obrigatorio: true },
  { id: 'email', rotulo: 'E-mail', tipo: 'email', secao: 'Seus dados', obrigatorio: true, ajuda: 'Vai ser usado para recuperar a senha.' },
  { id: 'telefone', rotulo: 'Telefone / WhatsApp', tipo: 'tel', secao: 'Seus dados' },
  { id: 'nascimento', rotulo: 'Data de nascimento', tipo: 'data', secao: 'Seus dados' },
  { id: 'sexo', rotulo: 'Sexo', tipo: 'opcoes', secao: 'Seus dados', opcoes: ['Feminino', 'Masculino', 'Prefiro não informar'] },

  { id: 'objetivo', rotulo: 'Qual seu objetivo?', tipo: 'opcoes', secao: 'Objetivo', obrigatorio: true,
    opcoes: ['Emagrecer', 'Ganhar massa', 'Condicionamento', 'Saúde e qualidade de vida', 'Reabilitação'] },
  { id: 'experiencia', rotulo: 'Já treinou antes?', tipo: 'opcoes', secao: 'Objetivo',
    opcoes: ['Nunca treinei', 'Menos de 6 meses', 'De 6 meses a 2 anos', 'Mais de 2 anos'] },
  { id: 'frequencia', rotulo: 'Quantos dias por semana pode treinar?', tipo: 'opcoes', secao: 'Objetivo',
    opcoes: ['2', '3', '4', '5', '6'] },

  { id: 'peso', rotulo: 'Peso (kg)', tipo: 'numero', secao: 'Medidas atuais' },
  { id: 'altura', rotulo: 'Altura (cm)', tipo: 'numero', secao: 'Medidas atuais' },

  { id: 'lesao', rotulo: 'Tem alguma lesão ou dor?', tipo: 'longo', secao: 'Saúde',
    ajuda: 'Descreva onde e há quanto tempo. Se não tiver, deixe em branco.' },
  { id: 'condicao', rotulo: 'Alguma condição de saúde ou medicação contínua?', tipo: 'longo', secao: 'Saúde' },
  { id: 'restricao', rotulo: 'Algum exercício que não pode fazer?', tipo: 'longo', secao: 'Saúde' },
  { id: 'observacoes', rotulo: 'Mais alguma coisa que eu deva saber?', tipo: 'longo', secao: 'Saúde' }
]

/** Seções na ordem em que aparecem, sem repetir. */
export const SECOES_FICHA = [...new Set(CAMPOS_FICHA.map(c => c.secao))]

/** Objeto vazio com todos os campos, pronto para o estado do formulário. */
export const respostasVazias = () =>
  Object.fromEntries(CAMPOS_FICHA.map(c => [c.id, '']))

/** Lista de rótulos que faltam preencher. Vazia = pode enviar. */
export function validarFicha(respostas) {
  return CAMPOS_FICHA
    .filter(c => c.obrigatorio && !String(respostas[c.id] ?? '').trim())
    .map(c => c.rotulo)
}

/**
 * Converte as respostas da ficha nos campos do perfil do aluno.
 * O que não cabe no perfil vira uma anotação única, para o personal não perder nada.
 */
export function fichaParaAluno(respostas) {
  const r = respostas || {}
  // Histórico de treino primeiro, depois saúde — é a ordem em que o personal lê.
  const anotacoes = ['experiencia', 'frequencia', 'lesao', 'condicao', 'restricao', 'observacoes']
    .map(id => {
      const valor = String(r[id] ?? '').trim()
      if (!valor) return null
      return `${CAMPOS_FICHA.find(c => c.id === id).rotulo}: ${valor}`
    })
    .filter(Boolean)
    .join('\n')

  return {
    nome: String(r.nome || '').trim(),
    email: String(r.email || '').trim().toLowerCase(),
    telefone: String(r.telefone || '').trim(),
    nascimento: String(r.nascimento || '').trim(),
    sexo: String(r.sexo || '').trim(),
    objetivo: String(r.objetivo || '').trim(),
    anotacoes
  }
}

/** Medidas iniciais da ficha, no formato de avaliacoes/{alunoId}. */
export function fichaParaMedidas(respostas) {
  const medidas = {}
  ;['peso', 'altura'].forEach(id => {
    const n = Number(respostas?.[id])
    if (Number.isFinite(n) && n > 0) medidas[id] = n
  })
  return medidas
}
