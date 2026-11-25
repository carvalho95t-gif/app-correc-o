// Liga as telas aos módulos. A lógica fica em src/.
import { montarLayout, montarQuadro, MAX_QUADRO } from './src/layout.js';
import { folhaSVG, quadroSVG } from './src/folha.js';
import { qrSVG, textoQR, lerQR } from './src/qr.js';
import { carregar, salvar, definirProva, arquivoInicial, ativo, comAtivo, escolher, novaProva, apagarProva, listar,
  acharPorNome, validarAreas, registrar, chave, remover, marcarExportado, definirLista, nomeDo, versaoDe } from './src/estado.js';
import { montarPlanilha, nomeArquivo, porTurma, notaDe, lerPlanilha, temParciais, lerConceitos, conceitoDe, posicoes, percentis, lerPesos, analiseDaProva, listaDeLinhas, gabaritoDeLinhas, gabaritoEmLinhas } from './src/planilha.js';
import { paraCinza, lerFolha, homografia, aplicar, acharMarcadores, quadroPronto, razaoDe, poucaLuz, reflexo } from './src/leitor.js';
import { codificar } from './src/codigo.js';
import { cadernoHTML, estiloDePagina } from './src/caderno.js';
import { ehEmbaralhada, cadernoDaVersao } from './src/embaralhar.js';
import { lerDocx } from './src/docx.js';
import { carregarImagens, guardarImagem, apagarImagens, ehRef, resolver, reduzir } from './src/imagens.js';

const $ = s => document.querySelector(s);
const letras = p => [...(p.alternativas ?? 'ABCDE')];
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ROTULO = { branco: 'Em branco', dupla: 'Dupla marcação' };
const nota1 = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
let leitura = null; // leitura em conferência
let imagens = {}; // chave → data URL, lidas do IndexedDB na abertura
try { imagens = await carregarImagens(); } catch { /* navegador sem IndexedDB: imagens ficam na própria prova */ }
// A prova com as imagens do caderno no lugar das referências, para imprimir e para a planilha.
const comImagens = p => (p?.caderno ? { ...p, caderno: { ...p.caderno,
  questoes: p.caderno.questoes.map(q => (q.imagem ? { ...q, imagem: resolver(imagens, q.imagem) } : q)) } } : p);
const refsDe = p => (p?.caderno?.questoes ?? []).map(q => q.imagem).filter(ehRef);

let armazenamento = null;
try { localStorage.setItem('teste', '1'); armazenamento = localStorage; } catch { /* navegador sem armazenamento */ }
let arquivo = armazenamento ? carregar(armazenamento) : arquivoInicial();
let estado = ativo(arquivo); // estado da prova em uso
const provaEmBranco = () => ({ nome: '', valor: 10, versoes: [{ gabarito: Array(10).fill(''), anuladas: [] }] });
let rascunho = estado.prova ? structuredClone(estado.prova) : provaEmBranco();
let editando = 0; // versão cujo gabarito está sendo editado
const numQuestoes = p => p.versoes[0].gabarito.length;
// Prova embaralhada: cada versão tem sua folha, com a versão no código, sem bolinhas de versão.
const layoutDa = p => montarLayout(numQuestoes(p), ehEmbaralhada(p) ? 1 : p.versoes.length, p.alternativas);
// Quadro do gabarito na página 1 (provas com caderno de até 30 questões). Os marcadores ficam no mesmo
// lugar com qualquer número de questões, então o QR de outra prova é lido com o quadro desta.
const quadroDa = p => montarQuadro(Math.min(numQuestoes(p), MAX_QUADRO), p.alternativas);
// Versões sem embaralhar usam bolinhas de versão, que o quadro não tem: essas provas ficam com a folha.
const cabeNoQuadro = p => numQuestoes(p) <= MAX_QUADRO && (p.versoes.length === 1 || ehEmbaralhada(p));
const RAZOES = [razaoDe(montarQuadro(1)), razaoDe(montarLayout(1))];

function gravar(novoArquivo) {
  arquivo = novoArquivo; estado = ativo(arquivo);
  try { if (armazenamento) salvar(armazenamento, arquivo); }
  catch { alert('Não foi possível salvar no aparelho. Baixe a planilha agora para não perder.'); }
  $('#aviso-exportar').hidden = !Object.values(arquivo.provas).some(e => e.pendente);
}
const persistir = novo => gravar(comAtivo(arquivo, novo));

// Pergunta com botões nomeados pela ação; resolve true para "sim".
function perguntar(msg, sim, nao) {
  const d = $('#dlg');
  $('#dlg-msg').textContent = msg; $('#dlg-sim').textContent = sim; $('#dlg-nao').textContent = nao;
  d.showModal();
  return new Promise(ok => {
    $('#dlg-sim').onclick = () => { d.close(); ok(true); };
    $('#dlg-nao').onclick = () => { d.close(); ok(false); };
    d.oncancel = () => ok(false);
  });
}

// ---------- abas ----------
const telas = ['prova', 'folha', 'corrigir', 'resultados'];
const render = { prova: renderProva, folha: renderFolha, corrigir: renderCorrigir, resultados: renderResultados };
function mostrar(tela) {
  if (tela !== 'corrigir') { modoCamera = false; fecharCamera(); }
  for (const t of telas) {
    $(`#tela-${t}`).hidden = t !== tela;
    if (t === tela) $(`#aba-${t}`).setAttribute('aria-current', 'page'); else $(`#aba-${t}`).removeAttribute('aria-current');
  }
  render[tela]();
  window.scrollTo(0, 0);
}
telas.forEach(t => $(`#aba-${t}`).addEventListener('click', () => mostrar(t)));

