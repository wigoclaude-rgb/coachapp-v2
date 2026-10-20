/*
  Rodadas do bi-set e leitura das repetições prescritas.

  DUAS COISAS QUE A TELA NÃO DAVA CONTA SOZINHA

  1. BI-SET ERA SÓ ENFEITE. `agruparBlocos` já marcava `combinado: true` para
     exercícios vizinhos com o mesmo `grupo`, mas a lista usava isso apenas para
     desenhar a borda tracejada e a etiqueta. Embaixo, cada exercício ganhava
     tabela e botão próprios — e o aluno tinha que marcar duas vezes o que fez
     de uma vez só. O `ExecucaoTreino.jsx` já fazia certo (uma ação marcava o
     bloco inteiro); a lógica se perdeu quando a execução virou inline.

  2. AS REPETIÇÕES NUNCA FORAM GRAVADAS. O plano guarda `reps` como texto livre
     ("6-8", "12", "até a falha") e `execucoes` só registrava o peso. O personal
     pedia 6-8 e nunca ficava sabendo se foram 6 ou 8 — e em exercício de carga
     livre, como flexão, as repetições são a ÚNICA medida de progresso que existe.

  REGRA DO CAMPO VAZIO
  Campo em branco quer dizer "fiz o que foi pedido", e não "não sei". É a mesma
  regra da carga, que já cai no valor do plano quando ninguém digita nada. Quem
  fez diferente digita; quem cumpriu não precisa tocar em nada no meio da série.
*/

/**
 * Lê as repetições que o personal escreveu.
 *
 * O campo é texto livre de propósito — "6-8", "12", "até a falha", "máximo" são
 * todos prescrições válidas que personais escrevem. Aqui só os formatos
 * numéricos viram alvo; o resto devolve `null` e a tela não preenche nem
 * compara nada. Chutar um número onde está escrito "até a falha" seria pior do
 * que não ter o dado.
 *
 * `sugerido` é o ALTO do intervalo: "6-8" pede para buscar 8, e 6 é o que se
 * aceita. Preencher com 6 convidaria a parar no mínimo.
 */
export function repsAlvo(texto) {
  const cru = String(texto ?? '').trim()
  if (!cru) return null

  const numeros = cru.match(/\d+/g)
  if (!numeros) return null

  // Só trata como intervalo quando o texto é mesmo "n-m" / "n a m".
  const intervalo = /^\s*(\d+)\s*(?:-|–|a|até)\s*(\d+)\s*$/i.exec(cru)
  if (intervalo) {
    const a = Number(intervalo[1]), b = Number(intervalo[2])
    const min = Math.min(a, b), max = Math.max(a, b)
    return { min, max, sugerido: max, legivel: cru }
  }

  // Número solto ("12", "12 reps"): alvo exato.
  const unico = /^\s*(\d+)\s*(reps?|repetições|repeticoes|x)?\s*$/i.exec(cru)
  if (unico) {
    const n = Number(unico[1])
    return { min: n, max: n, sugerido: n, legivel: cru }
  }

  return null
}

/** O que gravar quando o aluno não digitou nada. Null = sem alvo legível. */
export function repsParaGravar(digitado, textoDoPlano) {
  if (digitado !== undefined && digitado !== null && String(digitado).trim() !== '') {
    const n = Number(digitado)
    return Number.isFinite(n) && n > 0 ? n : null
  }
  return repsAlvo(textoDoPlano)?.sugerido ?? null
}

/**
 * Fez menos do que o combinado?
 *
 * Compara com o MÍNIMO, não com o sugerido: num "6-8", fazer 6 é cumprir. Só
 * abaixo de 6 é que o personal precisa saber.
 */
export function abaixoDoAlvo(feitas, textoDoPlano) {
  const alvo = repsAlvo(textoDoPlano)
  const n = Number(feitas)
  if (!alvo || !Number.isFinite(n) || n <= 0) return false
  return n < alvo.min
}

/**
 * As rodadas de um bloco.
 *
 * Um bi-set é UMA série de cada exercício, em sequência, e só então o descanso.
 * Por isso a unidade aqui é a rodada, não o exercício.
 *
 * Os exercícios de um bloco PODEM ter contagens diferentes (4 e 3, por
 * exemplo). A rodada que sobra fica só com quem ainda tem série — cortar pelo
 * menor apagaria série que o personal prescreveu, e inventar uma linha para
 * quem não tem pediria um exercício que ninguém mandou fazer.
 *
 * Devolve, por rodada, uma entrada por exercício; `linha: null` marca quem já
 * terminou e vira um traço na tela.
 */
export function rodadasDoBloco(bloco) {
  const exercicios = bloco?.exercicios || []
  const total = Math.max(0, ...exercicios.map(e => e.linhas?.length || 0))

  return Array.from({ length: total }, (_, i) => ({
    numero: i + 1,
    itens: exercicios.map(ex => ({
      exercicio: ex,
      serie: i + 1,
      linha: ex.linhas?.[i] || null
    })),
    /* O descanso da rodada é o maior entre os exercícios dela: numa dupla de
       60s e 90s, parar aos 60 encurtaria o descanso que o personal pediu. */
    descanso: Math.max(0, ...exercicios.map(e => Number(e.linhas?.[i]?.descanso) || 0))
  }))
}

/** A rodada está inteira concluída? Entrada sem linha não impede. */
export function rodadaCompleta(rodada, feitas, chave) {
  return (rodada?.itens || []).every(
    it => !it.linha || !!feitas[chave(it.exercicio.nome, it.serie)]
  )
}

/** Primeira rodada com algo pendente — é onde o treino continua. */
export function rodadaDaVez(rodadas, feitas, chave) {
  return (rodadas || []).find(r => !rodadaCompleta(r, feitas, chave)) || null
}
