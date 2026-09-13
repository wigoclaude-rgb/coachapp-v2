import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import AdminShell, { useDadosAdmin } from './AdminShell.jsx'
import { rotuloAcesso } from '../../lib/admin'
import { fmtData } from '../../lib/util'
import { IcBusca } from '../../components/Icones.jsx'

/*
  Alunos de toda a plataforma.

  Não existia: a única forma de ver um aluno era entrar no personal dele. Com a
  base crescendo, "quem ficou sem personal?" e "quem nunca abriu o app?" viraram
  perguntas sem resposta.

  O que NÃO tem aqui, e por quê: treinos, adesão e pagamentos do aluno. As regras
  do banco restringem esses nós ao aluno e ao personal dele — o admin não lê, de
  propósito. São dados de saúde e de dinheiro de terceiros.

  E também não há ação administrativa sobre aluno. Bloquear ou trocar de personal
  exigiria escrita em `users/{aluno}`, que hoje só o próprio aluno e o personal
  dele podem fazer. Abrir isso é decisão de arquitetura, não detalhe de tela —
  está explicado no texto do rodapé.
*/

const FILTROS = [
  { id: 'todos', rotulo: 'Todos' },
  { id: 'ativos', rotulo: 'Abriram em 7 dias' },
  { id: 'parados', rotulo: 'Parados há 30+ dias' },
  { id: 'nunca', rotulo: 'Nunca entraram' },
  { id: 'sem_personal', rotulo: 'Sem personal' },
  { id: 'sem_senha', rotulo: 'Senha não trocada' }
]

const semAcento = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

export default function AdminAlunos() {
  const { alunos, temPresenca, carregando, erro } = useDadosAdmin()
  const [params, setParams] = useSearchParams()

  const busca = params.get('q') || ''
  const filtro = params.get('filtro') || 'todos'
  const ordem = params.get('ordem') || 'nome'

  const setParam = (chave, valor) => {
    const p = new URLSearchParams(params)
    if (!valor || valor === 'todos' || valor === 'nome') p.delete(chave)
    else p.set(chave, valor)
    setParams(p, { replace: true })
  }

  const visiveis = useMemo(() => {
    const q = semAcento(busca).trim()
    const lista = alunos.filter(a => {
      if (q && ![a.nome, a.email, a.codigo, a.personalNome].some(v => semAcento(v).includes(q))) return false
      if (filtro === 'ativos') return a.acesso.dias !== null && a.acesso.dias <= 7
      if (filtro === 'parados') return a.acesso.dias !== null && a.acesso.dias >= 30
      if (filtro === 'nunca') return a.acesso.visto === null
      if (filtro === 'sem_personal') return a.semPersonal
      if (filtro === 'sem_senha') return a.precisaTrocarSenha
      return true
    })

    return lista.sort((a, b) => {
      if (ordem === 'recentes') return (b.criadoEm || 0) - (a.criadoEm || 0)
      if (ordem === 'parados') return (b.acesso.dias ?? Infinity) - (a.acesso.dias ?? Infinity)
      if (ordem === 'personal') return semAcento(a.personalNome).localeCompare(semAcento(b.personalNome))
      return a.nome.localeCompare(b.nome)
    })
  }, [alunos, busca, filtro, ordem])

  const acesso = a => {
    const { texto, tom } = rotuloAcesso(a.acesso, temPresenca)
    return <span className={'adm-selo ' + tom}>{texto}</span>
  }

  return (
    <AdminShell titulo="Alunos" subtitulo={`${alunos.length} na plataforma inteira.`}>
      {erro && <div className="erro">{erro}</div>}
      {carregando && <p className="muted">Carregando...</p>}

      {!carregando && !erro && (
        <>
          <div className="adm-filtros">
            <div className="campo-busca">
              <IcBusca />
              <input
                value={busca}
                onChange={e => setParam('q', e.target.value)}
                placeholder="Nome, e-mail, código ou personal"
              />
            </div>
            <select value={ordem} onChange={e => setParam('ordem', e.target.value)} aria-label="Ordenar">
              <option value="nome">Nome</option>
              <option value="recentes">Cadastro mais recente</option>
              <option value="parados">Mais tempo sem entrar</option>
              <option value="personal">Personal</option>
            </select>
          </div>

          <div className="adm-chips">
            {FILTROS.map(f => (
              <button
                key={f.id}
                className={'adm-chip' + (filtro === f.id ? ' ativo' : '')}
                onClick={() => setParam('filtro', f.id)}
              >
                {f.rotulo}
              </button>
            ))}
            <span className="adm-conta">{visiveis.length} de {alunos.length}</span>
          </div>

          {visiveis.length === 0 ? (
            <p className="muted adm-vazio">
              {alunos.length === 0
                ? 'Nenhum aluno cadastrado na plataforma ainda.'
                : 'Nenhum aluno com esses critérios.'}
            </p>
          ) : (
            <div className="adm-tabela-rolagem">
              <table className="adm-tabela">
                <thead>
                  <tr>
                    <th>Aluno</th><th>Personal</th><th>Cadastro</th><th>Último acesso</th><th>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map(a => (
                    <tr key={a.uid}>
                      <td>
                        <strong>{a.nome}</strong>
                        <span className="adm-sub">{a.email || 'sem e-mail'}{a.codigo ? ' · ' + a.codigo : ''}</span>
                      </td>
                      <td>
                        {a.semPersonal
                          ? <span className="adm-selo ruim">Sem personal</span>
                          : a.personalNome}
                      </td>
                      <td>{a.criadoEm ? fmtData(a.criadoEm) : '—'}</td>
                      <td>{acesso(a)}</td>
                      <td>
                        {a.precisaTrocarSenha
                          ? <span className="adm-selo aviso">Senha não trocada</span>
                          : <span className="adm-selo ok">Ativa</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="adm-nota rodape">
            Esta tela é de consulta. Bloquear um aluno ou trocá-lo de personal
            exigiria escrita em <code>users/{'{'}aluno{'}'}</code>, que hoje as regras
            permitem só ao próprio aluno e ao personal dele — abrir isso ao admin é
            uma mudança de arquitetura, não de interface. Treinos, adesão e cobranças
            não aparecem aqui pelo mesmo motivo: são privados ao par.
          </p>
        </>
      )}
    </AdminShell>
  )
}
