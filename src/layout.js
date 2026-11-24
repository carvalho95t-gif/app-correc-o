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

// Quadro do gabarito na página 1 da prova (até 30 questões), em mm com origem no canto de cima à esquerda do quadro.
// À esquerda o QR code, à direita o número de chamada e as questões em colunas de 10.
// Os 4 marcadores cercam o QR e as bolinhas: o que fica dentro deles nunca é tomado por um canto.
export const MAX_QUADRO = 30;
export function montarQuadro(numQuestoes, alternativas = 'ABCDE') {
  if (!Number.isInteger(numQuestoes) || numQuestoes < 1 || numQuestoes > MAX_QUADRO)
    throw new RangeError(`O quadro do gabarito cabe de 1 a ${MAX_QUADRO} questões`);
  const linha = k => 21 + 5 * k;
  const questoes = [...Array(numQuestoes)].map((_, q) =>
    [...alternativas].map((_, j) => ({ x: [63, 95.5, 128][Math.floor(q / 10)] + 9.5 + 5 * j, y: linha(q % 10) })));
  const digitos = x => [...Array(10)].map((_, d) => ({ x, y: linha(d) }));
  const papel = [16, 20, 24, 28, 32, 36, 40].flatMap(x => [23, 25, 27, 59, 61, 63].map(y => ({ x, y })));
  return {
    tipo: 'quadro',
    pagina: { w: 174, h: 86.5 },
    marcadorLado: 8,
    marcadores: [{ x: 8, y: 15 }, { x: 166, y: 15 }, { x: 166, y: 71 }, { x: 8, y: 71 }], // TL, TR, BR, BL
    raio: 2,
    numero: [digitos(52), digitos(57.5)],
    alternativas,
    questoes,
    qr: { x: 14, y: 29.25, lado: 28 },
    papel, // pontos sem impressão, para medir o branco do papel
  };
}
