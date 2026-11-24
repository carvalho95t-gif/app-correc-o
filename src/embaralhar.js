// Versões embaralhadas do caderno. A versão A é o caderno como foi digitado; as outras trocam
// a ordem das questões e/ou das alternativas, sempre iguais para a mesma semente.
// Numa versão: ordem[pos] = questão original na posição pos da folha;
// trocas[pos][j] = alternativa original que aparece na letra j da folha.
const SEM_TROCA = ['CE', 'VF']; // Certo/Errado e V/F ficam na ordem natural

function sorteador(semente) {
  let s = semente | 0;
  return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function embaralhado(n, rnd) {
  const v = [...Array(n).keys()];
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [v[i], v[j]] = [v[j], v[i]]; }
  return v;
}

export const ehEmbaralhada = prova => !!prova.versoes[1]?.ordem;

export function gerarVersoes(original, n, letras, embaralhar, semente) {
  const rnd = sorteador(semente), q = original.gabarito.length, L = letras.length;
  const trocaAlt = embaralhar.alternativas && !SEM_TROCA.includes(letras);
  return [{ gabarito: [...original.gabarito], anuladas: [...original.anuladas] }, ...[...Array(n - 1)].map(() => {
    const ordem = embaralhar.questoes ? embaralhado(q, rnd) : [...Array(q).keys()];
    const trocas = ordem.map(() => (trocaAlt ? embaralhado(L, rnd) : [...Array(L).keys()]));
    return {
      gabarito: ordem.map((o, p) => letras[trocas[p].indexOf(letras.indexOf(original.gabarito[o]))]),
      anuladas: ordem.flatMap((o, p) => (original.anuladas.includes(o) ? [p] : [])),
      ordem, trocas,
    };
  })];
}

// A prova com o caderno na ordem da versão k (0 = A).
export function cadernoDaVersao(prova, k) {
  const v = prova.versoes[k];
  if (!v?.ordem) return prova;
  const qs = prova.caderno.questoes;
  return { ...prova, caderno: { ...prova.caderno, questoes: v.ordem.map((o, p) =>
    ({ ...qs[o], alternativas: v.trocas[p].map(j => qs[o].alternativas[j]) })) } };
}

// Marcações de uma correção na ordem e nas letras do caderno original.
export function paraOriginal(prova, c) {
  const v = prova.versoes['ABCD'.indexOf(c.versao ?? 'A')], letras = prova.alternativas ?? 'ABCDE';
  if (!v?.ordem) return c.respostas;
  const out = Array(c.respostas.length);
  v.ordem.forEach((o, p) => {
    const r = c.respostas[p], j = letras.indexOf(r);
    out[o] = j >= 0 ? letras[v.trocas[p][j]] : r;
  });
  return out;
}
