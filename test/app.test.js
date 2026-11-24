// Seam: o app no navegador, como o professor usa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { abrirApp, criarProva, XLSX } from './apoio-app.js';

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
export async function fotografarFolha(page, numero, respostas, versao) {
  await page.click('#aba-folha');
  await page.setViewportSize({ width: 1000, height: 1500 });
  await page.evaluate(({ numero, respostas, versao }) => {
    const svg = document.querySelector('#folha svg');
    [...numero].forEach((d, c) => svg.querySelector(`[data-dig="${c}-${d}"]`)?.setAttribute('fill', 'black'));
    if (versao) svg.querySelector(`[data-ver="${versao}"]`).setAttribute('fill', 'black');
    respostas.forEach((a, q) => {
      if (!a) return;
      const [letra, cor] = a.split(':'); // 'B:#aaa' pinta a bolinha com tinta fraca
      svg.querySelector(`[data-q="${q}"][data-alt="${letra}"]`).setAttribute('fill', cor ?? 'black');
    });
  }, { numero, respostas, versao });
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

async function fotografarECorrigir(page, turma, numero, respostas, versao) {
  const png = await fotografarFolha(page, numero, respostas, versao);
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

test('resultados por turma, baixar planilha e aviso de não exportado', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page);
  await fotografarECorrigir(page, '2A', '07', [...'ABDDEABCD', null]);
  await page.click('#salvar-leitura');
  assert.ok(await page.isVisible('#aviso-exportar'));
  await page.click('#aba-resultados');
  assert.match(await page.locator('#resultados tr', { hasText: '07' }).textContent(), /8\/10.*8,0/s);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#baixar')]);
  assert.equal(download.suggestedFilename(), 'Teste.xlsx');
  const wb = XLSX.read(await readFile(await download.path()), { type: 'buffer' });
  assert.equal(wb.SheetNames[0], '2A');
  assert.ok(await page.isHidden('#aviso-exportar'));
  await page.click('#resultados button[data-apagar]');
  await page.click('#dlg-sim');
  assert.ok(await page.isVisible('#resultados-vazio'));
  assert.ok(await page.isVisible('#aviso-exportar'));
  await ctx.close();
});

test('funciona sem internet depois da primeira abertura', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page);
  await page.evaluate(() => Promise.race([navigator.serviceWorker.ready, new Promise((_, n) => setTimeout(() => n(new Error('sem service worker')), 5000))]));
  await page.reload(); // a página passa a ser controlada pelo service worker
  await ctx.setOffline(true);
  await page.reload();
  await page.click('#aba-prova');
  assert.equal(await page.inputValue('#prova-nome'), 'Teste');
  await page.click('#aba-folha');
  assert.ok(await page.isVisible('#folha svg'));
  await ctx.close();
});

// ---------- ticket 10: várias provas ----------
test('várias provas: cada uma guarda suas correções e a ativa aparece em Corrigir', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page, { nome: 'Prova A' });
  await fotografarECorrigir(page, '2A', '01', [...'ABCDEABCDE']);
  await page.click('#salvar-leitura');

  await page.click('#aba-prova');
  await page.click('#nova-prova');
  await criarProva(page, { nome: 'Prova B', gabarito: 'EEEEE' });
  await page.click('#aba-corrigir');
  assert.match(await page.textContent('#corrigindo'), /Prova B/, await page.textContent('#prova-msg'));
  await page.click('#aba-resultados');
  assert.ok(await page.isVisible('#resultados-vazio'));

  await page.click('#aba-prova');
  await page.selectOption('#prova-ativa', { label: 'Prova A' });
  assert.equal(await page.inputValue('#prova-nome'), 'Prova A');
  await page.click('#aba-resultados');
  assert.equal(await page.locator('#resultados tbody tr').count(), 1);
  await page.reload();
  await page.click('#aba-corrigir');
  assert.match(await page.textContent('#corrigindo'), /Prova A/);
  await ctx.close();
});

test('apagar uma prova avisa quando há correções fora da planilha', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page, { nome: 'Prova A' });
  await fotografarECorrigir(page, '2A', '01', [...'ABCDEABCDE']);
  await page.click('#salvar-leitura');
  await page.click('#aba-prova');
  await page.click('#apagar-prova');
  assert.match(await page.textContent('#dlg-msg'), /ainda não estão na planilha/);
  await page.click('#dlg-nao');
  assert.equal(await page.inputValue('#prova-nome'), 'Prova A');
  await page.click('#apagar-prova');
  await page.click('#dlg-sim');
  assert.equal(await page.inputValue('#prova-nome'), '');
  assert.equal(await page.locator('#prova-ativa option').count(), 1); // só "Nova prova"
  await ctx.close();
});

