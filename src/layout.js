// Geometria da folha de respostas, em mm numa página A4 retrato.
export function montarLayout(numQuestoes) {
  if (!Number.isInteger(numQuestoes) || numQuestoes < 1 || numQuestoes > 90)
    throw new RangeError('Número de questões deve ser de 1 a 90');
  const questoes = [];
  for (let q = 0; q < numQuestoes; q++) {
    const x0 = [25, 85, 145][Math.floor(q / 30)], y = 110 + 5.5 * (q % 30);
    questoes.push([0, 1, 2, 3, 4].map(j => ({ x: x0 + 8 + 6 * j, y })));
  }
  const digitos = x => [...Array(10)].map((_, d) => ({ x, y: 40 + 6 * d }));
  return {
    pagina: { w: 210, h: 297 },
    marcadorLado: 10,
    marcadores: [{ x: 15, y: 15 }, { x: 195, y: 15 }, { x: 195, y: 282 }, { x: 15, y: 282 }], // TL, TR, BR, BL
    raio: 2.2,
    numero: [digitos(150), digitos(157)],
    questoes,
  };
}
