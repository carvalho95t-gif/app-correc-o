// Gera "fotos" sintéticas da folha em tons de cinza, só para testes.
import { homografia, aplicar } from '../src/leitor.js';

export function rng(seed) {
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function cantosPagina(layout, o) {
  const { w, h } = layout.pagina, s = o.pxPorMm;
  const W = o.largura ?? Math.round(w * s), H = o.altura ?? Math.round(h * s);
  const cx = W / 2, cy = H / 2, a = (o.rotacaoGraus * Math.PI) / 180;
  const base = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]
    .map(([x, y], i) => [i < 2 ? x * (1 - o.perspectiva) : x, y]); // topo mais estreito = inclinada
  return { W, H, cantos: base.map(([x, y]) => ({ x: cx + s * (x * Math.cos(a) - y * Math.sin(a)), y: cy + s * (x * Math.sin(a) + y * Math.cos(a)) })) };
}

const PADRAO = { pxPorMm: 4, rotacaoGraus: 0, perspectiva: 0, papel: 235, tinta: 25, ruido: 0, gradiente: 0, fundo: null, manchas: [], semente: 1 };
const pagina = l => [{ x: 0, y: 0 }, { x: l.pagina.w, y: 0 }, { x: l.pagina.w, y: l.pagina.h }, { x: 0, y: l.pagina.h }];

export function cantosPx(layout, opcoes = {}) {
  const o = { ...PADRAO, ...opcoes }, { cantos } = cantosPagina(layout, o);
  const H = homografia(pagina(layout), cantos);
  return layout.marcadores.map(m => aplicar(H, m.x, m.y));
}

// marcas.versao: 'A'..'D' | null | ['A','B']. marcas.codigo: bits da faixa do código (ausente = folha antiga).
// marcas.respostas[i]: 'A'..'E' | null (branco) | ['A','B'] (dupla) | {letra, fracao?, tom?} (parcial ou clara)
export function gerarFoto(layout, marcas, opcoes = {}) {
  const o = { ...PADRAO, ...opcoes };
  const { W, H: Ht, cantos } = cantosPagina(layout, o);
  const inv = homografia(cantos, pagina(layout));
  const r = layout.raio, L = layout.alternativas;
  const bolhas = [];
  layout.questoes.forEach((q, i) => {
    const m = marcas.respostas?.[i];
    q.forEach((p, j) => {
      let f = 0;
      if (m === L[j] || (Array.isArray(m) && m.includes(L[j]))) f = 1;
      else if (m && m.letra === L[j]) f = m.fracao ?? 1;
      const tom = m && m.letra === L[j] ? m.tom : undefined;
      bolhas.push({ ...p, f, tom });
    });
  });
  (layout.versao ?? []).forEach((p, v) => {
    const m = marcas.versao; // 'B' | null | ['A','B']
    bolhas.push({ ...p, f: m === 'ABCD'[v] || (Array.isArray(m) && m.includes('ABCD'[v])) ? 1 : 0 });
  });
  layout.numero.forEach((col, c) => col.forEach((p, d) => {
    const dig = marcas.numero?.[c];
    bolhas.push({ ...p, f: Array.isArray(dig) ? (dig.includes(d) ? 1 : 0) : (dig !== undefined && dig !== null && +dig === d ? 1 : 0) });
  }));
  const grade = new Map(), k = (x, y) => `${Math.floor(x / 5)},${Math.floor(y / 5)}`;
  for (const b of bolhas) for (const dx of [-r, r]) for (const dy of [-r, r]) {
    const kk = k(b.x + dx, b.y + dy); if (!grade.has(kk)) grade.set(kk, new Set()); grade.get(kk).add(b);
  }
  const rand = rng(o.semente), data = new Uint8Array(W * Ht), meio = layout.marcadorLado / 2;
  for (let py = 0; py < Ht; py++) for (let px = 0; px < W; px++) {
    const { x, y } = aplicar(inv, px + 0.5, py + 0.5);
    let v;
    if (x < 0 || y < 0 || x > layout.pagina.w || y > layout.pagina.h) v = o.fundo ?? o.papel;
    else {
      v = o.papel;
      if (layout.marcadores.some(m => Math.abs(x - m.x) <= meio && Math.abs(y - m.y) <= meio)) v = o.tinta;
      const cel = layout.codigoCelula;
      if (marcas.codigo && layout.codigo.some((c, i) => marcas.codigo[i] && Math.abs(x - c.x) <= cel.w / 2 && Math.abs(y - c.y) <= cel.h / 2)) v = o.tinta;
      for (const b of grade.get(k(x, y)) ?? []) {
        const d = Math.hypot(x - b.x, y - b.y);
        if (d > r + 0.2) continue;
        if (b.f > 0 && d <= r && x <= b.x - r + 2 * r * b.f) v = b.tom ?? o.tinta;
        else if (Math.abs(d - r) < 0.15) v = o.tinta;               // contorno
        else if (d < 0.9) v = Math.min(v, o.papel - 60);            // letra impressa em cinza
      }
    }
    for (const mm of o.manchas) if (px >= mm.x && px < mm.x + mm.w && py >= mm.y && py < mm.y + mm.h) v = o.tinta;
    v -= o.gradiente * (px / W) + (rand() - 0.5) * 2 * o.ruido;
    data[py * W + px] = Math.max(0, Math.min(255, Math.round(v)));
  }
  return { width: W, height: Ht, data };
}
