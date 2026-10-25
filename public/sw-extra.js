/* Extras do service worker (o resto é gerado pelo vite-plugin-pwa).
   Aqui chegam os avisos mandados pelo servidor, mesmo com o app fechado. */

self.addEventListener("push", event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { corpo: event.data ? event.data.text() : "" }; }
  const titulo = d.titulo || "Cais";
  const opcoes = {
    body: d.corpo || "Você tem um aviso na agenda.",
    icon: self.registration.scope + "icons/icon-192.png",
    badge: self.registration.scope + "icons/icon-192.png",
    tag: d.tag || undefined,
    renotify: !!d.tag,
    vibrate: [180, 80, 180],
    data: { url: d.url || self.registration.scope },
  };
  event.waitUntil(self.registration.showNotification(titulo, opcoes));
});

// Tocar no aviso abre (ou traz para frente) o app
self.addEventListener("notificationclick", event => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || self.registration.scope;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(lista => {
    for (const c of lista) if ("focus" in c) return c.focus();
    return self.clients.openWindow(url);
  }));
});

// Se o aparelho trocar a inscrição sozinho, o app refaz na próxima vez que abrir
self.addEventListener("pushsubscriptionchange", () => {});
