// Importa uma prova de um arquivo Word (.docx), sem internet: lê o zip, o XML do documento
// e monta o cabeçalho, as questões (texto-base, fonte, comando, alternativas, imagem) e o gabarito.

// ---------- zip ----------
const u16 = (b, o) => b[o] | (b[o + 1] << 8);
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;

async function inflar(dados) {
  const s = new Blob([dados]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

// Arquivos do zip pelo diretório central: { nome: () => Promise<Uint8Array> }.
function abrirZip(buf) {
  const b = new Uint8Array(buf);
  let fim = b.length - 22;
  while (fim >= 0 && u32(b, fim) !== 0x06054b50) fim--;
  if (fim < 0) throw new Error('não é um arquivo .docx');
  const arquivos = {};
  for (let i = 0, o = u32(b, fim + 16); i < u16(b, fim + 10); i++) {
    const metodo = u16(b, o + 10), tam = u32(b, o + 20), nl = u16(b, o + 28), el = u16(b, o + 30), cl = u16(b, o + 32), local = u32(b, o + 42);
    const nome = new TextDecoder().decode(b.subarray(o + 46, o + 46 + nl));
    arquivos[nome] = () => {
      const ini = local + 30 + u16(b, local + 26) + u16(b, local + 28), dados = b.subarray(ini, ini + tam);
      return metodo === 0 ? Promise.resolve(dados) : inflar(dados);
    };
    o += 46 + nl + el + cl;
  }
  return arquivos;
}

// ---------- documento ----------
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp' };

// Parágrafos na ordem do documento (também os de tabelas): { texto, negrito, direita, imagens: [rId] }.
function paragrafos(xml) {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  return [...doc.getElementsByTagNameNS(W, 'p')].map(p => {
    const runs = [...p.getElementsByTagNameNS(W, 'r')];
    const comTexto = runs.filter(r => [...r.getElementsByTagNameNS(W, 't')].some(t => t.textContent.trim()));
    const texto = runs.map(r => [...r.childNodes].map(n => (n.localName === 't' ? n.textContent : n.localName === 'tab' ? ' ' : n.localName === 'br' ? '\n' : '')).join('')).join('');
    const jc = p.getElementsByTagNameNS(W, 'jc')[0]?.getAttributeNS(W, 'val');
    const negrito = comTexto.length > 0 && comTexto.every(r => { const b = r.getElementsByTagNameNS(W, 'b')[0]; return b && b.getAttributeNS(W, 'val') !== '0' && b.getAttributeNS(W, 'val') !== 'false'; });
    const imagens = [...p.getElementsByTagNameNS('*', 'blip')].map(b => b.getAttributeNS(R, 'embed')).filter(Boolean);
    return { texto: texto.replace(/\s+\n/g, '\n').replace(/[  ]+/g, ' ').trim(), negrito, direita: jc === 'right' || jc === 'end', imagens };
  });
}

// ---------- montar a prova ----------
const INICIO_QUESTAO = /^(?:QUEST[ÃA]O|Quest[ãa]o)\s*(\d{1,3})\b\s*(?:\(([\d,.]+)\s*pontos?\))?[\s.:–-]*(.*)$/s;
const ALTERNATIVA = /^\(?([a-eA-E])\s*[).]\s*(.*)$/s;
const GABARITO = /^(?:\d+\.\s*)?gabarito\b/i;
const PARECE_FONTE = /^(texto elaborado|texto adaptado|adaptado de|dispon[ií]vel em|fonte:|in:)|^[A-ZÀ-Ý]{2,}[A-ZÀ-Ý ]*,\s+[A-ZÀ-Ý]/i;

export function montarProva(pars) {
  const cab = [], questoes = [], gabarito = {}, textoGabarito = [];
  let atual = null, noGabarito = false;
  for (const p of pars) {
    if (!p.texto && !p.imagens.length) continue;
    if (GABARITO.test(p.texto)) { noGabarito = true; continue; }
    if (noGabarito) { textoGabarito.push(p.texto); continue; } // células de tabela vêm em parágrafos separados
    const q = INICIO_QUESTAO.exec(p.texto);
    if (q) { atual = { numero: +q[1], antes: q[3].trim() ? [{ ...p, texto: q[3].trim() }] : [], alternativas: [], imagens: [...p.imagens] }; questoes.push(atual); continue; }
    if (!atual) { if (p.texto) cab.push(p.texto); continue; }
    const a = ALTERNATIVA.exec(p.texto);
    if (a && atual.alternativas.length < 5 && 'abcde'.indexOf(a[1].toLowerCase()) === atual.alternativas.length) { atual.alternativas.push(a[2].trim()); atual.imagens.push(...p.imagens); continue; }
    if (atual.alternativas.length) { // continuação da última alternativa
      if (p.texto) atual.alternativas[atual.alternativas.length - 1] += ' ' + p.texto;
      atual.imagens.push(...p.imagens);
      continue;
    }
    atual.antes.push(p); atual.imagens.push(...p.imagens);
  }
  // Pares "01 d", "1-D", "Questão 01 – Alternativa d": vale o primeiro de cada questão.
  for (const m of textoGabarito.join(' ').matchAll(/\b(\d{1,3})\s*(?:[-–.:)]|–\s*alternativa)?\s*([a-e])\b/gi)) gabarito[+m[1]] ??= m[2].toUpperCase();
  return { cabecalho: cabecalho(cab), questoes: questoes.map(separar), gabarito: questoes.map(q => gabarito[q.numero] ?? '') };
}

// Antes das alternativas: texto-base, fonte (alinhada à direita ou com cara de referência) e comando (o último parágrafo).
function separar(q) {
  const ps = q.antes.filter(p => p.texto);
  const iFonte = ps.findIndex(p => p.direita || PARECE_FONTE.test(p.texto));
  const fonte = iFonte >= 0 ? ps.splice(iFonte, 1)[0].texto : '';
  const comando = ps.length > 1 ? ps.pop().texto : '';
  return { enunciado: ps.map(p => p.texto).join('\n'), fonte, comando, alternativas: q.alternativas, imagemRef: q.imagens[0] };
}

function cabecalho(linhas) {
  const c = {}, resto = [];
  for (const l of linhas) {
    const campo = (re, k) => { const m = re.exec(l); if (m && m[1].trim() && !/^_+$/.test(m[1].trim())) c[k] ??= m[1].trim(); return !!m; };
    const a = campo(/Professor(?:\(a\))?:\s*(.*?)(?:\s{2,}|\s+Turma:|$)/i, 'professor');
    const b = campo(/Disciplina:\s*(.*?)(?:\s{2,}|\s+S[ée]rie:|$)/i, 'disciplina');
    const d = campo(/S[ée]rie:\s*(.*?)(?:\s{2,}|\s+Nota:|$)/i, 'serie');
    if (!(a || b || d || /^Estudante:|^Aluno|^Nome:|INSTRU[ÇC][ÕO]ES|^\d+\.\s|CART[ÃA]O|Assinatura/i.test(l))) resto.push(l);
  }
  const iTitulo = resto.findIndex(l => /avalia[çc][ãa]o|prova|simulado|teste|exame|atividade/i.test(l));
  if (iTitulo >= 0) {
    c.titulo = resto[iTitulo];
    if (resto[iTitulo + 1]) c.subtitulo = resto[iTitulo + 1];
    if (iTitulo > 0) c.escola = resto.slice(Math.max(0, iTitulo - 4), iTitulo).join('\n');
  }
  return c;
}

// arquivo: ArrayBuffer do .docx. Devolve { cabecalho, questoes: [{enunciado, fonte, comando, alternativas, imagem?: Blob}], gabarito }.
export async function lerDocx(arquivo) {
  const zip = abrirZip(arquivo);
  if (!zip['word/document.xml']) throw new Error('não é um arquivo .docx');
  const texto = async nome => new TextDecoder().decode(await zip[nome]());
  const prova = montarProva(paragrafos(await texto('word/document.xml')));
  const rels = zip['word/_rels/document.xml.rels'] ? new DOMParser().parseFromString(await texto('word/_rels/document.xml.rels'), 'application/xml') : null;
  const alvo = id => [...(rels?.getElementsByTagName('Relationship') ?? [])].find(r => r.getAttribute('Id') === id)?.getAttribute('Target');
  for (const q of prova.questoes) {
    const t = q.imagemRef && alvo(q.imagemRef), nome = t && 'word/' + t.replace(/^\/?word\//, '').replace(/^\.\//, '');
    delete q.imagemRef;
    const tipo = nome && MIME[nome.split('.').pop().toLowerCase()];
    if (!tipo || !zip[nome]) continue;
    q.imagem = new Blob([await zip[nome]()], { type: tipo });
  }
  return prova;
}
