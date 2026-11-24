// Leitura da folha de respostas a partir de uma imagem em tons de cinza {width, height, data}.
import { decodificar } from './codigo.js';
export const MARCADO = 0.45;
export const VAZIO = 0.20;

// Homografia que leva origem[i] -> destino[i] (4 pontos), como array de 9 números.
export function homografia(origem, destino) {
  const A = [];
  origem.forEach(({ x, y }, i) => {
    const { x: u, y: v } = destino[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  });
  for (let c = 0; c < 8; c++) { // eliminação de Gauss com pivô parcial
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 8; r++) if (r !== c) {
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  return [...A.map((row, i) => row[8] / row[i]), 1];
}

export function aplicar(H, x, y) {
  const w = H[6] * x + H[7] * y + H[8];
  return { x: (H[0] * x + H[1] * y + H[2]) / w, y: (H[3] * x + H[4] * y + H[5]) / w };
}

// Índice marcado (>=0), -1 branco, -2 dupla; duvidosa se algum valor está na faixa ambígua.
function avaliar(preenchimentos) {
  const marcados = preenchimentos.flatMap((f, i) => (f >= MARCADO ? [i] : []));
  return {
    indice: marcados.length === 1 ? marcados[0] : marcados.length === 0 ? -1 : -2,
    duvidosa: preenchimentos.some(f => f > VAZIO && f < MARCADO),
  };
}

export function classificar(preenchimentos, letras = 'ABCDE') {
  const { indice, duvidosa } = avaliar(preenchimentos);
  return { marca: indice >= 0 ? letras[indice] : indice === -1 ? 'branco' : 'dupla', duvidosa };
}

const mediana = v => v.sort((a, b) => a - b)[v.length >> 1];

export function lerComMarcadores(cinza, layout, marcadoresPx) {
  const H = homografia(layout.marcadores, marcadoresPx);
  const pixel = (x, y) => {
    const p = aplicar(H, x, y);
    const px = Math.min(cinza.width - 1, Math.max(0, Math.round(p.x - 0.5)));
    const py = Math.min(cinza.height - 1, Math.max(0, Math.round(p.y - 0.5)));
    return cinza.data[py * cinza.width + px];
  };
  const tinta = [], papel = [];
  for (const m of layout.marcadores) for (let dx = -3; dx <= 3; dx++) for (let dy = -3; dy <= 3; dy++) tinta.push(pixel(m.x + dx, m.y + dy));
  if (layout.papel) for (const p of layout.papel) papel.push(pixel(p.x, p.y));
  else for (let y = 105; y <= 270; y += 2) papel.push(pixel(70, y), pixel(130, y)); // faixas sem impressão entre colunas
  // Escurecimento relativo (0 = papel, 1 = tinta): mantém a leitura igual em cópias claras e escuras.
  const nivelTinta = mediana(tinta), nivelPapel = mediana(papel);
  const escuro = v => Math.min(1, Math.max(0, (nivelPapel - v) / (nivelPapel - nivelTinta)));

  const r = 0.7 * layout.raio, passo = r / 4;
  const preenchimento = b => {
    let soma = 0, total = 0;
    for (let dx = -r; dx <= r + 1e-9; dx += passo) for (let dy = -r; dy <= r + 1e-9; dy += passo) {
      if (dx * dx + dy * dy > r * r) continue;
      total++; soma += escuro(pixel(b.x + dx, b.y + dy));
    }
    return soma / total;
  };

  const respostas = layout.questoes.map(q => {
    const preenchimentos = q.map(preenchimento);
    return { ...classificar(preenchimentos, layout.alternativas), preenchimentos };
  });
  const digitos = layout.numero.map(col => avaliar(col.map(preenchimento)));
  const versao = layout.versao ? avaliar(layout.versao.map(preenchimento)) : { indice: 0, duvidosa: false };
  const celula = c => { // média do escurecimento numa grade 3×3 dentro da célula
    let soma = 0;
    for (const fx of [-0.25, 0, 0.25]) for (const fy of [-0.25, 0, 0.25]) soma += escuro(pixel(c.x + fx * layout.codigoCelula.w, c.y + fy * layout.codigoCelula.h));
    return soma / 9;
  };
  return {
    codigo: layout.codigo ? decodificar(layout.codigo.map(c => celula(c) > 0.5)) : null, // o quadro leva o código no QR
    versao: versao.indice >= 0 ? 'ABCD'[versao.indice] : null,
    versaoDuvidosa: versao.duvidosa,
    numero: digitos.every(d => d.indice >= 0) ? digitos.map(d => d.indice).join('') : null,
    numeroDuvidoso: digitos.some(d => d.duvidosa),
    respostas,
    marcadoresPx,
  };
}

export function paraCinza({ width, height, data }) {
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = Math.round(0.299 * data[4 * i] + 0.587 * data[4 * i + 1] + 0.114 * data[4 * i + 2]);
  return { width, height, data: out };
}

function reduzir({ width, height, data }, f) {
  const w = Math.floor(width / f), h = Math.floor(height / f), out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0;
    for (let dy = 0; dy < f; dy++) for (let dx = 0; dx < f; dx++) s += data[(y * f + dy) * width + x * f + dx];
    out[y * w + x] = s / (f * f);
  }
  return { width: w, height: h, data: out };
}

function otsu(data) {
  const hist = new Array(256).fill(0);
  for (const v of data) hist[v]++;
  let soma = 0; hist.forEach((n, v) => { soma += n * v; });
  let sB = 0, wB = 0, melhor = 0, limiar = 0;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue;
    const wF = data.length - wB; if (!wF) break;
    sB += t * hist[t];
    const entre = wB * wF * (sB / wB - (soma - sB) / wF) ** 2;
    if (entre > melhor) { melhor = entre; limiar = t; }
  }
  return limiar;
}

