// Falas do elenco (Prof.ª Neide, Coord. Valdir, Kevin do fundão, Dona Merenda) por momento da correção.
// Nível "desligado" não tem fala. Nenhuma fala cita nome ou número de aluno.

const LIMITES = [9, 7, 5, 3]; // faixas 9–10, 7–8, 5–6, 3–4, 0–2 na escala de 10

// Quantos alunos em cada faixa, com as notas na escala do valor da prova.
export function faixas(notas, valor) {
  const conta = [0, 0, 0, 0, 0];
  for (const n of notas) {
    const dez = Math.round((n / valor) * 1000) / 100; // evita 6,9999… por arredondamento
    const i = LIMITES.findIndex(l => dez >= l);
    conta[i === -1 ? 4 : i]++;
  }
  return conta;
}

const fala = (quem, cara, texto) => ({ quem, cara, texto });
const FAIXAS = {
  raiz: [
    fala('merenda', 'feliz', 'Acertou, miserávi! Protocolo de festa ativado.'),
    fala('kevin', 'feliz', 'Mandou bem. Vou fingir que não estou impressionado.'),
    fala('neide', 'tedio', 'Raspando. Igual o Wi-Fi da escola.'),
    fala('valdir', 'susto', 'Calma, Calabreso. Respira.'),
    fala('valdir', 'bravo', 'Erro 404: estudo não encontrado.'),
  ],
  leve: [
    fala('merenda', 'feliz', 'Acertou, miserávi!'),
    fala('kevin', 'feliz', 'Mandou bem!'),
    fala('neide', 'tedio', 'No caminho. Dá pra subir.'),
    fala('valdir', 'susto', 'Calma, Calabreso.'),
    fala('valdir', 'tedio', 'Bora pra recuperação, sem drama.'),
  ],
};
// Fala da faixa i (0 = 9–10 … 4 = 0–2).
export const falaDaFaixa = (i, nivel) => FAIXAS[nivel]?.[i] ?? null;

const LEITURA = {
  raiz: [
    fala('merenda', 'feliz', 'Gabaritou. Já pode chamar a família.'),
    fala('kevin', 'bravo', 'Errou umas. Eu esperava mais. Não muito, mas mais.'),
    fala('neide', 'tedio', 'Na média. Igual o café da sala dos professores.'),
    fala('valdir', 'susto', 'Calma, Calabreso. Ainda dá pra recuperar.'),
    fala('kevin', 'bravo', 'Errou feio, errou rude.'),
  ],
  leve: [
    fala('merenda', 'feliz', 'Gabaritou!'),
    fala('kevin', 'feliz', 'Foi bem!'),
    fala('neide', 'tedio', 'Na média.'),
    fala('valdir', 'susto', 'Dá pra recuperar.'),
    fala('kevin', 'tedio', 'Essa vai precisar de reforço.'),
  ],
};
// Fala sobre uma folha: gabaritou, 7–8, 5–6, 3–4 ou abaixo (na escala de 10).
export function falaDaLeitura(acertos, total, nivel) {
  if (!total || !LEITURA[nivel]) return null;
  return LEITURA[nivel][acertos === total ? 0 : Math.max(1, faixas([acertos], total).indexOf(1))];
}

// Neide sobre a questão com menor % de acerto (número da questão começa em 1).
export function falaDaQuestaoDificil(questao, acerto, nivel) {
  if (nivel === 'raiz') return fala('neide', 'susto', `Q${questao}: só ${acerto}% acertaram. Recalculando minha fé na humanidade… 0%.`);
  if (nivel === 'leve') return fala('neide', 'tedio', `Q${questao}: ${acerto}% acertaram. Vale revisar em sala.`);
  return null;
}

// Valdir sobre as questões anuladas (números começam em 1).
export function falaDaAnulada(questoes, nivel) {
  if (!questoes.length || !['raiz', 'leve'].includes(nivel)) return null;
  const qual = questoes.length === 1 ? `a questão ${questoes[0]} foi anulada`
    : `as questões ${questoes.slice(0, -1).join(', ')} e ${questoes.at(-1)} foram anuladas`;
  return fala('valdir', 'tedio', `Conforme o regimento, ${qual}. Todo mundo ganha o ponto.${nivel === 'raiz' ? ' Até quem faltou.' : ''}`);
}

// Café que resta (%) e provas que faltam, quando se sabe o tamanho da turma.
export function cafe(corrigidas, total) {
  if (!total) return null;
  const faltam = Math.max(0, total - corrigidas);
  return { resta: Math.round((faltam / total) * 100), faltam };
}

export const NOMES = { neide: 'Prof.ª Neide', valdir: 'Coordenador Valdir', kevin: 'Kevin do fundão', merenda: 'Dona Merenda' };
export const NIVEIS = ['desligado', 'leve', 'raiz'];
