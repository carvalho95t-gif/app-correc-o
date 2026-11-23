// Liga as telas aos módulos. A lógica fica em src/.
import { montarLayout } from './src/layout.js';
import { folhaSVG } from './src/folha.js';
import { carregar, salvar, definirProva, estadoInicial } from './src/estado.js';

const $ = s => document.querySelector(s);
const LETRAS = [...'ABCDE'];

let armazenamento = null;
try { localStorage.setItem('teste', '1'); armazenamento = localStorage; } catch { /* navegador sem armazenamento */ }
let estado = armazenamento ? carregar(armazenamento) : estadoInicial();
let rascunho = estado.prova ? structuredClone(estado.prova) : { nome: '', gabarito: Array(10).fill(''), anuladas: [], valor: 10 };

function persistir(novo) {
  estado = novo;
  try { if (armazenamento) salvar(armazenamento, estado); }
  catch { alert('Não foi possível salvar no aparelho. Baixe a planilha agora para não perder.'); }
}

// ---------- abas ----------
const telas = ['prova', 'folha'];
const render = { prova: renderProva, folha: renderFolha };
function mostrar(tela) {
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
  $('#prova-nome').value = rascunho.nome;
  $('#prova-num').value = rascunho.gabarito.length;
  $('#prova-valor').value = rascunho.valor;
  $('#gabarito').innerHTML = rascunho.gabarito.map((g, i) => `
    <div class="linha" role="group" aria-label="Questão ${i + 1}">
      <span class="num">${i + 1}</span>
      ${LETRAS.map(a => `<button data-q="${i}" data-alt="${a}" aria-pressed="${g === a}" aria-label="Questão ${i + 1}, alternativa ${a}">${a}</button>`).join('')}
      <label><input type="checkbox" data-anular="${i}" ${rascunho.anuladas.includes(i) ? 'checked' : ''}> Anular</label>
    </div>`).join('');
}
$('#prova-nome').addEventListener('input', e => { rascunho.nome = e.target.value; });
$('#prova-valor').addEventListener('input', e => { rascunho.valor = e.target.value; });
$('#prova-num').addEventListener('change', e => {
  const n = Math.max(1, Math.min(90, parseInt(e.target.value, 10) || 1));
  rascunho.gabarito = Array.from({ length: n }, (_, i) => rascunho.gabarito[i] ?? '');
  rascunho.anuladas = rascunho.anuladas.filter(i => i < n);
  renderProva();
});
$('#gabarito').addEventListener('click', e => {
  const b = e.target.closest('button[data-q]');
  if (!b) return;
  rascunho.gabarito[+b.dataset.q] = b.dataset.alt;
  b.parentElement.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b));
});
$('#gabarito').addEventListener('change', e => {
  const q = +e.target.dataset.anular;
  rascunho.anuladas = e.target.checked ? [...rascunho.anuladas, q] : rascunho.anuladas.filter(i => i !== q);
});
$('#salvar-prova').addEventListener('click', () => {
  const msg = $('#prova-msg');
  const valor = Number(String(rascunho.valor).replace(',', '.'));
  if (!rascunho.nome.trim()) { msg.textContent = 'Dê um nome à prova antes de salvar.'; return; }
  if (!(valor > 0)) { msg.textContent = 'O valor da prova precisa ser maior que zero.'; return; }
  const faltam = rascunho.gabarito.flatMap((g, i) => (!g && !rascunho.anuladas.includes(i) ? [i + 1] : []));
  if (faltam.length) { msg.textContent = `Falta o gabarito da questão ${faltam.join(', ')}. Marque a alternativa certa ou anule a questão.`; return; }
  try {
    persistir(definirProva(estado, { nome: rascunho.nome.trim(), gabarito: rascunho.gabarito.map(g => g || 'A'), anuladas: [...rascunho.anuladas], valor }));
    msg.textContent = 'Prova salva. Agora imprima a folha na aba Folha.';
  } catch (err) { msg.textContent = err.message; }
});

// ---------- folha ----------
function renderFolha() {
  const p = estado.prova;
  $('#folha-vazia').hidden = !!p; $('#folha-pronta').hidden = !p;
  if (p) $('#folha').innerHTML = folhaSVG(montarLayout(p.gabarito.length), p.nome);
}
$('#imprimir').addEventListener('click', () => window.print());

mostrar('prova');
