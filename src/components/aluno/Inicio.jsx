import { IcCheck, IcHalter, IcSeta } from '../Icones.jsx'

/*
  A Home do aluno.

  Regra que guiou o desenho: UM foco por vez. Antes o app abria direto na
  execução do treino — útil na hora de treinar, e desorientador nas outras
  vinte horas do dia, quando a pergunta é "o que eu preciso fazer agora?" e a
  resposta pode ser uma dose, um check-in, uma mensagem ou uma cobrança.

  Por que não é uma pilha de cards: seis assuntos em seis caixas empurram tudo
  para baixo da dobra e obrigam a pessoa a ler a tela inteira para achar o que
  importa. Aqui são três níveis de informação — um bloco grande para o foco, uma
  LISTA de linhas para as pendências, e chips para o resto. Bloco que não tem
  conteúdo não aparece; nada anuncia que está vazio.

  Quem decide o que entra e em que ordem é `src/lib/painel.js`.
*/
export default function Inicio({ painel, resumo, proximo, onIr, carregando, erro }) {
  if (carregando) {
    return (
      <div className="in">
        <div className="in-esqueleto" aria-label="Carregando seu painel" />
        <div className="in-esqueleto curto" />
      </div>
    )
  }

  const { saudacao, foco, pendencias, atalhos, tudoEmDia } = painel

  return (
    <div className="in">
      <header className="in-topo">
        <h2>{saudacao.texto}</h2>
        <p>{saudacao.data}</p>
      </header>

      {erro && <div className="erro">{erro}</div>}

      {/* ---------- O foco: a única coisa grande da tela ---------- */}
      <section className={'in-foco ' + foco.tipo}>
        <span className="in-foco-rot">
          {foco.tipo === 'bloqueado' ? 'Precisa resolver'
            : foco.tipo === 'descanso' ? 'Hoje'
            : foco.tipo === 'treino_concluido' ? 'Feito'
            : foco.tipo === 'sem_plano' ? 'Seu treino'
            : 'Seu dia'}
        </span>

        <h3>
          {foco.tipo === 'treino_concluido' && <IcCheck />}
          {foco.titulo}
        </h3>
        <p className="in-foco-sub">{foco.subtitulo}</p>

        {typeof foco.progresso === 'number' && foco.progresso > 0 && foco.progresso < 100 && (
          <div className="in-barra">
            <div className="in-barra-fill" style={{ width: foco.progresso + '%' }} />
          </div>
        )}

        {foco.acao && (
          <button className="btn in-foco-btn" onClick={() => onIr(foco.acao.aba)}>
            {foco.acao.rotulo}
          </button>
        )}
      </section>

      {/* ---------- Pendências: uma linha cada, não um card cada ---------- */}
      {pendencias.length > 0 && (
        <section className="in-bloco">
          <h4>Precisa de você</h4>
          <ul className="in-pend">
            {pendencias.map(p => (
              <li key={p.id} className={p.urgente ? 'urgente' : ''}>
                <button className="in-pend-linha" onClick={() => onIr(p.acao.aba)}>
                  <span className="in-pend-marca" aria-hidden="true" />
                  <span className="in-pend-txt">
                    <strong>{p.titulo}</strong>
                    <span>{p.detalhe}</span>
                  </span>
                  <span className="in-pend-acao">{p.acao.rotulo} <IcSeta /></span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {tudoEmDia && (
        <p className="in-em-dia">
          <IcCheck /> Nada pendente. Seu dia está resolvido.
        </p>
      )}

      {/* ---------- Duas colunas no desktop, empilhadas no celular ---------- */}
      <div className="in-duplo">
        {resumo && (
          <section className="in-bloco">
            <h4>Seu mês</h4>
            <div className="in-nums">
              <div>
                <strong>{resumo.treinos}</strong>
                <span>{resumo.treinos === 1 ? 'treino' : 'treinos'}</span>
              </div>
              <div>
                <strong>{resumo.sequencia}</strong>
                <span>{resumo.sequencia === 1 ? 'dia seguido' : 'dias seguidos'}</span>
              </div>
              {resumo.recordes > 0 && (
                <div>
                  <strong>{resumo.recordes}</strong>
                  <span>{resumo.recordes === 1 ? 'recorde' : 'recordes'}</span>
                </div>
              )}
            </div>
            <button className="in-link" onClick={() => onIr('evolucao')}>
              Ver evolução <IcSeta />
            </button>
          </section>
        )}

        {proximo && (
          <section className="in-bloco">
            <h4>Próximo treino</h4>
            <div className="in-proximo">
              <span className="in-proximo-icone"><IcHalter /></span>
              <div>
                <strong>{proximo.nome}</strong>
                <span>{proximo.quando}</span>
              </div>
            </div>
          </section>
        )}
      </div>

      {/* ---------- Atalhos: o que não tem botão em lugar nenhum acima ---------- */}
      {atalhos.length > 0 && (
        <nav className="in-atalhos" aria-label="Atalhos">
          {atalhos.map(a => (
            <button key={a.id} className="in-atalho" onClick={() => onIr(a.aba)}>
              {a.rotulo}
            </button>
          ))}
        </nav>
      )}
    </div>
  )
}