// Componentes escuros com cara de quadrado preto cheio.
function candidatos(img) {
  const { width: w, height: h, data } = img, t = otsu(data), N = w * h;
  const visto = new Uint8Array(N), lista = [];
  for (let i = 0; i < N; i++) {
    if (visto[i] || data[i] > t) continue;
    const pilha = [i]; visto[i] = 1;
    let n = 0, sx = 0, sy = 0, x0 = w, x1 = 0, y0 = h, y1 = 0;
    while (pilha.length) {
      const j = pilha.pop(), x = j % w, y = (j - x) / w;
      n++; sx += x + 0.5; sy += y + 0.5;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, y > 0 ? j - w : -1, y < h - 1 ? j + w : -1])
        if (k >= 0 && !visto[k] && data[k] <= t) { visto[k] = 1; pilha.push(k); }
    }
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
    if (bw / bh >= 0.6 && bw / bh <= 1.6 && n / (bw * bh) >= 0.65 && n >= N / 5000 && n <= N / 50)
      lista.push({ x: sx / n, y: sy / n, n });
  }
  const maior = Math.max(0, ...lista.map(c => c.n));
  return lista.filter(c => c.n >= 0.3 * maior); // descarta bolinhas pintadas e sujeira pequena
}

// Largura sobre altura do retângulo dos marcadores de um layout.
export const razaoDe = ({ marcadores: [tl, tr, , bl] }) => (tr.x - tl.x) / (bl.y - tl.y);

// Centros dos 4 marcadores (TL, TR, BR, BL) em pixels da imagem original, ou null.
// razao: largura/altura esperada do retângulo dos marcadores (padrão: folha avulsa A4).
export function acharMarcadores(cinza, razaoEsperada = 180 / 267) {
  const f = Math.max(1, Math.ceil(Math.max(cinza.width, cinza.height) / 1000));
  const c = candidatos(f > 1 ? reduzir(cinza, f) : cinza);
  if (c.length < 4) return null;
  const melhor = pont => c.reduce((a, b) => (pont(b) > pont(a) ? b : a));
  const cantos = [p => -p.x - p.y, p => p.x - p.y, p => p.x + p.y, p => p.y - p.x].map(melhor);
  if (new Set(cantos).size < 4) return null;
  const d = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const razao = (d(cantos[0], cantos[1]) + d(cantos[3], cantos[2])) / (d(cantos[0], cantos[3]) + d(cantos[1], cantos[2]));
  if (Math.abs(razao / razaoEsperada - 1) > 0.25) return null;
  return cantos.map(p => ({ x: p.x * f, y: p.y * f }));
}

// Câmera ao vivo: o quadro está pronto quando os marcadores aparecem nos últimos 3 quadros
// e nenhum se moveu mais que 2% da largura da imagem.
export function quadroPronto(historico, largura, n = 3) {
  const ultimos = historico.slice(-n);
  if (ultimos.length < n || ultimos.some(m => !m)) return false;
  return ultimos.slice(1).every((m, k) => m.every((p, i) => Math.hypot(p.x - ultimos[k][i].x, p.y - ultimos[k][i].y) < 0.02 * largura));
}

export function lerFolha(cinza, layout) {
  const m = acharMarcadores(cinza, razaoDe(layout));
  return m && lerComMarcadores(cinza, layout, m);
}

// Câmera ao vivo: aviso quando a imagem está escura demais para ler as bolinhas.
export function poucaLuz({ data }) {
  let soma = 0;
  for (let i = 0; i < data.length; i += 7) soma += data[i];
  return soma / Math.ceil(data.length / 7) < 70;
}
