// Nota de uma correção: questão anulada conta como acerto; branco e dupla contam como erro.
// Cada questão vale seu peso (1 quando não há pesos); a nota é pontos ÷ pontos possíveis × 10.
export function corrigir(gabarito, anuladas, respostas, pesos = [], areas = []) {
  if (respostas.length !== gabarito.length) throw new Error('Respostas e gabarito com tamanhos diferentes');
  const peso = i => pesos[i] ?? 1, certa = i => anuladas.includes(i) || respostas[i] === gabarito[i];
  const idx = gabarito.map((_, i) => i);
  const pts = is => is.reduce((s, i) => s + peso(i), 0);
  const acertos = idx.filter(certa).length, pontos = pts(idx.filter(certa)), possiveis = pts(idx);
  const porArea = areas.map(a => {
    const is = idx.slice(a.de - 1, a.ate);
    return { nome: a.nome, acertos: is.filter(certa).length, percentual: Math.round((pts(is.filter(certa)) / pts(is)) * 100) };
  });
  return { acertos, total: gabarito.length, pontos, possiveis, porArea,
    percentual: Math.round((pontos / possiveis) * 100), nota: Math.round((pontos / possiveis) * 100) / 10 };
}
