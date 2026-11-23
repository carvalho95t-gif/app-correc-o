// Estado do app, guardado no navegador. Funções puras: nunca alteram o estado recebido.
const CHAVE = 'correcao-v2';

export const estadoInicial = () => ({ prova: null, correcoes: {}, pendente: false });

export function carregar(storage) {
  try {
    const e = JSON.parse(storage.getItem(CHAVE));
    return e && typeof e === 'object' && e.correcoes ? e : estadoInicial();
  } catch { return estadoInicial(); }
}
export const salvar = (storage, estado) => storage.setItem(CHAVE, JSON.stringify(estado));

export function definirProva(estado, prova) {
  const temCorrecoes = Object.keys(estado.correcoes).length > 0;
  if (temCorrecoes && estado.prova && estado.prova.gabarito.length !== prova.gabarito.length)
    throw new Error('Já há correções com outro número de questões. Baixe a planilha e comece uma nova prova.');
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
