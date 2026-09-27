/*
  Duas formas para o mesmo papel — escolher entre opções que se excluem.

  `Abas` troca a seção visível (Treinos / Evolução dentro de um aluno).
  `Pilulas` filtra uma lista que continua a mesma (Todos / Ativos / Pendentes).

  Parecem iguais e não são: aba navega, pílula restringe. Usar uma no lugar da
  outra faz a pessoa achar que perdeu conteúdo quando só filtrou.
*/
export function Abas({ itens, valor, aoTrocar, rotulo = 'Seções' }) {
  return (
    <div className="ui-abas" role="tablist" aria-label={rotulo}>
      {itens.map(it => (
        <button
          key={it.id}
          role="tab"
          aria-selected={valor === it.id}
          className="ui-aba"
          onClick={() => aoTrocar(it.id)}
        >
          {it.rotulo}
        </button>
      ))}
    </div>
  )
}

export function Pilulas({ itens, valor, aoTrocar, rotulo = 'Filtros' }) {
  return (
    <div className="ui-pilulas" role="group" aria-label={rotulo}>
      {itens.map(it => (
        <button
          key={it.id}
          aria-pressed={valor === it.id}
          className="ui-pilula"
          onClick={() => aoTrocar(it.id)}
        >
          {it.rotulo}
          {/* Contagem 0 não aparece: pílula que promete "0" é um caminho para
              lugar nenhum, e ocupa o mesmo espaço de uma que leva a algo. */}
          {it.n > 0 && <span className="ui-pilula-n">{it.n}</span>}
        </button>
      ))}
    </div>
  )
}
