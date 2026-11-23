// Nota de uma correção: questão anulada conta como acerto; branco e dupla contam como erro.
export function corrigir(gabarito, anuladas, respostas) {
  if (respostas.length !== gabarito.length) throw new Error('Respostas e gabarito com tamanhos diferentes');
  const total = gabarito.length;
  const acertos = gabarito.filter((g, i) => anuladas.includes(i) || respostas[i] === g).length;
  return { acertos, total, percentual: Math.round((acertos / total) * 100), nota: Math.round((acertos / total) * 100) / 10 };
}
