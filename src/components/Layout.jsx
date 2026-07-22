import { useState } from 'react'
import Notificacoes from './Notificacoes.jsx'

/*
  Layout com sidebar lateral + topbar.
  Props:
    - user, perfil, onSair
    - itens: [{ id, label, icone (jsx), badge? }]
    - abaAtiva, onAba(id)
    - roleLabel: texto abaixo do nome (ex: "Personal Trainer")
    - titulo, subtitulo: cabeçalho da topbar (dinâmico por aba)
*/
export default function Layout({ user, perfil, onSair, itens, abaAtiva, onAba, roleLabel, titulo, subtitulo, children }) {
  const [menuAberto, setMenuAberto] = useState(false)
  const inicial = (perfil?.nome || '?').trim().charAt(0).toUpperCase()

  function selecionar(id) {
    onAba(id)
    setMenuAberto(false)
  }

  return (
    <div className="app-shell">
      {/* Backdrop mobile */}
      <div
        className={'sidebar-backdrop ' + (menuAberto ? 'aberto' : '')}
        onClick={() => setMenuAberto(false)}
      />

      {/* Sidebar */}
      <aside className={'sidebar ' + (menuAberto ? 'aberta' : '')}>
        <div className="sidebar-brand">
          <span className="logo-mark">💪</span>
          <span style={{ color: '#fff' }}>COACH<span>APP</span></span>
        </div>

        <nav className="sidebar-nav">
          {itens.map(it => (
            <button
              key={it.id}
              className={'nav-item ' + (abaAtiva === it.id ? 'ativo' : '')}
              onClick={() => selecionar(it.id)}
            >
              <span className="nav-icone">{it.icone}</span>
              <span>{it.label}</span>
              {it.badge > 0 && <span className="nav-badge">{it.badge}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-rodape">
          <div className="sidebar-user">
            {perfil?.foto
              ? <img src={perfil.foto} className="avatar" alt="perfil" />
              : <div className="avatar-fallback">{inicial}</div>}
            <div className="u-info">
              <div className="u-nome">{perfil?.nome || 'Usuário'}</div>
              <div className="u-role">{roleLabel}</div>
            </div>
          </div>
          <button className="btn-sair" onClick={onSair}>Sair da conta</button>
        </div>
      </aside>

      {/* Área principal */}
      <div className="main-area">
        <header className="topbar">
          <button className="btn-menu" onClick={() => setMenuAberto(true)} aria-label="Abrir menu">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="topbar-titulo">
            <h1>{titulo}</h1>
            {subtitulo && <span className="sub">{subtitulo}</span>}
          </div>
          <div className="topbar-dir">
            <Notificacoes uid={user.uid} />
            {perfil?.foto
              ? <img src={perfil.foto} className="topbar-avatar" alt="perfil" />
              : <div className="topbar-avatar-fb">{inicial}</div>}
          </div>
        </header>

        <main className="conteudo" key={abaAtiva}>
          {children}
        </main>
      </div>
    </div>
  )
}
