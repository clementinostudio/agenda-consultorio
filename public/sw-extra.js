// Ao tocar numa notificação, abre (ou traz para frente) o app
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(lista => {
      for (const c of lista) if ("focus" in c) return c.focus();
      return self.clients.openWindow(self.registration.scope);
    })
  );
});
