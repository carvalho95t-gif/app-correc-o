// Seam: Planilha. Entram a prova e as correções, sai a pasta de trabalho (lida de volta com a SheetJS).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { montarPlanilha, nomeArquivo, lerPlanilha } from '../src/planilha.js';
import { definirProva, registrar, estadoInicial, definirLista, validarAreas } from '../src/estado.js';

const XLSX = createRequire(import.meta.url)('../vendor/xlsx.mini.min.js');
const linhas = (wb, aba) => XLSX.utils.sheet_to_json(wb.Sheets[aba], { header: 1, defval: '' });
const releitura = wb => XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
const corr = (turma, numero, respostas) => ({ turma, numero, respostas, editado: false });

function estadoExemplo(prova = {}) {
  const { gabarito = ['A', 'B', 'C', 'D'], anuladas = [], ...resto } = prova;
  let e = definirProva(estadoInicial(), { nome: 'Simulado 1', valor: 10, versoes: [{ gabarito, anuladas }], ...resto });
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
  const e = definirProva(estadoExemplo(), { nome: 'Simulado 1', versoes: [{ gabarito: ['A', 'B', 'C', 'E'], anuladas: [] }], valor: 10 });
  assert.deepEqual(linhas(montarPlanilha(XLSX, e), '2A')[2].slice(5), [4, 100, 10]);
});

test('mudar o número de questões com correções salvas é recusado', () => {
  assert.throws(() => definirProva(estadoExemplo(), { nome: 'x', versoes: [{ gabarito: ['A', 'B', 'C', 'D', 'E'], anuladas: [] }], valor: 10 }), /outro número de questões/);
});

test('nome do arquivo sem caracteres inválidos', () => {
  assert.equal(nomeArquivo({ nome: 'Prova 1/2: "A"' }), 'Prova 1-2- -A-.xlsx');
});

// ---------- ticket 06: Análise e Resumo ----------
const objetos = (wb, aba) => XLSX.utils.sheet_to_json(wb.Sheets[aba], { defval: '' });

test('abas Análise e Resumo depois das turmas', () => {
  assert.deepEqual(montarPlanilha(XLSX, estadoExemplo()).SheetNames, ['2A', '2B', 'Análise', 'Resumo', 'Dados']);
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
  let e = definirProva(estadoInicial(), { nome: 'x', versoes: [{ gabarito: ['A', 'B', 'C', 'D'], anuladas: [] }], valor: 10 });
  e = registrar(e, corr('3C', '01', ['A', 'B', 'C', 'D']));
  e = registrar(e, corr('3C', '02', ['A', 'B', 'E', 'E']));
  e = registrar(e, corr('3C', '03', ['A', 'E', 'E', 'E']));
  const [t, g] = objetos(montarPlanilha(XLSX, e), 'Resumo');
  assert.deepEqual(t, { Turma: '3C', Alunos: 3, Média: 5.8, Maior: 10, Menor: 2.5, '3 mais fáceis': 'Q1, Q2, Q3', '3 mais difíceis': 'Q3, Q4, Q2' });
  assert.equal(g.Turma, 'Geral'); assert.equal(g.Alunos, 3);
});

// ---------- ticket 08: nomes dos alunos ----------
test('lista de chamada: linha N vale para o número N, ou para o número escrito no início', () => {
  const e = definirLista(estadoExemplo(), '2b', 'Ana Souza\n\n04 - Bruno Lima\n');
  const l = linhas(montarPlanilha(XLSX, e), '2B');
  assert.deepEqual(l[0].slice(0, 3), ['Nº', 'Nome', 'Q1']);
  assert.deepEqual(l[1].slice(0, 3), ['Gabarito', '', 'A']);
  assert.deepEqual(l[2].slice(0, 2), ['03', '']);           // sem nome na lista
  assert.deepEqual(l[3].slice(0, 3), ['04', 'Bruno Lima', 'branco']);
  assert.deepEqual(linhas(montarPlanilha(XLSX, e), '2A')[0].slice(0, 2), ['Nº', 'Q1']); // turma sem lista
});

test('lista de chamada sem números segue a ordem das linhas', () => {
  const e = definirLista(estadoExemplo(), '2A', 'Ana\nBia');
  const l = linhas(montarPlanilha(XLSX, e), '2A');
  assert.deepEqual([l[2][1], l[3][1]], ['Ana', 'Bia']);
});

