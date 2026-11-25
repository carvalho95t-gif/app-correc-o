// Seam: montarProva. Entram os parágrafos do Word, sai a prova (questões, fonte, pontos e gabarito).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarProva } from '../src/docx.js';

const p = (texto, direita = false) => ({ texto, negrito: false, direita, imagens: [] });

test('docx: a fonte é a linha alinhada à direita, mesmo se o texto-base começa com "Para Kant,"', () => {
  const prova = montarProva([
    p('QUESTÃO 01 (5,0 pontos)'),
    p('Para Kant, o esclarecimento é a saída do homem de sua menoridade.'),
    p('Texto elaborado a partir de KANT, Immanuel.', true),
    p('Com base no texto, é correto afirmar que:'),
    p('a) um'), p('b) dois'),
  ]);
  const q = prova.questoes[0];
  assert.equal(q.fonte, 'Texto elaborado a partir de KANT, Immanuel.');
  assert.equal(q.enunciado, 'Para Kant, o esclarecimento é a saída do homem de sua menoridade.');
  assert.equal(q.comando, 'Com base no texto, é correto afirmar que:');
});

test('docx: referência "SOBRENOME, Nome" sem alinhamento ainda vira fonte', () => {
  const q = montarProva([p('QUESTÃO 1'), p('Texto.'), p('MONTAIGNE, Michel de. Os ensaios.'), p('Comando:'), p('a) x'), p('b) y')]).questoes[0];
  assert.equal(q.fonte, 'MONTAIGNE, Michel de. Os ensaios.');
});

test('docx: os pontos de "QUESTÃO 01 (2,5 pontos)" vêm junto; sem pontos, null', () => {
  const prova = montarProva([p('QUESTÃO 01 (2,5 pontos)'), p('a) x'), p('b) y'), p('QUESTÃO 02'), p('a) x'), p('b) y')]);
  assert.deepEqual(prova.questoes.map(q => q.pontos), [2.5, null]);
});
