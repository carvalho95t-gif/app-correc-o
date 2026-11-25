// Seam: banco de questões no arquivo do app (funções puras de estado.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { arquivoInicial, comAtivo, apagarProva, estadoInicial, guardarNoBanco, tirarDoBanco, buscarNoBanco } from '../src/estado.js';

const q = (enunciado, extra = {}) => ({ enunciado, fonte: '', comando: 'Assinale:', alternativas: ['um', 'dois'], certa: 'B', disciplina: 'Filosofia', assunto: 'Ética', ...extra });

test('banco: guarda, não repete a mesma questão, busca por texto, disciplina ou assunto e tira', () => {
  let a = guardarNoBanco(arquivoInicial(), q('Para Kant, o dever...'));
  a = guardarNoBanco(a, q('Para Kant, o dever...', { assunto: 'Kant' })); // mesma questão: atualiza
  a = guardarNoBanco(a, q('Sócrates e a maiêutica', { assunto: 'Antiga' }));
  assert.equal(a.banco.length, 2);
  assert.equal(a.banco[0].assunto, 'Kant');
  assert.deepEqual(buscarNoBanco(a.banco, 'kant').map(x => x.enunciado), ['Para Kant, o dever...']);
  assert.deepEqual(buscarNoBanco(a.banco, 'antiga').map(x => x.enunciado), ['Sócrates e a maiêutica']);
  assert.equal(buscarNoBanco(a.banco, 'socrates').length, 1); // sem acento também acha
  assert.equal(buscarNoBanco(a.banco, '').length, 2);
  a = tirarDoBanco(a, a.banco[0].id);
  assert.deepEqual(a.banco.map(x => x.enunciado), ['Sócrates e a maiêutica']);
});

test('banco: gravar ou apagar uma prova não perde o banco', () => {
  let a = guardarNoBanco(arquivoInicial(), q('Questão guardada'));
  a = comAtivo(a, estadoInicial());
  assert.equal(a.banco.length, 1);
  a = apagarProva(a, a.ativa);
  assert.equal(a.banco.length, 1);
});
