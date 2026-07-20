import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { ref, onValue } from 'firebase/database'
import { auth, db } from './firebase'
import Notificacoes from './components/Notificacoes.jsx'
import Login from './pages/Login.jsx'
import CadastroPersonal from './pages/CadastroPersonal.jsx'
import PersonalHome from './pages/personal/PersonalHome.jsx'
import AlunoDetalhe from './pages/personal/AlunoDetalhe.jsx'
import CriarTreino from './pages/personal/CriarTreino.jsx'
import AlunoHome from './pages/aluno/AlunoHome.jsx'

export default function App() {
  const [user, setUser] = useState(null)
  const [perfil, setPerfil] = useState(null)
  const [carregando, setCarregando] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    let unsubPerfil = null
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (unsubPerfil) { unsubPerfil(); unsubPerfil = null }
      setUser(u)
      if (u) {
        unsubPerfil = onValue(ref(db, 'users/' + u.uid), snap => {
          setPerfil(snap.exists() ? snap.val() : null)
          setCarregando(false)
        })
      } else {
        setPerfil(null)
        setCarregando(false)
      }
    })
    return () => { unsubAuth(); if (unsubPerfil) unsubPerfil() }
  }, [])

  async function sair() {
    await signOut(auth)
    navigate('/')
  }

  if (carregando) return <div className="loading">Carregando...</div>

  const logado = user && perfil

  return (
    <>
      {logado && (
        <header className="header">
          <div className="header-inner">
            <div className="brand">COACH<span>APP</span></div>
            <div className="header-dir">
              <Notificacoes uid={user.uid} />
              {perfil.foto
                ? <img src={perfil.foto} className="header-foto" alt="perfil" />
                : <span className="header-nome">{perfil.nome}</span>}
              <button onClick={sair}>Sair</button>
            </div>
          </div>
        </header>
      )}
      <Routes>
        <Route path="/" element={
          !logado ? <Login /> :
          perfil.role === 'personal' ? <Navigate to="/personal" /> : <Navigate to="/aluno" />
        } />
        <Route path="/cadastro-personal" element={<CadastroPersonal />} />
        <Route path="/personal/*" element={
          logado && perfil.role === 'personal'
            ? <PersonalHome user={user} perfil={perfil} />
            : <Navigate to="/" />
        } />
        <Route path="/personal-aluno/:alunoId" element={
          logado && perfil.role === 'personal'
            ? <AlunoDetalhe user={user} perfil={perfil} />
            : <Navigate to="/" />
        } />
        <Route path="/personal-treino/:alunoId" element={
          logado && perfil.role === 'personal'
            ? <CriarTreino user={user} perfil={perfil} />
            : <Navigate to="/" />
        } />
        <Route path="/aluno/*" element={
          logado && perfil.role === 'aluno'
            ? <AlunoHome user={user} perfil={perfil} />
            : <Navigate to="/" />
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  )
}
