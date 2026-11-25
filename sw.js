// Guarda os arquivos do app para funcionar sem internet. Responde do cache na hora e atualiza
// o cache pela rede em segundo plano, então uma versão nova aparece na abertura seguinte.
const VERSAO = 'correcao-v7';
const ARQUIVOS = ['./', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest',
  'src/layout.js', 'src/folha.js', 'src/leitor.js', 'src/nota.js', 'src/estado.js', 'src/planilha.js', 'src/codigo.js', 'src/caderno.js', 'src/imagens.js', 'src/embaralhar.js', 'src/qr.js', 'src/docx.js',
  'vendor/xlsx.mini.min.js', 'vendor/qrcode-generator.js', 'vendor/jsQR.js'];

self.addEventListener('install', e => e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())));
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const daRede = fetch(e.request).then(r => {
    if (r.ok) { const copia = r.clone(); caches.open(VERSAO).then(c => c.put(e.request, copia)); }
    return r;
  });
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(r => {
    if (r) { e.waitUntil(daRede.catch(() => {})); return r; }
    return daRede;
  }));
});
