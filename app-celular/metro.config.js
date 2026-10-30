// O app usa a mesma lógica do site (../src/*.js: postos, preços, transporte, nuvem...).
// - watchFolders: o Metro também enxerga a pasta do site.
// - resolveRequest: o que um arquivo do site importa ("react", "@supabase/supabase-js"...) vem do node_modules
//   do app, como se fosse importado daqui. O site usa outro React, e dois Reacts quebram o app.
// - "@site/postos.js" → ../src/postos.js (atalho em tsconfig.json, "paths").
const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");

const app = __dirname;
const site = path.resolve(app, "..", "src");
const doSite = arq => path.normalize(arq).toLowerCase().startsWith(site.toLowerCase() + path.sep);

const config = getDefaultConfig(app);
config.watchFolders = [...(config.watchFolders || []), site];
const anterior = config.resolver.resolveRequest;
config.resolver.resolveRequest = (ctx, nome, plataforma) => {
  const resolver = anterior || ctx.resolveRequest;
  if (doSite(ctx.originModulePath) && !nome.startsWith(".") && !path.isAbsolute(nome))
    return resolver({ ...ctx, originModulePath: path.join(app, "index.js") }, nome, plataforma);
  return resolver(ctx, nome, plataforma);
};

module.exports = config;
