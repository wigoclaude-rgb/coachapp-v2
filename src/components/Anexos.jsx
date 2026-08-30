import { useRef, useState } from 'react'
import {
  ACCEPT, TAMANHO_MAX, ehImagem, tamanhoLegivel, validarArquivo,
  enviarAnexo, lerAnexo, apagarAnexo
} from '../lib/anexos'
import { fmtData } from '../lib/util'
import { IcMais, IcLixeira, IcFechar, IcAlerta } from './Icones.jsx'

/*
  Lista de anexos, usada tanto na ficha do aluno quanto dentro de uma avaliação.

  A lista mostra só nome, tipo e tamanho — o arquivo em si é buscado no clique.
  Sem isso, abrir a ficha de um aluno com cinco PDFs baixaria cinco PDFs.

  `podeEditar` é falso do lado do aluno: ele lê os documentos, não os gerencia.
*/
export default function Anexos({ alunoId, lista, avaliacaoId = null, podeEditar = false, titulo }) {
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [aberto, setAberto] = useState(null)   // { id, nome, tipo, dados }
  const [carregando, setCarregando] = useState(null)
  const inputRef = useRef(null)

  async function escolher(e) {
    const file = e.target.files?.[0]
    e.target.value = ''            // permite reenviar o mesmo arquivo depois de um erro
    if (!file) return

    const invalido = validarArquivo(file)
    if (invalido) { setErro(invalido); return }

    setErro('')
    setEnviando(true)
    try {
      await enviarAnexo(alunoId, file, { avaliacaoId })
    } catch (err) {
      setErro(
        String(err?.message || '').toLowerCase().includes('permission')
          ? 'O banco recusou o envio. As regras de "anexos" precisam ser publicadas no Firebase.'
          : err.message || 'Não foi possível enviar. Tente de novo.'
      )
      console.warn('Falha ao enviar anexo:', err)
    }
    setEnviando(false)
  }

  async function abrir(a) {
    setCarregando(a.id)
    try {
      const dados = await lerAnexo(alunoId, a.id)
      if (!dados) setErro('O conteúdo deste anexo não foi encontrado.')
      else setAberto({ ...a, dados })
    } catch (err) {
      setErro('Não foi possível abrir o arquivo.')
      console.warn('Falha ao ler anexo:', err)
    }
    setCarregando(null)
  }

  async function apagar(a) {
    if (!confirm(`Remover "${a.nome}"? Não tem como desfazer.`)) return
    try {
      await apagarAnexo(alunoId, a.id)
    } catch (err) {
      setErro('Não foi possível remover o arquivo.')
      console.warn('Falha ao apagar anexo:', err)
    }
  }

  const vazio = !lista || lista.length === 0
  if (vazio && !podeEditar) return null

  return (
    <div className="anexos">
      {titulo && <p className="av-sub">{titulo}</p>}

      {erro && <div className="erro">{erro}</div>}

      {vazio && podeEditar && (
        <p className="mini anexos-vazio">
          Nenhum arquivo. Aceita imagem ou PDF de até {tamanhoLegivel(TAMANHO_MAX)}.
        </p>
      )}

      {!vazio && (
        <div className="anexos-lista">
          {lista.map(a => (
            <div key={a.id} className="anexo-item">
              <button
                type="button"
                className="anexo-abrir"
                onClick={() => abrir(a)}
                disabled={carregando === a.id}
              >
                <span className={'anexo-tipo' + (ehImagem(a.tipo) ? ' img' : ' pdf')}>
                  {ehImagem(a.tipo) ? 'IMG' : 'PDF'}
                </span>
                <span className="anexo-txt">
                  <span className="anexo-nome">{a.nome}</span>
                  <span className="anexo-meta">
                    {tamanhoLegivel(a.tamanho)}
                    {a.ts ? ' · ' + fmtData(a.ts) : ''}
                    {carregando === a.id ? ' · abrindo...' : ''}
                  </span>
                </span>
              </button>
              {podeEditar && (
                <button
                  type="button" className="btn btn-perigo-sutil btn-sm"
                  onClick={() => apagar(a)} title="Remover"
                >
                  <IcLixeira />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {podeEditar && (
        <>
          <input
            ref={inputRef} type="file" accept={ACCEPT}
            onChange={escolher} style={{ display: 'none' }}
          />
          <button
            type="button" className="btn btn-sec btn-sm btn-auto"
            onClick={() => inputRef.current?.click()} disabled={enviando}
          >
            {enviando ? 'Enviando...' : <><IcMais /> Anexar arquivo</>}
          </button>
        </>
      )}

      {/* Visualizador. PDF em <object> porque <img> não renderiza PDF. */}
      {aberto && (
        <div className="espiada" onClick={() => setAberto(null)}>
          <div className="espiada-caixa anexo-visor" onClick={e => e.stopPropagation()}>
            <header className="espiada-topo">
              <div style={{ minWidth: 0 }}>
                <span className="espiada-letra">{ehImagem(aberto.tipo) ? 'Imagem' : 'PDF'}</span>
                <h2>{aberto.nome}</h2>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setAberto(null)} title="Fechar">
                <IcFechar />
              </button>
            </header>
            <div className="espiada-corpo anexo-corpo">
              {ehImagem(aberto.tipo)
                ? <img src={aberto.dados} alt={aberto.nome} className="anexo-img" />
                : (
                  <object data={aberto.dados} type="application/pdf" className="anexo-pdf">
                    <p className="muted">
                      <IcAlerta /> Este navegador não abre PDF aqui dentro.
                    </p>
                  </object>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
