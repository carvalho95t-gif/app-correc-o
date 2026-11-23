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

export function montarPlanilha(XLSX, estado) {
  const wb = XLSX.utils.book_new();
  for (const [turma, cs] of Object.entries(porTurma(estado)))
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(abaTurma(estado.prova, cs)), nomeAba(turma));
  return wb;
}

export const nomeArquivo = prova => `${prova.nome.replace(/[\\/:*?"<>|]/g, '-').trim() || 'resultados'}.xlsx`;
