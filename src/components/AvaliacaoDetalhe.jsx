import { CAMPOS_MEDIDAS, rotuloMedida } from '../lib/medidas'
import {
  TIPOS, CAMPOS_ANAMNESE, CAMPOS_PARQ, PONTOS_DOBRAS, CAMPOS_BIO,
  normalizarAvaliacao, alunoVe, classificarIMC
} from '../lib/avaliacao'
import { IcAlerta } from './Icones.jsx'

/*
  Uma avaliação, em leitura.

  `comoAluno` é o único interruptor: com ele ligado, cada bloco só aparece se o
  personal tiver liberado. O personal vê tudo, sempre.
*/

const fmt = (v, casas = 1) =>
  typeof v === 'number' ? v.toFixed(casas).replace('.', ',') : String(v ?? '')

const dataLonga = ts =>
  new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

function Grade({ itens }) {
  if (!itens.length) return null
  return (
    <div className="av-grade">
      {itens.map(([rotulo, valor]) => (
        <div key={rotulo} className="av-item">
          <span className="av-rot">{rotulo}</span>
          <span className="av-val">{valor}</span>
        </div>
      ))}
    </div>
  )
}

export default function AvaliacaoDetalhe({ avaliacao, comoAluno = false }) {
  const a = normalizarAvaliacao(avaliacao)
  if (!a) return null

  const ve = bloco => (comoAluno ? alunoVe(a, bloco) : true)
  const tipo = TIPOS.find(t => t.id === a.tipo)?.rotulo || 'Avaliação'

  /* ---- resumo ---- */
  const r = a.resumo || {}
  const cartoes = [
    r.peso && ['Peso', fmt(r.peso) + ' kg'],
    r.imc && ['IMC', fmt(r.imc) + ' · ' + classificarIMC(r.imc)],
    (r.percentualGordura ?? null) !== null && ['Gordura', fmt(r.percentualGordura) + '%'],
    r.massaMagra && ['Massa magra', fmt(r.massaMagra) + ' kg'],
    r.cintura && ['Cintura', fmt(r.cintura) + ' cm'],
    r.rcq && ['Cintura/quadril', fmt(r.rcq, 2)]
  ].filter(Boolean)

  /* ---- medidas ---- */
  const circ = CAMPOS_MEDIDAS
    .filter(([campo]) => campo !== 'peso' && campo !== 'altura')
    .map(([campo, rot]) => a.medidas[campo] ? [rot, fmt(a.medidas[campo]) + ' cm'] : null)
    .filter(Boolean)

  const basicas = [
    a.medidas.peso && ['Peso', fmt(a.medidas.peso) + ' kg'],
    a.medidas.altura && ['Altura', fmt(a.medidas.altura, 0) + ' cm'],
    a.medidas.pressaoArterial && ['Pressão arterial', a.medidas.pressaoArterial],
    a.medidas.fcRepouso && ['FC de repouso', fmt(a.medidas.fcRepouso, 0) + ' bpm']
  ].filter(Boolean)

  /* ---- dobras ---- */
  const d = a.dobras || {}
  const pontosD = PONTOS_DOBRAS
    .map(([id, rot]) => d.pontos?.[id] ? [rot, fmt(d.pontos[id]) + ' mm'] : null)
    .filter(Boolean)
  const resultD = [
    d.soma && ['Soma das dobras', fmt(d.soma) + ' mm'],
    d.percentualGordura && ['Gordura', fmt(d.percentualGordura) + '%'],
    d.massaGordaKg && ['Massa gorda', fmt(d.massaGordaKg) + ' kg'],
    d.massaMagraKg && ['Massa magra', fmt(d.massaMagraKg) + ' kg']
  ].filter(Boolean)

  /* ---- bio ---- */
  const b = a.bio || {}
  const itensBio = CAMPOS_BIO
    .map(([id, rot]) => (b[id] ?? null) !== null ? [rot, fmt(b[id])] : null)
    .filter(Boolean)

  /* ---- anamnese ---- */
  const an = a.anamnese || {}
  const respostas = CAMPOS_ANAMNESE
    .map(c => {
      const v = an[c.id]
      if (v === undefined || v === null || v === '') return null
      return [c.rotulo, c.tipo === 'sim_nao' ? (v === true || v === 'sim' ? 'Sim' : 'Não') : String(v)]
    })
    .filter(Boolean)
  const parqSim = CAMPOS_PARQ.filter(([id]) => an.parq?.[id] === true || an.parq?.[id] === 'sim')

  const temAlgo = cartoes.length || basicas.length || circ.length ||
    pontosD.length || itensBio.length || respostas.length || a.observacoesGerais

  return (
    <div className="av-detalhe">
      <header className="av-cab">
        <div>
          <span className="av-tipo">{tipo}</span>
          <h3>{dataLonga(a.ts)}</h3>
        </div>
      </header>

      {!temAlgo && <p className="muted">Esta avaliação ainda não tem dados registrados.</p>}

      {ve('resumo') && cartoes.length > 0 && (
        <section className="av-bloco">
          <div className="av-cartoes">
            {cartoes.map(([rot, val]) => (
              <div key={rot} className="av-cartao">
                <span>{rot}</span>
                <strong>{val}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {ve('medidas') && (basicas.length > 0 || circ.length > 0) && (
        <section className="av-bloco">
          <h4>Medidas</h4>
          <Grade itens={basicas} />
          {circ.length > 0 && (
            <>
              <p className="av-sub">Circunferências</p>
              <Grade itens={circ} />
            </>
          )}
        </section>
      )}

      {ve('dobras') && (pontosD.length > 0 || resultD.length > 0) && (
        <section className="av-bloco">
          <h4>Dobras cutâneas</h4>
          {d.equacao && <p className="av-sub">{d.equacao}{d.idade ? ` · ${d.idade} anos` : ''}</p>}
          <Grade itens={pontosD} />
          {resultD.length > 0 && (
            <>
              <p className="av-sub">Resultado</p>
              <Grade itens={resultD} />
            </>
          )}
        </section>
      )}

      {ve('bio') && itensBio.length > 0 && (
        <section className="av-bloco">
          <h4>Bioimpedância</h4>
          {b.aparelho && <p className="av-sub">{b.aparelho}</p>}
          <Grade itens={itensBio} />
          {b.obs && <p className="av-obs">{b.obs}</p>}
        </section>
      )}

      {ve('anamnese') && (respostas.length > 0 || parqSim.length > 0) && (
        <section className="av-bloco">
          <h4>Anamnese</h4>
          {parqSim.length > 0 && (
            <div className="av-parq">
              <IcAlerta />
              <div>
                <strong>Atenção no PAR-Q</strong>
                <ul>{parqSim.map(([id, texto]) => <li key={id}>{texto}</li>)}</ul>
              </div>
            </div>
          )}
          <Grade itens={respostas} />
        </section>
      )}

      {ve('observacoesGerais') && a.observacoesGerais && (
        <section className="av-bloco">
          <h4>Observações</h4>
          <p className="av-obs">{a.observacoesGerais}</p>
        </section>
      )}

      {comoAluno && (
        <p className="mini av-nota-aluno">
          Seu personal escolhe o que aparece aqui. Faltando algo, fale com ele.
        </p>
      )}
    </div>
  )
}
