// Liga as telas aos módulos. A lógica fica em src/.
import { montarLayout } from './src/layout.js';
import { folhaSVG } from './src/folha.js';
import { carregar, salvar, definirProva, arquivoInicial, ativo, comAtivo, escolher, novaProva, apagarProva, listar,
  acharPorNome, validarAreas, registrar, chave, remover, marcarExportado, definirLista, nomeDo, versaoDe } from './src/estado.js';
import { montarPlanilha, nomeArquivo, porTurma, notaDe, lerPlanilha } from './src/planilha.js';
import { paraCinza, lerFolha, homografia, aplicar, acharMarcadores, quadroPronto } from './src/leitor.js';
import { corrigir } from './src/nota.js';
import { codificar } from './src/codigo.js';
import { cadernoHTML } from './src/caderno.js';
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
const layoutDa = p => montarLayout(numQuestoes(p), p.versoes.length, p.alternativas);

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
  $('#prova-versoes').value = rascunho.versoes.length;
  if (editando >= rascunho.versoes.length) editando = 0;
  $('#versoes-gabarito').hidden = rascunho.versoes.length < 2;
  $('#versoes-gabarito').innerHTML = rascunho.versoes.map((_, k) =>
    `<button data-versao="${'ABCD'[k]}" aria-pressed="${k === editando}">Versão ${'ABCD'[k]}</button>`).join('');
  const { gabarito, anuladas } = rascunho.versoes[editando];
  $('#prova-valor').value = rascunho.valor;
  $('#pesos-resumo').textContent = resumoPesos(rascunho.pesos ?? []);
  renderCadernoEditor();
  $('#areas').innerHTML = (rascunho.areas ?? []).map((a, k) => `
    <div class="pesos" data-area="${k}">
      <label>Área <input name="nome" value="${esc(a.nome)}" autocomplete="off"></label>
      <label>da questão <input name="de" type="number" inputmode="numeric" min="1" value="${a.de ?? ''}"></label>
      <label>até a <input name="ate" type="number" inputmode="numeric" min="1" value="${a.ate ?? ''}"></label>
      <button data-remover-area="${k}" aria-label="Remover a área ${esc(a.nome)}">Remover</button>
    </div>`).join('');
  $('#gabarito').innerHTML = gabarito.map((g, i) => `
    <div class="linha" role="group" aria-label="Questão ${i + 1}">
      <span class="num">${i + 1}</span>
      ${letras(rascunho).map(a => `<button data-q="${i}" data-alt="${a}" aria-pressed="${g === a}" aria-label="Questão ${i + 1}, alternativa ${a}">${a}</button>`).join('')}
      <label><input type="checkbox" data-anular="${i}" ${anuladas.includes(i) ? 'checked' : ''}> Anular</label>
    </div>`).join('');
}
// O caderno tem uma questão por questão da prova; o gabarito da versão A é a alternativa certa.
const questaoVazia = () => ({ enunciado: '', alternativas: [] });
function ajustarCaderno() {
  const n = numQuestoes(rascunho), qs = rascunho.caderno?.questoes ?? [];
  rascunho.caderno = { ...rascunho.caderno, questoes: Array.from({ length: n }, (_, i) => qs[i] ?? questaoVazia()) };
}
function renderCadernoEditor() {
  ajustarCaderno();
  const g = rascunho.versoes[0].gabarito;
  $('#caderno-questoes').innerHTML = rascunho.caderno.questoes.map((q, i) => `
    <div class="cq" data-cq="${i}">
      <label>Questão ${i + 1}<textarea rows="3" data-campo="enunciado">${esc(q.enunciado)}</textarea></label>
      ${q.imagem ? `<img class="miniatura" src="${esc(resolver(imagens, q.imagem))}" alt="Imagem da questão ${i + 1}"><button data-tirar-imagem>Remover imagem</button>`
        : `<label class="botao">Adicionar imagem<input type="file" accept="image/*" class="oculto" aria-label="Imagem da questão ${i + 1}"></label>`}
      ${letras(rascunho).map((a, j) => `<div class="alt">
        <input type="radio" name="certa-${i}" value="${a}" ${g[i] === a ? 'checked' : ''} aria-label="Questão ${i + 1}: ${a} é a certa">
        <b>${a})</b><input type="text" data-texto="${a}" value="${esc(q.alternativas[j] ?? '')}" aria-label="Questão ${i + 1}, texto da alternativa ${a}">
      </div>`).join('')}
    </div>`).join('');
}
$('#caderno-questoes').addEventListener('input', e => {
  const i = +e.target.closest('[data-cq]').dataset.cq, q = rascunho.caderno.questoes[i];
  if (e.target.dataset.campo === 'enunciado') q.enunciado = e.target.value;
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
$('#prova-ativa').addEventListener('change', e => {
  if (!e.target.value) return;
  gravar(escolher(arquivo, e.target.value));
  rascunho = structuredClone(estado.prova); $('#prova-msg').textContent = '';
  renderProva();
});
$('#nova-prova').addEventListener('click', () => {
  gravar(novaProva(arquivo));
  rascunho = provaEmBranco(); $('#prova-msg').textContent = '';
  renderProva();
});
$('#apagar-prova').addEventListener('click', async () => {
  if (arquivo.ativa) {
    const nome = estado.prova.nome;
    const ok = await perguntar(estado.pendente
      ? `Apagar a prova "${nome}" e todas as correções dela? Há correções que ainda não estão na planilha, e elas serão perdidas.`
      : `Apagar a prova "${nome}" e todas as correções dela?`, 'Apagar prova', 'Manter');
    if (!ok) return;
    apagarImagens(refsDe(estado.prova)).catch(() => {});
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
$('#prova-num').addEventListener('change', e => {
  const n = Math.max(1, Math.min(90, parseInt(e.target.value, 10) || 1));
  if (n === numQuestoes(rascunho)) return; // evita redesenhar a lista no meio de um toque
  rascunho.versoes = rascunho.versoes.map(v => ({
    gabarito: Array.from({ length: n }, (_, i) => v.gabarito[i] ?? ''), anuladas: v.anuladas.filter(i => i < n) }));
  if (rascunho.pesos) rascunho.pesos = Array.from({ length: n }, (_, i) => rascunho.pesos[i] ?? 1);
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
  rascunho.versoes[editando].gabarito[+b.dataset.q] = b.dataset.alt;
  b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
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
    const faltam = v.gabarito.flatMap((g, i) => (!g && !v.anuladas.includes(i) ? [i + 1] : []));
    const daVersao = rascunho.versoes.length > 1 ? ` da versão ${'ABCD'[k]}` : '';
    if (faltam.length) { msg.textContent = `Falta o gabarito${daVersao} da questão ${faltam.join(', ')}. Marque a alternativa certa ou anule a questão.`; return; }
  }
  const areas = (rascunho.areas ?? []).map(a => ({ ...a, nome: a.nome.trim() }));
  const problema = validarAreas(areas, numQuestoes(rascunho));
  if (problema) { msg.textContent = problema; return; }
  try {
    persistir(definirProva(estado, { codigo: estado.prova?.codigo ?? novoCodigo(), ...(temCaderno(rascunho) ? { caderno: structuredClone(rascunho.caderno) } : {}), ...(areas.length ? { areas } : {}), nome: rascunho.nome.trim(), valor, ...((rascunho.alternativas ?? 'ABCDE') !== 'ABCDE' ? { alternativas: rascunho.alternativas } : {}), ...(rascunho.pesos?.some(p => p !== 1) ? { pesos: [...rascunho.pesos] } : {}),
      versoes: rascunho.versoes.map(v => ({ gabarito: v.gabarito.map(g => g || letras(rascunho)[0]), anuladas: [...v.anuladas] })) }));
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
  const svg = folhaSVG(layoutDa(estado.prova), p.nome, codificar(estado.prova.codigo, null));
  $('#folha').innerHTML = duas ? svg + svg : svg;
  $('#folha').classList.toggle('duas', duas);
  const comCaderno = temCaderno(estado.prova);
  $('#imprimir-caderno').hidden = !comCaderno;
  $('#caderno').innerHTML = comCaderno ? cadernoHTML(comImagens(estado.prova)) : '';
  $('#pagina').textContent = `@page { size: A4 ${duas ? 'landscape' : 'portrait'}; margin: 0; }`;
}
$('#duas-por-pagina').addEventListener('change', renderFolha);
$('#imprimir').addEventListener('click', () => { document.body.classList.remove('com-caderno'); window.print(); });
// O caderno vem antes da folha: a ordem na tela de impressão segue a ordem no HTML.
$('#imprimir-caderno').addEventListener('click', () => {
  $('#folha').before($('#caderno'));
  document.body.classList.add('com-caderno'); window.print();
  $('#caderno').before($('#folha'));
});

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
    let layout = layoutDa(estado.prova), l = lerFolha(cinza, layout);
    if (!l) { mostrarErro('Não encontrei os 4 quadrados pretos da folha. Enquadre a folha inteira, com boa luz, e fotografe de novo.'); return; }
    // O código fica no mesmo lugar em todas as folhas: lido com qualquer layout, decide a prova.
    const daFolha = l.codigo && idDoCodigo(l.codigo.prova);
    let aviso = l.codigo && !daFolha ? 'Esta folha é de uma prova que não está neste aparelho. Confira se está corrigindo a prova certa.' : '';
    if (daFolha && daFolha !== arquivo.ativa) {
      const nome = arquivo.provas[daFolha].prova.nome;
      if (await perguntar(`Esta folha é da prova "${nome}". Corrigir nela?`, `Corrigir em "${nome}"`, `Manter "${estado.prova.nome}"`)) {
        gravar(escolher(arquivo, daFolha)); rascunho = structuredClone(estado.prova); renderCorrigir();
        layout = layoutDa(estado.prova); l = lerFolha(cinza, layout);
      } else aviso = `Esta folha é da prova "${nome}", mas você escolheu corrigir em "${estado.prova.nome}".`;
    }
    $('#aviso-codigo').textContent = aviso; $('#aviso-codigo').hidden = !aviso;
    leitura = {
      layout, foto, H: homografia(layout.marcadores, l.marcadoresPx),
      original: l.respostas.map(r => r.marca),
      valores: l.respostas.map(r => (r.duvidosa ? '' : r.marca)),
    };
    $('#numero').value = l.numero && !l.numeroDuvidoso ? l.numero : '';
    $('#versao-campo').hidden = estado.prova.versoes.length < 2;
    $('#versao').innerHTML = '<option value="">Confira</option>' +
      estado.prova.versoes.map((_, k) => `<option value="${'ABCD'[k]}">Versão ${'ABCD'[k]}</option>`).join('');
    $('#versao').value = l.codigo?.versao ?? (l.versao && !l.versaoDuvidosa ? l.versao : '');
    renderConferencia();
    $('#conferencia').hidden = false;
    $('#conferencia').scrollIntoView();
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
    const m = acharMarcadores(paraCinza(cx.getImageData(0, 0, pequeno.width, pequeno.height)));
    camera.historico = [...camera.historico.slice(-2), m];
    $('#camera-status').textContent = m ? 'Achei a folha. Segure parado…' : 'Procurando os 4 quadrados pretos…';
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
  const p = versaoAtual(), v = leitura.valores;
  const c = corrigir(p.gabarito, p.anuladas, v.map(x => x || 'branco'), estado.prova.pesos);
  $('#placar').textContent = `${c.acertos} de ${c.total} acertos · nota ${nota1(c.nota)}`;
  const faltam = v.flatMap((x, i) => (x === '' ? [i + 1] : []));
  const numeroOk = /^\d{1,2}$/.test($('#numero').value.trim()), versaoOk = $('#versao').value !== '';
  $('#pendencias').textContent = [
    versaoOk ? '' : 'Escolha a versão da prova: ela não está clara na folha.',
    faltam.length ? `Confira a leitura da questão ${faltam.join(', ')}: a marcação não está clara.` : '',
    numeroOk ? '' : 'Digite o número de chamada do aluno.',
  ].filter(Boolean).join(' ');
  $('#salvar-leitura').disabled = faltam.length > 0 || !numeroOk || !versaoOk;
  document.querySelectorAll('#respostas label').forEach((l, i) => { l.className = situacao(i); });
  desenhar();
}

function desenhar() {
  const cv = $('#canvas'), ctx = cv.getContext('2d'), { layout, H } = leitura;
  ctx.putImageData(leitura.foto, 0, 0);
  const cor = { certa: '#15803d', errada: '#b91c1c', confira: '#ca8a04' };
  const a = aplicar(H, 10, 10), b = aplicar(H, 10 + layout.raio, 10);
  const raioPx = Math.hypot(b.x - a.x, b.y - a.y);
  ctx.lineWidth = Math.max(2, raioPx / 3);
  layout.questoes.forEach((q, i) => {
    const j = letras(estado.prova).indexOf(leitura.valores[i]);
    const alvo = q[j >= 0 ? j : letras(estado.prova).indexOf(versaoAtual().gabarito[i])];
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
$('#descartar').addEventListener('click', () => { $('#conferencia').hidden = true; leitura = null; });
$('#salvar-leitura').addEventListener('click', async () => {
  const turma = $('#turma').value.trim().toUpperCase(), numero = $('#numero').value.trim().padStart(2, '0');
  if (estado.correcoes[chave(turma, numero)] &&
      !(await perguntar(`O nº ${numero} da turma ${turma} já foi corrigido. Trocar pela correção nova?`, 'Trocar pela nova', 'Manter a anterior'))) return;
  persistir(registrar(estado, { turma, numero, versao: $('#versao').value, respostas: [...leitura.valores], editado: leitura.valores.some((v, i) => v !== leitura.original[i]) }));
  $('#conferencia').hidden = true; leitura = null;
  $('#corrigir-msg').textContent = `Correção do nº ${numero} (${turma}) salva. ${modoCamera ? 'Aponte para a próxima folha.' : 'Fotografe a próxima folha.'}`;
  if (modoCamera) abrirCamera();
});

// ---------- resultados ----------
function renderResultados() {
  const p = estado.prova, turmas = porTurma(estado);
  const vazio = Object.keys(turmas).length === 0;
  $('#resultados-vazio').hidden = !vazio; $('#baixar').hidden = vazio;
  $('#resultados').innerHTML = Object.entries(turmas).map(([t, cs]) => `
    <table><caption>Turma ${t} · ${cs.length} aluno(s)</caption>
      <thead><tr><th>Nº</th><th>Nome</th><th>Acertos</th><th>Nota</th><th><span class="oculto">Ações</span></th></tr></thead>
      <tbody>${cs.map(c => {
        const r = notaDe(p, c), k = chave(t, c.numero);
        return `<tr><td>${c.numero}${p.versoes.length > 1 ? ` (${c.versao})` : ''}${c.editado ? ' <span title="Leitura alterada por você" aria-label="leitura alterada por você">✎</span>' : ''}</td>
          <td>${esc(nomeDo(estado, t, c.numero))}</td><td>${r.acertos}/${r.total}</td><td>${nota1(r.nota)}</td>
          <td><button data-apagar="${k}" aria-label="Apagar correção do nº ${c.numero}, turma ${t}">Apagar</button></td></tr>`;
      }).join('')}</tbody></table>`).join('');
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
