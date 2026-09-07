/*
  Service worker do CoachApp.

  Só existe por causa das notificações: é o único código que o navegador executa
  com o app fechado. Não faz cache de nada — o app é servido pelo Netlify e um
  cache mal feito aqui entregaria versão velha depois de cada deploy.

  O push chega do agendador (netlify/functions/lembretes-suplementos.mjs).
*/

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

self.addEventListener('push', evento => {
  let dados = {}
  try {
    dados = evento.data ? evento.data.json() : {}
  } catch {
    dados = { titulo: 'CoachApp', corpo: evento.data ? evento.data.text() : '' }
  }

  const titulo = dados.titulo || 'CoachApp'
  const opcoes = {
    body: dados.corpo || '',
    icon: '/icone-192.png',
    badge: '/icone-badge.png',
    tag: dados.tag || 'suplemento',      // substitui o anterior em vez de empilhar
    renotify: true,
    data: { rota: dados.rota || '/aluno' },
    /*
      A ação abre o app na dose e o registro acontece lá, com o aluno logado.
      Marcar direto daqui exigiria credencial do Firebase dentro do service
      worker — um token de escrita guardado fora da sessão, para economizar um
      toque. Não vale o risco.
    */
    actions: [{ action: 'abrir', title: 'Ver dose' }]
  }

  evento.waitUntil(self.registration.showNotification(titulo, opcoes))
})

self.addEventListener('notificationclick', evento => {
  evento.notification.close()
  const rota = evento.notification.data?.rota || '/aluno'
  const destino = new URL(rota, self.location.origin).href

  // Reaproveita uma aba aberta do CoachApp; só abre outra se não houver nenhuma.
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(abas => {
      for (const aba of abas) {
        if (aba.url.startsWith(self.location.origin) && 'navigate' in aba) {
          return aba.navigate(destino).then(a => a && a.focus())
        }
      }
      return self.clients.openWindow(destino)
    })
  )
})
