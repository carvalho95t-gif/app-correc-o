// Prova impressa no modelo do professor: página 1 com cabeçalho, identificação e instruções; depois as questões.
const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const texto = s => esc(s).replace(/\n/g, '<br>');
const num = x => (Math.round(x * 100) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

// Pontos de cada questão: valor da prova dividido pelos pesos.
export function pontosDasQuestoes(prova) {
  const n = prova.caderno.questoes.length, pesos = Array.from({ length: n }, (_, i) => prova.pesos?.[i] ?? 1);
  const soma = pesos.reduce((a, b) => a + b, 0), valor = prova.valor ?? 10;
  return pesos.map(p => (valor * p) / soma);
}

export function instrucoes(prova) {
  const n = prova.caderno.questoes.length, letras = [...(prova.alternativas ?? 'ABCDE').toLowerCase()];
  const pts = pontosDasQuestoes(prova), iguais = pts.every(p => Math.abs(p - pts[0]) < 1e-9), valor = prova.valor ?? 10;
  return [
    `A prova contém ${n} ${n === 1 ? 'questão objetiva' : 'questões objetivas'}. Cada questão apresenta ${letras.length} alternativas (${letras.length === 2 ? `${letras[0]} ou ${letras[1]}` : `de ${letras[0]} até ${letras.at(-1)}`}) e somente uma está correta.`,
    iguais ? `Cada questão vale ${num(pts[0])} ${pts[0] === 1 ? 'ponto' : 'pontos'}, totalizando ${num(valor)} pontos.`
      : `O valor de cada questão está ao lado do seu número, totalizando ${num(valor)} pontos.`,
    'Leia com atenção o texto-base e o enunciado antes de responder.',
    'Marque suas respostas no quadro do gabarito, preenchendo completamente a bolinha da alternativa escolhida, com caneta azul ou preta. Não use corretivo; respostas rasuradas ou com mais de uma marcação serão anuladas.',
    ...String(prova.caderno.cabecalho?.instrucoes ?? '').split('\n').map(l => l.trim()).filter(Boolean),
  ];
}

// gabarito: HTML do quadro do gabarito ou da folha, colocado na página 1 depois das instruções.
export function capaHTML(prova, rotuloVersao = '', gabarito = '') {
  const c = prova.caderno.cabecalho ?? {}, escola = String(c.escola ?? '').split('\n').map(l => l.trim()).filter(Boolean);
  return `<section class="capa">
    ${escola.length ? `<div class="escola">${escola.map((l, i) => `<div${i === escola.length - 1 ? ' class="nome-escola"' : ''}>${esc(l)}</div>`).join('')}</div>` : ''}
    <h1>${esc(c.titulo || prova.nome)}${rotuloVersao ? ` · ${esc(rotuloVersao)}` : ''}</h1>
    ${c.subtitulo ? `<p class="subtitulo">${esc(c.subtitulo)}</p>` : ''}
    <table class="identificacao">
      <tr><td colspan="3"><b>Estudante:</b> <span class="linha"></span></td></tr>
      <tr><td><b>Professor:</b> ${esc(c.professor)}</td><td><b>Turma:</b> _____</td><td><b>Data:</b> ____/____/______</td></tr>
      <tr><td><b>Disciplina:</b> ${esc(c.disciplina)}</td><td><b>Série:</b> ${esc(c.serie)}</td><td><b>Nota:</b> _______ / ${num(prova.valor ?? 10)}</td></tr>
    </table>
    <div class="instrucoes"><h2>Instruções ao estudante</h2>
      <ol>${instrucoes(prova).map(l => `<li>${esc(l)}</li>`).join('')}</ol></div>
    ${gabarito}
  </section>`;
}

export function cadernoHTML(prova, rotuloVersao = '', gabarito = '') {
  const letras = (prova.alternativas ?? 'ABCDE').toLowerCase(), pts = pontosDasQuestoes(prova);
  const questoes = prova.caderno.questoes.map((q, i) => `
    <li class="questao">
      <h3>QUESTÃO ${String(i + 1).padStart(2, '0')} <small>(${num(pts[i])} ${pts[i] === 1 ? 'ponto' : 'pontos'})</small></h3>
      ${q.enunciado?.trim() ? `<p class="texto-base">${texto(q.enunciado)}</p>` : ''}
      ${q.imagem ? `<img src="${esc(q.imagem)}" alt="Imagem da questão ${i + 1}">` : ''}
      ${q.fonte?.trim() ? `<p class="fonte">${esc(q.fonte)}</p>` : ''}
      ${q.comando?.trim() ? `<p class="comando">${texto(q.comando)}</p>` : ''}
      <ol class="alternativas">${[...letras].map((a, j) => `<li><b>${a})</b> ${esc(q.alternativas[j])}</li>`).join('')}</ol>
    </li>`).join('');
  return `<article class="caderno-pagina" lang="pt-BR">
    ${capaHTML(prova, rotuloVersao, gabarito)}
    <ol class="questoes">${questoes}</ol>
  </article>`;
}

// Regras de página: o cabeçalho corrido das questões traz o nome curto e o número da página.
export function estiloDePagina(prova) {
  const c = prova.caderno?.cabecalho ?? {}, nome = (c.nomeCurto || prova.nome).replace(/["\\\n]/g, ' ');
  return `@page questoes { size: A4; margin: 18mm 18mm 16mm; @top-right { content: "${nome}   " counter(page); font: 10pt "Times New Roman", serif; } }
@page capa { size: A4; margin: 14mm 18mm 16mm; }`;
}