// ---------- prova ----------
function renderProva() {
  const provas = listar(arquivo);
  $('#prova-ativa').innerHTML = (arquivo.ativa ? '' : '<option value="" selected>Nova prova (ainda não salva)</option>') +
    provas.map(p => `<option value="${p.id}" ${p.id === arquivo.ativa ? 'selected' : ''}>${esc(p.nome)}</option>`).join('');
  $('#prova-nome').value = rascunho.nome;
  $('#prova-num').value = numQuestoes(rascunho);
  $('#prova-alternativas').value = rascunho.alternativas ?? 'ABCDE';
  $('#prova-pesquisa').checked = !!rascunho.pesquisa; $('#tela-prova').classList.toggle('em-pesquisa', !!rascunho.pesquisa);
  $('#prova-versoes').value = rascunho.versoes.length;
  if (editando >= rascunho.versoes.length) editando = 0;
  $('#versoes-gabarito').hidden = rascunho.versoes.length < 2;
  $('#versoes-gabarito').innerHTML = rascunho.versoes.map((_, k) =>
    `<button data-versao="${'ABCD'[k]}" aria-pressed="${k === editando}">Versão ${'ABCD'[k]}</button>`).join('');
  const { gabarito, anuladas } = rascunho.versoes[editando];
  $('#prova-valor').value = rascunho.valor;
  $('#prova-conceitos').value = (rascunho.conceitos ?? []).map(f => `${f.conceito} ${String(f.min).replace('.', ',')}`).join('\n');
  $('#pesos-resumo').textContent = resumoPesos(rascunho.pesos ?? []);
  renderCadernoEditor();
  const emb = rascunho.caderno?.embaralhar ?? {};
  $('#embaralhar-questoes').checked = !!emb.questoes; $('#embaralhar-alternativas').checked = !!emb.alternativas;
  $('#embaralhar-de-novo').hidden = !embaralhando(rascunho);
  $('#embaralhar-nota').hidden = !embaralhando(rascunho);
  const salva = estado.prova && ehEmbaralhada(estado.prova) ? estado.prova : null; // gabaritos gerados, só para ver
  $('#embaralhar-nota').textContent = 'O gabarito acima é o da versão A. As outras versões são geradas pelo app' +
    (salva ? ':\n' + salva.versoes.slice(1).map((v, k) => `Versão ${'BCD'[k]}: ${v.gabarito.map((g, i) => `${i + 1} ${v.anuladas.includes(i) ? 'anulada' : g}`).join(', ')}`).join('\n') : ' quando você salvar a prova.');
  if (embaralhando(rascunho)) $('#versoes-gabarito').hidden = true;
  $('#areas').innerHTML = (rascunho.areas ?? []).map((a, k) => `
    <div class="pesos" data-area="${k}">
      <label>Área <input name="nome" value="${esc(a.nome)}" autocomplete="off"></label>
      <label>da questão <input name="de" type="number" inputmode="numeric" min="1" value="${a.de ?? ''}"></label>
      <label>até a <input name="ate" type="number" inputmode="numeric" min="1" value="${a.ate ?? ''}"></label>
      <button data-remover-area="${k}" aria-label="Remover a área ${esc(a.nome)}">Remover</button>
    </div>`).join('');
  if (rascunho.versoes.some(temParciais)) parcialAberto = true;
  const parciais = rascunho.versoes[editando].parciais ?? [];
  $('#parcial-ativar').checked = parcialAberto;
  $('#gabarito').innerHTML = gabarito.map((g, i) => `
    <div class="linha" role="group" aria-label="Questão ${i + 1}">
      <span class="num">${i + 1}</span>
      ${letras(rascunho).map(a => `<button data-q="${i}" data-alt="${a}" aria-pressed="${g === a}" aria-label="Questão ${i + 1}, alternativa ${a}">${a}</button>`).join('')}
      <label><input type="checkbox" data-anular="${i}" ${anuladas.includes(i) ? 'checked' : ''}> Anular</label>
    </div>${parcialAberto ? `<div class="parciais" data-pq="${i}">${linhaParcial(i, g, parciais[i])}</div>` : ''}`).join('');
}
// O caderno tem uma questão por questão da prova; o gabarito da versão A é a alternativa certa.
const questaoVazia = () => ({ enunciado: '', alternativas: [] });
function ajustarCaderno() {
  const n = numQuestoes(rascunho), qs = rascunho.caderno?.questoes ?? [];
  rascunho.caderno = { ...rascunho.caderno, questoes: Array.from({ length: n }, (_, i) => qs[i] ?? questaoVazia()) };
}
function renderCadernoEditor() {
  ajustarCaderno();
  const cab = rascunho.caderno.cabecalho ?? {};
  document.querySelectorAll('[data-cab]').forEach(el => { el.value = cab[el.dataset.cab] ?? ''; });
  const g = rascunho.versoes[0].gabarito;
  $('#caderno-questoes').innerHTML = rascunho.caderno.questoes.map((q, i) => `
    <div class="cq" data-cq="${i}">
      <label>Questão ${i + 1}: texto-base<textarea rows="3" data-campo="enunciado">${esc(q.enunciado)}</textarea></label>
      <details class="fonte-comando"${q.fonte || q.comando ? ' open' : ''}><summary>Fonte e comando</summary>
      <label>Fonte <input data-campo="fonte" value="${esc(q.fonte ?? '')}" placeholder="Texto elaborado a partir de..."></label>
      <label>Comando <textarea rows="2" data-campo="comando">${esc(q.comando ?? '')}</textarea></label></details>
      ${q.imagem ? `<img class="miniatura" src="${esc(resolver(imagens, q.imagem))}" alt="Imagem da questão ${i + 1}"><button data-tirar-imagem>Remover imagem</button>`
        : `<label class="botao">Adicionar imagem<input type="file" accept="image/*" class="oculto" aria-label="Imagem da questão ${i + 1}"></label>`}
      ${letras(rascunho).map((a, j) => `<div class="alt">
        <input type="radio" name="certa-${i}" value="${a}" ${g[i] === a ? 'checked' : ''} aria-label="Questão ${i + 1}: ${a} é a certa">
        <b>${a})</b><input type="text" data-texto="${a}" value="${esc(q.alternativas[j] ?? '')}" aria-label="Questão ${i + 1}, texto da alternativa ${a}">
      </div>`).join('')}
    </div>`).join('');
}
$('#cabecalho-prova').addEventListener('input', e => {
  if (!e.target.dataset.cab) return;
  ajustarCaderno();
  rascunho.caderno.cabecalho = { ...rascunho.caderno.cabecalho, [e.target.dataset.cab]: e.target.value };
});
$('#caderno-questoes').addEventListener('input', e => {
  const i = +e.target.closest('[data-cq]').dataset.cq, q = rascunho.caderno.questoes[i];
  if (e.target.dataset.campo) q[e.target.dataset.campo] = e.target.value;
  else if (e.target.dataset.texto) q.alternativas[letras(rascunho).indexOf(e.target.dataset.texto)] = e.target.value;
});
$('#caderno-questoes').addEventListener('click', e => {
  if (!e.target.matches('[data-tirar-imagem]')) return;
  // shortcut: a imagem tirada continua no IndexedDB até apagar a prova; limpar órfãs se o espaço virar problema.
  delete rascunho.caderno.questoes[+e.target.closest('[data-cq]').dataset.cq].imagem;
  renderCadernoEditor();
});
$('#caderno-questoes').addEventListener('change', async e => {
  if (e.target.type === 'file') {
    const i = +e.target.closest('[data-cq]').dataset.cq, f = e.target.files[0];
    if (!f) return;
    try {
      const dataURL = await reduzir(f);
      let ref = dataURL;
      try { ref = await guardarImagem(dataURL); imagens[ref.slice(4)] = dataURL; } catch { /* sem IndexedDB: fica na prova */ }
      rascunho.caderno.questoes[i].imagem = ref;
      renderCadernoEditor();
    } catch { $('#prova-msg').textContent = 'Não consegui abrir essa imagem. Tente outra.'; }
    return;
  }
  if (e.target.type !== 'radio') return;
  const i = +e.target.closest('[data-cq]').dataset.cq;
  rascunho.versoes[0].gabarito[i] = e.target.value;
  document.querySelectorAll(`#gabarito button[data-q="${i}"]`).forEach(b => b.setAttribute('aria-pressed', b.dataset.alt === e.target.value));
});
const temCaderno = p => !!p.caderno?.questoes.some(q => q.enunciado.trim());
const embaralhando = p => p.versoes.length > 1 && temCaderno(p) && !!(p.caderno.embaralhar?.questoes || p.caderno.embaralhar?.alternativas);
for (const [id, campo] of [['#embaralhar-questoes', 'questoes'], ['#embaralhar-alternativas', 'alternativas']])
  $(id).addEventListener('change', e => {
    ajustarCaderno();
    rascunho.caderno.embaralhar = { ...rascunho.caderno.embaralhar, [campo]: e.target.checked };
    rascunho.caderno.semente ??= 1 + Math.floor(Math.random() * 2 ** 30);
    editando = 0; renderProva();
  });
$('#embaralhar-de-novo').addEventListener('click', () => {
  if (Object.keys(estado.correcoes).length) { $('#prova-msg').textContent = 'Já há correções desta prova. Embaralhar de novo mudaria as versões já corrigidas. Comece uma nova prova.'; return; }
  rascunho.caderno.semente = 1 + Math.floor(Math.random() * 2 ** 30);
  $('#prova-msg').textContent = 'Versões embaralhadas de novo. Salve a prova e imprima o caderno outra vez.';
});

