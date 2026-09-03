import { rotuloMomento, faltamPara } from '../../lib/suplementos'
import { IcCheck, IcAlerta, IcRelogio, IcHalter } from '../Icones.jsx'

/*
  A rotina do dia — a parte mais importante da tela.

  Havia um bloco "Agora" separado, em destaque, com um botão de marcar. Ele
  mostrava exatamente o mesmo suplemento que encabeçava esta lista: o mesmo item
  duas vezes, com duas formas de fazer a mesma coisa. O destaque virou estado do
  primeiro item, e a bolinha é o único jeito de marcar.

  A ordem vem de `rotinaDeHoje`: pós-treino primeiro quando houve treino, depois
  atrasada, depois horário mais próximo, e as concluídas por último.
*/
export default function RotinaHoje({
  rotina, podeMarcar, nomeAluno, treinoDeHoje, onMarcar, onDesmarcar, marcando
}) {
  const { itens, dosesFeitas, dosesTotal, pct, tudoFeito, pendentes } = rotina
  if (itens.length === 0) return null

  const emFoco = pendentes[0]?.id

  return (
    <section className="card">
      <div className="card-titulo">
        <div style={{ minWidth: 0 }}>
          <h2>Hoje</h2>
          <p className="mini">
            {podeMarcar
              ? 'Toque na bolinha ao tomar cada dose.'
              : `Quem marca é ${(nomeAluno || 'o aluno').split(' ')[0]}.`}
          </p>
        </div>
      </div>

      <div className="sp-progresso">
        <div className="sp-prog-txt">
          <strong>{dosesFeitas}</strong>
          <span>de {dosesTotal} {dosesTotal === 1 ? 'dose concluída' : 'doses concluídas'}</span>
        </div>
        <div className="sp-barra">
          <div className="sp-barra-fill" style={{ width: pct + '%' }} />
        </div>
      </div>

      {tudoFeito && <p className="sp-tudo-certo"><IcCheck /> Tudo certo por hoje.</p>}

      <ul className="sp-doses">
        {itens.map(s => {
          const foco = s.id === emFoco
          const porTreino = s.frequencia === 'treino' && !!treinoDeHoje

          return (
            <li
              key={s.id}
              className={
                'sp-dose' +
                (s.completo ? ' feita' : '') +
                (s.atrasada ? ' atrasada' : '') +
                (foco ? ' foco' : '')
              }
            >
              {foco && (
                <span className="sp-dose-rot">
                  {porTreino ? 'Treino concluído' : s.atrasada ? 'Atrasada' : 'Próxima'}
                </span>
              )}

              <div className="sp-dose-linha">
                <button
                  type="button"
                  className={'sp-marcar' + (s.completo ? ' feita' : '')}
                  onClick={() => (s.completo ? onDesmarcar(s) : onMarcar(s))}
                  disabled={!podeMarcar || marcando === s.id}
                  aria-pressed={s.completo}
                  aria-label={
                    s.completo
                      ? `Desfazer a dose de ${s.nome}`
                      : `Marcar a dose de ${s.nome} como tomada`
                  }
                >
                  {s.completo && <IcCheck />}
                </button>

                <div className="sp-dose-txt">
                  <span className="sp-dose-nome">{s.nome}</span>
                  <span className="sp-dose-meta">
                    {[s.dose, s.marca].filter(Boolean).join(' · ')}
                  </span>

                  {porTreino && !s.completo && (
                    <span className="sp-dose-treino">
                      <IcHalter /> {treinoDeHoje.nome}
                      {treinoDeHoje.exercicios ? ` · ${treinoDeHoje.exercicios} exercícios` : ''}
                    </span>
                  )}

                  <span className="sp-dose-quando">
                    {s.completo && s.vezesAoDia === 1 && s.hora
                      ? `Tomada às ${s.hora}`
                      : s.completo
                        ? 'Concluída'
                        : porTreino
                          ? rotuloMomento(s.momento)
                          : s.atrasada
                            ? `Programada para ${s.horario} · ainda não marcada`
                            : s.horario
                              ? `Às ${s.horario}${s.minutosAte !== null ? ' · ' + faltamPara(s.minutosAte) : ''}`
                              : 'Sem horário definido'}
                  </span>
                </div>

                <span className="sp-dose-lado">
                  {s.vezesAoDia > 1 && (
                    <span className="sp-contagem">{Math.min(s.feitas, s.vezesAoDia)}/{s.vezesAoDia}</span>
                  )}
                  {s.atrasada && <span className="sp-atraso" title="Horário já passou"><IcAlerta /></span>}
                  {!s.completo && !s.atrasada && s.minutosAte !== null && s.minutosAte <= 60 && (
                    <span className="sp-logo" title="Está perto"><IcRelogio /></span>
                  )}
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
