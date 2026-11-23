// Monta a planilha a partir do estado. XLSX é a SheetJS (global no navegador, require nos testes).
import { corrigir } from './nota.js';

export function porTurma(estado) {
  const grupos = {};
  for (const c of Object.values(estado.correcoes)) (grupos[c.turma] ??= []).push(c);
  for (const l of Object.values(grupos)) l.sort((a, b) => a.numero.localeCompare(b.numero));
  return Object.fromEntries(Object.entries(grupos).sort(([a], [b]) => a.localeCompare(b)));
}

const nomeAba = t => t.replace(/[\\/:*?[\]]/g, '-').slice(0, 31) || 'Turma';
const numeroBR = n => n.toLocaleString('pt-BR');

function abaTurma(prova, correcoes) {
  const comValor = prova.valor !== 10;
  const cabecalho = ['Nº', ...prova.gabarito.map((_, i) => `Q${i + 1}`), 'Acertos', '%', 'Nota', ...(comValor ? [`Nota (valor ${numeroBR(prova.valor)})`] : [])];
  const gabarito = ['Gabarito', ...prova.gabarito.map((g, i) => (prova.anuladas.includes(i) ? 'ANULADA' : g))];
  const alunos = correcoes.map(c => {
    const r = corrigir(prova.gabarito, prova.anuladas, c.respostas);
    const extra = comValor ? [Math.round((r.acertos / r.total) * prova.valor * 10) / 10] : [];
    return [c.numero, ...c.respostas, r.acertos, r.percentual, r.nota, ...extra];
  });
  return [cabecalho, gabarito, ...alunos];
}

const acertou = (prova, c, i) => prova.anuladas.includes(i) || c.respostas[i] === prova.gabarito[i];
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

function analise(prova, turmas) {
  const todos = Object.values(turmas).flat();
  const totais = todos.map(c => corrigir(prova.gabarito, prova.anuladas, c.respostas).acertos);
  return prova.gabarito.map((g, i) => {
    const ok = todos.map(c => acertou(prova, c, i)), geral = pct(ok.filter(Boolean).length, todos.length);
    const conta = v => todos.filter(c => c.respostas[i] === v).length;
    const d = discriminacao(ok, totais);
    return {
      Questão: `Q${i + 1}`,
      Gabarito: prova.anuladas.includes(i) ? 'ANULADA' : g,
      '% acerto geral': geral,
      ...Object.fromEntries(Object.entries(turmas).map(([t, cs]) => [`% acerto ${t}`, pct(cs.filter(c => acertou(prova, c, i)).length, cs.length)])),
      A: conta('A'), B: conta('B'), C: conta('C'), D: conta('D'), E: conta('E'), Branco: conta('branco'), Dupla: conta('dupla'),
      Dificuldade: geral >= 85 ? 'Fácil' : geral >= 50 ? 'Média' : 'Difícil',
      Discriminação: d,
      Revisar: d !== '' && d < 0.2 ? 'Revisar' : '',
    };
  });
}

function resumo(prova, turmas) {
  const linha = (nome, cs) => {
    const notas = cs.map(c => corrigir(prova.gabarito, prova.anuladas, c.respostas).nota);
    const acerto = prova.gabarito.map((_, i) => ({ q: `Q${i + 1}`, n: cs.filter(c => acertou(prova, c, i)).length }));
    const tres = sentido => [...acerto].sort((a, b) => sentido * (b.n - a.n)).slice(0, 3).map(x => x.q).join(', ');
    return {
      Turma: nome, Alunos: cs.length,
      Média: Math.round((soma(notas) / cs.length) * 10) / 10, Maior: Math.max(...notas), Menor: Math.min(...notas),
      '3 mais fáceis': tres(1), '3 mais difíceis': tres(-1),
    };
  };
  return [...Object.entries(turmas).map(([t, cs]) => linha(t, cs)), linha('Geral', Object.values(turmas).flat())];
}

export function montarPlanilha(XLSX, estado) {
  const wb = XLSX.utils.book_new(), turmas = porTurma(estado), { prova } = estado;
  for (const [turma, cs] of Object.entries(turmas))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(abaTurma(prova, cs)), nomeAba(turma));
  if (Object.keys(turmas).length) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(analise(prova, turmas)), 'Análise');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo(prova, turmas)), 'Resumo');
  }
  return wb;
}

export const nomeArquivo = prova => `${prova.nome.replace(/[\\/:*?"<>|]/g, '-').trim() || 'resultados'}.xlsx`;
