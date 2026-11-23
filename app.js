// Liga as telas aos módulos. A lógica fica em src/.
import { montarLayout } from './src/layout.js';
import { folhaSVG } from './src/folha.js';
import { carregar, salvar, definirProva, estadoInicial, registrar, chave } from './src/estado.js';
import { paraCinza, lerFolha, homografia, aplicar } from './src/leitor.js';
import { corrigir } from './src/nota.js';

const $ = s => document.querySelector(s);
const LETRAS = [...'ABCDE'];
const ROTULO = { branco: 'Em branco', dupla: 'Dupla marcação' };
const nota1 = n => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
let leitura = null; // leitura em conferência

let armazenamento = null;
try { localStorage.setItem('teste', '1'); armazenamento = localStorage; } catch { /* navegador sem armazenamento */ }
let estado = armazenamento ? carregar(armazenamento) : estadoInicial();
let rascunho = estado.prova ? structuredClone(estado.prova) : { nome: '', gabarito: Array(10).fill(''), anuladas: [], valor: 10 };

function persistir(novo) {
  estado = novo;
  try { if (armazenamento) salvar(armazenamento, estado); }
  catch { alert('Não foi possível salvar no aparelho. Baixe a planilha agora para não perder.'); }
}

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
const telas = ['prova', 'folha', 'corrigir'];
const render = { prova: renderProva, folha: renderFolha, corrigir: renderCorrigir };
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

// ---------- corrigir ----------
function renderCorrigir() {
  $('#corrigir-vazio').hidden = !!estado.prova; $('#corrigir-pronto').hidden = !estado.prova;
  try { $('#turma').value ||= localStorage.getItem('correcao-turma') ?? ''; } catch { /* sem armazenamento */ }
}
$('#turma').addEventListener('input', e => { try { localStorage.setItem('correcao-turma', e.target.value); } catch { /* ok */ } });

$('#foto').addEventListener('change', async e => {
  const arquivo = e.target.files[0];
  e.target.value = '';
  if (!arquivo) return;
  $('#erro-leitura').hidden = true; $('#corrigir-msg').textContent = '';
  if (!$('#turma').value.trim()) { mostrarErro('Digite a turma antes de fotografar.'); return; }
  $('#lendo').hidden = false;
  try {
    const img = await createImageBitmap(arquivo);
    const escala = Math.min(1, 2000 / Math.max(img.width, img.height)); // fotos de 12 MP ficam leves
    const cv = $('#canvas');
    cv.width = Math.round(img.width * escala); cv.height = Math.round(img.height * escala);
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    const foto = ctx.getImageData(0, 0, cv.width, cv.height);
    const layout = montarLayout(estado.prova.gabarito.length);
    const l = lerFolha(paraCinza(foto), layout);
    if (!l) { mostrarErro('Não encontrei os 4 quadrados pretos da folha. Enquadre a folha inteira, com boa luz, e fotografe de novo.'); return; }
    leitura = {
      layout, foto, H: homografia(layout.marcadores, l.marcadoresPx),
      original: l.respostas.map(r => r.marca),
      valores: l.respostas.map(r => (r.duvidosa ? '' : r.marca)),
    };
    $('#numero').value = l.numero && !l.numeroDuvidoso ? l.numero : '';
    renderConferencia();
    $('#conferencia').hidden = false;
    $('#conferencia').scrollIntoView();
  } catch {
    mostrarErro('Não consegui abrir essa foto. Tente fotografar de novo.');
  } finally { $('#lendo').hidden = true; }
});

function mostrarErro(msg) {
  $('#erro-leitura').textContent = msg; $('#erro-leitura').hidden = false;
  $('#conferencia').hidden = true; leitura = null;
}

function situacao(i) {
  const v = leitura.valores[i], p = estado.prova;
  if (v === '') return 'confira';
  if (p.anuladas.includes(i) || v === p.gabarito[i]) return 'certa';
  return v === 'branco' || v === 'dupla' ? 'confira' : 'errada';
}

function renderConferencia() {
  $('#respostas').innerHTML = leitura.valores.map((v, i) => `
    <label class="${situacao(i)}">Q${i + 1}
      <select data-q="${i}" aria-label="Resposta da questão ${i + 1}">
        ${v === '' ? '<option value="" selected>Confira</option>' : ''}
        ${[...LETRAS, 'branco', 'dupla'].map(o => `<option value="${o}" ${o === v ? 'selected' : ''}>${ROTULO[o] ?? o}</option>`).join('')}
      </select></label>`).join('');
  atualizarConferencia();
}

function atualizarConferencia() {
  const p = estado.prova, v = leitura.valores;
  const c = corrigir(p.gabarito, p.anuladas, v.map(x => x || 'branco'));
  $('#placar').textContent = `${c.acertos} de ${c.total} acertos · nota ${nota1(c.nota)}`;
  const faltam = v.flatMap((x, i) => (x === '' ? [i + 1] : []));
  const numeroOk = /^\d{1,2}$/.test($('#numero').value.trim());
  $('#pendencias').textContent = [
    faltam.length ? `Confira a leitura da questão ${faltam.join(', ')}: a marcação não está clara.` : '',
    numeroOk ? '' : 'Digite o número de chamada do aluno.',
  ].filter(Boolean).join(' ');
  $('#salvar-leitura').disabled = faltam.length > 0 || !numeroOk;
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
    const j = LETRAS.indexOf(leitura.valores[i]);
    const alvo = q[j >= 0 ? j : LETRAS.indexOf(estado.prova.gabarito[i])];
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
$('#descartar').addEventListener('click', () => { $('#conferencia').hidden = true; leitura = null; });
$('#salvar-leitura').addEventListener('click', async () => {
  const turma = $('#turma').value.trim().toUpperCase(), numero = $('#numero').value.trim().padStart(2, '0');
  if (estado.correcoes[chave(turma, numero)] &&
      !(await perguntar(`O nº ${numero} da turma ${turma} já foi corrigido. Trocar pela correção nova?`, 'Trocar pela nova', 'Manter a anterior'))) return;
  persistir(registrar(estado, { turma, numero, respostas: [...leitura.valores], editado: leitura.valores.some((v, i) => v !== leitura.original[i]) }));
  $('#conferencia').hidden = true; leitura = null;
  $('#corrigir-msg').textContent = `Correção do nº ${numero} (${turma}) salva. Fotografe a próxima folha.`;
});

mostrar(estado.prova ? 'corrigir' : 'prova');
