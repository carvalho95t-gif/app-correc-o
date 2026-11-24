// Monta a planilha a partir do estado. XLSX é a SheetJS (global no navegador, require nos testes).
import { corrigir } from './nota.js';
import { nomeDo, versaoDe } from './estado.js';

export function porTurma(estado) {
  const grupos = {};
  for (const c of Object.values(estado.correcoes)) (grupos[c.turma] ??= []).push(c);
  for (const l of Object.values(grupos)) l.sort((a, b) => a.numero.localeCompare(b.numero));
  return Object.fromEntries(Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b)));
}

// Excel compara nomes de aba sem maiúsculas; as abas fixas vêm depois e ficam reservadas.
const RESERVADAS = ['análise', 'análise a', 'análise b', 'análise c', 'análise d', 'resumo', 'dados'];
function nomeAba(t, usados) {
  const base = t.replace(/[\\/:*?[\]]/g, '-').slice(0, 31) || 'Turma';
  let nome = base;
  for (let k = 2; usados.has(nome.toLowerCase()); k++) nome = `${base.slice(0, 26)} (${k})`;
  usados.add(nome.toLowerCase());
  return nome;
}
const numeroBR = n => n.toLocaleString('pt-BR');

const LETRA = 'ABCD';
export const notaDe = (prova, c) => { const v = versaoDe(prova, c.versao); return corrigir(v.gabarito, v.anuladas, c.respostas, prova.pesos); };
const comGabarito = v => v.gabarito.map((g, i) => (v.anuladas.includes(i) ? 'ANULADA' : g));

function abaTurma(estado, turma, correcoes) {
  const { prova } = estado, comValor = prova.valor !== 10, comNomes = !!estado.chamadas?.[turma], comVersoes = prova.versoes.length > 1;
  const nome = c => (comNomes ? [nomeDo(estado, turma, c.numero)] : []);
  const n = prova.versoes[0].gabarito.length, comPesos = !!prova.pesos?.some(p => p !== 1);
  const cabecalho = ['Nº', ...(comNomes ? ['Nome'] : []), ...(comVersoes ? ['Versão'] : []), ...[...Array(n)].map((_, i) => `Q${i + 1}`),
    'Acertos', ...(comPesos ? ['Pontos'] : []), '%', 'Nota', ...(comValor ? [`Nota (valor ${numeroBR(prova.valor)})`] : [])];
  const pesos = comPesos ? [['Peso', ...(comNomes ? [''] : []), ...(comVersoes ? [''] : []), ...prova.pesos]] : [];
  const gabaritos = prova.versoes.map((v, i) => ['Gabarito', ...(comNomes ? [''] : []), ...(comVersoes ? [LETRA[i]] : []), ...comGabarito(v)]);
  const alunos = correcoes.map(c => {
    const r = notaDe(prova, c);
    const extra = comValor ? [Math.round((r.pontos / r.possiveis) * prova.valor * 10) / 10] : [];
    return [c.numero, ...nome(c), ...(comVersoes ? [c.versao ?? 'A'] : []), ...c.respostas, r.acertos, ...(comPesos ? [r.pontos] : []), r.percentual, r.nota, ...extra];
  });
  return [cabecalho, ...pesos, ...gabaritos, ...alunos];
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

function analise(v, turmas) {
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
      A: conta('A'), B: conta('B'), C: conta('C'), D: conta('D'), E: conta('E'), Branco: conta('branco'), Dupla: conta('dupla'),
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
    };
  };
  return [...Object.entries(turmas).map(([t, cs]) => linha(t, cs)), linha('Geral', Object.values(turmas).flat())];
}

export function montarPlanilha(XLSX, estado) {
  const wb = XLSX.utils.book_new(), turmas = porTurma(estado), { prova } = estado, usados = new Set(RESERVADAS);
  for (const [turma, cs] of Object.entries(turmas))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(abaTurma(estado, turma, cs)), nomeAba(turma, usados));
  if (Object.keys(turmas).length) {
    prova.versoes.forEach((v, k) => {
      const daVersao = Object.fromEntries(Object.entries(turmas)
        .map(([t, cs]) => [t, cs.filter(c => (c.versao ?? 'A') === LETRA[k])]).filter(([, cs]) => cs.length));
      if (Object.keys(daVersao).length)
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analise(v, daVersao)), prova.versoes.length > 1 ? `Análise ${LETRA[k]}` : 'Análise');
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo(prova, turmas)), 'Resumo');
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(dados(estado)), 'Dados');
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
