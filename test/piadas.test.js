import { test } from 'node:test';
import assert from 'node:assert/strict';
import { faixas } from '../src/piadas.js';

test('faixas: conta alunos em 9–10, 7–8, 5–6, 3–4 e 0–2 na escala de 10', () => {
  // prova de valor 20: 19 → 9,5; 15 → 7,5; 10 → 5; 7 → 3,5; 2 → 1; 20 → 10
  assert.deepEqual(faixas([19, 15, 10, 7, 2, 20], 20), [2, 1, 1, 1, 1]);
});

test('falaDaFaixa: cada faixa tem quem fala, a cara e o texto; desligado não fala', async () => {
  const { falaDaFaixa } = await import('../src/piadas.js');
  assert.deepEqual(falaDaFaixa(0, 'raiz'), { quem: 'merenda', cara: 'feliz', texto: 'Acertou, miserávi! Protocolo de festa ativado.' });
  assert.equal(falaDaFaixa(4, 'raiz').texto, 'Erro 404: estudo não encontrado.');
  assert.notEqual(falaDaFaixa(4, 'leve').texto, falaDaFaixa(4, 'raiz').texto);
  assert.equal(falaDaFaixa(2, 'desligado'), null);
});

test('falaDaLeitura: comenta a folha pela fração de acerto', async () => {
  const { falaDaLeitura } = await import('../src/piadas.js');
  assert.deepEqual(falaDaLeitura(10, 10, 'raiz'), { quem: 'merenda', cara: 'feliz', texto: 'Gabaritou. Já pode chamar a família.' });
  assert.equal(falaDaLeitura(8, 10, 'raiz').quem, 'kevin');
  assert.equal(falaDaLeitura(1, 10, 'raiz').cara, 'bravo');
  assert.equal(falaDaLeitura(1, 10, 'desligado'), null);
  assert.equal(falaDaLeitura(0, 0, 'raiz'), null); // prova sem questões contadas (pesquisa)
});

test('falaDaQuestaoDificil: Neide comenta a questão mais errada com o número e o %', async () => {
  const { falaDaQuestaoDificil } = await import('../src/piadas.js');
  assert.deepEqual(falaDaQuestaoDificil(10, 3, 'raiz'),
    { quem: 'neide', cara: 'susto', texto: 'Q10: só 3% acertaram. Recalculando minha fé na humanidade… 0%.' });
  assert.match(falaDaQuestaoDificil(4, 60, 'leve').texto, /^Q4: 60% acertaram/);
  assert.equal(falaDaQuestaoDificil(4, 60, 'desligado'), null);
});

test('falaDaAnulada: Valdir fala das questões anuladas', async () => {
  const { falaDaAnulada } = await import('../src/piadas.js');
  assert.deepEqual(falaDaAnulada([7], 'raiz'),
    { quem: 'valdir', cara: 'tedio', texto: 'Conforme o regimento, a questão 7 foi anulada. Todo mundo ganha o ponto. Até quem faltou.' });
  assert.match(falaDaAnulada([2, 7], 'raiz').texto, /as questões 2 e 7 foram anuladas/);
  assert.equal(falaDaAnulada([], 'raiz'), null);
  assert.equal(falaDaAnulada([7], 'desligado'), null);
});

test('cafe: o café da Neide acaba junto com a pilha', async () => {
  const { cafe } = await import('../src/piadas.js');
  assert.deepEqual(cafe(14, 32), { resta: 56, faltam: 18 });
  assert.deepEqual(cafe(32, 32), { resta: 0, faltam: 0 });
  assert.deepEqual(cafe(35, 32), { resta: 0, faltam: 0 }); // alunos fora da lista
  assert.equal(cafe(3, 0), null); // turma sem lista de chamada
});

test('falaDoCafe: Neide conta o que falta e a Merenda celebra a pilha zerada', async () => {
  const { falaDoCafe } = await import('../src/piadas.js');
  assert.deepEqual(falaDoCafe(18, '2A', 'raiz'), { quem: 'neide', cara: 'tedio', texto: 'Faltam 18 provas da 2A. O café acaba antes.' });
  assert.deepEqual(falaDoCafe(0, '2A', 'raiz'), { quem: 'merenda', cara: 'feliz', texto: 'Pilha da 2A zerada. Já acabou, Jéssica? Acabou.' });
  assert.equal(falaDoCafe(1, '2A', 'leve').texto, 'Falta 1 prova da 2A.');
  assert.equal(falaDoCafe(3, '2A', 'desligado'), null);
});
