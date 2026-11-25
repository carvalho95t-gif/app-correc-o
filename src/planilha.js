// Monta a planilha a partir do estado. XLSX é a SheetJS (global no navegador, require nos testes).
import { corrigir } from './nota.js';
import { nomeDo, versaoDe } from './estado.js';
import { ehEmbaralhada, paraOriginal } from './embaralhar.js';

export function porTurma(estado) {
  const grupos = {};
  for (const c of Object.values(estado.correcoes)) (grupos[c.turma] ??= []).push(c);
  for (const l of Object.values(grupos)) l.sort((a, b) => a.numero.localeCompare(b.numero));
  return Object.fromEntries(Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b)));
}

// Excel compara nomes de aba sem maiúsculas; as abas fixas vêm depois e ficam reservadas.
const RESERVADAS = ['pesquisa', 'análise', 'análise a', 'análise b', 'análise c', 'análise d', 'resumo', 'diário', 'dados'];
function nomeAba(t, usados) {
  const base = t.replace(/[\\/:*?[\]]/g, '-').slice(0, 31) || 'Turma';
  let nome = base;
  for (let k = 2; usados.has(nome.toLowerCase()); k++) nome = `${base.slice(0, 26)} (${k})`;
  usados.add(nome.toLowerCase());
  return nome;
}
const numeroBR = n => n.toLocaleString('pt-BR');

const LETRA = 'ABCD';

// Conceitos por faixa de nota (no valor da prova): uma linha por conceito, "A 9", "B 7,5"...
// Devolve as faixas da maior para a menor, [] sem texto, ou null se alguma linha não tem nota.
export function lerConceitos(texto) {
  const linhas = String(texto ?? '').split('\n').map(l => l.trim()).filter(Boolean);
  const faixas = linhas.map(l => /^(.+?)\s+(\d+(?:[.,]\d+)?)$/.exec(l)).map(m => m && { conceito: m[1].trim(), min: Number(m[2].replace(',', '.')) });
  return faixas.includes(null) ? null : faixas.sort((a, b) => b.min - a.min);
}
export const conceitoDe = (faixas, nota) => faixas.find(f => nota >= f.min - 1e-9)?.conceito ?? '';
const notaNoValor = (prova, r) => Math.round((r.pontos / r.possiveis) * (prova.valor ?? 10) * 10) / 10;
// Posição de cada nota na lista (notas iguais dividem a posição).
export const posicoes = notas => notas.map(n => 1 + notas.filter(m => m > n).length);
// Percentil: % dos outros alunos com nota menor (o único aluno da prova fica com 100).
export const percentis = notas => notas.map(n => (notas.length < 2 ? 100 : Math.round((100 * notas.filter(m => m < n).length) / (notas.length - 1))));
// Pesos colados de uma planilha ou digitados: "2 2 1,5 1". null se algum não for número maior que zero.
export function lerPesos(texto) {
  const ps = String(texto ?? '').split(/[\s;]+/).filter(Boolean).map(t => (/^\d+(?:[.,]\d+)?$/.test(t) ? Number(t.replace(',', '.')) : NaN));
  return ps.every(p => p > 0) ? ps : null;
}
// Prova embaralhada: a nota é sempre pela questão original, para os pesos e as áreas seguirem a questão.
export function notaDe(prova, c) {
  if (ehEmbaralhada(prova)) { const v = prova.versoes[0]; return corrigir(v.gabarito, v.anuladas, paraOriginal(prova, c), prova.pesos, prova.areas, v.parciais); }
  const v = versaoDe(prova, c.versao);
  return corrigir(v.gabarito, v.anuladas, c.respostas, prova.pesos, prova.areas, v.parciais);
}
// Para a planilha, uma prova embaralhada vira uma prova de versão única com as marcações pela original;
// a versão impressa fica só para mostrar na coluna Versão.
function vistaOriginal(estado) {
  const { prova } = estado;
  if (!ehEmbaralhada(prova)) return estado;
  const correcoes = Object.fromEntries(Object.entries(estado.correcoes).map(([k, c]) =>
    [k, { ...c, respostas: paraOriginal(prova, c), versao: undefined, versaoImpressa: c.versao ?? 'A' }]));
  return { ...estado, prova: { ...prova, versoes: [prova.versoes[0]] }, correcoes, versoesImpressas: prova.versoes.length };
}
export const temParciais = v => !!v.parciais?.some(o => Object.values(o ?? {}).some(f => f > 0));
const comGabarito = v => v.gabarito.map((g, i) => (v.anuladas.includes(i) ? 'ANULADA' : g));

