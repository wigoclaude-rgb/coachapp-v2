import { useMemo, useState } from 'react'
import { CAMPOS_MEDIDAS } from '../lib/medidas'
import {
  TIPOS, BLOCOS, CAMPOS_ANAMNESE, CAMPOS_PARQ, PONTOS_DOBRAS,
  PONTOS_POR_PROTOCOLO, CAMPOS_BIO, avaliacaoVazia, normalizarAvaliacao,
  calcularIMC, classificarIMC, calcularRCQ, gorduraPorDobras, composicao,
  idadeDe, sexoLetra
} from '../lib/avaliacao'
import { IcCheck } from './Icones.jsx'

/*
  Formulário da avaliação, um bloco por aba.

  Nenhum bloco é obrigatório: avaliação parcial é o caso comum — o personal mede
  circunferência toda semana e dobra uma vez por mês. O que estiver vazio some do
  documento em vez de virar campo nulo.

  Os cálculos aparecem enquanto se digita, e não só no save: ver o IMC mudar é o
  que denuncia altura digitada em metro onde se esperava centímetro.
*/

const ATALHOS = [
  { id: 'so_resumo', rotulo: 'Só resumo',
    vis: { anamnese: false, medidas: false, dobras: false, bio: false, resumo: true, observacoesGerais: false } },
  { id: 'sem_anamnese', rotulo: 'Tudo exceto anamnese',
    vis: { anamnese: false, medidas: true, dobras: true, bio: true, resumo: true, observacoesGerais: true } },
  { id: 'tudo', rotulo: 'Liberar tudo',
    vis: { anamnese: true, medidas: true, dobras: true, bio: true, resumo: true, observacoesGerais: true } }
]

