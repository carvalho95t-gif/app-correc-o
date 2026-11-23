// Seam: Planilha. Entram a prova e as correções, sai a pasta de trabalho (lida de volta com a SheetJS).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { montarPlanilha, nomeArquivo } from '../src/planilha.js';
import { definirProva, registrar, estadoInicial } from '../src/estado.js';

const XLSX = createRequire(import.meta.url)('../vendor/xlsx.mini.min.js');
const linhas = (wb, aba) => XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: '' });
const releitura = wb => XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
const corr = (turma, numero, respostas) => ({ turma, numero, respostas, editado: false });

function estadoExemplo(prova = {}) {
  let e = definirProva(estadoInicial(), { nome: 'Simulado 1', gabarito: ['A', 'B', 'C', 'D'], anuladas: [], valor: 10, ...prova });
  for (const c of [
    corr('2A', '02', ['A', 'B', 'C', 'E']),
    corr('2A', '01', ['A', 'B', 'C', 'E']),
    corr('2B', '03', ['A', 'E', 'E', 'D']),
    corr('2B', '04', ['branco', 'E', 'dupla', 'D']),
  ]) e = registrar(e, c);
  return e;
}

test('uma aba por turma, em ordem', () => {
  assert.deepEqual(montarPlanilha(XLSX, estadoExemplo()).SheetNames.slice(0, 2), ['2A', '2B']);
});

test('aba da turma: cabeçalho, gabarito e alunos em ordem de número', () => {
  const l = linhas(releitura(montarPlanilha(XLSX, estadoExemplo())), '2B');
  assert.deepEqual(l[0], ['Nº', 'Q1', 'Q2', 'Q3', 'Q4', 'Acertos', '%', 'Nota']);
  assert.deepEqual(l[1].slice(0, 5), ['Gabarito', 'A', 'B', 'C', 'D']);
  assert.deepEqual(l[2], ['03', 'A', 'E', 'E', 'D', 2, 50, 5]);
  assert.deepEqual(l[3], ['04', 'branco', 'E', 'dupla', 'D', 1, 25, 2.5]);
});

test('questão anulada aparece como ANULADA e conta para todos', () => {
  const l = linhas(montarPlanilha(XLSX, estadoExemplo({ anuladas: [1] })), '2B');
  assert.equal(l[1][2], 'ANULADA');
  assert.deepEqual(l[2].slice(5), [3, 75, 7.5]);
});

test('valor da prova diferente de 10 ganha a coluna da nota nessa escala', () => {
  const l = linhas(montarPlanilha(XLSX, estadoExemplo({ valor: 3 })), '2A');
  assert.equal(l[0].at(-1), 'Nota (valor 3)');
  assert.deepEqual(l[2].slice(5), [3, 75, 7.5, 2.3]); // 3/4 de 3 pontos = 2,25 → 2,3
});

test('corrigir uma letra do gabarito recalcula as notas', () => {
  const e = definirProva(estadoExemplo(), { nome: 'Simulado 1', gabarito: ['A', 'B', 'C', 'E'], anuladas: [], valor: 10 });
  assert.deepEqual(linhas(montarPlanilha(XLSX, e), '2A')[2].slice(5), [4, 100, 10]);
});

test('mudar o número de questões com correções salvas é recusado', () => {
  assert.throws(() => definirProva(estadoExemplo(), { nome: 'x', gabarito: ['A', 'B', 'C', 'D', 'E'], anuladas: [], valor: 10 }), /outro número de questões/);
});

test('nome do arquivo sem caracteres inválidos', () => {
  assert.equal(nomeArquivo({ nome: 'Prova 1/2: "A"' }), 'Prova 1-2- -A-.xlsx');
});

// ---------- ticket 06: Análise e Resumo ----------
const objetos = (wb, aba) => XLSX.utils.sheet_to_json(wb.Sheets[aba], { defval: '' });

test('abas Análise e Resumo depois das turmas', () => {
  assert.deepEqual(montarPlanilha(XLSX, estadoExemplo()).SheetNames, ['2A', '2B', 'Análise', 'Resumo']);
});

test('Análise: acerto geral e por turma, alternativas marcadas e dificuldade', () => {
  const [q1, q2] = objetos(releitura(montarPlanilha(XLSX, estadoExemplo())), 'Análise');
  assert.equal(q1['Questão'], 'Q1'); assert.equal(q1['Gabarito'], 'A');
  assert.equal(q1['% acerto geral'], 75);
  assert.equal(q1['% acerto 2A'], 100); assert.equal(q1['% acerto 2B'], 50);
  assert.equal(q1['A'], 3); assert.equal(q1['Branco'], 1); assert.equal(q1['Dupla'], 0);
  assert.equal(q1['Dificuldade'], 'Média');
  assert.equal(q2['% acerto geral'], 50); assert.equal(q2['E'], 2);
});

test('Análise: discriminação calculada à mão e alerta Revisar', () => {
  // Totais de acertos: 01=3, 02=3, 03=2, 04=1. Q2 só os dois melhores acertam; Q4 só os dois piores.
  const a = objetos(montarPlanilha(XLSX, estadoExemplo()), 'Análise');
  assert.equal(a[1]['Discriminação'], 0.9);   // (3 − 1,5) / 0,829 × 0,5 = 0,905 → 0,9
  assert.equal(a[1]['Revisar'], '');
  assert.equal(a[3]['Discriminação'], -0.9);
  assert.equal(a[3]['Revisar'], 'Revisar');
});

test('Análise: sem discriminação quando todos acertam, e questão fácil', () => {
  const a = objetos(montarPlanilha(XLSX, estadoExemplo({ anuladas: [0] })), 'Análise');
  assert.equal(a[0]['Discriminação'], '');
  assert.equal(a[0]['Dificuldade'], 'Fácil');
  assert.equal(a[0]['Gabarito'], 'ANULADA');
});

test('Resumo por turma e geral', () => {
  let e = definirProva(estadoInicial(), { nome: 'x', gabarito: ['A', 'B', 'C', 'D'], anuladas: [], valor: 10 });
  e = registrar(e, corr('3C', '01', ['A', 'B', 'C', 'D']));
  e = registrar(e, corr('3C', '02', ['A', 'B', 'E', 'E']));
  e = registrar(e, corr('3C', '03', ['A', 'E', 'E', 'E']));
  const [t, g] = objetos(montarPlanilha(XLSX, e), 'Resumo');
  assert.deepEqual(t, { Turma: '3C', Alunos: 3, Média: 5.8, Maior: 10, Menor: 2.5, '3 mais fáceis': 'Q1, Q2, Q3', '3 mais difíceis': 'Q3, Q4, Q2' });
  assert.equal(g.Turma, 'Geral'); assert.equal(g.Alunos, 3);
});