// "Questões 1 a 5 valem 2; as outras valem 1."
function resumoPesos(pesos) {
  const grupos = [];
  pesos.forEach((p, i) => {
    if (p === 1) return;
    const g = grupos.at(-1);
    if (g && g.p === p && g.ate === i - 1) g.ate = i; else grupos.push({ p, de: i, ate: i });
  });
  if (!grupos.length) return 'Todas as questões valem 1.';
  const fmt = g => `${g.de === g.ate ? `Questão ${g.de + 1} vale` : `Questões ${g.de + 1} a ${g.ate + 1} valem`} ${String(g.p).replace('.', ',')}`;
  return `${grupos.map(fmt).join('; ')}; as outras valem 1.`;
}
$('#aplicar-peso').addEventListener('click', () => {
  const n = numQuestoes(rascunho), p = Number($('#peso-valor').value.replace(',', '.'));
  const de = parseInt($('#peso-de').value, 10), ate = parseInt($('#peso-ate').value, 10);
  if (!(p > 0)) { $('#pesos-resumo').textContent = 'O peso precisa ser maior que zero.'; return; }
  if (!(de >= 1 && ate >= de && ate <= n)) { $('#pesos-resumo').textContent = `Escolha questões entre 1 e ${n}, com a primeira antes da última.`; return; }
  rascunho.pesos = Array.from({ length: n }, (_, i) => (i >= de - 1 && i <= ate - 1 ? p : rascunho.pesos?.[i] ?? 1));
  $('#pesos-resumo').textContent = resumoPesos(rascunho.pesos);
});
$('#aplicar-lista-pesos').addEventListener('click', () => {
  const n = numQuestoes(rascunho), ps = lerPesos($('#pesos-lista').value);
  if (!ps || ps.length !== n) { $('#pesos-resumo').textContent = ps ? `A lista tem ${ps.length} pesos e a prova tem ${n} questões.` : 'Cada peso precisa ser um número maior que zero, como 2 ou 1,5.'; return; }
  rascunho.pesos = ps;
  $('#pesos-resumo').textContent = resumoPesos(ps);
});
$('#pesos-iguais').addEventListener('click', () => { delete rascunho.pesos; $('#pesos-resumo').textContent = resumoPesos([]); });
$('#adicionar-area').addEventListener('click', () => {
  rascunho.areas = [...(rascunho.areas ?? []), { nome: '', de: '', ate: '' }];
  renderProva();
});
$('#areas').addEventListener('input', e => {
  const k = +e.target.closest('[data-area]').dataset.area, campo = e.target.name;
  rascunho.areas[k][campo] = campo === 'nome' ? e.target.value : parseInt(e.target.value, 10);
});
$('#areas').addEventListener('click', e => {
  const b = e.target.closest('[data-remover-area]');
  if (!b) return;
  rascunho.areas.splice(+b.dataset.removerArea, 1);
  renderProva();
});
// Prova a partir de um .docx: vira o rascunho de uma prova nova (caderno, cabeçalho e gabarito), para conferir e salvar.
$('#importar-docx').addEventListener('change', async e => {
  const f = e.target.files[0], msg = $('#prova-msg');
  e.target.value = '';
  if (!f) return;
  let lida;
  try { lida = await lerDocx(await f.arrayBuffer()); } catch { msg.textContent = 'Não consegui ler esse arquivo. Abra no Word, salve como .docx e tente de novo.'; return; }
  const qs = lida.questoes.filter(q => q.alternativas.length >= 2);
  if (!qs.length) { msg.textContent = 'Não achei questões nesse arquivo. Cada questão deve começar com "QUESTÃO 1" e ter alternativas "a)" a "e)".'; return; }
  const n = Math.max(...qs.map(q => q.alternativas.length)), alternativas = n === 4 ? 'ABCD' : 'ABCDE';
  const gabarito = lida.questoes.flatMap((q, i) => (q.alternativas.length >= 2 ? [alternativas.includes(lida.gabarito[i]) ? lida.gabarito[i] : ''] : []));
  gravar(novaProva(arquivo)); editando = 0; parcialAberto = false;
  rascunho = { ...provaEmBranco(), nome: (lida.cabecalho.titulo ?? f.name.replace(/\.docx$/i, '')).slice(0, 80),
    ...(alternativas !== 'ABCDE' ? { alternativas } : {}), versoes: [{ gabarito, anuladas: [] }],
    caderno: { cabecalho: lida.cabecalho, questoes: [] } };
  if (qs.every(q => q.pontos > 0)) { rascunho.pesos = qs.map(q => q.pontos); rascunho.valor = Math.round(rascunho.pesos.reduce((a, b) => a + b, 0) * 100) / 100; } // "QUESTÃO 01 (5,0 pontos)": peso = pontos, valor = soma
  for (const q of qs) {
    const { imagem, pontos, ...resto } = q, nova = { ...resto, alternativas: Array.from({ length: alternativas.length }, (_, j) => q.alternativas[j] ?? '') };
    if (imagem) try { const dataURL = await reduzir(imagem); nova.imagem = dataURL; nova.imagem = await guardarImagem(dataURL); imagens[nova.imagem.slice(4)] = dataURL; } catch { /* sem imagem ou sem IndexedDB */ }
    rascunho.caderno.questoes.push(nova);
  }
  renderProva();
  $('#caderno-editor').open = true;
  const faltam = gabarito.flatMap((g, i) => (g ? [] : [i + 1]));
  msg.textContent = `${qs.length} questões importadas de "${f.name}". ` + (faltam.length
    ? `Não achei o gabarito da questão ${faltam.join(', ')}: marque a alternativa certa. Depois confira e toque em Salvar prova.`
    : 'O gabarito também veio do arquivo. Confira e toque em Salvar prova.');
});
$('#prova-ativa').addEventListener('change', e => {
  if (!e.target.value) return;
  gravar(escolher(arquivo, e.target.value));
  rascunho = structuredClone(estado.prova); $('#prova-msg').textContent = '';
  renderProva();
});
$('#nova-prova').addEventListener('click', () => {
  gravar(novaProva(arquivo)); parcialAberto = false;
  rascunho = provaEmBranco(); $('#prova-msg').textContent = '';
  renderProva();
});
// Duplicar: a prova salva vira o rascunho de uma prova nova, sem correções e com outro código.
$('#duplicar-prova').addEventListener('click', () => {
  if (!estado.prova) { $('#prova-msg').textContent = 'Salve a prova antes de duplicar.'; return; }
  const { codigo, ...copia } = structuredClone(estado.prova);
  gravar(novaProva(arquivo)); editando = 0;
  rascunho = { ...copia, nome: `${copia.nome} (cópia)` };
  renderProva();
  $('#prova-msg').textContent = 'Cópia pronta, sem correções. Mude o que quiser e toque em Salvar prova.';
});
$('#apagar-prova').addEventListener('click', async () => {
  if (arquivo.ativa) {
    const nome = estado.prova.nome;
    const ok = await perguntar(estado.pendente
      ? `Apagar a prova "${nome}" e todas as correções dela? Há correções que ainda não estão na planilha, e elas serão perdidas.`
      : `Apagar a prova "${nome}" e todas as correções dela?`, 'Apagar prova', 'Manter');
    if (!ok) return;
    // Imagens usadas por outra prova (cópia feita com "Duplicar") ficam.
    const outras = new Set(Object.entries(arquivo.provas).filter(([id]) => id !== arquivo.ativa).flatMap(([, e]) => refsDe(e.prova)));
    apagarImagens(refsDe(estado.prova).filter(r => !outras.has(r))).catch(() => {});
    gravar(apagarProva(arquivo, arquivo.ativa));
  }
  rascunho = provaEmBranco(); $('#prova-msg').textContent = '';
  renderProva();
});
$('#importar').addEventListener('change', async e => {
  const arquivoXlsx = e.target.files[0];
  e.target.value = '';
  if (!arquivoXlsx) return;
  const msg = $('#prova-msg');
  let restaurado;
  try { restaurado = lerPlanilha(XLSX, XLSX.read(await arquivoXlsx.arrayBuffer(), { type: 'array' })); }
  catch (err) { msg.textContent = err.message.startsWith('Esta planilha') ? err.message : 'Não consegui ler esse arquivo. Escolha a planilha baixada pelo app.'; return; }
  const nome = restaurado.prova.nome, existente = acharPorNome(arquivo, nome);
  let base = novaProva(arquivo);
  if (existente) {
    const aviso = arquivo.provas[existente].pendente ? ' Ela tem correções que ainda não estão em nenhuma planilha e serão perdidas.' : '';
    if (await perguntar(`Já existe uma prova "${nome}" no app.${aviso} Substituir pela da planilha?`, 'Substituir', 'Manter as duas')) base = escolher(arquivo, existente);
    else restaurado.prova = { ...restaurado.prova, nome: `${nome} (restaurada)` };
  }
  for (const q of restaurado.prova.caderno?.questoes ?? []) {
    if (!q.imagem || ehRef(q.imagem)) continue;
    try { const dataURL = q.imagem; q.imagem = await guardarImagem(dataURL); imagens[q.imagem.slice(4)] = dataURL; } catch { /* fica na prova */ }
  }
  gravar(comAtivo(base, restaurado));
  rascunho = structuredClone(estado.prova);
  renderProva();
  const n = Object.keys(estado.correcoes).length;
  msg.textContent = `Prova "${nome}" restaurada com ${n} ${n === 1 ? 'correção' : 'correções'}.`;
});
$('#prova-nome').addEventListener('input', e => { rascunho.nome = e.target.value; });
$('#prova-valor').addEventListener('input', e => { rascunho.valor = e.target.value; });
// Pontuação parcial: % da questão que cada alternativa errada vale (a certa vale 100%).
let parcialAberto = false;
const linhaParcial = (i, certa, credito = {}) => letras(rascunho).map(a => (a === certa
  ? `<span class="parcial-certa">${a} 100%</span>`
  : `<label>${a} <input type="number" inputmode="numeric" min="0" max="100" step="5" data-parcial="${i}" data-alt="${a}" value="${Math.round((credito[a] ?? 0) * 100)}" aria-label="Questão ${i + 1}, alternativa ${a}, % da questão">%</label>`)).join('');
