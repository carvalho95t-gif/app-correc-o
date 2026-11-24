// Nota de uma correção: questão anulada conta como acerto; branco e dupla contam como erro.
// Cada questão vale seu peso (1 quando não há pesos); a nota é pontos ÷ pontos possíveis × 10.
export function corrigir(gabarito, anuladas, respostas, pesos = []) {
  if (respostas.length !== gabarito.length) throw new Error('Respostas e gabarito com tamanhos diferentes');
  const peso = i => pesos[i] ?? 1, certa = i => anuladas.includes(i) || respostas[i] === gabarito[i];
  const idx = gabarito.map((_, i) => i);
  const acertos = idx.filter(certa).length;
  const pontos = idx.filter(certa).reduce((s, i) => s + peso(i), 0), possiveis = idx.reduce((s, i) => s + peso(i), 0);
  return { acertos, total: gabarito.length, pontos, possiveis,
    percentual: Math.round((pontos / possiveis) * 100), nota: Math.round((pontos / possiveis) * 100) / 10 };
}
