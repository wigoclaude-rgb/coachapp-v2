import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { ref, onValue } from 'firebase/database'
import { auth, db } from '../../firebase'
import { montarPersonais, montarAlunos, buscar } from '../../lib/admin'
import { IcBusca } from '../../components/Icones.jsx'

/**
 * Os dados da plataforma, carregados uma vez e compartilhados pelas telas.
 *
 * São exatamente os nós que as regras liberam para o admin: `users`, `planos`,
 * `personals`, `adminLogs` — mais `presenca`, aberta a qualquer autenticado, que
 * é de onde sai "último acesso".
 *
 * Cobranças, execuções e treinos NÃO entram: as regras os restringem ao par
 * personal↔aluno, e é assim que deve ser. Ver o cabeçalho de `lib/admin.js`.
 */
export function useDadosAdmin() {
  const [bruto, setBruto] = useState({ users: {}, planos: {}, personals: {}, presenca: {}, logs: {} })
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  /*
    `presenca` só virou legível pelo nó inteiro em Set/2026. Com a regra antiga
    publicada a leitura é negada, e sem saber disso a tela diria "Nunca entrou"
    para todo mundo — inventando um fato. Aqui a ausência do dado é registrada
    para as listas mostrarem "—" em vez de uma resposta errada.
  */
  const [temPresenca, setTemPresenca] = useState(true)

  useEffect(() => {
    const falha = e => {
      setErro('Sem permissão para ler os dados. Confira as regras de admin no Firebase.')
      console.warn('Admin sem leitura:', e?.code || e)
      setCarregando(false)
    }
    const guardar = campo => valor => setBruto(b => ({ ...b, [campo]: valor || {} }))

    const us = [
      onValue(ref(db, 'users'), s => { guardar('users')(s.val()); setCarregando(false) }, falha),
      onValue(ref(db, 'planos'), s => guardar('planos')(s.val()), falha),
      onValue(ref(db, 'personals'), s => guardar('personals')(s.val()), falha),
      // Presença e logs são complementares: falhar neles não derruba o painel.
      onValue(ref(db, 'presenca'), s => guardar('presenca')(s.val()), () => setTemPresenca(false)),
      onValue(ref(db, 'adminLogs'), s => guardar('logs')(s.val()), () => {})
    ]
    return () => us.forEach(cancelar => cancelar())
  }, [])

  const personais = useMemo(() => montarPersonais(bruto), [bruto])
  const alunos = useMemo(() => montarAlunos(bruto), [bruto])

  return { personais, alunos, logs: bruto.logs, temPresenca, carregando, erro, lista: personais }
}

/* Os grupos do menu. Nome curto: o admin volta aqui todo dia. */
const MENU = [
  { grupo: 'Visão geral', itens: [{ rota: '/admin', rotulo: 'Painel', exato: true }] },
  {
    grupo: 'Usuários',
    itens: [
      { rota: '/admin/personals', rotulo: 'Personais' },
      { rota: '/admin/alunos', rotulo: 'Alunos' }
    ]
  },
  { grupo: 'Atendimento', itens: [{ rota: '/admin/suporte', rotulo: 'Suporte' }] }
]

/** Casca do painel: navegação, busca global e sair. Fora do Layout do app. */
export default function AdminShell({ titulo, subtitulo, acao, children }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { personais, alunos } = useDadosAdmin()

  const [menuAberto, setMenuAberto] = useState(false)
  const [buscaAberta, setBuscaAberta] = useState(false)
  const [termo, setTermo] = useState('')

  const ativo = it => (it.exato ? pathname === it.rota : pathname.startsWith(it.rota))

  /*
    Ctrl+K abre a busca. Só abre — nenhuma tecla executa ação administrativa,
    porque atalho que bloqueia ou altera plano por engano não tem desfazer.
  */
  const abrirBusca = useCallback(() => { setTermo(''); setBuscaAberta(true) }, [])
  useEffect(() => {
    function aoTeclar(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        abrirBusca()
      }
      if (e.key === 'Escape') setBuscaAberta(false)
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [abrirBusca])

  const resultado = useMemo(
    () => buscar(termo, { personais, alunos }),
    [termo, personais, alunos]
  )

  function ir(rota) {
    setBuscaAberta(false)
    setMenuAberto(false)
    navigate(rota)
  }

  return (
    <div className="adm">
      <aside className={'adm-lado' + (menuAberto ? ' aberto' : '')}>
        <div className="adm-marca">WIGO <span>ADMIN</span></div>

        <button className="adm-busca-btn" onClick={abrirBusca}>
          <IcBusca /> <span>Buscar</span> <kbd>Ctrl K</kbd>
        </button>

        <nav className="adm-nav">
          {MENU.map(g => (
            <div key={g.grupo} className="adm-grupo">
              <span className="adm-grupo-rot">{g.grupo}</span>
              {g.itens.map(it => (
                <Link
                  key={it.rota}
                  to={it.rota}
                  className={'adm-item' + (ativo(it) ? ' ativo' : '')}
                  onClick={() => setMenuAberto(false)}
                >
                  {it.rotulo}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <button
          className="adm-sair"
          onClick={() => signOut(auth).then(() => { window.location.href = '/admin/login' })}
        >
          Sair
        </button>
      </aside>

      <div
        className={'adm-backdrop' + (menuAberto ? ' aberto' : '')}
        onClick={() => setMenuAberto(false)}
      />

      <main className="adm-corpo">
        <header className="adm-cab">
          <button className="adm-menu-btn" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">☰</button>
          <div style={{ minWidth: 0 }}>
            <h1>{titulo}</h1>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          {acao}
        </header>
        {children}
      </main>

      {buscaAberta && (
        <div className="adm-busca-fundo" onClick={() => setBuscaAberta(false)}>
          <div className="adm-busca" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
            <input
              autoFocus
              value={termo}
              onChange={e => setTermo(e.target.value)}
              placeholder="Nome, e-mail ou código do aluno"
              aria-label="Buscar"
            />

            {resultado.vazio ? (
              <p className="adm-busca-dica">Digite pelo menos 2 letras.</p>
            ) : resultado.personais.length + resultado.alunos.length === 0 ? (
              <p className="adm-busca-dica">Nada encontrado para “{termo}”.</p>
            ) : (
              <div className="adm-busca-lista">
                {resultado.personais.length > 0 && (
                  <>
                    <span className="adm-busca-rot">Personais</span>
                    {resultado.personais.map(p => (
                      <button key={p.uid} onClick={() => ir('/admin/personals/' + p.uid)}>
                        <strong>{p.nome}</strong>
                        <span>{p.email} · {p.alunos} aluno{p.alunos === 1 ? '' : 's'}</span>
                      </button>
                    ))}
                  </>
                )}
                {resultado.alunos.length > 0 && (
                  <>
                    <span className="adm-busca-rot">Alunos</span>
                    {resultado.alunos.map(a => (
                      <button key={a.uid} onClick={() => ir('/admin/alunos?q=' + encodeURIComponent(a.nome))}>
                        <strong>{a.nome}</strong>
                        <span>{a.personalNome ? 'Personal: ' + a.personalNome : 'Sem personal'}</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