$('#gabarito-arquivo').addEventListener('change', async e => {
  const f = e.target.files[0], msg = $('#prova-msg'); e.target.value = '';
  if (!f) return;
  let g = [];
  try { g = gabaritoDeLinhas(await linhasDoArquivo(f), letras(rascunho).join('')); } catch { /* cai na mensagem abaixo */ }
  if (!g.length || g.length > 90) { msg.textContent = 'Não achei o gabarito nesse arquivo. Use uma coluna com a questão e outra com a letra, ou uma coluna só de letras.'; return; }
  const cortadas = numQuestoes(rascunho) - g.length;
  if (cortadas > 0 && (rascunho.caderno?.questoes ?? []).slice(g.length).some(q => q.enunciado || q.comando || q.alternativas.some(Boolean)) && !(await perguntar(`O arquivo tem ${g.length} questões e a prova tem ${numQuestoes(rascunho)}. As últimas ${cortadas} questões do caderno serão apagadas. Continuar?`, 'Usar o gabarito do arquivo', 'Cancelar'))) return;
  if (g.length !== numQuestoes(rascunho)) { $('#prova-num').value = g.length; $('#prova-num').dispatchEvent(new Event('change')); }
  rascunho.versoes[editando].gabarito = g;
  renderProva();
  const faltam = g.flatMap((x, i) => (x ? [] : [i + 1]));
  msg.textContent = `Gabarito de ${g.length} questões trazido de "${f.name}".` + (faltam.length ? ` Falta a letra da questão ${faltam.join(', ')}.` : '') + ' Confira e salve a prova.';
});
$('#baixar-gabarito').addEventListener('click', () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(gabaritoEmLinhas(rascunho)), 'Gabarito');
  XLSX.writeFile(wb, `Gabarito - ${(rascunho.nome.trim() || 'prova').replace(/[\\/:*?"<>|]/g, '')}.csv`, { bookType: 'csv', FS: ';' });
});
$('#parcial-ativar').addEventListener('change', e => {
  parcialAberto = e.target.checked;
  if (!parcialAberto) rascunho.versoes.forEach(v => delete v.parciais);
  renderProva();
});
$('#gabarito').addEventListener('input', e => {
  const i = e.target.dataset.parcial;
  if (i === undefined) return;
  const v = rascunho.versoes[editando], f = Math.min(100, Math.max(0, Number(e.target.value) || 0)) / 100;
  v.parciais ??= v.gabarito.map(() => ({}));
  v.parciais[+i] = { ...v.parciais[+i], [e.target.dataset.alt]: f };
  if (!f) delete v.parciais[+i][e.target.dataset.alt];
});
$('#prova-num').addEventListener('change', e => {
  const n = Math.max(1, Math.min(90, parseInt(e.target.value, 10) || 1));
  if (n === numQuestoes(rascunho)) return; // evita redesenhar a lista no meio de um toque
  rascunho.versoes = rascunho.versoes.map(v => ({
    gabarito: Array.from({ length: n }, (_, i) => v.gabarito[i] ?? ''), anuladas: v.anuladas.filter(i => i < n),
    ...(v.parciais ? { parciais: Array.from({ length: n }, (_, i) => v.parciais[i] ?? {}) } : {}) }));
  if (rascunho.pesos) rascunho.pesos = Array.from({ length: n }, (_, i) => rascunho.pesos[i] ?? 1);
  renderProva();
});
$('#prova-pesquisa').addEventListener('change', e => {
  if (e.target.checked) rascunho.pesquisa = true; else delete rascunho.pesquisa;
  renderProva();
});
$('#prova-alternativas').addEventListener('change', e => {
  rascunho.alternativas = e.target.value;
  rascunho.versoes = rascunho.versoes.map(v => ({ ...v, gabarito: v.gabarito.map(g => (e.target.value.includes(g) ? g : '')) }));
  renderProva();
});
$('#prova-versoes').addEventListener('change', e => {
  const k = +e.target.value, n = numQuestoes(rascunho);
  rascunho.versoes = Array.from({ length: k }, (_, i) => rascunho.versoes[i] ?? { gabarito: Array(n).fill(''), anuladas: [] });
  renderProva();
});
$('#versoes-gabarito').addEventListener('click', e => {
  const b = e.target.closest('button[data-versao]');
  if (!b) return;
  editando = 'ABCD'.indexOf(b.dataset.versao);
  renderProva();
});
$('#gabarito').addEventListener('click', e => {
  const b = e.target.closest('button[data-q]');
  if (!b) return;
  const v = rascunho.versoes[editando], i = +b.dataset.q;
  v.gabarito[i] = b.dataset.alt;
  if (v.parciais?.[i]) delete v.parciais[i][b.dataset.alt]; // a certa vale 100%
  b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
  const linha = document.querySelector(`#gabarito [data-pq="${i}"]`);
  if (linha) linha.innerHTML = linhaParcial(i, b.dataset.alt, v.parciais?.[i]);
});
$('#gabarito').addEventListener('change', e => {
  const q = +e.target.dataset.anular;
  const v = rascunho.versoes[editando];
  v.anuladas = e.target.checked ? [...v.anuladas, q] : v.anuladas.filter(i => i !== q);
});
$('#salvar-prova').addEventListener('click', () => {
  const msg = $('#prova-msg');
  const valor = Number(String(rascunho.valor).replace(',', '.'));
  if (!rascunho.nome.trim()) { msg.textContent = 'Dê um nome à prova antes de salvar.'; return; }
  if (!(valor > 0)) { msg.textContent = 'O valor da prova precisa ser maior que zero.'; return; }
  for (const [k, v] of rascunho.versoes.entries()) {
    if (rascunho.pesquisa || (k > 0 && embaralhando(rascunho))) break; // pesquisa não tem gabarito; as outras versões saem da A
    const faltam = v.gabarito.flatMap((g, i) => (!g && !v.anuladas.includes(i) ? [i + 1] : []));
    const daVersao = rascunho.versoes.length > 1 ? ` da versão ${'ABCD'[k]}` : '';
    if (faltam.length) { msg.textContent = `Falta o gabarito${daVersao} da questão ${faltam.join(', ')}. Marque a alternativa certa ou anule a questão.`; return; }
  }
  const conceitos = lerConceitos($('#prova-conceitos').value);
  if (!conceitos) { msg.textContent = 'Em Conceitos, escreva o conceito e a nota mínima em cada linha, por exemplo "A 9".'; return; }
  const areas = (rascunho.areas ?? []).map(a => ({ ...a, nome: a.nome.trim() }));
  const problema = validarAreas(areas, numQuestoes(rascunho));
  if (problema) { msg.textContent = problema; return; }
  try {
    persistir(definirProva(estado, { ...(rascunho.pesquisa ? { pesquisa: true } : {}), codigo: estado.prova?.codigo ?? novoCodigo(), ...(temCaderno(rascunho) ? { caderno: structuredClone(rascunho.caderno) } : {}), ...(areas.length ? { areas } : {}), ...(conceitos.length ? { conceitos } : {}), nome: rascunho.nome.trim(), valor, ...((rascunho.alternativas ?? 'ABCDE') !== 'ABCDE' ? { alternativas: rascunho.alternativas } : {}), ...(rascunho.pesos?.some(p => p !== 1) ? { pesos: [...rascunho.pesos] } : {}),
      versoes: rascunho.versoes.map(v => ({ gabarito: v.gabarito.map(g => (rascunho.pesquisa ? '' : g || letras(rascunho)[0])), anuladas: [...v.anuladas],
        ...(temParciais(v) ? { parciais: v.parciais.map((o, i) => Object.fromEntries(Object.entries(o ?? {}).filter(([a, f]) => f > 0 && a !== v.gabarito[i]))) } : {}) })) }));
    renderProva();
    msg.textContent = 'Prova salva. Agora imprima a folha na aba Folha.';
  } catch (err) { msg.textContent = err.message; }
});

