// Monta a planilha a partir do estado. XLSX é a SheetJS (global no navegador, require nos testes).
import { corrigir } from './nota.js';
import { nomeDo, versaoDe } from './estado.js';

export function porTurma(estado) {
  const grupos = {};
  for (const c of Object.values(estado.correcoes)) (grupos[c.turma] ??= []).push(c);
  for (const l of Object.values(grupos)) l.sort((a, b) => a.numero.localeCompare(b.numero));
  return Object.fromEntries(Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b)));
}

const nomeAba = t => t.replace(/[\\/:*?[\]]/g, '-').slice(0, 31) || 'Turma';
const numeroBR = n => n.toLocaleString('pt-BR');

const LETRA = 'ABCD';
export const notaDe = (prova, c) => { const v = versaoDe(prova, c.versao); return corrigir(v.gabarito, v.anuladas, c.respostas); };
const comGabarito = v => v.gabarito.map((g, i) => (v.anuladas.includes(i) ? 'ANULADA' : g));

function abaTurma(estado, turma, correcoes) {
  const { prova } = estado, comValor = prova.valor !== 10, comNomes = !!estado.chamadas?.[turma], comVersoes = prova.versoes.length > 1;
  const nome = c => (comNomes ? [nomeDo(estado, turma, c.numero)] : []);
  const n = prova.versoes[0].gabarito.length;
  const cabecalho = ['Nº', ...(comNomes ? ['Nome'] : []), ...(comVersoes ? ['Versão'] : []), ...[...Array(n)].map((_, i) => `Q${i + 1}`),
    'Acertos', '%', 'Nota', ...(comValor ? [`Nota (valor ${numeroBR(prova.valor)})`] : [])];
  const gabaritos = prova.versoes.map((v, i) => ['Gabarito', ...(comNomes ? [''] : []), ...(comVersoes ? [LETRA[i]] : []), ...comGabarito(v)]);
  const alunos = correcoes.map(c => {
    const r = notaDe(prova, c);
    const extra = comValor ? [Math.round((r.acertos / r.total) * prova.valor * 10) / 10] : [];
    return [c.numero, ...nome(c), ...(comVersoes ? [c.versao ?? 'A'] : []), ...c.respostas, r.acertos, r.percentual, r.nota, ...extra];
  });
  return [cabecalho, ...gabaritos, ...alunos];
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
  const wb = XLSX.utils.book_new(), turmas = porTurma(estado), { prova } = estado;
  for (const [turma, cs] of Object.entries(turmas))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(abaTurma(estado, turma, cs)), nomeAba(turma));
  if (Object.keys(turmas).length) {
    prova.versoes.forEach((v, k) => {
      const daVersao = Object.fromEntries(Object.entries(turmas)
        .map(([t, cs]) => [t, cs.filter(c => (c.versao ?? 'A') === LETRA[k])]).filter(([, cs]) => cs.length));
      if (Object.keys(daVersao).length)
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analise(v, daVersao)), prova.versoes.length > 1 ? `Análise ${LETRA[k]}` : 'Análise');
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo(prova, turmas)), 'Resumo');
  }
  return wb;
}

export const nomeArquivo = prova => `${prova.nome.replace(/[\\/:*?"<>|]/g, '-').trim() || 'resultados'}.xlsx`;