function abaTurma(estado, turma, correcoes) {
  const { prova } = estado, comValor = prova.valor !== 10, comNomes = !!estado.chamadas?.[turma], comVersoes = (estado.versoesImpressas ?? prova.versoes.length) > 1;
  const nome = c => (comNomes ? [nomeDo(estado, turma, c.numero)] : []);
  const comConceitos = !!prova.conceitos?.length;
  const n = prova.versoes[0].gabarito.length, comParciais = prova.versoes.some(temParciais), comPesos = !!prova.pesos?.some(p => p !== 1);
  const cabecalho = ['Nº', ...(comNomes ? ['Nome'] : []), ...(comVersoes ? ['Versão'] : []), ...[...Array(n)].map((_, i) => `Q${i + 1}`),
    'Acertos', ...(comPesos || comParciais ? ['Pontos'] : []), '%', 'Nota', ...(comValor ? [`Nota (valor ${numeroBR(prova.valor)})`] : []), ...(comConceitos ? ['Conceito'] : []),
    ...(prova.areas ?? []).flatMap(a => [`${a.nome} acertos`, `${a.nome} %`])];
  const pesos = comPesos ? [['Peso', ...(comNomes ? [''] : []), ...(comVersoes ? [''] : []), ...prova.pesos]] : [];
  const gabaritos = prova.versoes.map((v, i) => ['Gabarito', ...(comNomes ? [''] : []), ...(comVersoes ? [estado.versoesImpressas ? '' : LETRA[i]] : []), ...comGabarito(v)]);
  const alunos = correcoes.map(c => {
    const r = notaDe(prova, c);
    const extra = comValor ? [notaNoValor(prova, r)] : [];
    return [c.numero, ...nome(c), ...(comVersoes ? [c.versaoImpressa ?? c.versao ?? 'A'] : []), ...c.respostas, r.acertos, ...(comPesos || comParciais ? [r.pontos] : []), r.percentual, r.nota, ...extra,
      ...(comConceitos ? [conceitoDe(prova.conceitos, notaNoValor(prova, r))] : []), ...r.porArea.flatMap(a => [a.acertos, a.percentual])];
  });
  return [cabecalho, ...pesos, ...gabaritos, ...alunos];
}

// Modo pesquisa (sem gabarito): na turma só as respostas; na aba Pesquisa, contagem e % de cada alternativa.
function abaRespostas(estado, turma, correcoes) {
  const comNomes = !!estado.chamadas?.[turma], n = estado.prova.versoes[0].gabarito.length;
  return [['Nº', ...(comNomes ? ['Nome'] : []), ...[...Array(n)].map((_, i) => `Q${i + 1}`)],
    ...correcoes.map(c => [c.numero, ...(comNomes ? [nomeDo(estado, turma, c.numero)] : []), ...c.respostas])];
}
function pesquisa(prova, turmas) {
  const todos = Object.values(turmas).flat();
  return prova.versoes[0].gabarito.map((_, i) => {
    const conta = m => todos.filter(c => c.respostas[i] === m).length;
    return { Questão: `Q${i + 1}`, Respostas: todos.length,
      ...Object.fromEntries([...(prova.alternativas ?? 'ABCDE')].flatMap(a => [[a, conta(a)], [`% ${a}`, pct(conta(a), todos.length)]])),
      Branco: conta('branco'), Dupla: conta('dupla') };
  });
}

// Aqui "v" é uma versão: { gabarito, anuladas }.
const acertou = (v, c, i) => v.anuladas.includes(i) || c.respostas[i] === v.gabarito[i];
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);
const soma = v => v.reduce((a, b) => a + b, 0);

// Correlação ponto-bisserial entre acertar a questão e o total de acertos; '' quando não se aplica.
function discriminacao(acertos, totais) {
  const n = totais.length, p = acertos.filter(Boolean).length / n;
  if (n < 2 || p === 0 || p === 1) return '';
  const media = soma(totais) / n;
  const dp = Math.sqrt(soma(totais.map(t => (t - media) ** 2)) / n);
  if (!dp) return '';
  const mediaDe = f => { const v = totais.filter((_, i) => acertos[i] === f); return soma(v) / v.length; };
  return Math.round(((mediaDe(true) - mediaDe(false)) / dp) * Math.sqrt(p * (1 - p)) * 100) / 100;
}

