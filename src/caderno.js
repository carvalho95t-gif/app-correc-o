// Caderno de prova em HTML, pronto para imprimir antes da folha de respostas.
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function cadernoHTML(prova, rotuloVersao = '') {
  const letras = prova.alternativas ?? 'ABCDE';
  const questoes = prova.caderno.questoes.map((q, i) => `
    <li class="questao">
      <p class="enunciado"><b>${i + 1}.</b> ${esc(q.enunciado).replace(/\n/g, '<br>')}</p>
      ${q.imagem ? `<img src="${esc(q.imagem)}" alt="Imagem da questão ${i + 1}">` : ''}
      <ol class="alternativas">${[...letras].map((a, j) => `<li><b>${a})</b> ${esc(q.alternativas[j])}</li>`).join('')}</ol>
    </li>`).join('');
  return `<article class="caderno-pagina">
    <header><h1>${esc(prova.nome)}${rotuloVersao ? ` · ${esc(rotuloVersao)}` : ''}</h1>
      <p>Nome: ____________________________________________ Turma: ________ Nº: ____</p></header>
    <ol class="questoes">${questoes}</ol>
  </article>`;
}
