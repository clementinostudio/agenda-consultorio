/* Extras do service worker (o resto é gerado pelo vite-plugin-pwa).
   Aqui chegam os avisos mandados pelo servidor, mesmo com o app fechado. */

self.addEventListener("push", event => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { corpo: event.data ? event.data.text() : "" }; }
  const titulo = d.titulo || "Avina";
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

// "Compartilhar com o Avina" (Android): foto de comprovante, código de boleto ou texto.
// Guarda o que chegou e abre o app, que lê e mostra para você conferir.
self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "POST" || !new URL(req.url).pathname.endsWith("/compartilhar")) return;
  event.respondWith((async () => {
    try {
      const form = await req.formData();
      const c = await caches.open("compartilhado");
      const u = n => new URL(`__compartilhado/${n}`, self.registration.scope).href;
      const arq = form.getAll("arquivo").find(f => f && typeof f === "object" && f.size);
      if (arq) await c.put(u("arquivo"), new Response(arq, { headers: { "content-type": arq.type || "image/jpeg" } }));
      const texto = ["title", "text", "url"].map(k => form.get(k)).filter(v => typeof v === "string" && v.trim()).join(" ").trim();
      if (texto) await c.put(u("texto"), new Response(texto, { headers: { "content-type": "text/plain; charset=utf-8" } }));
    } catch (e) {}
    return Response.redirect(self.registration.scope + "#compartilhado", 303);
  })());
});
