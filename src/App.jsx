import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { ref, onValue } from 'firebase/database'
import { auth, db } from './firebase'
import { conectarPresenca } from './lib/presenca'
import Login from './pages/Login.jsx'
import CadastroPersonal from './pages/CadastroPersonal.jsx'
import FichaPublica from './pages/FichaPublica.jsx'
import CriarSenha from './pages/CriarSenha.jsx'
import Novidades from './components/Novidades.jsx'
import PersonalHome from './pages/personal/PersonalHome.jsx'
import AlunoDetalhe from './pages/personal/AlunoDetalhe.jsx'
import CriarTreino from './pages/personal/CriarTreino.jsx'
import AlunoHome from './pages/aluno/AlunoHome.jsx'
import GuardAdmin from './components/GuardAdmin.jsx'
import AdminLogin from './pages/admin/AdminLogin.jsx'
import AdminHome from './pages/admin/AdminHome.jsx'
import AdminPersonals from './pages/admin/AdminPersonals.jsx'
import AdminFicha from './pages/admin/AdminFicha.jsx'

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

  // Marca presença enquanto estiver logado; o Firebase derruba sozinho ao cair.
  useEffect(() => (user ? conectarPresenca(user.uid) : undefined), [user?.uid])

  async function sair() {
    await signOut(auth)
    navigate('/')
  }

  if (carregando) return <div className="loading">Carregando...</div>

  const logado = user && perfil

  // Primeiro acesso com senha temporária: só sai daqui depois de criar a senha.
  if (logado && perfil.precisaTrocarSenha) {
    return <CriarSenha user={user} perfil={perfil} />
  }

  return (
    <>
      {logado && <Novidades user={user} perfil={perfil} />}
      <Routes>
        <Route path="/" element={
          !logado ? <Login /> :
          perfil.role === 'personal' ? <Navigate to="/personal" /> : <Navigate to="/aluno" />
        } />
        <Route path="/cadastro-personal" element={<CadastroPersonal />} />
        <Route path="/ficha/:codigo" element={<FichaPublica />} />

        {/*
          Painel master. Fora do gate `logado` de propósito: a conta de admin não
          tem registro em `users/`, então `perfil` é null e ela seria expulsa.
          Quem autoriza aqui é o GuardAdmin, pelo nó `admins/{uid}`.
        */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<GuardAdmin><AdminHome /></GuardAdmin>} />
        <Route path="/admin/personals" element={
          <GuardAdmin>{uid => <AdminPersonals adminUid={uid} />}</GuardAdmin>
        } />
        <Route path="/admin/personals/:id" element={
          <GuardAdmin>{uid => <AdminFicha adminUid={uid} />}</GuardAdmin>
        } />
        <Route path="/personal/*" element={
          logado && perfil.role === 'personal'
            ? <PersonalHome user={user} perfil={perfil} onSair={sair} />
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
            ? <AlunoHome user={user} perfil={perfil} onSair={sair} />
            : <Navigate to="/" />
        } />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </>
  )
}