// Código da prova impresso na folha: único entre as provas deste aparelho.
function novoCodigo() {
  const usados = new Set(Object.values(arquivo.provas).map(e => e.prova?.codigo));
  let c;
  do c = 1 + Math.floor(Math.random() * 4095); while (usados.has(c));
  return c;
}
const idDoCodigo = codigo => Object.keys(arquivo.provas).find(id => arquivo.provas[id].prova?.codigo === codigo);

// ---------- folha ----------
function renderFolha() {
  const p = estado.prova;
  $('#folha-vazia').hidden = !!p; $('#folha-pronta').hidden = !p;
  if (!p) return;
  const cabeDuas = numQuestoes(p) <= 30, duas = cabeDuas && $('#duas-por-pagina').checked;
  $('#opcao-duas').hidden = !cabeDuas;
  if (!p.codigo) persistir({ ...estado, prova: { ...p, codigo: novoCodigo() } }); // provas salvas antes do código
  const prova = estado.prova, emb = ehEmbaralhada(prova), layout = layoutDa(prova);
  const folhaDe = k => folhaSVG(layout, prova.nome, codificar(prova.codigo, emb ? 'ABCD'[k] : null))
    .replace('<svg ', emb ? `<svg data-versao="${'ABCD'[k]}" ` : '<svg ');
  const folhas = emb ? prova.versoes.map((_, k) => folhaDe(k)) : [folhaDe(0)];
  $('#folha').innerHTML = folhas.map(f => (duas ? f + f : f)).join('');
  $('#folha').classList.toggle('duas', duas);
  const comCaderno = temCaderno(prova);
  $('#imprimir-caderno').hidden = !comCaderno;
  // Para imprimir: o caderno de cada versão seguido da sua folha.
  const quadro = comCaderno && cabeNoQuadro(prova);
  const quadroDe = k => {
    const l = quadroDa(prova), v = emb ? 'ABCD'[k] : null;
    return `<div class="quadro-gabarito">${quadroSVG(l, qrSVG(textoQR(prova.codigo, v), l.qr.x, l.qr.y, l.qr.lado), `${prova.codigo}${v ? `.${v}` : ''}`)}</div>`;
  };
  $('#imprimir-caderno').textContent = quadro ? 'Imprimir prova' : 'Imprimir caderno e folha';
  $('#aviso-quadro').hidden = !comCaderno || numQuestoes(prova) <= MAX_QUADRO;
  // Para imprimir: cada versão com o quadro do gabarito na página 1, ou seguida da folha quando não cabe.
  $('#caderno').innerHTML = !comCaderno ? '' : (emb ? prova.versoes : [0]).map((_, k) =>
    cadernoHTML(comImagens(cadernoDaVersao(prova, k)), emb ? `Versão ${'ABCD'[k]}` : '', quadro ? quadroDe(k) : '') +
    (quadro ? '' : `<div class="folha-impressa">${folhas[k]}</div>`)).join('') +
    `<style>${estiloDePagina(prova)}</style>`;
  $('#pagina').textContent = `@page { size: A4 ${duas ? 'landscape' : 'portrait'}; margin: 0; }`;
}
$('#duas-por-pagina').addEventListener('change', renderFolha);
$('#imprimir').addEventListener('click', () => { document.body.classList.remove('com-caderno'); window.print(); });
$('#imprimir-caderno').addEventListener('click', () => { document.body.classList.add('com-caderno'); window.print(); });

// ---------- corrigir ----------
function renderCorrigir() {
  $('#corrigir-vazio').hidden = !!estado.prova; $('#corrigir-pronto').hidden = !estado.prova;
  if (estado.prova) $('#corrigindo').textContent = `Corrigindo: ${estado.prova.nome}`;
  try { $('#turma').value ||= localStorage.getItem('correcao-turma') ?? ''; } catch { /* sem armazenamento */ }
}
$('#turma').addEventListener('input', e => { try { localStorage.setItem('correcao-turma', e.target.value); } catch { /* ok */ } });

$('#foto').addEventListener('change', async e => {
  const imagem = e.target.files[0];
  e.target.value = '';
  if (!imagem) return;
  $('#erro-leitura').hidden = true; $('#corrigir-msg').textContent = '';
  if (!$('#turma').value.trim()) { mostrarErro('Digite a turma antes de fotografar.'); return; }
  let img;
  try { img = await createImageBitmap(imagem); } catch { mostrarErro('Não consegui abrir essa foto. Tente fotografar de novo.'); return; }
  await lerImagem(img, img.width, img.height);
});

