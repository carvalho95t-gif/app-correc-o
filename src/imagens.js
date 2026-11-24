// Imagens das questões do caderno ficam no IndexedDB (o localStorage é pequeno demais para elas).
// Na prova, a questão guarda só a referência "idb:<chave>"; a planilha leva a imagem inteira.
const BANCO = 'correcao-imagens', LOJA = 'imagens';
const REF = 'idb:';

function abrir() {
  return new Promise((ok, erro) => {
    const r = indexedDB.open(BANCO, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(LOJA);
    r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error);
  });
}
async function operar(modo, fn) {
  const db = await abrir();
  return new Promise((ok, erro) => {
    const t = db.transaction(LOJA, modo), r = fn(t.objectStore(LOJA));
    t.oncomplete = () => ok(r?.result); t.onerror = () => erro(t.error);
  });
}

// Mapa chave → data URL de todas as imagens guardadas.
export async function carregarImagens() {
  const [chaves, valores] = await Promise.all([operar('readonly', s => s.getAllKeys()), operar('readonly', s => s.getAll())]);
  return Object.fromEntries(chaves.map((k, i) => [k, valores[i]]));
}

// Guarda a data URL e devolve a referência para pôr na questão.
export async function guardarImagem(dataURL) {
  const chave = `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  await operar('readwrite', s => s.put(dataURL, chave));
  return REF + chave;
}
export const apagarImagens = refs => operar('readwrite', s => refs.forEach(r => s.delete(r.slice(REF.length))));

export const ehRef = v => typeof v === 'string' && v.startsWith(REF);
export const resolver = (mapa, v) => (ehRef(v) ? mapa[v.slice(REF.length)] : v);

// Reduz a imagem para no máximo `lado` px no lado maior, em JPEG.
export async function reduzir(arquivo, lado = 800) {
  const img = await createImageBitmap(arquivo), f = Math.min(1, lado / Math.max(img.width, img.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(img.width * f); cv.height = Math.round(img.height * f);
  const ctx = cv.getContext('2d');
  ctx.fillStyle = 'white'; ctx.fillRect(0, 0, cv.width, cv.height); // PNG transparente não fica preto
  ctx.drawImage(img, 0, 0, cv.width, cv.height);
  return cv.toDataURL('image/jpeg', 0.8);
}
