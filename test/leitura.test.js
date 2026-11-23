// Seam: Leitura. Entra uma imagem em tons de cinza, sai o número de chamada e as marcações.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarLayout } from '../src/layout.js';
import { lerFolha } from '../src/leitor.js';
import { gerarFoto } from './sintetico.js';

const layout = montarLayout(20);
const respostas = ['A', 'B', 'C', 'D', 'E', null, ['A', 'C'], 'E', 'D', 'C', 'B', 'A', null, 'B', 'B', 'C', 'C', 'D', 'D', 'E'];
const esperado = ['A', 'B', 'C', 'D', 'E', 'branco', 'dupla', 'E', 'D', 'C', 'B', 'A', 'branco', 'B', 'B', 'C', 'C', 'D', 'D', 'E'];

test('folha reta: lê número de chamada, alternativas, em branco e dupla marcação', () => {
  const l = lerFolha(gerarFoto(layout, { numero: '05', respostas }), layout);
  assert.equal(l.numero, '05');
  assert.deepEqual(l.respostas.map(r => r.marca), esperado);
  assert.ok(l.respostas.every(r => !r.duvidosa));
});

test('imagem sem folha não tem leitura', () => {
  assert.equal(lerFolha({ width: 400, height: 500, data: new Uint8Array(200000).fill(128) }, layout), null);
});