function abrirConferencia(versao) {
  $('#canvas').hidden = !leitura.foto; $('#legenda-foto').hidden = !leitura.foto;
  $('#versao-campo').hidden = estado.prova.versoes.length < 2;
  $('#versao').innerHTML = '<option value="">Confira</option>' +
    estado.prova.versoes.map((_, k) => `<option value="${'ABCD'[k]}">Versão ${'ABCD'[k]}</option>`).join('');
  $('#versao').value = versao;
  renderConferencia();
  $('#conferencia').hidden = false;
  $('#conferencia').scrollIntoView();
}

// Várias fotos da galeria: uma conferência de cada vez; a próxima abre depois de salvar ou descartar.
let fila = [], semLeitura = [];
$('#fotos').addEventListener('change', e => {
  fila = [...e.target.files]; semLeitura = [];
  e.target.value = '';
  $('#erro-leitura').hidden = true; $('#corrigir-msg').textContent = '';
  if (!$('#turma').value.trim()) { fila = []; mostrarErro('Digite a turma antes de escolher as fotos.'); return; }
  proximaDaFila();
});
async function proximaDaFila() {
  while (fila.length) {
    const f = fila.shift();
    $('#fila-status').textContent = `Foto "${f.name}"${fila.length ? ` · faltam ${fila.length}` : ''}`;
    leitura = null; // uma leitura que falha não pode parecer a anterior
    try { const img = await createImageBitmap(f); await lerImagem(img, img.width, img.height); } catch { leitura = null; }
    if (leitura) return; // espera o professor salvar ou descartar
    semLeitura.push(f.name); $('#erro-leitura').hidden = true;
  }
  $('#fila-status').textContent = '';
  if (semLeitura.length) { mostrarErro(`Não consegui ler: ${semLeitura.join(', ')}. Fotografe essas folhas de novo.`); semLeitura = []; }
}

// Sem foto: o professor digita as respostas do aluno.
$('#digitar').addEventListener('click', async () => {
  if (leitura && !$('#conferencia').hidden && !(await perguntar('Há uma correção aberta que não foi salva. Descartar e digitar outra?', 'Descartar', 'Voltar'))) return;
  $('#erro-leitura').hidden = true; $('#corrigir-msg').textContent = ''; $('#aviso-codigo').hidden = true;
  if (!$('#turma').value.trim()) { mostrarErro('Digite a turma antes de digitar as respostas.'); return; }
  const n = numQuestoes(estado.prova);
  leitura = { layout: null, foto: null, H: null, original: Array(n).fill(''), valores: Array(n).fill('') };
  $('#numero').value = '';
  abrirConferencia(estado.prova.versoes.length === 1 ? 'A' : '');
});

// Tenta o quadro do gabarito (página 1 da prova) e depois a folha avulsa. No quadro, a prova vem do QR.
async function ler(cinza, foto, prova) {
  const quadro = quadroDa(prova), noQuadro = lerFolha(cinza, quadro);
  if (!noQuadro) { const folha = layoutDa(prova); return [folha, lerFolha(cinza, folha)]; }
  noQuadro.codigo = await lerQR(recorteQR(foto, quadro, noQuadro.marcadoresPx));
  return [quadro, noQuadro];
}
// Só a região do QR (com folga), para o leitor achar rápido.
function recorteQR(foto, layout, marcadoresPx) {
  const H = homografia(layout.marcadores, marcadoresPx), { x, y, lado } = layout.qr, folga = 4;
  const ps = [[x - folga, y - folga], [x + lado + folga, y - folga], [x + lado + folga, y + lado + folga], [x - folga, y + lado + folga]].map(([a, b]) => aplicar(H, a, b));
  const x0 = Math.max(0, Math.floor(Math.min(...ps.map(p => p.x)))), y0 = Math.max(0, Math.floor(Math.min(...ps.map(p => p.y))));
  const x1 = Math.min(foto.width, Math.ceil(Math.max(...ps.map(p => p.x)))), y1 = Math.min(foto.height, Math.ceil(Math.max(...ps.map(p => p.y))));
  const w = x1 - x0, h = y1 - y0;
  if (w < 1 || h < 1) return null;
  const out = new ImageData(w, h);
  for (let r = 0; r < h; r++) out.data.set(foto.data.subarray(4 * ((y0 + r) * foto.width + x0), 4 * ((y0 + r) * foto.width + x1)), 4 * r * w);
  return out;
}

// Lê uma foto ou um quadro da câmera (qualquer coisa que o canvas desenhe) e abre a conferência.
async function lerImagem(img, largura, altura) {
  $('#lendo').hidden = false;
  try {
    const escala = Math.min(1, 2000 / Math.max(largura, altura)); // fotos de 12 MP ficam leves
    const cv = $('#canvas');
    cv.width = Math.round(largura * escala); cv.height = Math.round(altura * escala);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const foto = ctx.getImageData(0, 0, cv.width, cv.height);
    const cinza = paraCinza(foto);
    let [layout, l] = await ler(cinza, foto, estado.prova);
    if (!l) { mostrarErro('Não encontrei os 4 quadrados pretos da folha. ' + (reflexo(cinza) ? 'Há reflexo de luz na foto: incline um pouco o celular' : 'Enquadre a folha inteira, com boa luz,') + ' e fotografe de novo.'); return; }
    // O código fica no mesmo lugar em todas as folhas: lido com qualquer layout, decide a prova.
    const daFolha = l.codigo && idDoCodigo(l.codigo.prova);
    let aviso = l.codigo && !daFolha ? 'Esta folha é de uma prova que não está neste aparelho. Confira se está corrigindo a prova certa.' : '';
    if (daFolha && daFolha !== arquivo.ativa) {
      const nome = arquivo.provas[daFolha].prova.nome;
      if (await perguntar(`Esta folha é da prova "${nome}". Corrigir nela?`, `Corrigir em "${nome}"`, `Manter "${estado.prova.nome}"`)) {
        gravar(escolher(arquivo, daFolha)); rascunho = structuredClone(estado.prova); renderCorrigir();
        [layout, l] = await ler(cinza, foto, estado.prova);
      } else aviso = `Esta folha é da prova "${nome}", mas você escolheu corrigir em "${estado.prova.nome}".`;
    }
    if (layout.tipo === 'quadro' && !cabeNoQuadro(estado.prova)) { mostrarErro(`Este quadro do gabarito não é da prova "${estado.prova.nome}". Escolha a prova certa e fotografe de novo.`); return; }
    $('#aviso-codigo').textContent = aviso; $('#aviso-codigo').hidden = !aviso;
    leitura = {
      layout, foto, H: homografia(layout.marcadores, l.marcadoresPx),
      original: l.respostas.map(r => r.marca),
      valores: l.respostas.map(r => (r.duvidosa ? '' : r.marca)),
    };
    $('#numero').value = l.numero && !l.numeroDuvidoso ? l.numero : '';
    // Prova embaralhada sem código legível: a folha não tem bolinhas de versão, o professor escolhe.
    abrirConferencia(l.codigo?.versao ?? (ehEmbaralhada(estado.prova) ? '' : l.versao && !l.versaoDuvidosa ? l.versao : ''));
  } catch {
    mostrarErro('Não consegui abrir essa foto. Tente fotografar de novo.');
  } finally { $('#lendo').hidden = true; }
}