function analise(v, turmas, alternativas = 'ABCDE') {
  const todos = Object.values(turmas).flat();
  const totais = todos.map(c => corrigir(v.gabarito, v.anuladas, c.respostas).acertos);
  return v.gabarito.map((g, i) => {
    const ok = todos.map(c => acertou(v, c, i)), geral = pct(ok.filter(Boolean).length, todos.length);
    const conta = v => todos.filter(c => c.respostas[i] === v).length;
    const d = discriminacao(ok, totais);
    return {
      Questão: `Q${i + 1}`,
      Gabarito: v.anuladas.includes(i) ? 'ANULADA' : g,
      '% acerto geral': geral,
      ...Object.fromEntries(Object.entries(turmas).map(([t, cs]) => [`% acerto ${t}`, pct(cs.filter(c => acertou(v, c, i)).length, cs.length)])),
      ...Object.fromEntries([...alternativas].map(a => [a, conta(a)])), Branco: conta('branco'), Dupla: conta('dupla'),
      Dificuldade: geral >= 85 ? 'Fácil' : geral >= 50 ? 'Média' : 'Difícil',
      Discriminação: d,
      Revisar: d !== '' && d < 0.2 ? 'Revisar' : '',
    };
  });
}

function resumo(prova, turmas) {
  const comVersoes = prova.versoes.length > 1;
  const linha = (nome, cs) => {
    const notas = cs.map(c => notaDe(prova, c).nota);
    const extremos = prova.versoes.flatMap((v, k) => {
      const daVersao = cs.filter(c => (c.versao ?? 'A') === LETRA[k]);
      if (comVersoes && !daVersao.length) return [];
      const acerto = v.gabarito.map((_, i) => ({ q: `Q${i + 1}`, n: daVersao.filter(c => acertou(v, c, i)).length }));
      const tres = sentido => [...acerto].sort((a, b) => sentido * (b.n - a.n)).slice(0, 3).map(x => x.q).join(', ');
      const sufixo = comVersoes ? ` (${LETRA[k]})` : '';
      return [[`3 mais fáceis${sufixo}`, tres(1)], [`3 mais difíceis${sufixo}`, tres(-1)]];
    });
    return {
      Turma: nome, Alunos: cs.length,
      Média: Math.round((soma(notas) / cs.length) * 10) / 10, Maior: Math.max(...notas), Menor: Math.min(...notas),
      ...Object.fromEntries(extremos),
      ...Object.fromEntries((prova.areas ?? []).map((a, k) =>
        [`${a.nome} % médio`, Math.round(soma(cs.map(c => notaDe(prova, c).porArea[k].percentual)) / cs.length)])),
    };
  };
  return [...Object.entries(turmas).map(([t, cs]) => linha(t, cs)), linha('Geral', Object.values(turmas).flat())];
}

// Uma linha por aluno, pronta para copiar para o diário da escola.
function diario(estado, turmas) {
  const { prova } = estado, valor = prova.valor ?? 10;
  return Object.entries(turmas).flatMap(([t, cs]) => cs.map(c => {
    const nota = notaNoValor(prova, notaDe(prova, c));
    return { Turma: t, Nº: c.numero, Nome: nomeDo(estado, t, c.numero) ?? '', [`Nota (valor ${numeroBR(valor)})`]: nota,
      ...(prova.conceitos?.length ? { Conceito: conceitoDe(prova.conceitos, nota) } : {}) };
  }));
}

// Análise para a tela Resultados: % de acerto e de cada alternativa por questão (versão A, ou a original
// numa prova embaralhada) e as notas (0 a 10) de todos os alunos.
// shortcut: provas com versões sem embaralhar mostram só a versão A na tela; a planilha tem todas.
export function analiseDaProva(original) {
  const estado = vistaOriginal(original), { prova } = estado, v = prova.versoes[0], turmas = porTurma(estado);
  const todos = Object.values(turmas).flat(), daA = todos.filter(c => (c.versao ?? 'A') === 'A'), L = prova.alternativas ?? 'ABCDE';
  const questoes = v.gabarito.map((g, i) => {
    const conta = m => pct(daA.filter(c => c.respostas[i] === m).length, daA.length);
    return { gabarito: v.anuladas.includes(i) ? 'ANULADA' : g, acerto: pct(daA.filter(c => acertou(v, c, i)).length, daA.length),
      alternativas: Object.fromEntries([...L].map(a => [a, conta(a)])), branco: conta('branco'), dupla: conta('dupla') };
  });
  return { questoes, alunos: daA.length, notas: todos.map(c => notaDe(prova, c).nota) };
}

