import { gerarVersoes } from './embaralhar.js';
// Estado do app, guardado no navegador. Funções puras: nunca alteram o estado recebido.
// "Arquivo" guarda várias provas; cada uma tem seu "estado": prova, correções e se falta exportar.
const CHAVE = 'correcao-v3';

export const estadoInicial = () => ({ prova: null, correcoes: {}, pendente: false });
export const arquivoInicial = () => ({ provas: {}, ativa: null });

export function carregar(storage) {
  try {
    const a = JSON.parse(storage.getItem(CHAVE));
    return a && typeof a === 'object' && a.provas ? a : arquivoInicial();
  } catch { return arquivoInicial(); }
}
export const salvar = (storage, arquivo) => storage.setItem(CHAVE, JSON.stringify(arquivo));

export const ativo = arquivo => arquivo.provas[arquivo.ativa] ?? estadoInicial();

// Grava o estado da prova ativa; uma prova nova ganha um id na primeira gravação.
export function comAtivo(arquivo, estado) {
  const id = arquivo.ativa ?? `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { provas: { ...arquivo.provas, [id]: estado }, ativa: id };
}
export const escolher = (arquivo, id) => ({ ...arquivo, ativa: id });
export const acharPorNome = (arquivo, nome) => Object.keys(arquivo.provas).find(id => arquivo.provas[id].prova.nome === nome) ?? null;
export const novaProva = arquivo => ({ ...arquivo, ativa: null });
export function apagarProva(arquivo, id) {
  const { [id]: _, ...resto } = arquivo.provas;
  return { provas: resto, ativa: arquivo.ativa === id ? null : arquivo.ativa };
}
export const listar = arquivo =>
  Object.entries(arquivo.provas).map(([id, e]) => ({ id, nome: e.prova.nome })).sort((a, b) => a.nome.localeCompare(b.nome));

// Gabarito e anuladas da versão de uma correção ('A' quando a prova tem uma versão só).
export const versaoDe = (prova, versao = 'A') => prova.versoes['ABCD'.indexOf(versao)];

export function definirProva(estado, prova) {
  const correcoes = Object.values(estado.correcoes), temCorrecoes = correcoes.length > 0;
  if (temCorrecoes && estado.prova && estado.prova.versoes[0].gabarito.length !== prova.versoes[0].gabarito.length)
    throw new Error('Já há correções com outro número de questões. Baixe a planilha e comece uma nova prova.');
  if (temCorrecoes && estado.prova && (estado.prova.alternativas ?? 'ABCDE') !== (prova.alternativas ?? 'ABCDE'))
    throw new Error('Já há correções com outras alternativas. Baixe a planilha e comece uma nova prova.');
  const semVersao = correcoes.find(c => 'ABCD'.indexOf(c.versao ?? 'A') >= prova.versoes.length);
  if (semVersao) throw new Error(`Já há correções da versão ${semVersao.versao}. Não dá para tirar essa versão.`);
  const emb = prova.caderno?.embaralhar;
  if (emb && (emb.questoes || emb.alternativas) && prova.versoes.length > 1) // versões B–D saem do gabarito da A
    prova = { ...prova, versoes: gerarVersoes(prova.versoes[0], prova.versoes.length, prova.alternativas ?? 'ABCDE', emb, prova.caderno.semente ?? 1) };
  const arranjo = p => JSON.stringify(p?.versoes.map(v => [v.ordem, v.trocas]) ?? null);
  if (temCorrecoes && estado.prova && (estado.prova.versoes[1]?.ordem || prova.versoes[1]?.ordem) && arranjo(estado.prova) !== arranjo(prova))
    throw new Error('Já há correções desta prova. Não dá para mudar o embaralhamento das versões. Comece uma nova prova.');
  return { ...estado, prova, pendente: estado.pendente || temCorrecoes };
}

// Áreas: { nome, de, ate } com questões de 1 a n, sem sobreposição. Devolve a mensagem do problema, ou ''.
export function validarAreas(areas, n) {
  for (const a of areas) {
    if (!a.nome?.trim()) return 'Dê um nome a cada área.';
    if (!(Number.isInteger(a.de) && Number.isInteger(a.ate) && a.de >= 1 && a.ate >= a.de && a.ate <= n))
      return `A área "${a.nome}" precisa ir de uma questão até outra, até a questão ${n}.`;
  }
  const ord = [...areas].sort((a, b) => a.de - b.de);
  const choque = ord.findIndex((a, i) => i > 0 && a.de <= ord[i - 1].ate);
  return choque > 0 ? `As áreas "${ord[choque - 1].nome}" e "${ord[choque].nome}" se sobrepõem.` : '';
}

export const chave = (turma, numero) => `${turma.trim().toUpperCase()}|${numero}`;

export function registrar(estado, correcao) {
  const turma = correcao.turma.trim().toUpperCase();
  return {
    ...estado,
    correcoes: { ...estado.correcoes, [chave(turma, correcao.numero)]: { ...correcao, turma, salvoEm: new Date().toISOString() } },
    pendente: true,
  };
}

export function remover(estado, k) {
  const { [k]: _, ...resto } = estado.correcoes;
  return { ...estado, correcoes: resto, pendente: true };
}
export const marcarExportado = estado => ({ ...estado, pendente: false });

// Lista de chamada colada pelo professor: linha N vale para o número N, ou para o número escrito no início.
export function lerLista(texto) {
  const nomes = {};
  texto.split('\n').map(l => l.trim()).filter(Boolean).forEach((linha, i) => {
    const m = linha.match(/^(\d{1,2})\s*(?:[-.–)]\s*|\s+)(.+)$/);
    nomes[String(m ? +m[1] : i + 1).padStart(2, '0')] = m ? m[2].trim() : linha;
  });
  return nomes;
}
export const definirLista = (estado, turma, texto) =>
  ({ ...estado, chamadas: { ...estado.chamadas, [turma.trim().toUpperCase()]: lerLista(texto) }, pendente: true });
export const nomeDo = (estado, turma, numero) => estado.chamadas?.[turma]?.[numero] ?? '';
