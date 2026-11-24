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

// ---------- ticket 03: leitura robusta ----------
import { rng } from './sintetico.js';
const layout45 = montarLayout(45);
const sorteio = rng(42);
const resp45 = layout45.questoes.map(() => 'ABCDE'[Math.floor(sorteio() * 5)]);
const confere = opcoes => {
  const l = lerFolha(gerarFoto(layout45, { numero: '17', respostas: resp45 }, opcoes), layout45);
  assert.ok(l, 'não achou a folha');
  assert.deepEqual(l.respostas.map(r => r.marca), resp45);
  assert.equal(l.numero, '17');
};

test('folha girada 8°', () => confere({ rotacaoGraus: 8, largura: 1000, altura: 1300 }));
test('folha inclinada (perspectiva)', () => confere({ perspectiva: 0.15 }));
test('ruído e luz desigual', () => confere({ ruido: 20, gradiente: 60 }));
test('fotocópia clara', () => confere({ papel: 200, tinta: 70 }));
test('fotocópia escura', () => confere({ papel: 180, tinta: 20 }));
test('folha sobre mesa escura com objetos escuros perto da borda', () => confere({
  pxPorMm: 3, largura: 1100, altura: 1250, fundo: 40, rotacaoGraus: -4,
  manchas: [{ x: 5, y: 5, w: 30, h: 30 }, { x: 1050, y: 1180, w: 40, h: 40 }, { x: 1040, y: 20, w: 35, h: 30 }],
}));
test('foto de 12 MP lida em menos de 2 s', () => {
  const foto = gerarFoto(layout45, { numero: '17', respostas: resp45 }, { pxPorMm: 9.5, largura: 3000, altura: 4000 });
  const t = performance.now();
  const l = lerFolha(foto, layout45);
  assert.ok(performance.now() - t < 2000);
  assert.deepEqual(l.respostas.map(r => r.marca), resp45);
});
test('marcação fraca de lápis fica duvidosa, nunca em branco sem aviso', () => {
  const rs = [...respostas]; rs[0] = { letra: 'A', tom: 160 };
  assert.equal(lerFolha(gerarFoto(layout, { numero: '05', respostas: rs }), layout).respostas[0].duvidosa, true);
});
test('bolinha pintada pela metade fica duvidosa', () => {
  const rs = [...respostas]; rs[0] = { letra: 'A', fracao: 0.4 };
  assert.equal(lerFolha(gerarFoto(layout, { numero: '05', respostas: rs }), layout).respostas[0].duvidosa, true);
});
test('número de chamada em branco ou duplo fica sem número', () => {
  assert.equal(lerFolha(gerarFoto(layout, { numero: [0, null], respostas }), layout).numero, null);
  assert.equal(lerFolha(gerarFoto(layout, { numero: [0, [3, 4]], respostas }), layout).numero, null);
});
test('folha com um marcador apagado não tem leitura', () => {
  const foto = gerarFoto(layout, { numero: '05', respostas });
  for (let y = 0; y < 120; y++) for (let x = 0; x < 120; x++) foto.data[y * foto.width + x] = 235;
  assert.equal(lerFolha(foto, layout), null);
});

// ---------- ticket 09: duas folhas por A4 ----------
test('folha impressa em meio tamanho (A5) é lida igual', () => {
  const l30 = montarLayout(30), r30 = l30.questoes.map((_, i) => 'ABCDE'[i % 5]);
  const l = lerFolha(gerarFoto(l30, { numero: '42', respostas: r30 }, { pxPorMm: 4 * 0.707 * 0.9, largura: 700, altura: 900, fundo: 90, rotacaoGraus: 3 }), l30);
  assert.equal(l.numero, '42');
  assert.deepEqual(l.respostas.map(r => r.marca), r30);
});

// ---------- ticket 12: versões da prova ----------
test('lê a versão marcada pelo aluno', () => {
  const lv = montarLayout(20, 3);
  const l = lerFolha(gerarFoto(lv, { numero: '05', versao: 'C', respostas }, { rotacaoGraus: 3, largura: 900, altura: 1250 }), lv);
  assert.equal(l.versao, 'C');
  assert.equal(l.numero, '05');
  assert.deepEqual(l.respostas.map(r => r.marca), esperado);
});
test('versão em branco ou dupla fica sem versão', () => {
  const lv = montarLayout(20, 2);
  assert.equal(lerFolha(gerarFoto(lv, { numero: '05', versao: null, respostas }), lv).versao, null);
  assert.equal(lerFolha(gerarFoto(lv, { numero: '05', versao: ['A', 'B'], respostas }), lv).versao, null);
});
test('prova de uma versão só é sempre versão A', () => {
  assert.equal(lerFolha(gerarFoto(layout, { numero: '05', respostas }), layout).versao, 'A');
});

// ---------- novas funções 02: alternativas da prova ----------
for (const [alts, resp, esp] of [
  ['ABCD', ['A', 'D', null, ['B', 'C'], 'C'], ['A', 'D', 'branco', 'dupla', 'C']],
  ['AB', ['B', 'A', null, ['A', 'B'], 'B'], ['B', 'A', 'branco', 'dupla', 'B']],
  ['CE', ['C', 'E', null, ['C', 'E'], 'E'], ['C', 'E', 'branco', 'dupla', 'E']],
]) test(`folha com alternativas ${alts}: só essas bolinhas e leitura certa`, () => {
  const l5 = montarLayout(5, 1, alts);
  assert.ok(l5.questoes.every(q => q.length === alts.length));
  const l = lerFolha(gerarFoto(l5, { numero: '09', respostas: resp }, { rotacaoGraus: 4 }), l5);
  assert.deepEqual(l.respostas.map(r => r.marca), esp);
});

// ---------- novas funções 04: código da prova ----------
import { codificar } from '../src/codigo.js';
const lc = montarLayout(20);
const comCodigo = (codigo, opcoes) => lerFolha(gerarFoto(lc, { numero: '05', respostas, codigo }, opcoes), lc);

for (const [nome, opcoes] of [
  ['reta', {}], ['girada 6°', { rotacaoGraus: 6, largura: 950, altura: 1300 }], ['em perspectiva', { perspectiva: 0.15 }],
  ['com ruído e luz desigual', { ruido: 20, gradiente: 60 }], ['em fotocópia clara', { papel: 200, tinta: 70 }],
  ['em meio tamanho', { pxPorMm: 4 * 0.707 * 0.9, largura: 700, altura: 900, fundo: 90 }],
]) test(`código da prova lido na folha ${nome}`, () => {
  const l = comCodigo(codificar(2741, 'C'), opcoes);
  assert.deepEqual(l.codigo, { prova: 2741, versao: 'C' });
  assert.deepEqual(l.respostas.map(r => r.marca), esperado);
});

test('código sem versão', () => assert.deepEqual(comCodigo(codificar(7, null)).codigo, { prova: 7, versao: null }));

test('código danificado ou folha antiga sem faixa ficam sem código', () => {
  const bits = codificar(2741, 'C'); bits[3] = !bits[3];
  assert.equal(comCodigo(bits).codigo, null);
  assert.equal(comCodigo(undefined).codigo, null);
  assert.equal(comCodigo(Array(20).fill(true)).codigo, null);
});