const paraInput = ts => {
  const d = new Date(ts)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

export default function FormAvaliacao({ inicial, aluno, primeira, onSalvar, onCancelar, salvando, erro }) {
  const [f, setF] = useState(() =>
    inicial ? { ...avaliacaoVazia(), ...normalizarAvaliacao(inicial) } : avaliacaoVazia(primeira))
  const [bloco, setBloco] = useState('medidas')

  const set = (campo, valor) => setF(v => ({ ...v, [campo]: valor }))
  const setDe = (grupo, campo, valor) =>
    setF(v => ({ ...v, [grupo]: { ...v[grupo], [campo]: valor } }))
  const setPonto = (ponto, valor) =>
    setF(v => ({ ...v, dobras: { ...v.dobras, pontos: { ...v.dobras.pontos, [ponto]: valor } } }))
  const setParq = (campo, valor) =>
    setF(v => ({ ...v, anamnese: { ...v.anamnese, parq: { ...v.anamnese.parq, [campo]: valor } } }))
  const setBlocoVis = (id, valor) =>
    setF(v => ({ ...v, visibilidade: { ...v.visibilidade, blocos: { ...v.visibilidade.blocos, [id]: valor } } }))

  /* Sexo e idade vêm do cadastro; o campo fica editável para quem não preencheu a ficha. */
  const sexoAluno = f.dobras.sexo || aluno?.sexo || ''
  const idadeAluno = f.dobras.idade || idadeDe(aluno?.nascimento) || ''

  const previa = useMemo(() => {
    const imc = calcularIMC(f.medidas.peso, f.medidas.altura)
    const rcq = calcularRCQ(f.medidas.cintura, f.medidas.quadril)
    const { soma, percentual } = gorduraPorDobras({
      protocolo: f.dobras.protocolo, pontos: f.dobras.pontos, sexo: sexoAluno, idade: idadeAluno
    })
    const comp = composicao(f.medidas.peso, percentual)
    return { imc, rcq, soma, percentual, ...comp }
  }, [f.medidas, f.dobras, sexoAluno, idadeAluno])

  const exigidos = PONTOS_POR_PROTOCOLO[f.dobras.protocolo]?.[sexoLetra(sexoAluno)] || []

  function enviar(e) {
    e.preventDefault()
    onSalvar({ ...f, dobras: { ...f.dobras, sexo: sexoAluno, idade: idadeAluno } })
  }

  const secoesAnamnese = [...new Set(CAMPOS_ANAMNESE.map(c => c.secao))]

  return (
    <form className="card" onSubmit={enviar}>
      <div className="card-titulo">
        <div style={{ minWidth: 0 }}>
          <h2>{inicial ? 'Editar avaliação' : 'Nova avaliação'}</h2>
          <p className="mini">Preencha só o que mediu. O resto fica de fora.</p>
        </div>
      </div>

      <div className="linha-2">
        <div>
          <label htmlFor="av-data">Data</label>
          <input
            id="av-data" type="date" value={paraInput(f.ts)}
            onChange={e => {
              const [a, m, d] = e.target.value.split('-').map(Number)
              if (a && m && d) set('ts', new Date(a, m - 1, d, 12).getTime())
            }}
          />
        </div>
        <div>
          <label htmlFor="av-tipo">Tipo</label>
          <select id="av-tipo" value={f.tipo} onChange={e => set('tipo', e.target.value)}>
            {TIPOS.map(t => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
          </select>
        </div>
      </div>

      <div className="tabs av-tabs">
        {[...BLOCOS.filter(b => b.id !== 'resumo' && b.id !== 'observacoesGerais'),
          { id: 'visibilidade', rotulo: 'Visibilidade' }].map(b => (
          <button
            key={b.id} type="button"
            className={'tab ' + (bloco === b.id ? 'ativa' : '')}
            onClick={() => setBloco(b.id)}
          >
            {b.rotulo}
          </button>
        ))}
      </div>

      {/* ---------------- MEDIDAS ---------------- */}
      {bloco === 'medidas' && (
        <div className="av-form-bloco">
          <div className="linha-2">
            <div>
              <label htmlFor="m-peso">Peso (kg)</label>
              <input id="m-peso" type="number" step="0.1" inputMode="decimal"
                value={f.medidas.peso ?? ''} onChange={e => setDe('medidas', 'peso', e.target.value)} />
            </div>
            <div>
              <label htmlFor="m-altura">Altura (cm)</label>
              <input id="m-altura" type="number" step="0.5" inputMode="decimal"
                value={f.medidas.altura ?? ''} onChange={e => setDe('medidas', 'altura', e.target.value)} />
            </div>
          </div>

          {(previa.imc || previa.rcq) && (
            <div className="av-previa">
              {previa.imc && <span><b>IMC {previa.imc.toFixed(1).replace('.', ',')}</b> · {classificarIMC(previa.imc)}</span>}
              {previa.rcq && <span><b>Cintura/quadril {previa.rcq.toFixed(2).replace('.', ',')}</b></span>}
            </div>
          )}

          <div className="linha-2">
            <div>
              <label htmlFor="m-pa">Pressão arterial</label>
              <input id="m-pa" value={f.medidas.pressaoArterial ?? ''} placeholder="120/80"
                onChange={e => setDe('medidas', 'pressaoArterial', e.target.value)} />
            </div>
            <div>
              <label htmlFor="m-fc">FC de repouso (bpm)</label>
              <input id="m-fc" type="number" inputMode="numeric"
                value={f.medidas.fcRepouso ?? ''} onChange={e => setDe('medidas', 'fcRepouso', e.target.value)} />
            </div>
          </div>

          <p className="av-sub">Circunferências (cm)</p>
          <div className="av-campos">
            {CAMPOS_MEDIDAS.filter(([c]) => c !== 'peso' && c !== 'altura').map(([campo, rot]) => (
              <div key={campo}>
                <label htmlFor={'m-' + campo}>{rot.replace(' (cm)', '')}</label>
                <input
                  id={'m-' + campo} type="number" step="0.1" inputMode="decimal"
                  value={f.medidas[campo] ?? ''}
                  onChange={e => setDe('medidas', campo, e.target.value)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------- DOBRAS ---------------- */}
      {bloco === 'dobras' && (
        <div className="av-form-bloco">
          <div className="linha-2">
            <div>
              <label htmlFor="d-prot">Protocolo</label>
              <select id="d-prot" value={f.dobras.protocolo}
                onChange={e => setDe('dobras', 'protocolo', e.target.value)}>
                <option value="3">Pollock 3 dobras</option>
                <option value="7">Pollock 7 dobras</option>
                <option value="outro">Outro / manual</option>
              </select>
            </div>
            <div>
              <label htmlFor="d-eq">Equação usada</label>
              <input id="d-eq" value={f.dobras.equacao ?? ''}
                onChange={e => setDe('dobras', 'equacao', e.target.value)} />
            </div>
          </div>

          <div className="linha-2">
            <div>
              <label htmlFor="d-sexo">Sexo (para a equação)</label>
              <select id="d-sexo" value={sexoAluno} onChange={e => setDe('dobras', 'sexo', e.target.value)}>
                <option value="">Selecione</option>
                <option value="Feminino">Feminino</option>
                <option value="Masculino">Masculino</option>
              </select>
            </div>
            <div>
              <label htmlFor="d-idade">Idade</label>
              <input id="d-idade" type="number" inputMode="numeric" value={idadeAluno}
                onChange={e => setDe('dobras', 'idade', e.target.value)} />
            </div>
          </div>

          {!sexoLetra(sexoAluno) && (
            <p className="mini av-aviso-inline">
              Sem sexo e idade a equação não roda. Preencha acima ou informe o percentual à mão.
            </p>
          )}

          <p className="av-sub">Dobras (mm){exigidos.length > 0 && ' — as marcadas entram no cálculo'}</p>
          <div className="av-campos">
            {PONTOS_DOBRAS.map(([id, rot]) => {
              const usada = exigidos.includes(id)
              return (
                <div key={id} className={usada ? 'av-campo-usado' : ''}>
                  <label htmlFor={'d-' + id}>{rot}{usada && <span className="av-req">•</span>}</label>
                  <input
                    id={'d-' + id} type="number" step="0.1" inputMode="decimal"
                    value={f.dobras.pontos?.[id] ?? ''}
                    onChange={e => setPonto(id, e.target.value)}
                  />
                </div>
              )
            })}
          </div>

          {previa.percentual !== null && previa.percentual !== undefined ? (
            <div className="av-previa">
              <span><b>Soma {previa.soma} mm</b></span>
              <span><b>Gordura {previa.percentual.toFixed(1).replace('.', ',')}%</b></span>
              {previa.massaMagraKg && <span>Massa magra {previa.massaMagraKg.toFixed(1).replace('.', ',')} kg</span>}
            </div>
          ) : (
            <div>
              <label htmlFor="d-pct">Percentual de gordura à mão (%)</label>
              <input id="d-pct" type="number" step="0.1" inputMode="decimal"
                value={f.dobras.percentualGordura ?? ''}
                onChange={e => setDe('dobras', 'percentualGordura', e.target.value)} />
            </div>
          )}
        </div>
      )}

      {/* ---------------- BIO ---------------- */}
      {bloco === 'bio' && (
        <div className="av-form-bloco">
          <div>
            <label htmlFor="b-ap">Aparelho</label>
            <input id="b-ap" value={f.bio.aparelho ?? ''} placeholder="Ex: InBody 270"
              onChange={e => setDe('bio', 'aparelho', e.target.value)} />
          </div>
          <div className="av-campos">
            {CAMPOS_BIO.map(([id, rot]) => (
              <div key={id}>
                <label htmlFor={'b-' + id}>{rot}</label>
                <input id={'b-' + id} type="number" step="0.1" inputMode="decimal"
                  value={f.bio[id] ?? ''} onChange={e => setDe('bio', id, e.target.value)} />
              </div>
            ))}
          </div>
          <label htmlFor="b-obs">Observação</label>
          <textarea id="b-obs" rows={2} value={f.bio.obs ?? ''}
            onChange={e => setDe('bio', 'obs', e.target.value)} />
        </div>
      )}

      {/* ---------------- ANAMNESE ---------------- */}
      {bloco === 'anamnese' && (
        <div className="av-form-bloco">
          {secoesAnamnese.map(secao => (
            <div key={secao}>
              <p className="av-sub">{secao}</p>
              {CAMPOS_ANAMNESE.filter(c => c.secao === secao).map(c => {
                if (c.dependeDe && f.anamnese[c.dependeDe] !== true) return null
                const v = f.anamnese[c.id]
                return (
                  <div key={c.id} className="av-campo-largo">
                    <label htmlFor={'a-' + c.id}>{c.rotulo}</label>
                    {c.tipo === 'sim_nao' ? (
                      <div className="av-simnao">
                        <button type="button" className={'av-op' + (v === true ? ' ativo' : '')}
                          onClick={() => setDe('anamnese', c.id, true)}>Sim</button>
                        <button type="button" className={'av-op' + (v === false ? ' ativo' : '')}
                          onClick={() => setDe('anamnese', c.id, false)}>Não</button>
                      </div>
                    ) : c.tipo === 'opcoes' ? (
                      <select id={'a-' + c.id} value={v ?? ''}
                        onChange={e => setDe('anamnese', c.id, e.target.value)}>
                        <option value="">Selecione</option>
                        {c.opcoes.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : c.tipo === 'texto' ? (
                      <textarea id={'a-' + c.id} rows={2} value={v ?? ''}
                        onChange={e => setDe('anamnese', c.id, e.target.value)} />
                    ) : (
                      <input id={'a-' + c.id} value={v ?? ''}
                        onChange={e => setDe('anamnese', c.id, e.target.value)} />
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          <p className="av-sub">PAR-Q</p>
          {CAMPOS_PARQ.map(([id, texto]) => (
            <div key={id} className="av-campo-largo">
              <label>{texto}</label>
              <div className="av-simnao">
                <button type="button" className={'av-op' + (f.anamnese.parq?.[id] === true ? ' ativo alerta' : '')}
                  onClick={() => setParq(id, true)}>Sim</button>
                <button type="button" className={'av-op' + (f.anamnese.parq?.[id] === false ? ' ativo' : '')}
                  onClick={() => setParq(id, false)}>Não</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------------- VISIBILIDADE ---------------- */}
      {bloco === 'visibilidade' && (
        <div className="av-form-bloco">
          <label className="troca-privacidade">
            <input type="checkbox" checked={f.visibilidade.alunoPodeVer}
              onChange={e => set('visibilidade', { ...f.visibilidade, alunoPodeVer: e.target.checked })} />
            <span className="tp-caixa" aria-hidden="true"><IcCheck /></span>
            <span className="tp-texto">
              <strong>O aluno pode ver esta avaliação</strong>
              <span className="mini">Desmarcado, ela não aparece para ele de forma nenhuma.</span>
            </span>
          </label>

          {f.visibilidade.alunoPodeVer && (
            <>
              <p className="av-sub">Atalhos</p>
              <div className="opcoes-chips">
                {ATALHOS.map(at => (
                  <button key={at.id} type="button" className="chip-opcao"
                    onClick={() => set('visibilidade', { ...f.visibilidade, blocos: at.vis })}>
                    {at.rotulo}
                  </button>
                ))}
                <button type="button" className="chip-opcao"
                  onClick={() => set('visibilidade', { ...f.visibilidade, alunoPodeVer: false })}>
                  Ocultar do aluno
                </button>
              </div>

              <p className="av-sub">O que ele vê</p>
              <div className="av-vis-lista">
                {BLOCOS.map(b => (
                  <label key={b.id} className="av-vis-item">
                    <input type="checkbox" checked={f.visibilidade.blocos[b.id] !== false}
                      onChange={e => setBlocoVis(b.id, e.target.checked)} />
                    <span>{b.rotulo}</span>
                  </label>
                ))}
              </div>
              <p className="mini">
                A anamnese entra fechada por padrão: ela guarda dado clínico que nem sempre
                se devolve cru para quem respondeu.
              </p>
            </>
          )}

          <label htmlFor="av-obs">Observações gerais</label>
          <textarea id="av-obs" rows={3} value={f.observacoesGerais ?? ''}
            onChange={e => set('observacoesGerais', e.target.value)} />
        </div>
      )}

      {erro && <div className="erro">{erro}</div>}

      <div className="av-acoes">
        <button className="btn" disabled={salvando}>
          {salvando ? 'Salvando...' : inicial ? 'Salvar alterações' : 'Registrar avaliação'}
        </button>
        <button type="button" className="btn btn-sec btn-auto" onClick={onCancelar}>Cancelar</button>
      </div>
    </form>
  )
}
