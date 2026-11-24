// Prova impressa 02 e 03: quadro do gabarito na página 1, com QR code, lido pela foto da página inteira.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirApp, abrirAppComCamera } from './apoio-app.js';

async function criarCaderno(page, nome, gabarito, { versoes = 1, embaralhar = false } = {}) {
  await page.click('#aba-prova');
  await page.fill('#prova-nome', nome);
  await page.fill('#prova-num', String(gabarito.length));
  await page.dispatchEvent('#prova-num', 'change');
  if (versoes > 1) await page.selectOption('#prova-versoes', String(versoes));
  await page.$eval('#caderno-editor', d => { d.open = true; });
  for (const [i, certa] of [...gabarito].entries()) {
    await page.fill(`#caderno-questoes [data-cq="${i}"] textarea[data-campo="enunciado"]`, `Texto-base da questão ${i + 1}.`);
    await page.check(`#caderno-questoes [data-cq="${i}"] input[type=radio][value="${certa}"]`);
  }
  if (embaralhar) await page.check('#embaralhar-alternativas');
  else for (let v = 1; v < versoes; v++) { // versões sem embaralhar: gabarito de cada versão à mão
    await page.click(`#versoes-gabarito button[data-versao="${'ABCD'[v]}"]`);
    for (const [i, a] of [...gabarito].entries()) await page.click(`#gabarito button[data-q="${i}"][data-alt="${a}"]`);
  }
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#prova-msg'), /Prova salva/);
  await page.click('#aba-folha');
}

// Pinta o quadro da página 1 da versão k e devolve um print da página 1 inteira (com o texto em volta).
async function fotografarPagina1(page, k, numero, respostas, { girar = 0, semQR = false } = {}) {
  await page.setViewportSize({ width: 1000, height: 1500 });
  const capa = `#caderno .caderno-pagina >> nth=${k} >> .capa`;
  await page.locator(capa).evaluate((el, { numero, respostas, girar, semQR }) => {
    const svg = el.querySelector('svg.quadro');
    if (semQR) svg.querySelector('path.qr').remove();
    [...numero].forEach((d, c) => svg.querySelector(`[data-dig="${c}-${d}"]`).setAttribute('fill', 'black'));
    respostas.forEach((a, q) => a && svg.querySelector(`[data-q="${q}"][data-alt="${a}"]`).setAttribute('fill', 'black'));
    el.style.background = 'white'; el.style.transform = `rotate(${girar}deg)`;
  }, { numero, respostas, girar, semQR });
  await page.evaluate(() => { document.querySelector('nav').style.visibility = 'hidden'; });
  const png = await page.locator(capa).screenshot();
  await page.evaluate(() => { document.querySelector('nav').style.visibility = ''; });
  await page.setViewportSize({ width: 390, height: 844 });
  return png;
}

