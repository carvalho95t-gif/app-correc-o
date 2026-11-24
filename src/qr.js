// QR code do quadro do gabarito: diz a prova e a versão. Texto curto, ex.: "AC1:123:B".
import qrcode from '../vendor/qrcode-generator.js';

export const textoQR = (prova, versao) => `AC1:${prova}${versao ? `:${versao}` : ''}`;

export function lerTextoQR(texto) {
  const m = /^AC1:(\d{1,4})(?::([A-D]))?$/.exec(texto ?? '');
  return m ? { prova: +m[1], versao: m[2] ?? null } : null;
}

// Módulos do QR como um só caminho SVG, em mm, com o canto de cima à esquerda em (x, y).
export function qrSVG(texto, x, y, lado) {
  const q = qrcode(0, 'M');
  q.addData(texto); q.make();
  const n = q.getModuleCount(), m = lado / n, f = v => +v.toFixed(3);
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++)
    if (q.isDark(r, c)) d += `M${f(x + c * m)} ${f(y + r * m)}h${f(m)}v${f(m)}h${f(-m)}z`;
  return `<path class="qr" d="${d}" fill="black"/>`;
}

// Leitor do navegador quando existe (Android Chrome); senão o jsQR, carregado só quando precisa.
let jsQR = null;
const carregarJsQR = () => (jsQR ??= new Promise(ok => {
  if (globalThis.jsQR) return ok(globalThis.jsQR);
  const s = document.createElement('script');
  s.src = 'vendor/jsQR.js';
  s.onload = () => ok(globalThis.jsQR); s.onerror = () => { jsQR = null; ok(null); };
  document.head.append(s);
}));

// imagem: ImageData (RGBA). Devolve {prova, versao} ou null.
export async function lerQR(imagem) {
  if (!imagem) return null;
  try {
    if (globalThis.BarcodeDetector && (await BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
      for (const r of await new BarcodeDetector({ formats: ['qr_code'] }).detect(imagem)) {
        const lido = lerTextoQR(r.rawValue);
        if (lido) return lido;
      }
    }
  } catch { /* cai no jsQR */ }
  const ler = await carregarJsQR();
  return lerTextoQR(ler?.(imagem.data, imagem.width, imagem.height)?.data);
}
