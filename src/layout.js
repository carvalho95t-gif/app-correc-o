// Geometria da folha de respostas, em mm numa página A4 retrato.
// Com mais de uma versão, a folha ganha uma coluna de bolinhas A–D para o aluno marcar a versão.
// alternativas: as letras da prova, por exemplo 'ABCDE', 'ABCD' ou 'CE'.
export function montarLayout(numQuestoes, numVersoes = 1, alternativas = 'ABCDE') {
  if (!Number.isInteger(numQuestoes) || numQuestoes < 1 || numQuestoes > 90)
    throw new RangeError('Número de questões deve ser de 1 a 90');
  const questoes = [];
  for (let q = 0; q < numQuestoes; q++) {
    const x0 = [25, 85, 145][Math.floor(q / 30)], y = 110 + 5.5 * (q % 30);
    questoes.push([...alternativas].map((_, j) => ({ x: x0 + 8 + 6 * j, y })));
  }
  const digitos = x => [...Array(10)].map((_, d) => ({ x, y: 40 + 6 * d }));
  return {
    pagina: { w: 210, h: 297 },
    marcadorLado: 10,
    marcadores: [{ x: 15, y: 15 }, { x: 195, y: 15 }, { x: 195, y: 282 }, { x: 15, y: 282 }], // TL, TR, BR, BL
    raio: 2.2,
    numero: [digitos(150), digitos(157)],
    alternativas,
    // Faixa do código da prova entre os dois marcadores de cima; células separadas para não virarem um marcador.
    codigo: [...Array(20)].map((_, i) => ({ x: 33 + 7.5 * i, y: 15 })),
    codigoCelula: { w: 5, h: 4 },
    questoes,
    ...(numVersoes > 1 ? { versao: [...Array(numVersoes)].map((_, v) => ({ x: 175, y: 40 + 6 * v })) } : {}),
  };
}