async function enviar(page, png) {
  await page.click('#aba-corrigir');
  await page.fill('#turma', '2A');
  await page.setInputFiles('#foto', { name: 'p1.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('#conferencia:not([hidden]), #erro-leitura:not([hidden]), #dlg[open]');
}

test('quadro do gabarito: página 1 inteira fotografada é lida com número e marcações', async () => {
  const { ctx, page, erros } = await abrirApp();
  await criarCaderno(page, 'Recuperação', 'ABCDEABCDEAB');
  const html = await page.innerHTML('#caderno');
  assert.equal(await page.locator('#caderno svg.quadro').count(), 1);
  assert.equal(await page.locator('#caderno .folha-impressa').count(), 0); // sem folha separada
  assert.match(html, /Marque o gabarito preenchendo completamente a região de cada alternativa\./);
  assert.match(await page.textContent('#caderno'), /Prova: \d+.*Assinatura do estudante.*Visto do\(a\) professor\(a\)/s);
  assert.equal(await page.textContent('#imprimir-caderno'), 'Imprimir prova');
  const png = await fotografarPagina1(page, 0, '07', [...'ABCDEABCDEA', null].map((a, i) => (i === 2 ? 'E' : a)), { girar: 3 });
  await enviar(page, png);
  assert.equal(await page.inputValue('#numero'), '07');
  assert.match(await page.textContent('#placar'), /10 de 12/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('quadro do gabarito: o QR diz a versão da prova embaralhada', async () => {
  const { ctx, page, erros } = await abrirApp();
  await criarCaderno(page, 'Embaralhada', 'ABCDEA', { versoes: 2, embaralhar: true });
  assert.equal(await page.locator('#caderno svg.quadro').count(), 2);
  assert.match(await page.textContent('#caderno .caderno-pagina >> nth=1'), /Prova: \d+\.B/);
  const gabB = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('correcao-v3')).provas)[0].prova.versoes[1].gabarito);
  await enviar(page, await fotografarPagina1(page, 1, '12', gabB));
  assert.equal(await page.inputValue('#versao'), 'B');
  assert.match(await page.textContent('#placar'), /6 de 6/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('quadro do gabarito: sem QR legível, corrige na prova ativa e deixa a versão para o professor', async () => {
  const { ctx, page } = await abrirApp();
  await criarCaderno(page, 'Sem QR', 'ABCDEA', { versoes: 2, embaralhar: true });
  await enviar(page, await fotografarPagina1(page, 0, '03', [...'ABCDEA'], { semQR: true }));
  assert.ok(await page.isVisible('#conferencia'));
  assert.equal(await page.inputValue('#numero'), '03');
  assert.equal(await page.inputValue('#versao'), '');
  await ctx.close();
});

test('quadro do gabarito: prova de outra prova do aparelho pergunta e corrige na certa', async () => {
  const { ctx, page } = await abrirApp();
  await criarCaderno(page, 'Prova A', 'ABCDE');
  const png = await fotografarPagina1(page, 0, '05', [...'ABCDE']);
  await page.click('#aba-prova');
  await page.click('#nova-prova');
  await criarCaderno(page, 'Prova B', 'EEEEEEEEEE');
  await enviar(page, png);
  await page.waitForSelector('#dlg[open]');
  assert.match(await page.textContent('#dlg-msg'), /Esta folha é da prova "Prova A"/);
  await page.click('#dlg-sim');
  await page.waitForSelector('#conferencia:not([hidden])');
  assert.match(await page.textContent('#placar'), /5 de 5/);
  await ctx.close();
});

test('prova com 31 questões: gabarito na folha separada, com aviso', async () => {
  const { ctx, page } = await abrirApp();
  await criarCaderno(page, 'Longa', 'ABCDE'.repeat(6) + 'A');
  assert.equal(await page.locator('#caderno svg.quadro').count(), 0);
  assert.equal(await page.locator('#caderno .folha-impressa').count(), 1);
  assert.ok(await page.isVisible('#aviso-quadro'));
  assert.match(await page.textContent('#caderno'), /na folha de respostas/);
  await ctx.close();
});

test('quadro do gabarito: a câmera ao vivo reconhece a página 1 e captura sozinha', async () => {
  const a = await abrirApp();
  await criarCaderno(a.page, 'Câmera', 'ABCDEABCDE');
  const png = await fotografarPagina1(a.page, 0, '21', [...'ABCDEABCDA']);
  const prova = await a.page.evaluate(() => localStorage.getItem('correcao-v3'));
  await a.ctx.close();
  const dir = await mkdtemp(join(tmpdir(), 'camera-'));
  await writeFile(join(dir, 'p1.png'), png);
  execFileSync('ffmpeg', ['-loglevel', 'error', '-loop', '1', '-i', join(dir, 'p1.png'), '-t', '2', '-r', '10',
    '-vf', 'scale=640:-2,pad=720:1080:(ow-iw)/2:(oh-ih)/2:gray', '-pix_fmt', 'yuv420p', join(dir, 'p1.y4m')]);
  const { page, erros, fechar } = await abrirAppComCamera(join(dir, 'p1.y4m'));
  try {
    await page.evaluate(v => { localStorage.setItem('correcao-v3', v); }, prova);
    await page.reload();
    await page.click('#aba-corrigir');
    await page.fill('#turma', '2A');
    await page.click('#abrir-camera');
    await page.waitForSelector('#conferencia:not([hidden])');
    assert.equal(await page.inputValue('#numero'), '21');
    assert.match(await page.textContent('#placar'), /9 de 10/);
    assert.deepEqual(erros, []);
  } finally { await fechar(); }
});

test('versões sem embaralhar: a folha separada continua, porque o quadro não tem bolinhas de versão', async () => {
  const { ctx, page } = await abrirApp();
  await criarCaderno(page, 'Duas versões', 'ABCDE', { versoes: 2 });
  assert.equal(await page.locator('#caderno svg.quadro').count(), 0);
  assert.equal(await page.locator('#caderno .folha-impressa').count(), 1);
  await ctx.close();
});
