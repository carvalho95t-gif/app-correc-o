// Nota de uma correção: questão anulada conta como acerto; branco e dupla contam como erro.
// Cada questão vale seu peso (1 quando não há pesos); a nota é pontos ÷ pontos possíveis × 10.
// parciais[i]: fração da questão que cada alternativa errada vale, ex.: { B: 0.75, C: 0.5 }.
export function corrigir(gabarito, anuladas, respostas, pesos = [], areas = [], parciais = []) {
  if (respostas.length !== gabarito.length) throw new Error('Respostas e gabarito com tamanhos diferentes');
  const peso = i => pesos[i] ?? 1, certa = i => anuladas.includes(i) || respostas[i] === gabarito[i];
  const credito = i => (certa(i) ? 1 : parciais[i]?.[respostas[i]] ?? 0);
  const idx = gabarito.map((_, i) => i);
  const pts = is => Math.round(is.reduce((s, i) => s + peso(i) * credito(i), 0) * 1000) / 1000;
  const peso1 = is => is.reduce((s, i) => s + peso(i), 0);
  const acertos = idx.filter(certa).length, pontos = pts(idx), possiveis = peso1(idx);
  const porArea = areas.map(a => {
    const is = idx.slice(a.de - 1, a.ate);
    return { nome: a.nome, acertos: is.filter(certa).length, percentual: Math.round((pts(is) / peso1(is)) * 100) };
  });
  return { acertos, total: gabarito.length, pontos, possiveis, porArea,
    percentual: Math.round((pontos / possiveis) * 100), nota: Math.round((pontos / possiveis) * 100) / 10 };
}
