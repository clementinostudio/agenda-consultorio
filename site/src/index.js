// avina.com.br: entrega a página de apresentação; www.avina.com.br vai para o endereço sem www
export default {
  fetch(req, env) {
    const url = new URL(req.url);
    if (url.hostname.startsWith("www.")) {
      url.hostname = url.hostname.slice(4);
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(req);
  },
};
