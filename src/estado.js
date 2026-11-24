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
  const semVersao = correcoes.find(c => 'ABCD'.indexOf(c.versao ?? 'A') >= prova.versoes.length);
  if (semVersao) throw new Error(`Já há correções da versão ${semVersao.versao}. Não dá para tirar essa versão.`);
  return { ...estado, prova, pendente: estado.pendente || temCorrecoes };
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
