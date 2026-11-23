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

// Pinta bolinhas na folha da tela Folha e devolve um print dela, que faz o papel da foto.
export async function fotografarFolha(page, numero, respostas) {
  await page.click('#aba-folha');
  await page.setViewportSize({ width: 1000, height: 1500 });
  await page.evaluate(({ numero, respostas }) => {
    const svg = document.querySelector('#folha svg');
    [...numero].forEach((d, c) => svg.querySelector(`[data-dig="${c}-${d}"]`)?.setAttribute('fill', 'black'));
    respostas.forEach((a, q) => {
      if (!a) return;
      const [letra, cor] = a.split(':'); // 'B:#aaa' pinta a bolinha com tinta fraca
      svg.querySelector(`[data-q="${q}"][data-alt="${letra}"]`).setAttribute('fill', cor ?? 'black');
    });
  }, { numero, respostas });
  const png = await page.locator('#folha svg').screenshot();
  await page.setViewportSize({ width: 390, height: 844 });
  return png;
}

test('professor fotografa uma folha, confere os acertos e salva a correção', async () => {
  const { ctx, page, erros } = await abrirApp();
  await criarProva(page);
  const png = await fotografarFolha(page, '07', [...'ABDDEABCD', null]); // erra a Q3 e deixa a Q10 em branco
  await page.click('#aba-corrigir');
  await page.fill('#turma', '2A');
  await page.setInputFiles('#foto', { name: 'folha.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('#conferencia:not([hidden])');
  assert.equal(await page.inputValue('#numero'), '07');
  assert.match(await page.textContent('#placar'), /8 de 10/);
  await page.click('#salvar-leitura');
  assert.match(await page.textContent('#corrigir-msg'), /nº 07 \(2A\) salva/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('foto sem folha mostra o que fazer', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page);
  await page.click('#aba-corrigir');
  await page.fill('#turma', '2A');
  await page.setInputFiles('#foto', { name: 'x.png', mimeType: 'image/png', buffer: await page.screenshot() });
  await page.waitForSelector('#erro-leitura:not([hidden])');
  assert.match(await page.textContent('#erro-leitura'), /4 quadrados pretos/);
  await ctx.close();
});

async function fotografarECorrigir(page, turma, numero, respostas) {
  const png = await fotografarFolha(page, numero, respostas);
  await page.click('#aba-corrigir');
  await page.fill('#turma', turma);
  await page.setInputFiles('#foto', { name: 'folha.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('#conferencia:not([hidden])');
}

test('sem número de chamada, salvar fica bloqueado até digitar', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page);
  await fotografarECorrigir(page, '2B', '', [...'ABCDEABCDE']);
  assert.equal(await page.inputValue('#numero'), '');
  assert.ok(await page.isDisabled('#salvar-leitura'));
  await page.fill('#numero', '9');
  assert.ok(await page.isEnabled('#salvar-leitura'));
  await page.click('#salvar-leitura');
  assert.match(await page.textContent('#corrigir-msg'), /nº 09 \(2B\)/);
  await ctx.close();
});

test('marcação fraca fica para conferir e bloqueia o salvar até escolher', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page);
  await fotografarECorrigir(page, '2A', '03', ['A', 'B:#aaa', ...'CDEABCDE']);
  assert.ok(await page.isDisabled('#salvar-leitura'));
  assert.match(await page.textContent('#pendencias'), /questão 2/);
  await page.selectOption('#respostas select[data-q="1"]', 'B');
  assert.ok(await page.isEnabled('#salvar-leitura'));
  assert.match(await page.textContent('#placar'), /10 de 10/);
  await ctx.close();
});

test('trocar uma marcação na conferência muda os acertos', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page);
  await fotografarECorrigir(page, '2A', '04', [...'ABCDEABCDE']);
  await page.selectOption('#respostas select[data-q="0"]', 'dupla');
  assert.match(await page.textContent('#placar'), /9 de 10/);
  await ctx.close();
});

test('aluno já corrigido: pergunta antes de trocar', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page);
  await fotografarECorrigir(page, '2A', '05', [...'ABCDEABCDE']);
  await page.click('#salvar-leitura');
  await fotografarECorrigir(page, '2a', '05', [...'EEEEEEEEEE']);
  await page.click('#salvar-leitura');
  assert.match(await page.textContent('#dlg-msg'), /nº 05 da turma 2A já foi corrigido/);
  await page.click('#dlg-nao'); // Manter a anterior
  assert.ok(await page.isVisible('#conferencia'));
  await page.click('#salvar-leitura');
  await page.click('#dlg-sim'); // Trocar pela nova
  assert.match(await page.textContent('#corrigir-msg'), /nº 05 \(2A\) salva/);
  await ctx.close();
});
