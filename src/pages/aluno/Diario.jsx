import { useEffect, useMemo, useState } from 'react'
import { ref, onValue, push, set, update, remove } from 'firebase/database'
import { db } from '../../firebase'
import { fmtData } from '../../lib/util'
import { apagarFoto } from '../../lib/fotos'
import { CAMPOS_MEDIDAS, MEDIDAS_RAPIDAS, rotuloMedida, medidasPreenchidas } from '../../lib/medidas'
import FotoInput from '../../components/FotoInput.jsx'
import LineChart from '../../components/LineChart.jsx'
import { IcMais, IcCheck, IcLixeira, IcEvolucao, IcFechar } from '../../components/Icones.jsx'

/**
 * Diário de evolução do aluno. Tudo é opcional — dá para registrar só uma nota.
 *
 * Cada registro nasce PRIVADO. O aluno decide, um por um, o que o personal
 * pode ver (`compartilhado: true`). Quem garante isso de verdade são as regras
 * do Realtime Database, não esta tela.
 */
export default function Diario({ user, perfil }) {
  const [registros, setRegistros] = useState({})
  const [aberto, setAberto] = useState(false)

  const [foto, setFoto] = useState('')
  const [nota, setNota] = useState('')
  const [medidas, setMedidas] = useState({})
  const [compartilhar, setCompartilhar] = useState(false)

  /*
    O personal usa este mesmo diário para acompanhar o próprio corpo, e aí não há
    com quem compartilhar. Sem isso a tela oferece "compartilhar com meu personal"
    para quem é o personal.
  */
  const temPersonal = !!perfil?.personalId
  const [maisMedidas, setMaisMedidas] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [grafico, setGrafico] = useState('peso')
  const [compararA, setCompararA] = useState('')
  const [compararB, setCompararB] = useState('')

  useEffect(() => (
    onValue(ref(db, 'diario/' + user.uid), s => setRegistros(s.val() || {}))
  ), [user.uid])

  const lista = useMemo(() => (
    Object.entries(registros)
      .map(([id, r]) => ({ id, ...r }))
      .sort((a, b) => (b.ts || 0) - (a.ts || 0))
  ), [registros])

  const comFoto = useMemo(() => lista.filter(r => r.foto), [lista])

  /** Medidas que o aluno já usou alguma vez — só essas viram opção no gráfico. */
  const medidasUsadas = useMemo(() => {
    const chaves = new Set()
    lista.forEach(r => Object.keys(r.medidas || {}).forEach(k => chaves.add(k)))
    return CAMPOS_MEDIDAS.filter(([c]) => chaves.has(c))
  }, [lista])

  const pontos = useMemo(() => (
    lista
      .filter(r => r.medidas?.[grafico] != null)
      .sort((a, b) => a.ts - b.ts)
      .map(r => ({ label: fmtData(r.ts).slice(0, 5), valor: Number(r.medidas[grafico]) }))
  ), [lista, grafico])

  const variacao = useMemo(() => {
    if (pontos.length < 2) return null
    const d = pontos[pontos.length - 1].valor - pontos[0].valor
    return { valor: Math.abs(d).toFixed(1), subiu: d > 0, igual: d === 0 }
  }, [pontos])

  function limpar() {
    setFoto(''); setNota(''); setMedidas({})
    setCompartilhar(false); setMaisMedidas(false); setErro('')
  }

  /*
    O que é compartilhado vai para `diarioCompartilhado/{uid}`, um espelho que o
    personal consegue ler. `diario/{uid}` continua fechado só para o aluno.

    Separar em dois nós é o que faz a privacidade valer: as regras do Firebase
    não filtram uma lista, elas liberam ou negam o caminho inteiro. Sem o espelho,
    ou o personal lê tudo, ou não lê nada.
  */
  const caminhoEspelho = id => 'diarioCompartilhado/' + user.uid + '/' + id

  const paraEspelho = r => ({
    ts: r.ts, foto: r.foto || '', nota: r.nota || '', medidas: r.medidas || {},
    alunoNome: perfil?.nome || '', personalId: perfil?.personalId || ''
  })

  async function salvar(e) {
    e.preventDefault()
    const numeros = medidasPreenchidas(medidas)
    const texto = nota.trim()

    if (!foto && !texto && Object.keys(numeros).length === 0) {
      setErro('Escreva algo, coloque uma medida ou adicione uma foto.')
      return
    }

    setSalvando(true)
    try {
      const registro = {
        ts: Date.now(),
        foto: foto || '',
        nota: texto,
        medidas: numeros,
        compartilhado: compartilhar
      }
      const criado = await push(ref(db, 'diario/' + user.uid), registro)
      if (compartilhar) await set(ref(db, caminhoEspelho(criado.key)), paraEspelho(registro))
      limpar()
      setAberto(false)
    } catch (err) {
      setErro('Não foi possível salvar. Tente de novo.')
      console.warn('Falha ao salvar registro do diário:', err)
    }
    setSalvando(false)
  }

  async function alternarCompartilhar(r) {
    const agora = !r.compartilhado
    await update(ref(db, 'diario/' + user.uid + '/' + r.id), { compartilhado: agora })
    if (agora) await set(ref(db, caminhoEspelho(r.id)), paraEspelho(r))
    else await remove(ref(db, caminhoEspelho(r.id)))
  }

  async function apagar(r) {
    if (!confirm('Apagar este registro? Não dá para desfazer.')) return
    await remove(ref(db, 'diario/' + user.uid + '/' + r.id))
    await remove(ref(db, caminhoEspelho(r.id)))
    await apagarFoto(r.foto)
  }

  const a = comFoto.find(r => r.id === compararA)
  const b = comFoto.find(r => r.id === compararB)

  return (
    <>
      <div className="card">
        <div className="card-titulo">
          <div style={{ minWidth: 0 }}>
            <h2>Check-in</h2>
            <p className="mini">
              {temPersonal
                ? <>Só você vê. Compartilhe com {perfil?.nomePersonal || 'seu personal'} o que quiser.</>
                : 'Seu registro de peso, medidas e fotos. Só você vê.'}
            </p>
          </div>
          <button className="btn btn-sm" onClick={() => { setAberto(!aberto); setErro('') }}>
            {aberto ? 'Fechar' : <><IcMais /> Novo registro</>}
          </button>
        </div>

        {aberto && (
          <form onSubmit={salvar} className="diario-form">
            <label>Foto de hoje (opcional)</label>
            <FotoInput
              atual={foto}
              onFoto={setFoto}
              rotulo={foto ? 'Trocar foto' : 'Adicionar foto'}
              pasta={'diario/' + user.uid}
            />

            <label style={{ marginTop: 16 }}>Como foi o dia? (opcional)</label>
            <textarea
              rows={3} value={nota} onChange={e => setNota(e.target.value)}
              placeholder="Energia, sono, alimentação, como se sentiu no treino..."
            />

            <label style={{ marginTop: 16 }}>Medidas (opcional)</label>
            <div className="grid-medidas">
              {CAMPOS_MEDIDAS
                .filter(([campo]) => maisMedidas || MEDIDAS_RAPIDAS.includes(campo))
                .map(([campo, rotulo]) => (
                  <div key={campo}>
                    <label htmlFor={'m-' + campo}>{rotulo}</label>
                    <input
                      id={'m-' + campo} type="number" step="0.1" inputMode="decimal"
                      value={medidas[campo] ?? ''}
                      onChange={e => setMedidas(m => ({ ...m, [campo]: e.target.value }))}
                    />
                  </div>
                ))}
            </div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMaisMedidas(!maisMedidas)}>
              {maisMedidas ? 'Mostrar menos' : 'Mais medidas'}
            </button>

            {temPersonal && (
              <label className="troca-privacidade">
                <input
                  type="checkbox" checked={compartilhar}
                  onChange={e => setCompartilhar(e.target.checked)}
                />
                <span className="tp-caixa" aria-hidden="true"><IcCheck /></span>
                <span className="tp-texto">
                  <strong>Compartilhar com meu personal</strong>
                  <span className="mini">Sem marcar, este registro fica só para você.</span>
                </span>
              </label>
            )}

            {erro && <div className="erro">{erro}</div>}

            <button className="btn" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar registro'}
            </button>
          </form>
        )}
      </div>

      {medidasUsadas.length > 0 && (
        <div className="card">
          <div className="card-titulo"><h2>Sua evolução</h2></div>
          <label>Medida</label>
          <select value={grafico} onChange={e => setGrafico(e.target.value)}>
            {medidasUsadas.map(([campo, rotulo]) => <option key={campo} value={campo}>{rotulo}</option>)}
          </select>

          {pontos.length < 2 ? (
            <p className="muted" style={{ marginTop: 14 }}>
              Registre {rotuloMedida(grafico).toLowerCase()} mais uma vez para ver o gráfico.
            </p>
          ) : (
            <>
              {variacao && (
                <p className="mini" style={{ marginTop: 10 }}>
                  {variacao.igual
                    ? 'Sem mudança desde o primeiro registro.'
                    : `${variacao.subiu ? 'Subiu' : 'Baixou'} ${variacao.valor} desde o primeiro registro.`}
                </p>
              )}
              <div style={{ marginTop: 14 }}><LineChart pontos={pontos} unidade="" /></div>
            </>
          )}
        </div>
      )}

      {comFoto.length >= 2 && (
        <div className="card">
          <div className="card-titulo"><h2>Antes e depois</h2></div>
          <div className="linha-2">
            <div>
              <label>Antes</label>
              <select value={compararA} onChange={e => setCompararA(e.target.value)}>
                <option value="">Escolher</option>
                {comFoto.map(r => <option key={r.id} value={r.id}>{fmtData(r.ts)}</option>)}
              </select>
            </div>
            <div>
              <label>Depois</label>
              <select value={compararB} onChange={e => setCompararB(e.target.value)}>
                <option value="">Escolher</option>
                {comFoto.map(r => <option key={r.id} value={r.id}>{fmtData(r.ts)}</option>)}
              </select>
            </div>
          </div>
          {a && b && (
            <div className="comparar-fotos">
              {[a, b].map((r, i) => (
                <figure key={i}>
                  <img src={r.foto} alt={'Registro de ' + fmtData(r.ts)} loading="lazy" />
                  <figcaption>
                    {fmtData(r.ts)}
                    {r.medidas?.peso != null && <> · {r.medidas.peso} kg</>}
                  </figcaption>
                </figure>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="section-title">
        {lista.length === 0 ? 'Linha do tempo' : `Linha do tempo · ${lista.length} registro${lista.length === 1 ? '' : 's'}`}
      </div>

      {lista.length === 0 ? (
        <div className="card">
          <div className="vazio-estado">
            <div className="ve-icone"><IcEvolucao /></div>
            <h2>Nada registrado ainda</h2>
            <p className="muted">
              Anote como foi o dia, tire uma foto ou marque seu peso. Nada é obrigatório
              {temPersonal ? ' e nada aparece para o seu personal sem você marcar.' : '.'}
            </p>
          </div>
        </div>
      ) : lista.map(r => (
        <div key={r.id} className="card diario-registro">
          <div className="dr-topo">
            <span className="dr-data">{fmtData(r.ts)}</span>
            {temPersonal && (
              <span className={'badge ' + (r.compartilhado ? 'primaria' : '')}>
                {r.compartilhado ? 'Compartilhado' : 'Privado'}
              </span>
            )}
          </div>

          {r.foto && <img src={r.foto} alt="" className="dr-foto" loading="lazy" />}
          {r.nota && <p className="dr-nota">{r.nota}</p>}

          {r.medidas && Object.keys(r.medidas).length > 0 && (
            <div className="dr-medidas">
              {Object.entries(r.medidas).map(([campo, valor]) => (
                <span key={campo} className="dr-medida">
                  <span className="dm-rotulo">{rotuloMedida(campo).replace(/\s*\(.*\)/, '')}</span>
                  <span className="dm-valor">{valor}</span>
                </span>
              ))}
            </div>
          )}

          <div className="dr-acoes">
            {temPersonal && (
              <button className="btn btn-ghost btn-sm" onClick={() => alternarCompartilhar(r)}>
                {r.compartilhado ? <><IcFechar /> Tornar privado</> : <><IcCheck /> Compartilhar</>}
              </button>
            )}
            <span className="espaco" />
            <button className="btn btn-perigo-sutil btn-sm" onClick={() => apagar(r)}>
              <IcLixeira /> Apagar
            </button>
          </div>
        </div>
      ))}
    </>
  )
}
