// Folha de respostas em SVG (unidades em mm), pronta para imprimir.
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// codigo: os 20 bits do código da prova (src/codigo.js); sem ele a folha sai sem a faixa.
export function folhaSVG(layout, nomeProva, codigo) {
  const { w, h } = layout.pagina, lado = layout.marcadorLado, r = layout.raio;
  const bolinha = (p, rotulo, attr) =>
    `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="white" stroke="black" stroke-width="0.25" ${attr}/>` +
    `<text x="${p.x}" y="${p.y + 0.85}" font-size="2.4" text-anchor="middle" fill="#999">${rotulo}</text>`;
  const partes = [
    ...layout.marcadores.map(m => `<rect class="marcador" x="${m.x - lado / 2}" y="${m.y - lado / 2}" width="${lado}" height="${lado}" fill="black"/>`),
    ...(codigo ? layout.codigo.map((c, i) => (codigo[i]
      ? `<rect class="codigo" x="${c.x - layout.codigoCelula.w / 2}" y="${c.y - layout.codigoCelula.h / 2}" width="${layout.codigoCelula.w}" height="${layout.codigoCelula.h}" fill="black"/>` : '')) : []),
    `<text x="25" y="30" font-size="6" font-weight="bold">${esc(nomeProva)}</text>`,
    `<text x="25" y="48" font-size="4.5">Nome:</text><line x1="40" y1="48" x2="135" y2="48" stroke="black" stroke-width="0.3"/>`,
    `<text x="25" y="62" font-size="4.5">Turma:</text><line x1="42" y1="62" x2="80" y2="62" stroke="black" stroke-width="0.3"/>`,
    `<text x="25" y="80" font-size="3.5">Marque seu número de chamada ao lado.</text>`,
    `<text x="25" y="88" font-size="3.5">Pinte toda a bolinha com caneta preta ou azul.</text>`,
    `<text x="25" y="96" font-size="3.5">Marque só uma alternativa por questão. Não rasure.</text>`,
    `<text x="153.5" y="34" font-size="3.5" text-anchor="middle">Nº</text>`,
    ...(layout.versao ? [`<text x="175" y="34" font-size="3.5" text-anchor="middle">Versão</text>`,
      ...layout.versao.map((p, v) => bolinha(p, 'ABCD'[v], `data-ver="${'ABCD'[v]}"`))] : []),
    ...layout.numero.flatMap((col, c) => col.map((p, d) => bolinha(p, d, `data-dig="${c}-${d}"`))),
    ...layout.questoes.flatMap((q, i) => [
      `<text x="${q[0].x - 4}" y="${q[0].y + 1.2}" font-size="3.2" text-anchor="end" font-weight="bold">${i + 1}</text>`,
      ...q.map((p, j) => bolinha(p, layout.alternativas[j], `data-q="${i}" data-alt="${layout.alternativas[j]}"`)),
    ]),
  ];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm" font-family="Arial, sans-serif"><rect width="${w}" height="${h}" fill="white"/>${partes.join('')}</svg>`;
}

// Quadro do gabarito (src/layout.js montarQuadro) em SVG, para a página 1 da prova.
// qr: o SVG do QR code (src/qr.js); rotulo: "código.versão" escrito no rodapé.
export function quadroSVG(layout, qr, rotulo) {
  const { w, h } = layout.pagina, lado = layout.marcadorLado, r = layout.raio, L = layout.alternativas.toLowerCase();
  const bolinha = (p, attr) => `<rect x="${p.x - r - 0.1}" y="${p.y - 1.8}" width="${2 * r + 0.2}" height="3.6" rx="1.5" fill="white" stroke="#555" stroke-width="0.2" stroke-dasharray="0.45 0.35" ${attr}/>`;
  const colunas = Math.ceil(layout.questoes.length / 10);
  const letras = y => [...Array(colunas)].flatMap((_, c) => layout.questoes[c * 10].map((p, j) =>
    `<text x="${p.x}" y="${y}" font-size="2.8" text-anchor="middle">${L[j]}</text>`));
  const ultimaLinha = layout.numero[0][9].y;
  const partes = [
    `<rect x="0.3" y="0.3" width="${w - 0.6}" height="${h - 0.6}" fill="white" stroke="black" stroke-width="0.35"/>`,
    `<rect x="1.5" y="1.5" width="${w - 3}" height="${h - 3}" fill="none" stroke="black" stroke-width="0.25"/>`,
    `<line x1="1.5" y1="9" x2="${w - 1.5}" y2="9" stroke="black" stroke-width="0.25"/>`,
    `<line x1="1.5" y1="${h - 9}" x2="${w - 1.5}" y2="${h - 9}" stroke="black" stroke-width="0.25"/>`,
    `<line x1="46" y1="9" x2="46" y2="${h - 9}" stroke="black" stroke-width="0.25"/>`,
    `<text x="${w / 2}" y="6.6" font-size="3.4" text-anchor="middle">Marque o gabarito preenchendo completamente a região de cada alternativa.</text>`,
    `<text x="${w / 2}" y="${h - 3.6}" font-size="3.4" text-anchor="middle">Prova: ${esc(rotulo)}</text>`,
    ...layout.marcadores.map(m => `<rect class="marcador" x="${m.x - lado / 2}" y="${m.y - lado / 2}" width="${lado}" height="${lado}" fill="black"/>`),
    qr,
    `<text x="54.75" y="16.5" font-size="2.8" text-anchor="middle">Nº</text>`,
    ...layout.numero.flatMap((col, c) => col.map((p, d) => bolinha(p, `data-dig="${c}-${d}"`))),
    ...layout.numero[0].map((p, d) => `<text x="${p.x - 4}" y="${p.y + 1}" font-size="2.6" text-anchor="middle">${d}</text>`),
    ...letras(16.5), ...letras(ultimaLinha + 6),
    ...layout.questoes.flatMap((q, i) => [
      `<text x="${q[0].x - 3.5}" y="${q[0].y + 1}" font-size="2.8" text-anchor="end">Q.${i + 1}:</text>`,
      ...q.map((p, j) => bolinha(p, `data-q="${i}" data-alt="${layout.alternativas[j]}"`)),
    ]),
  ];
  return `<svg class="quadro" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}mm" height="${h}mm" font-family="'Times New Roman', Times, serif">${partes.join('')}</svg>`;
}
