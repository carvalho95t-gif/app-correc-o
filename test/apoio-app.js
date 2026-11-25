// Apoio para os testes no navegador: servidor estático + Chromium com tela de celular.
import { before, after } from 'node:test';
import { createRequire } from 'node:module';
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
export const XLSX = require('../vendor/xlsx.mini.min.js');
const raiz = new URL('..', import.meta.url).pathname;
const tipos = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

let servidor, url, browser;
before(async () => {
  servidor = http.createServer(async (req, res) => {
    const caminho = join(raiz, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
    try { const corpo = await readFile(caminho); res.writeHead(200, { 'content-type': tipos[extname(caminho)] ?? 'application/octet-stream' }); res.end(corpo); }
    catch { res.writeHead(404); res.end(); }
  });
  await new Promise(r => servidor.listen(0, '127.0.0.1', r));
  url = `http://127.0.0.1:${servidor.address().port}/`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); servidor?.close(); });

export async function abrirApp() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  ctx.setDefaultTimeout(5000);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(e));
  await page.goto(url);
  return { ctx, page, erros };
}

export async function criarProva(page, { nome = 'Teste', gabarito = 'ABCDEABCDE', valor, versoes, alternativas } = {}) {
  await page.click('#aba-prova');
  await page.fill('#prova-nome', nome);
  await page.fill('#prova-num', String(gabarito.length));
  await page.dispatchEvent('#prova-num', 'change');
  if (valor) await page.fill('#prova-valor', String(valor));
  if (alternativas) await page.selectOption('#prova-alternativas', alternativas);
  const gabaritos = versoes ?? [gabarito];
  if (versoes) await page.selectOption('#prova-versoes', String(versoes.length));
  for (const [v, g] of gabaritos.entries()) {
    if (versoes) await page.click(`#versoes-gabarito button[data-versao="${'ABCD'[v]}"]`);
    for (const [i, a] of [...g].entries()) await page.click(`#gabarito button[data-q="${i}"][data-alt="${a}"]`);
  }
  await page.click('#salvar-prova');
}

// Chromium com câmera falsa que mostra o vídeo `video` (.y4m) em loop.
export async function abrirAppComCamera(video) {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${video}`] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera'] });
  ctx.setDefaultTimeout(8000);
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', e => erros.push(e));
  await page.goto(url);
  return { ctx, page, erros, fechar: () => b.close() };
}