// ---------- ticket 08: nomes dos alunos ----------
test('lista de chamada mostra o nome do aluno nos resultados', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page);
  await fotografarECorrigir(page, '2A', '02', [...'ABCDEABCDE']);
  await page.click('#salvar-leitura');
  await page.click('#aba-resultados');
  await page.click('#lista summary');
  await page.fill('#lista-turma', '2a');
  await page.fill('#lista-nomes', 'Ana\nBruno');
  await page.click('#salvar-lista');
  assert.match(await page.locator('#resultados tbody tr').textContent(), /02.*Bruno/s);
  await ctx.close();
});

// ---------- ticket 09: duas folhas por A4 ----------
test('duas folhas por página só para provas de até 30 questões', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page);
  await page.click('#aba-folha');
  await page.check('#duas-por-pagina');
  assert.equal(await page.locator('#folha svg').count(), 2);
  await page.click('#aba-prova');
  await page.click('#nova-prova');
  await criarProva(page, { nome: 'Longa', gabarito: 'A'.repeat(31) });
  await page.click('#aba-folha');
  assert.ok(await page.isHidden('#opcao-duas'));
  assert.equal(await page.locator('#folha svg').count(), 1);
  await ctx.close();
});

// ---------- ticket 12: versões da prova ----------
test('prova com duas versões: folha com bolinhas de versão e nota pelo gabarito certo', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page, { gabarito: 'ABCDE', versoes: ['ABCDE', 'EDCBA'] });
  assert.match(await page.textContent('#prova-msg'), /Prova salva/);
  await page.click('#aba-folha');
  assert.equal(await page.locator('#folha svg circle[data-ver]').count(), 2);
  await fotografarECorrigir(page, '2A', '01', [...'EDCBA'], 'B');
  assert.equal(await page.inputValue('#versao'), 'B');
  assert.match(await page.textContent('#placar'), /5 de 5/);
  await page.click('#salvar-leitura');
  await fotografarECorrigir(page, '2A', '02', [...'EDCBA'], null);
  assert.ok(await page.isDisabled('#salvar-leitura'));
  assert.match(await page.textContent('#pendencias'), /versão/);
  await page.selectOption('#versao', 'A');
  assert.match(await page.textContent('#placar'), /1 de 5/);
  assert.ok(await page.isEnabled('#salvar-leitura'));
  await ctx.close();
});

// ---------- ticket 11: restaurar a partir da planilha ----------
test('restaurar a prova importando a planilha baixada', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page, { nome: 'Prova A' });
  await fotografarECorrigir(page, '2A', '01', [...'ABCDEABCDE']);
  await page.click('#salvar-leitura');
  await page.click('#aba-resultados');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#baixar')]);
  const arquivo = await readFile(await download.path());

  // Mesmo nome já existe: o professor escolhe manter as duas.
  await page.click('#aba-prova');
  await page.setInputFiles('#importar', { name: 'Prova A.xlsx', mimeType: 'application/octet-stream', buffer: arquivo });
  await page.waitForSelector('#dlg[open]');
  assert.match(await page.textContent('#dlg-msg'), /Já existe uma prova "Prova A"/);
  await page.click('#dlg-nao'); // Manter as duas
  await page.waitForFunction(() => document.querySelectorAll('#prova-ativa option').length === 2);
  assert.ok(await page.locator('#prova-ativa option', { hasText: 'Prova A (restaurada)' }).count());

  // Celular apagou tudo: importar traz a prova e as correções de volta.
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.click('#aba-prova');
  await page.setInputFiles('#importar', { name: 'Prova A.xlsx', mimeType: 'application/octet-stream', buffer: arquivo });
  await page.waitForFunction(() => /restaurada/.test(document.querySelector('#prova-msg').textContent));
  assert.match(await page.textContent('#prova-msg'), /Prova "Prova A" restaurada com 1 correção\./);
  await page.click('#aba-resultados');
  assert.match(await page.locator('#resultados tbody tr').textContent(), /01.*10\/10/s);

  await page.click('#aba-prova');
  await page.setInputFiles('#importar', { name: 'x.xlsx', mimeType: 'application/octet-stream', buffer: Buffer.from('não é planilha') });
  await page.waitForFunction(() => /não foi baixada|Não consegui ler/.test(document.querySelector('#prova-msg').textContent));
  await ctx.close();
});