// ---------- câmera ao vivo ----------
let camera = null; // { stream, timer, historico } enquanto a câmera está aberta
let modoCamera = false; // depois de salvar, volta para a câmera
async function abrirCamera() {
  $('#erro-leitura').hidden = true; $('#corrigir-msg').textContent = '';
  if (!$('#turma').value.trim()) { mostrarErro('Digite a turma antes de abrir a câmera.'); return; }
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
  } catch {
    mostrarErro('Não consegui abrir a câmera. Permita o uso da câmera no navegador, ou use "Fotografar folha".'); return;
  }
  modoCamera = true;
  const video = $('#video');
  video.srcObject = stream; await video.play().catch(() => {});
  $('#camera').hidden = false; $('#conferencia').hidden = true;
  $('#camera-status').textContent = 'Procurando os 4 quadrados pretos…';
  const pequeno = document.createElement('canvas'), cx = pequeno.getContext('2d', { willReadFrequently: true });
  camera = { stream, historico: [] };
  camera.timer = setInterval(() => {
    if (!video.videoWidth) return;
    const f = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
    pequeno.width = Math.round(video.videoWidth * f); pequeno.height = Math.round(video.videoHeight * f);
    cx.drawImage(video, 0, 0, pequeno.width, pequeno.height);
    const c = paraCinza(cx.getImageData(0, 0, pequeno.width, pequeno.height));
    let m = null;
    for (const r of RAZOES) if ((m = acharMarcadores(c, r))) break;
    camera.historico = [...camera.historico.slice(-2), m];
    $('#camera-status').textContent = m ? 'Achei a folha. Segure parado…'
      : poucaLuz(c) ? 'Pouca luz: acenda a luz da sala ou chegue perto de uma janela.'
      : reflexo(c) ? 'Reflexo de luz na folha: incline um pouco o celular ou mude a folha de lugar.' : 'Procurando os 4 quadrados pretos…';
    if (quadroPronto(camera.historico, pequeno.width)) capturar(video);
  }, 250);
}
function fecharCamera() {
  if (!camera) return;
  clearInterval(camera.timer);
  camera.stream.getTracks().forEach(t => t.stop());
  $('#video').srcObject = null; $('#camera').hidden = true;
  camera = null;
}
function avisarCaptura() {
  try { navigator.vibrate?.(150); } catch { /* sem vibração */ }
  try {
    const a = new AudioContext(), o = a.createOscillator();
    o.frequency.value = 880; o.connect(a.destination); o.start(); o.stop(a.currentTime + 0.15);
  } catch { /* sem som */ }
}
async function capturar(video) {
  const w = video.videoWidth, h = video.videoHeight;
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  cv.getContext('2d').drawImage(video, 0, 0, w, h);
  fecharCamera(); avisarCaptura();
  await lerImagem(cv, w, h);
  if (!leitura && modoCamera) abrirCamera(); // leitura falhou: a mensagem fica e a câmera volta
}
$('#abrir-camera').addEventListener('click', abrirCamera);
$('#fechar-camera').addEventListener('click', () => { modoCamera = false; fecharCamera(); });

function mostrarErro(msg) {
  $('#erro-leitura').textContent = msg; $('#erro-leitura').hidden = false;
  $('#conferencia').hidden = true; leitura = null;
}

const versaoAtual = () => versaoDe(estado.prova, $('#versao').value || 'A');
function situacao(i) {
  const v = leitura.valores[i], p = versaoAtual();
  if (v === '') return 'confira';
  if (estado.prova.pesquisa) return v === 'branco' || v === 'dupla' ? 'confira' : 'certa'; // sem gabarito: verde é só "lido"
  if (p.anuladas.includes(i) || v === p.gabarito[i]) return 'certa';
  return v === 'branco' || v === 'dupla' ? 'confira' : 'errada';
}

function renderConferencia() {
  $('#respostas').innerHTML = leitura.valores.map((v, i) => `
    <label class="${situacao(i)}">Q${i + 1}
      <select data-q="${i}" aria-label="Resposta da questão ${i + 1}">
        ${v === '' ? '<option value="" selected>Confira</option>' : ''}
        ${[...letras(estado.prova), 'branco', 'dupla'].map(o => `<option value="${o}" ${o === v ? 'selected' : ''}>${ROTULO[o] ?? o}</option>`).join('')}
      </select></label>`).join('');
  atualizarConferencia();
}

function atualizarConferencia() {
  const v = leitura.valores;
  const c = notaDe(estado.prova, { versao: $('#versao').value || 'A', respostas: v.map(x => x || 'branco') });
  $('#placar').textContent = estado.prova.pesquisa ? `Pesquisa: ${v.filter(x => x && x !== 'branco').length} de ${v.length} questões respondidas`
    : `${c.acertos} de ${c.total} acertos · nota ${nota1(c.nota)}`;
  const faltam = v.flatMap((x, i) => (x === '' ? [i + 1] : []));
  const numeroOk = /^\d{1,2}$/.test($('#numero').value.trim()), versaoOk = $('#versao').value !== '';
  const com = m => v.flatMap((x, i) => (x === m ? [i + 1] : []));
  const duplas = com('dupla'), brancos = com('branco');
  $('#pendencias').textContent = [
    versaoOk ? '' : 'Escolha a versão da prova: ela não está clara na folha.',
    duplas.length ? `Dupla marcação (ou rasura) na questão ${duplas.join(', ')}: veja na foto se o aluno apagou uma delas.` : '',
    brancos.length ? `Em branco: questão ${brancos.join(', ')}.` : '',
    faltam.length ? `Confira a leitura da questão ${faltam.join(', ')}: a marcação não está clara.` : '',
    numeroOk ? '' : 'Digite o número de chamada do aluno.',
  ].filter(Boolean).join(' ');
  $('#salvar-leitura').disabled = faltam.length > 0 || !numeroOk || !versaoOk;
  document.querySelectorAll('#respostas label').forEach((l, i) => { l.className = situacao(i); });
  desenhar();
}

function desenhar() {
  if (!leitura.foto) return; // respostas digitadas
  const cv = $('#canvas'), ctx = cv.getContext('2d'), { layout, H } = leitura;
  ctx.putImageData(leitura.foto, 0, 0);
  const cor = { certa: '#15803d', errada: '#b91c1c', confira: '#ca8a04' };
  const a = aplicar(H, 10, 10), b = aplicar(H, 10 + layout.raio, 10);
  const raioPx = Math.hypot(b.x - a.x, b.y - a.y);
  ctx.lineWidth = Math.max(2, raioPx / 3);
  layout.questoes.forEach((q, i) => {
    const j = letras(estado.prova).indexOf(leitura.valores[i]);
    const alvo = q[j >= 0 ? j : letras(estado.prova).indexOf(versaoAtual().gabarito[i])];
    if (!alvo) return; // pesquisa: em branco não tem bolinha certa para circular
    const p = aplicar(H, alvo.x, alvo.y);
    ctx.strokeStyle = cor[situacao(i)];
    ctx.beginPath(); ctx.arc(p.x, p.y, raioPx * 1.6, 0, 2 * Math.PI); ctx.stroke();
  });
}

$('#respostas').addEventListener('change', e => {
  const q = +e.target.dataset.q;
  leitura.valores[q] = e.target.value;
  e.target.querySelector('option[value=""]')?.remove();
  e.target.closest('label').className = situacao(q);
  atualizarConferencia();
});
$('#numero').addEventListener('input', atualizarConferencia);
$('#versao').addEventListener('change', atualizarConferencia);
$('#descartar').addEventListener('click', () => { $('#conferencia').hidden = true; leitura = null; if (modoCamera) abrirCamera(); else proximaDaFila(); });
$('#salvar-leitura').addEventListener('click', async () => {
  const turma = $('#turma').value.trim().toUpperCase(), numero = $('#numero').value.trim().padStart(2, '0');
  if (estado.correcoes[chave(turma, numero)] &&
      !(await perguntar(`O nº ${numero} da turma ${turma} já foi corrigido. Trocar pela correção nova?`, 'Trocar pela nova', 'Manter a anterior'))) return;
  persistir(registrar(estado, { turma, numero, versao: $('#versao').value, respostas: [...leitura.valores], editado: leitura.valores.some((v, i) => v !== leitura.original[i]) }));
  $('#conferencia').hidden = true; leitura = null;
  $('#corrigir-msg').textContent = `Correção do nº ${numero} (${turma}) salva. ${modoCamera ? 'Aponte para a próxima folha.' : fila.length ? '' : 'Fotografe a próxima folha.'}`;
  if (modoCamera) abrirCamera(); else proximaDaFila();
});