// ---------- ticket 12: versões da prova ----------
function estadoVersoes() {
  let e = definirProva(estadoInicial(), { nome: 'V', valor: 10, versoes: [
    { gabarito: ['A', 'B', 'C', 'D'], anuladas: [] },
    { gabarito: ['D', 'C', 'B', 'A'], anuladas: [3] },
  ] });
  e = registrar(e, { ...corr('2A', '01', ['A', 'B', 'C', 'D']), versao: 'A' });
  e = registrar(e, { ...corr('2A', '02', ['D', 'C', 'B', 'E']), versao: 'B' });
  e = registrar(e, { ...corr('2A', '03', ['A', 'B', 'C', 'D']), versao: 'B' });
  return e;
}

test('com versões: a nota usa o gabarito da versão do aluno', () => {
  const l = linhas(montarPlanilha(XLSX, estadoVersoes()), '2A');
  assert.deepEqual(l[0].slice(0, 3), ['Nº', 'Versão', 'Q1']);
  assert.deepEqual(l[1].slice(0, 6), ['Gabarito', 'A', 'A', 'B', 'C', 'D']);
  assert.deepEqual(l[2].slice(0, 6), ['Gabarito', 'B', 'D', 'C', 'B', 'ANULADA']);
  assert.deepEqual(l[3].slice(-3), [4, 100, 10]);   // 01, versão A, tudo certo
  assert.deepEqual(l[4].slice(-3), [4, 100, 10]);   // 02, versão B, Q4 anulada
  assert.deepEqual(l[5].slice(-3), [1, 25, 2.5]);   // 03, versão B com respostas da A: só a anulada
});

test('com versões: uma aba de Análise por versão e Resumo por versão', () => {
  const wb = montarPlanilha(XLSX, estadoVersoes());
  assert.deepEqual(wb.SheetNames, ['2A', 'Análise A', 'Análise B', 'Resumo', 'Dados']);
  assert.equal(objetos(wb, 'Análise B')[0]['% acerto geral'], 50);
  const [t] = objetos(wb, 'Resumo');
  assert.equal(t['Alunos'], 3);
  assert.equal(t['3 mais difíceis (A)'], 'Q1, Q2, Q3');
  assert.equal(t['3 mais fáceis (B)'], 'Q4, Q1, Q2');
});

// ---------- ticket 11: restaurar a partir da planilha ----------
test('exportar e importar devolve a mesma prova, correções, nomes, valor e versões', () => {
  let e = definirLista(estadoVersoes(), '2A', 'Ana\nBia');
  e = definirProva(e, { ...e.prova, valor: 3 });
  const volta = lerPlanilha(XLSX, releitura(montarPlanilha(XLSX, e)));
  assert.deepEqual(volta, { ...e, pendente: false });
});

test('a aba Dados fica escondida e aguenta muitas correções', () => {
  let e = definirProva(estadoInicial(), { nome: 'Grande', valor: 10, versoes: [{ gabarito: Array(90).fill('A'), anuladas: [] }] });
  for (let t = 0; t < 4; t++) for (let n = 0; n < 45; n++) e = registrar(e, corr(`T${t}`, String(n).padStart(2, '0'), Array(90).fill('dupla')));
  const wb = releitura(montarPlanilha(XLSX, e));
  assert.ok(wb.Workbook.Sheets.find(x => x.name === 'Dados').Hidden);
  assert.equal(Object.keys(lerPlanilha(XLSX, wb).correcoes).length, 180);
});

test('planilha que não é do app dá erro claro', () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['oi']]), 'Plan1');
  assert.throws(() => lerPlanilha(XLSX, wb), /não foi baixada por este app/);
});

test('turmas com nomes que colidem ainda geram a planilha, cada uma na sua aba', () => {
  let e = estadoExemplo();
  for (const t of ['2/A', '2:A', 'Dados', 'resumo']) e = registrar(e, corr(t, '01', ['A', 'B', 'C', 'D']));
  const wb = releitura(montarPlanilha(XLSX, e));
  const minusc = wb.SheetNames.map(n => n.toLowerCase());
  assert.equal(new Set(minusc).size, minusc.length);
  assert.equal(linhas(wb, 'Dados')[0][0], 'app-correcao-v1');
  assert.equal(lerPlanilha(XLSX, wb).prova.nome, 'Simulado 1');
});

test('lista de chamada aceita número colado ao separador', () => {
  const l = linhas(montarPlanilha(XLSX, definirLista(estadoExemplo(), '2B', '3-Ana\n4.Bruno')), '2B');
  assert.deepEqual(l.slice(2).map(r => r.slice(0, 2)), [['03', 'Ana'], ['04', 'Bruno']]);
});

