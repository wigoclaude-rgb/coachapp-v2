import {
  DIAS_SEMANA, QUEM_INDICOU, FREQUENCIAS, MOMENTOS, suplementoVazio
} from '../../lib/suplementos'

/*
  Cadastro. Fica atrás de um botão de propósito: a tela é de acompanhamento, e
  quem abre para marcar a dose das 5h não deveria passar por um formulário.

  A frequência é um seletor e não dois botões porque "apenas dias de treino"
  entrou — e é ela que liga a suplementação ao treino do dia.
*/
export default function FormSuplemento({ form, onMudar, onSalvar, onCancelar, salvando, editando, erro }) {
  const mudar = (campo, valor) => onMudar({ ...form, [campo]: valor })

  const alternarDia = d => mudar(
    'dias',
    form.dias.includes(d) ? form.dias.filter(x => x !== d) : [...form.dias, d]
  )

  return (
    <div className="card">
      <div className="card-titulo">
        <h2>{editando ? 'Editar suplemento' : 'Novo suplemento'}</h2>
      </div>

      <form onSubmit={onSalvar}>
        <div className="linha-2">
          <div>
            <label htmlFor="sp-nome">Suplemento *</label>
            <input
              id="sp-nome" value={form.nome} required
              onChange={e => mudar('nome', e.target.value)}
              placeholder="Ex: Creatina"
            />
          </div>
          <div>
            <label htmlFor="sp-marca">Marca</label>
            <input
              id="sp-marca" value={form.marca}
              onChange={e => mudar('marca', e.target.value)}
              placeholder="Ex: Darklab"
            />
          </div>
        </div>

        <div className="linha-2">
          <div>
            <label htmlFor="sp-dose">Dose</label>
            <input
              id="sp-dose" value={form.dose}
              onChange={e => mudar('dose', e.target.value)}
              placeholder="Ex: 2 scoops (6g)"
            />
          </div>
          <div>
            <label htmlFor="sp-vezes">Vezes ao dia</label>
            <input
              id="sp-vezes" type="number" min="1" max="8"
              value={form.vezesAoDia}
              onChange={e => mudar('vezesAoDia', e.target.value)}
            />
          </div>
        </div>

        <label htmlFor="sp-freq">Frequência</label>
        <select id="sp-freq" value={form.frequencia} onChange={e => mudar('frequencia', e.target.value)}>
          {FREQUENCIAS.map(f => <option key={f.id} value={f.id}>{f.rotulo}</option>)}
        </select>

        {form.frequencia === 'dias' && (
          <div className="opcoes-chips" style={{ marginTop: 10 }}>
            {DIAS_SEMANA.map((d, i) => (
              <button
                key={i} type="button"
                className={'chip-opcao ' + (form.dias.includes(i) ? 'ativo' : '')}
                onClick={() => alternarDia(i)}
                aria-pressed={form.dias.includes(i)}
              >
                {d}
              </button>
            ))}
          </div>
        )}

        {form.frequencia === 'treino' && (
          <>
            <label style={{ marginTop: 12 }}>Momento</label>
            <div className="opcoes-chips">
              {MOMENTOS.map(m => (
                <button
                  key={m.id} type="button"
                  className={'chip-opcao ' + (form.momento === m.id ? 'ativo' : '')}
                  onClick={() => mudar('momento', m.id)}
                  aria-pressed={form.momento === m.id}
                >
                  {m.rotulo}
                </button>
              ))}
            </div>
            <p className="mini" style={{ marginTop: 6 }}>
              Só aparece na rotina nos dias em que houver treino registrado.
            </p>
          </>
        )}

        <div className="linha-2" style={{ marginTop: 14 }}>
          <div>
            <label htmlFor="sp-hora">Horário</label>
            <input
              id="sp-hora" type="time" value={form.horario}
              onChange={e => mudar('horario', e.target.value)}
              disabled={form.frequencia === 'treino'}
            />
            <p className="mini">
              {form.frequencia === 'treino'
                ? 'Definido pelo momento do treino.'
                : 'Em branco, a dose aparece sem contagem de tempo.'}
            </p>
          </div>
          <div>
            <label htmlFor="sp-indic">Indicado por</label>
            <select id="sp-indic" value={form.indicadoPor} onChange={e => mudar('indicadoPor', e.target.value)}>
              {QUEM_INDICOU.map(q => <option key={q.id} value={q.id}>{q.rotulo}</option>)}
            </select>
          </div>
        </div>

        <label htmlFor="sp-obs">Observação</label>
        <textarea
          id="sp-obs" rows={2} value={form.observacao}
          onChange={e => mudar('observacao', e.target.value)}
          placeholder="Ex: tomar junto com o pós-treino"
        />

        {erro && <div className="erro">{erro}</div>}

        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <button className="btn" disabled={salvando}>
            {salvando ? 'Salvando...' : editando ? 'Salvar alterações' : 'Adicionar suplemento'}
          </button>
          <button type="button" className="btn btn-sec btn-auto" onClick={onCancelar}>Cancelar</button>
        </div>
      </form>
    </div>
  )
}

export { suplementoVazio }