// ---------- resultados ----------
function renderResultados() {
  const p = estado.prova, turmas = porTurma(estado);
  const vazio = Object.keys(turmas).length === 0;
  $('#resultados-vazio').hidden = !vazio; $('#baixar').hidden = vazio;
  const comConceito = !!p?.conceitos?.length, valor = p?.valor ?? 10;
  $('#resultados').innerHTML = Object.entries(turmas).map(([t, cs]) => {
    if (p.pesquisa) return `
    <table><caption>Turma ${t} · ${cs.length} aluno(s)</caption>
      <thead><tr><th>Nº</th><th>Nome</th><th>Respondidas</th><th><span class="oculto">Ações</span></th></tr></thead>
      <tbody>${cs.map(c => `<tr><td>${c.numero}</td><td>${esc(nomeDo(estado, t, c.numero))}</td>
        <td>${c.respostas.filter(r => r !== 'branco').length}/${c.respostas.length}</td>
        <td><button data-apagar="${chave(t, c.numero)}" aria-label="Apagar correção do nº ${c.numero}, turma ${t}">Apagar</button></td></tr>`).join('')}</tbody></table>`;
    const rs = cs.map(c => notaDe(p, c)), fr = rs.map(r => r.pontos / r.possiveis), pos = posicoes(fr), perc = percentis(fr);
    return `
    <table><caption>Turma ${t} · ${cs.length} aluno(s)</caption>
      <thead><tr><th>Nº</th><th>Nome</th><th>Acertos</th><th>Nota</th><th>Posição</th>${comConceito ? '<th>Conceito</th>' : ''}<th><span class="oculto">Ações</span></th></tr></thead>
      <tbody>${cs.map((c, j) => {
        const r = rs[j], k = chave(t, c.numero), noValor = Math.round((r.pontos / r.possiveis) * valor * 10) / 10;
        return `<tr><td>${c.numero}${p.versoes.length > 1 ? ` (${c.versao})` : ''}${c.editado ? ' <span title="Leitura alterada por você" aria-label="leitura alterada por você">✎</span>' : ''}</td>
          <td>${esc(nomeDo(estado, t, c.numero))}</td><td>${r.acertos}/${r.total}</td><td>${nota1(r.nota)}</td><td>${pos[j]}º <small>(percentil ${perc[j]})</small></td>
          ${comConceito ? `<td>${esc(conceitoDe(p.conceitos, noValor))}</td>` : ''}
          <td><button data-apagar="${k}" aria-label="Apagar correção do nº ${c.numero}, turma ${t}">Apagar</button></td></tr>`;
      }).join('')}</tbody></table>`;
  }).join('');
  $('#analise-tela').hidden = vazio;
  if (!vazio) renderAnalise(analiseDaProva(estado), letras(p), !!p.pesquisa);
}

// Notas em 10 faixas (0–1 … 9–10) e, por questão, % de acerto e % de cada alternativa.
// A cor de fundo vai do vermelho (pouco acerto) ao verde; a alternativa certa fica em negrito.
function renderAnalise({ questoes, alunos, notas }, L, pesquisa) {
  $('#analise-notas').hidden = pesquisa;
  const faixas = Array(10).fill(0);
  for (const n of notas) faixas[Math.min(9, Math.floor(n))]++;
  const maior = Math.max(1, ...faixas), media = notas.reduce((a, b) => a + b, 0) / notas.length;
  $('#analise-notas').innerHTML = `<h3>Distribuição das notas</h3>
    <p class="dica">${notas.length} aluno(s) · média ${nota1(media)}</p>
    <div class="histograma" role="img" aria-label="Alunos por faixa de nota: ${faixas.map((f, i) => `${i} a ${i + 1}: ${f}`).join('; ')}">
      ${faixas.map((f, i) => `<div><span style="height:${(f / maior) * 100}%"></span><b>${f || ''}</b><small>${i}–${i + 1}</small></div>`).join('')}
    </div>`;
  const cor = p => `hsl(${Math.round(p * 1.2)} 70% 88%)`;
  $('#analise-questoes').innerHTML = `<h3>Questões</h3>
    <p class="dica">% dos ${alunos} aluno(s) da versão A.${pesquisa ? '' : ' A alternativa certa está em negrito.'}</p>
    <div class="rolagem"><table class="analise">
      <thead><tr><th>Q</th>${pesquisa ? '' : '<th>Acerto</th>'}${L.map(a => `<th>${a}</th>`).join('')}<th>Branco</th><th>Dupla</th></tr></thead>
      <tbody>${questoes.map((q, i) => `<tr><td>${i + 1}</td>${pesquisa ? '' : `<td style="background:${cor(q.acerto)}">${q.acerto}%</td>`}
        ${L.map(a => `<td${a === q.gabarito ? ' class="certa-analise"' : ''}>${q.alternativas[a]}%</td>`).join('')}
        <td>${q.branco}%</td><td>${q.dupla}%</td></tr>`).join('')}</tbody>
    </table></div>`;
}
$('#resultados').addEventListener('click', async e => {
  const k = e.target.dataset.apagar;
  if (!k) return;
  const c = estado.correcoes[k];
  if (await perguntar(`Apagar a correção do nº ${c.numero} (${c.turma})? Para corrigir de novo, fotografe a folha outra vez.`, 'Apagar correção', 'Manter')) {
    persistir(remover(estado, k)); renderResultados();
  }
});
$('#lista-turma').addEventListener('input', e => {
  const nomes = estado.chamadas?.[e.target.value.trim().toUpperCase()];
  $('#lista-nomes').value = nomes ? Object.entries(nomes).map(([n, nome]) => `${n} ${nome}`).join('\n') : '';
});
// Linhas da primeira aba de uma planilha ou CSV escolhido pelo professor.
async function linhasDoArquivo(f) {
  const wb = /\.csv$/i.test(f.name) ? XLSX.read(await f.text(), { type: 'string' }) : XLSX.read(await f.arrayBuffer(), { type: 'array' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
}
$('#lista-arquivo').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  let texto = '';
  try { texto = listaDeLinhas(await linhasDoArquivo(f)); } catch { /* cai na mensagem abaixo */ }
  if (!texto) { $('#lista-msg').textContent = 'Não achei nomes nesse arquivo. Use uma planilha com os nomes numa coluna.'; return; }
  $('#lista-nomes').value = texto;
  $('#lista-msg').textContent = `${texto.split('\n').length} nomes trazidos de "${f.name}". Confira, digite a turma e toque em Salvar lista.`;
});
$('#salvar-lista').addEventListener('click', () => {
  const turma = $('#lista-turma').value.trim();
  if (!turma) { $('#lista-msg').textContent = 'Digite a turma da lista.'; return; }
  persistir(definirLista(estado, turma, $('#lista-nomes').value));
  $('#lista-msg').textContent = `Lista da turma ${turma.toUpperCase()} salva.`;
  renderResultados();
});
$('#baixar').addEventListener('click', () => {
  XLSX.writeFile(montarPlanilha(XLSX, { ...estado, prova: comImagens(estado.prova) }), nomeArquivo(estado.prova));
  persistir(marcarExportado(estado));
});

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => { /* segue funcionando online */ });

gravar(arquivo);
mostrar(estado.prova ? 'corrigir' : 'prova');