test('peso por questão: nota por pontos, anulada dá o peso cheio e aparece a coluna Pontos', () => {
  // Gabarito A B C D, pesos 3 1 1 1 (6 pontos). 2B nº 03 marcou A E E D: acertou Q1 e Q4 = 4 pontos → 6,7.
  const l = linhas(montarPlanilha(XLSX, estadoExemplo({ pesos: [3, 1, 1, 1] })), '2B');
  assert.deepEqual(l[0], ['Nº', 'Q1', 'Q2', 'Q3', 'Q4', 'Acertos', 'Pontos', '%', 'Nota']);
  assert.deepEqual(l[1].slice(0, 5), ['Peso', 3, 1, 1, 1]);
  assert.deepEqual(l[3], ['03', 'A', 'E', 'E', 'D', 2, 4, 67, 6.7]);
  // Anulando a Q2 (peso 1): nº 04 (branco E dupla D) fica com Q2 + Q4 = 2 pontos → 3,3.
  const a = linhas(montarPlanilha(XLSX, estadoExemplo({ pesos: [3, 1, 1, 1], anuladas: [1] })), '2B');
  assert.deepEqual(a[4].slice(5), [2, 2, 33, 3.3]);
});

test('com todos os pesos 1 a planilha não muda', () => {
  const l = linhas(montarPlanilha(XLSX, estadoExemplo({ pesos: [1, 1, 1, 1] })), '2B');
  assert.deepEqual(l[0], ['Nº', 'Q1', 'Q2', 'Q3', 'Q4', 'Acertos', '%', 'Nota']);
});

test('restaurar traz os pesos', () => {
  const wb = releitura(montarPlanilha(XLSX, estadoExemplo({ pesos: [3, 1, 1, 1] })));
  assert.deepEqual(lerPlanilha(XLSX, wb).prova.pesos, [3, 1, 1, 1]);
});

test('prova C/E: nota e Análise com as colunas C e E', () => {
  let e = definirProva(estadoInicial(), { nome: 'CE', valor: 10, alternativas: 'CE', versoes: [{ gabarito: ['C', 'E', 'C'], anuladas: [] }] });
  e = registrar(e, corr('1A', '01', ['C', 'C', 'branco']));
  const wb = releitura(montarPlanilha(XLSX, e));
  assert.deepEqual(linhas(wb, '1A')[2].slice(4), [1, 33, 3.3]);
  const cab = linhas(wb, 'Análise')[0];
  assert.ok(cab.includes('C') && cab.includes('E') && !cab.includes('A') && !cab.includes('D'), cab.join());
});

test('não dá para mudar as alternativas com correções salvas', () => {
  const e = estadoExemplo();
  assert.throws(() => definirProva(e, { ...e.prova, alternativas: 'ABCD' }), /outras alternativas/);
});

// ---------- novas funções 03: nota por área ----------
const areas = [{ nome: 'Linguagens', de: 1, ate: 2 }, { nome: 'Matemática', de: 3, ate: 4 }];

test('área: acertos e % por área na aba da turma', () => {
  const l = linhas(montarPlanilha(XLSX, estadoExemplo({ areas })), '2B');
  assert.deepEqual(l[0].slice(-4), ['Linguagens acertos', 'Linguagens %', 'Matemática acertos', 'Matemática %']);
  // nº 03: A E E D → Linguagens 1 de 2, Matemática 1 de 2. nº 04: branco E dupla D → 0 e 1.
  assert.deepEqual(l[2].slice(-4), [1, 50, 1, 50]);
  assert.deepEqual(l[3].slice(-4), [0, 0, 1, 50]);
});

test('área: Resumo com a média % por turma', () => {
  const [a, b, g] = objetos(montarPlanilha(XLSX, estadoExemplo({ areas })), 'Resumo');
  // 2A: os dois marcaram A B C E → Linguagens 100, Matemática 50. 2B: Linguagens (50+0)/2 = 25, Matemática 50.
  assert.equal(a['Linguagens % médio'], 100); assert.equal(a['Matemática % médio'], 50);
  assert.equal(b['Linguagens % médio'], 25);
  assert.equal(g['Linguagens % médio'], 63);
});

test('área: recusa sobreposição e intervalo além da última questão; restaurar traz as áreas', () => {
  assert.match(validarAreas([{ nome: 'X', de: 1, ate: 3 }, { nome: 'Y', de: 3, ate: 4 }], 4), /se sobrepõem/);
  assert.match(validarAreas([{ nome: 'X', de: 1, ate: 5 }], 4), /até a questão 4/);
  assert.match(validarAreas([{ nome: '', de: 1, ate: 2 }], 4), /nome/);
  assert.equal(validarAreas(areas, 4), '');
  const wb = releitura(montarPlanilha(XLSX, estadoExemplo({ areas })));
  assert.deepEqual(lerPlanilha(XLSX, wb).prova.areas, areas);
});
