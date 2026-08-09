import { useMemo, useState } from 'react'
import { BIBLIOTECA_EXERCICIOS } from '../lib/exercicios'
import { exercicioVazio, linhaVazia, normalizarExercicios } from '../lib/treinoModel'
import { imagemExercicio } from '../lib/util'
import { apagarFoto } from '../lib/fotos'
import FotoInput from './FotoInput.jsx'
import { IcMais, IcLixeira, IcCheck, IcFechar } from './Icones.jsx'

/**
 * Editor de exercícios com:
 *  - linhas de série (reps livre + carga + intervalo) para progressão de carga
 *  - seleção por checkbox para combinar exercícios em bi-set
 *  - campo de observações por exercício
 *
 *  - imagem de demonstração por exercício (envia, troca ou remove)
 *
 * Props: exercicios (array canônico), onChange(novaLista), pastaFotos
 */
export default function EditorExercicios({ exercicios, onChange, pastaFotos = 'exercicios' }) {
  const [sel, setSel] = useState(() => new Set())

  const segmentos = useMemo(() => {
    const segs = []
    exercicios.forEach((ex, i) => {
      const ultimo = segs[segs.length - 1]
      if (ex.grupo && ultimo && ultimo.grupo === ex.grupo) ultimo.itens.push({ ex, i })
      else segs.push({ grupo: ex.grupo || null, itens: [{ ex, i }] })
    })
    return segs
  }, [exercicios])

  function aplicar(lista) {
    onChange(normalizarExercicios(lista))
  }

  function alternarSel(i) {
    setSel(s => {
      const novo = new Set(s)
      novo.has(i) ? novo.delete(i) : novo.add(i)
      return novo
    })
  }

  function combinar() {
    const idx = [...sel].sort((a, b) => a - b)
    if (idx.length < 2) return
    const gid = 'g' + Date.now().toString(36)
    const escolhidos = idx.map(i => ({ ...exercicios[i], grupo: gid }))

    const novo = []
    let inserido = false
    exercicios.forEach((ex, i) => {
      if (sel.has(i)) {
        if (!inserido) { escolhidos.forEach(e => novo.push(e)); inserido = true }
        return
      }
      novo.push(ex)
    })
    aplicar(novo)
    setSel(new Set())
  }

  function separar(gid) {
    aplicar(exercicios.map(ex => (ex.grupo === gid ? { ...ex, grupo: null } : ex)))
    setSel(new Set())
  }

  function excluirSelecionados() {
    if (!confirm(`Remover ${sel.size} exercício(s)?`)) return
    const restantes = exercicios.filter((_, i) => !sel.has(i))
    aplicar(restantes.length ? restantes : [exercicioVazio()])
    setSel(new Set())
  }

  function mudar(i, campo, valor) {
    aplicar(exercicios.map((ex, idx) => (idx === i ? { ...ex, [campo]: valor } : ex)))
  }

  function mudarLinha(i, li, campo, valor) {
    aplicar(exercicios.map((ex, idx) => (idx === i
      ? { ...ex, linhas: ex.linhas.map((l, k) => (k === li ? { ...l, [campo]: valor } : l)) }
      : ex)))
  }

  function addLinha(i) {
    aplicar(exercicios.map((ex, idx) => (idx === i
      ? { ...ex, linhas: [...ex.linhas, linhaVazia(ex.linhas[ex.linhas.length - 1])] }
      : ex)))
  }

  function removerLinha(i, li) {
    aplicar(exercicios.map((ex, idx) => (idx === i && ex.linhas.length > 1
      ? { ...ex, linhas: ex.linhas.filter((_, k) => k !== li) }
      : ex)))
  }

  /** Troca a imagem do exercício e apaga a anterior do Storage. */
  async function trocarImagem(i, url) {
    const antiga = exercicios[i].imagem
    mudar(i, 'imagem', url)
    if (antiga && antiga !== url) await apagarFoto(antiga)
  }

  async function removerImagem(i) {
    const antiga = exercicios[i].imagem
    mudar(i, 'imagem', '')
    await apagarFoto(antiga)
  }

  function addExercicio() {
    aplicar([...exercicios, exercicioVazio()])
  }

  function removerExercicio(i) {
    const restantes = exercicios.filter((_, idx) => idx !== i)
    aplicar(restantes.length ? restantes : [exercicioVazio()])
    setSel(new Set())
  }

  function cartao({ ex, i }, dentroDeGrupo) {
    const previa = imagemExercicio(ex)
    return (
      <div className={'ex-editor ' + (sel.has(i) ? 'selecionado' : '')} key={i}>
        <div className="ex-editor-topo">
          <label className="ex-check">
            <input
              type="checkbox"
              checked={sel.has(i)}
              onChange={() => alternarSel(i)}
              aria-label={`Selecionar ${ex.nome || 'exercício ' + (i + 1)}`}
            />
            <span className="ex-check-caixa" aria-hidden="true"><IcCheck /></span>
          </label>
          <input
            className="ex-nome-input"
            list="lista-exercicios"
            value={ex.nome}
            onChange={e => mudar(i, 'nome', e.target.value)}
            placeholder="Nome do exercício"
          />
          <button type="button" className="remove-btn" onClick={() => removerExercicio(i)} title="Remover exercício">
            <IcLixeira />
          </button>
        </div>

        <div className="linhas-serie">
          <div className="linha-serie cabecalho">
            <span>Série / reps</span>
            <span>Carga</span>
            <span>Intervalo</span>
            <span />
          </div>
          {ex.linhas.map((l, li) => (
            <div className="linha-serie" key={li}>
              <div className="ls-reps">
                <span className="ls-prefixo">{li + 1}×</span>
                <input
                  value={l.reps}
                  onChange={e => mudarLinha(i, li, 'reps', e.target.value)}
                  placeholder="12 ou 10-12"
                />
              </div>
              <input
                value={l.carga}
                onChange={e => mudarLinha(i, li, 'carga', e.target.value)}
                placeholder="kg"
              />
              <input
                type="number" min="0"
                value={l.descanso}
                onChange={e => mudarLinha(i, li, 'descanso', Number(e.target.value))}
                placeholder="s"
              />
              <button
                type="button" className="remove-btn" title="Remover série"
                onClick={() => removerLinha(i, li)}
                disabled={ex.linhas.length <= 1}
              >
                <IcFechar />
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => addLinha(i)}>
            <IcMais /> Série
          </button>
        </div>

        <div className="ex-imagem">
          <label>Imagem de demonstração</label>
          <div className="ex-imagem-linha">
            {previa ? (
              <img src={previa} alt="" className="ex-imagem-previa" />
            ) : (
              <div className="ex-imagem-previa vazia">Sem imagem</div>
            )}
            <div className="ex-imagem-acoes">
              <FotoInput
                atual={null}
                onFoto={url => trocarImagem(i, url)}
                rotulo={ex.imagem ? 'Trocar imagem' : 'Enviar imagem'}
                pasta={pastaFotos}
                maxLado={800}
              />
              {ex.imagem && (
                <button type="button" className="btn btn-perigo-sutil btn-sm" onClick={() => removerImagem(i)}>
                  Remover
                </button>
              )}
            </div>
          </div>
          {!ex.imagem && previa && (
            <p className="mini">Usando a capa do vídeo do YouTube. Envie uma imagem para substituir.</p>
          )}
        </div>

        <div className="linha-2" style={{ marginTop: 12 }}>
          <div>
            <label>Vídeo do YouTube</label>
            <input value={ex.video} onChange={e => mudar(i, 'video', e.target.value)} placeholder="https://youtube.com/..." />
          </div>
          <div>
            <label>Observações {dentroDeGrupo ? '' : '(opcional)'}</label>
            <textarea
              rows={2}
              value={ex.obs}
              onChange={e => mudar(i, 'obs', e.target.value)}
              placeholder="Ex: 10 reps carga normal, reduz 20% e vai até a falha"
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <datalist id="lista-exercicios">
        {BIBLIOTECA_EXERCICIOS.map(ex => <option key={ex} value={ex} />)}
      </datalist>

      {sel.size > 0 && (
        <div className="barra-selecao">
          <span>{sel.size} selecionado{sel.size === 1 ? '' : 's'}</span>
          <span className="espaco" />
          <button type="button" className="btn btn-sec btn-sm" onClick={combinar} disabled={sel.size < 2}>
            Combinar
          </button>
          <button type="button" className="btn btn-perigo-sutil btn-sm" onClick={excluirSelecionados}>
            Excluir
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSel(new Set())}>
            Cancelar
          </button>
        </div>
      )}

      {segmentos.map((seg, s) => (
        seg.grupo && seg.itens.length > 1 ? (
          <div className="grupo-bloco" key={'g' + s}>
            <div className="grupo-topo">
              <span className="badge primaria">Bi-set</span>
              <span className="grupo-titulo">{seg.itens.map(it => it.ex.nome || 'Exercício').join(' + ')}</span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => separar(seg.grupo)}>Separar</button>
            </div>
            {seg.itens.map(it => cartao(it, true))}
          </div>
        ) : (
          seg.itens.map(it => cartao(it, false))
        )
      ))}

      <button type="button" className="btn btn-sec btn-sm" onClick={addExercicio}>
        <IcMais /> Adicionar exercício
      </button>
    </>
  )
}
