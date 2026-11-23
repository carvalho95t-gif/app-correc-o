// Seam: o app no navegador, como o professor usa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { abrirApp, criarProva } from './apoio-app.js';

test('professor cria a prova e vê a folha para imprimir', async () => {
  const { ctx, page, erros } = await abrirApp();
  await criarProva(page, { nome: 'Simulado <1>', gabarito: 'ABCDEABCDE' });
  assert.match(await page.textContent('#prova-msg'), /Prova salva/);
  await page.click('#aba-folha');
  const svg = page.locator('#folha svg');
  assert.equal(await svg.locator('circle[data-q]').count(), 50);
  assert.equal(await svg.locator('circle[data-dig]').count(), 20);
  assert.equal(await svg.locator('rect.marcador').count(), 4);
  const texto = await svg.textContent();
  assert.ok(texto.includes('Simulado <1>'));
  assert.ok(texto.includes('Pinte toda a bolinha com caneta preta ou azul.'));
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('salvar prova sem nome ou com gabarito faltando explica o que falta', async () => {
  const { ctx, page } = await abrirApp();
  await page.fill('#prova-num', '3');
  await page.dispatchEvent('#prova-num', 'change');
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#prova-msg'), /Dê um nome/);
  await page.fill('#prova-nome', 'P');
  await page.click('#gabarito button[data-q="0"][data-alt="A"]');
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#prova-msg'), /questão 2, 3/);
  await page.check('#gabarito input[data-anular="1"]');
  await page.click('#gabarito button[data-q="2"][data-alt="C"]');
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#prova-msg'), /Prova salva/);
  await ctx.close();
});