export function montarPlanilha(XLSX, original) {
  const estado = vistaOriginal(original);
  const wb = XLSX.utils.book_new(), turmas = porTurma(estado), { prova } = estado, usados = new Set(RESERVADAS);
  for (const [turma, cs] of Object.entries(turmas))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(prova.pesquisa ? abaRespostas(estado, turma, cs) : abaTurma(estado, turma, cs)), nomeAba(turma, usados));
  if (prova.pesquisa && Object.keys(turmas).length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pesquisa(prova, turmas)), 'Pesquisa');
  else if (Object.keys(turmas).length) {
    prova.versoes.forEach((v, k) => {
      const daVersao = Object.fromEntries(Object.entries(turmas)
        .map(([t, cs]) => [t, cs.filter(c => (c.versao ?? 'A') === LETRA[k])]).filter(([, cs]) => cs.length));
      if (Object.keys(daVersao).length)
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analise(v, daVersao, prova.alternativas)), prova.versoes.length > 1 ? `Análise ${LETRA[k]}` : 'Análise');
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo(prova, turmas)), 'Resumo');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(diario(estado, turmas)), 'Diário');
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dados(original)), 'Dados');
  wb.Workbook = { Sheets: wb.SheetNames.map(name => ({ name, Hidden: name === 'Dados' ? 1 : 0 })) };
  return wb;
}

// Aba escondida com tudo o que é preciso para restaurar a prova. Uma célula do Excel guarda até
// 32.767 caracteres, então o JSON vai dividido em várias linhas.
const MARCA = 'app-correcao-v1';
function dados({ prova, correcoes, chamadas }) {
  const json = JSON.stringify({ prova, correcoes, chamadas });
  const linhas = [[MARCA]];
  for (let i = 0; i < json.length; i += 30000) linhas.push([json.slice(i, i + 30000)]);
  return linhas;
}

export function lerPlanilha(XLSX, wb) {
  const aba = wb.Sheets.Dados, linhas = aba ? XLSX.utils.sheet_to_json(aba, { header: 1, defval: '' }) : [];
  if (linhas[0]?.[0] !== MARCA) throw new Error('Esta planilha não foi baixada por este app. Use a planilha do botão "Baixar planilha".');
  const { prova, correcoes, chamadas } = JSON.parse(linhas.slice(1).map(l => l[0]).join(''));
  return { prova, correcoes, pendente: false, ...(chamadas ? { chamadas } : {}) };
}

export const nomeArquivo = prova => `${prova.nome.replace(/[\\/:*?"<>|]/g, '-').trim() || 'resultados'}.xlsx`;

// ---------- importar de planilha ou CSV (linhas já lidas pela SheetJS) ----------
const celula = v => String(v ?? '').trim();
// Lista da turma: "07 Ana Souza" quando a linha tem número, senão só o nome; o cabeçalho e linhas vazias ficam de fora.
export function listaDeLinhas(linhas) {
  return linhas.flatMap(l => {
    const cs = l.map(celula).filter(Boolean), num = cs.find(c => /^\d{1,2}$/.test(c));
    const nome = cs.find(c => /\p{L}/u.test(c) && !/@/.test(c) && !/^(n[º°o.]*|nome.*|aluno.*|estudante.*|n[úu]mero.*|\d+[a-z]?)$/i.test(c));
    return nome ? [num ? `${num.padStart(2, '0')} ${nome}` : nome] : [];
  }).join('\n');
}
// Gabarito: linhas "questão, letra", uma coluna de letras ou uma linha de letras. Letra fora da prova fica ''.
// Gabarito para baixar em CSV: [Questão, Resposta] ou uma coluna por versão.
export function gabaritoEmLinhas(prova) {
  const vs = prova.versoes;
  return [['Questão', ...(vs.length === 1 ? ['Resposta'] : vs.map((_, i) => `Versão ${'ABCD'[i]}`))],
    ...vs[0].gabarito.map((_, q) => [q + 1, ...vs.map(v => v.gabarito[q])])];
}
export function gabaritoDeLinhas(linhas, letras) {
  const letra = c => (letras.includes(celula(c).toUpperCase()) ? celula(c).toUpperCase() : '');
  const ehLetra = c => /^[A-Za-z]$/.test(celula(c));
  const pares = linhas.filter(l => /^\d{1,3}$/.test(celula(l[0])) && l.length > 1);
  if (pares.length) {
    const g = [];
    for (const l of pares) g[+celula(l[0]) - 1] = letra(l[1]);
    return Array.from(g, x => x ?? '');
  }
  const coluna = linhas.map(l => l[0]).filter(ehLetra);
  if (coluna.length > 1) return coluna.map(letra);
  return (linhas.find(l => l.filter(ehLetra).length > 1) ?? []).filter(ehLetra).map(letra);
}
