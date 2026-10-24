// Gera o par de chaves VAPID (identidade do servidor de avisos). Roda uma vez só.
const { subtle } = globalThis.crypto;
const par = await subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
const publica = Buffer.from(await subtle.exportKey("raw", par.publicKey)).toString("base64url");
const privada = JSON.stringify(await subtle.exportKey("jwk", par.privateKey));
process.stdout.write(JSON.stringify({ publica, privada }));
