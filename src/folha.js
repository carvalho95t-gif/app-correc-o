// Folha de respostas em SVG (unidades em mm), pronta para imprimir.
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function folhaSVG(layout, nomeProva) {
  const { w, h } = layout.pagina, lado = layout.marcadorLado, r = layout.raio;
  const bolinha = (p, rotulo, attr) =>
    `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="white" stroke="black" stroke-width="0.25" ${attr}/>` +
    `<text x="${p.x}" y="${p.y + 0.85}" font-size="2.4" text-anchor="middle" fill="#999">${rotulo}</text>`;
  const partes = [
    ...layout.marcadores.map(m => `<rect class="marcador" x="${m.x - lado / 2}" y="${m.y - lado / 2}" width="${lado}" height="${lado}" fill="black"/>`),
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
