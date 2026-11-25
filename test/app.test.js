// Seam: o app no navegador, como o professor usa.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { abrirApp, abrirAppComCamera, criarProva, XLSX } from './apoio-app.js';

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
export async function fotografarFolha(page, numero, respostas, versao, { semCodigo = false } = {}) {
  await page.click('#aba-folha');
  await page.setViewportSize({ width: 1000, height: 1500 });
  // Prova embaralhada: cada versão tem sua folha (svg[data-versao]); senão o aluno pinta a bolinha da versão.
  const seletor = await page.evaluate(v => (v && document.querySelector(`#folha svg[data-versao="${v}"]`) ? `#folha svg[data-versao="${v}"]` : '#folha svg'), versao);
  await page.evaluate(({ numero, respostas, versao, seletor, semCodigo }) => {
    const svg = document.querySelector(seletor);
    if (semCodigo) svg.querySelectorAll('rect.codigo').forEach(r => r.remove());
    [...numero].forEach((d, c) => svg.querySelector(`[data-dig="${c}-${d}"]`)?.setAttribute('fill', 'black'));
    if (versao) svg.querySelector(`[data-ver="${versao}"]`)?.setAttribute('fill', 'black');
    respostas.forEach((a, q) => {
      if (!a) return;
      const [letra, cor] = a.split(':'); // 'B:#aaa' pinta a bolinha com tinta fraca
      svg.querySelector(`[data-q="${q}"][data-alt="${letra}"]`).setAttribute('fill', cor ?? 'black');
    });
  }, { numero, respostas, versao, seletor, semCodigo });
  await page.evaluate(() => { document.querySelector('nav').style.visibility = 'hidden'; }); // a barra fixa cobriria a folha de baixo
  const png = await page.locator(seletor).screenshot();
  await page.evaluate(() => { document.querySelector('nav').style.visibility = ''; });
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

test('restaurar por cima de uma prova com correções não exportadas avisa a perda', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page, { nome: 'Prova A' });
  await fotografarECorrigir(page, '2A', '01', [...'ABCDEABCDE']);
  await page.click('#salvar-leitura');
  await page.click('#aba-resultados');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#baixar')]);
  const arquivo = await readFile(await download.path());
  await fotografarECorrigir(page, '2A', '02', [...'ABCDEABCDE']);
  await page.click('#salvar-leitura');

  await page.click('#aba-prova');
  await page.setInputFiles('#importar', { name: 'Prova A.xlsx', mimeType: 'application/octet-stream', buffer: arquivo });
  await page.waitForSelector('#dlg[open]');
  assert.match(await page.textContent('#dlg-msg'), /ainda não estão em nenhuma planilha e serão perdidas/);
  await ctx.close();
});

test('peso por questão: peso 2 nas questões 1 a 5 muda a nota da conferência', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page);
  await page.fill('#peso-valor', '2');
  await page.fill('#peso-de', '1');
  await page.fill('#peso-ate', '5');
  await page.click('#aplicar-peso');
  assert.match(await page.textContent('#pesos-resumo'), /1 a 5 valem 2/);
  await page.click('#salvar-prova');
  // Gabarito ABCDEABCDE; marcou ABCDE EEEEE: Q1–Q5 (10 pontos) + Q10 (1) = 11 de 15 → 7,3.
  await fotografarECorrigir(page, '2A', '01', [...'ABCDEEEEEE']);
  assert.match(await page.textContent('#placar'), /6 de 10 acertos · nota 7,3/);
  await ctx.close();
});

test('pesos colados de uma lista e "todas com o mesmo peso"', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page);
  await page.$eval('#pesos-colar', d => { d.open = true; });
  await page.fill('#pesos-lista', '2 2 2');
  await page.click('#aplicar-lista-pesos');
  assert.match(await page.textContent('#pesos-resumo'), /3 pesos e a prova tem 10/);
  await page.fill('#pesos-lista', '2\n2\n2\n2\n2\n1\n1\n1\n1\n1');
  await page.click('#aplicar-lista-pesos');
  assert.match(await page.textContent('#pesos-resumo'), /1 a 5 valem 2/);
  await page.click('#salvar-prova');
  await fotografarECorrigir(page, '2A', '01', [...'ABCDEEEEEE']);
  assert.match(await page.textContent('#placar'), /nota 7,3/);
  await page.click('#descartar');
  await page.click('#aba-prova');
  await page.$eval('#pesos-colar', d => { d.open = true; });
  await page.click('#pesos-iguais');
  assert.match(await page.textContent('#pesos-resumo'), /Todas as questões valem 1/);
  await page.click('#salvar-prova');
  await fotografarECorrigir(page, '2A', '01', [...'ABCDEEEEEE']);
  assert.match(await page.textContent('#placar'), /nota 6,0/);
  await ctx.close();
});

test('prova A–D: gabarito, folha e conferência só com A a D', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page, { gabarito: 'ABCDABCD', alternativas: 'ABCD' });
  assert.equal(await page.locator('#gabarito .linha').first().locator('button').count(), 4);
  await page.click('#aba-folha');
  assert.equal(await page.locator('#folha circle[data-q="0"]').count(), 4);
  await fotografarECorrigir(page, '3A', '02', [...'ABCDABCC']);
  assert.match(await page.textContent('#placar'), /7 de 8/);
  assert.deepEqual(await page.$$eval('#respostas select[data-q="0"] option', os => os.map(o => o.value)), ['A', 'B', 'C', 'D', 'branco', 'dupla']);
  await page.click('#salvar-leitura');
  assert.match(await page.textContent('#corrigir-msg'), /nº 02 \(3A\) salva/);
  await ctx.close();
});

test('áreas: recusa sobreposição e salva duas áreas', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page);
  const area = async (k, nome, de, ate) => {
    await page.click('#adicionar-area');
    await page.fill(`#areas [data-area="${k}"] [name="nome"]`, nome);
    await page.fill(`#areas [data-area="${k}"] [name="de"]`, String(de));
    await page.fill(`#areas [data-area="${k}"] [name="ate"]`, String(ate));
  };
  await area(0, 'Linguagens', 1, 5);
  await area(1, 'Matemática', 5, 10);
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#prova-msg'), /se sobrepõem/);
  await page.fill('#areas [data-area="1"] [name="de"]', '6');
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#prova-msg'), /Prova salva/);
  await page.reload();
  await page.click('#aba-prova');
  assert.equal(await page.inputValue('#areas [data-area="1"] [name="nome"]'), 'Matemática');
  await ctx.close();
});

// ---------- novas funções 04: código da prova ----------
async function enviarFoto(page, turma, png) {
  await page.click('#aba-corrigir');
  await page.fill('#turma', turma);
  await page.setInputFiles('#foto', { name: 'folha.png', mimeType: 'image/png', buffer: png });
}

test('folha de outra prova: pergunta e corrige na prova certa', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page, { nome: 'Prova A' });
  const png = await fotografarFolha(page, '03', [...'ABCDEABCDE']);
  await page.click('#aba-prova');
  await page.click('#nova-prova');
  await criarProva(page, { nome: 'Prova B', gabarito: 'EEEEEEEEEE' });
  await enviarFoto(page, '2A', png);
  await page.waitForSelector('#dlg[open]');
  assert.match(await page.textContent('#dlg-msg'), /Esta folha é da prova "Prova A"\. Corrigir nela\?/);
  await page.click('#dlg-sim');
  await page.waitForSelector('#conferencia:not([hidden])');
  assert.match(await page.textContent('#placar'), /10 de 10/);
  assert.match(await page.textContent('#corrigindo'), /Prova A/);
  await ctx.close();
});

test('folha de uma prova que não está no aparelho mostra aviso', async () => {
  const a = await abrirApp();
  await criarProva(a.page, { nome: 'Prova A' });
  const png = await fotografarFolha(a.page, '03', [...'ABCDEABCDE']);
  await a.ctx.close();
  const { ctx, page } = await abrirApp();
  await criarProva(page, { nome: 'Prova B' });
  await enviarFoto(page, '2A', png);
  await page.waitForSelector('#conferencia:not([hidden])');
  assert.match(await page.textContent('#aviso-codigo'), /não está neste aparelho/);
  await ctx.close();
});

// ---------- novas funções 05: câmera ao vivo ----------
import { execFileSync } from 'node:child_process';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';

test('câmera ao vivo: captura sozinha, abre a conferência e volta para a câmera depois de salvar', async () => {
  const a = await abrirApp();
  await criarProva(a.page);
  const png = await fotografarFolha(a.page, '12', [...'ABCDEABCDA']);
  await a.ctx.close();
  const dir = await mkdtemp(join(tmpdir(), 'camera-'));
  await writeFile(join(dir, 'folha.png'), png);
  // Folha sobre fundo cinza, como numa mesa, em vídeo de 2 s.
  execFileSync('ffmpeg', ['-loglevel', 'error', '-loop', '1', '-i', join(dir, 'folha.png'), '-t', '2', '-r', '10',
    '-vf', 'scale=600:-2,pad=720:1080:(ow-iw)/2:(oh-ih)/2:gray', '-pix_fmt', 'yuv420p', join(dir, 'folha.y4m')]);

  const { page, erros, fechar } = await abrirAppComCamera(join(dir, 'folha.y4m'));
  try {
    await criarProva(page);
    await page.click('#aba-corrigir');
    await page.fill('#turma', '2A');
    await page.click('#abrir-camera');
    await page.waitForSelector('#conferencia:not([hidden])');
    assert.match(await page.textContent('#placar'), /9 de 10/);
    assert.equal(await page.inputValue('#numero'), '12');
    assert.ok(await page.isHidden('#camera'));
    await page.click('#salvar-leitura');
    await page.waitForSelector('#camera:not([hidden])');
    await page.waitForSelector('#conferencia:not([hidden])'); // captura a mesma folha de novo
    await page.click('#descartar');
    await page.waitForSelector('#camera:not([hidden])'); // descartar também volta para a câmera
    await page.click('#aba-resultados');
    assert.ok(await page.isHidden('#camera'));
    assert.equal(await page.evaluate(() => document.querySelector('#video').srcObject), null);
    assert.deepEqual(erros, []);
  } finally { await fechar(); }
});

// ---------- novas funções 06: caderno de prova ----------
test('caderno: digitar 3 questões, gabarito sai do caderno e a impressão traz as questões e a folha', async () => {
  const { ctx, page } = await abrirApp();
  await page.click('#aba-prova');
  await page.fill('#prova-nome', 'Caderno 1');
  await page.fill('#prova-num', '3');
  await page.dispatchEvent('#prova-num', 'change');
  await page.click('#caderno-editor summary');
  for (const [i, certa] of ['B', 'E', 'A'].entries()) {
    await page.fill(`#caderno-questoes [data-cq="${i}"] textarea`, `Enunciado da questão ${i + 1} <b>`);
    for (const a of 'ABCDE') await page.fill(`#caderno-questoes [data-cq="${i}"] input[data-texto="${a}"]`, `opção ${a}${i + 1}`);
    await page.check(`#caderno-questoes [data-cq="${i}"] input[type=radio][value="${certa}"]`);
  }
  assert.equal(await page.getAttribute('#gabarito button[data-q="1"][data-alt="E"]', 'aria-pressed'), 'true');
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#prova-msg'), /Prova salva/);
  await page.click('#aba-folha');
  const texto = await page.textContent('#caderno');
  assert.match(texto, /Caderno 1/);
  assert.match(texto, /QUESTÃO 01.*Enunciado da questão 1 <b>/s);
  assert.match(texto, /b\).*opção B1/s);
  assert.match(await page.innerHTML('#caderno'), /questão 1 &lt;b&gt;/); // texto digitado não vira HTML
  assert.ok(await page.isVisible('#imprimir-caderno'));
  assert.equal(await page.locator('#folha svg').count(), 1);
  await ctx.close();
});

test('impressão: folha em 1 página e prova curta sem folha separada', async () => {
  const paginas = pdf => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  const { ctx, page } = await abrirApp();
  await criarProva(page, { gabarito: 'ABCDE' });
  await page.click('#aba-folha');
  assert.equal(paginas(await page.pdf({ preferCSSPageSize: true })), 1);
  await page.click('#aba-prova');
  await page.click('#caderno-editor summary');
  for (let i = 0; i < 5; i++) await page.fill(`#caderno-questoes [data-cq="${i}"] textarea[data-campo="enunciado"]`, 'Texto '.repeat(15));
  await page.click('#salvar-prova');
  await page.click('#aba-folha');
  await page.evaluate(() => { document.querySelector('#folha').before(document.querySelector('#caderno')); document.body.classList.add('com-caderno'); });
  assert.equal(paginas(await page.pdf({ preferCSSPageSize: true })), 2); // página 1 com o quadro do gabarito, questões em duas colunas
  await ctx.close();
});

// ---------- prova impressa 01: modelo do professor ----------
test('prova impressa: cabeçalho, identificação, instruções e questão no modelo do professor', async () => {
  const { ctx, page, erros } = await abrirApp();
  await page.click('#aba-prova');
  await page.fill('#prova-nome', 'Recuperação');
  await page.fill('#prova-num', '20');
  await page.dispatchEvent('#prova-num', 'change');
  await page.fill('#prova-valor', '100');
  await page.click('#caderno-editor summary');
  await page.click('#cabecalho-prova summary');
  await page.fill('[data-cab="escola"]', 'GOVERNO DO ESTADO\nESCOLA ESTADUAL <X>');
  await page.fill('[data-cab="titulo"]', 'Avaliação de Recuperação Final');
  await page.fill('[data-cab="subtitulo"]', 'Filosofia – 2ª série');
  await page.fill('[data-cab="professor"]', 'Tiago');
  await page.fill('[data-cab="disciplina"]', 'Filosofia');
  await page.fill('[data-cab="serie"]', '2ª');
  await page.fill('[data-cab="instrucoes"]', 'O tempo de prova será informado.');
  for (let i = 0; i < 20; i++) {
    await page.fill(`#caderno-questoes [data-cq="${i}"] textarea[data-campo="enunciado"]`, `Texto-base ${i + 1}`);
    await page.check(`#caderno-questoes [data-cq="${i}"] input[type=radio][value="A"]`);
  }
  await page.click('#caderno-questoes [data-cq="0"] .fonte-comando summary');
  await page.fill('#caderno-questoes [data-cq="0"] input[data-campo="fonte"]', 'Texto elaborado a partir de Montaigne.');
  await page.fill('#caderno-questoes [data-cq="0"] textarea[data-campo="comando"]', 'Montaigne sugere que:');
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#prova-msg'), /Prova salva/);
  await page.click('#aba-folha');
  const html = await page.innerHTML('#caderno'), texto = await page.textContent('#caderno');
  assert.match(html, /class="nome-escola">ESCOLA ESTADUAL &lt;X&gt;/);
  assert.match(texto, /Avaliação de Recuperação Final/);
  assert.match(texto, /Professor:\s*Tiago/);
  assert.match(texto, /Nota:.*\/ 100,0/);
  assert.match(texto, /20 questões objetivas/);
  assert.match(texto, /Cada questão vale 5,0 pontos, totalizando 100,0 pontos/);
  assert.match(texto, /O tempo de prova será informado/);
  assert.match(texto, /QUESTÃO 01\s*\(5,0 pontos\)/);
  assert.match(html, /class="fonte">Texto elaborado a partir de Montaigne\./);
  assert.match(html, /class="comando">Montaigne sugere que:/);
  assert.match(html, /Recuperação   " counter\(page\)/);
  // depois de recarregar, o cabeçalho continua no editor
  await page.reload();
  await page.click('#aba-prova');
  assert.equal(await page.inputValue('[data-cab="professor"]'), 'Tiago');
  assert.deepEqual(erros, []);
  await ctx.close();
});

// ---------- novas funções 07: imagens nas questões ----------
test('imagem na questão: fica reduzida no caderno e continua depois de recarregar', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'imagem-'));
  execFileSync('ffmpeg', ['-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=2400x1600', '-frames:v', '1', join(dir, 'grande.png')]);
  const { ctx, page, erros } = await abrirApp();
  await page.click('#aba-prova');
  await page.fill('#prova-nome', 'Com imagem');
  await page.fill('#prova-num', '2');
  await page.dispatchEvent('#prova-num', 'change');
  await page.click('#caderno-editor summary');
  for (const i of [0, 1]) {
    await page.fill(`#caderno-questoes [data-cq="${i}"] textarea`, `Questão ${i + 1}`);
    await page.check(`#caderno-questoes [data-cq="${i}"] input[type=radio][value="A"]`);
  }
  await page.setInputFiles('#caderno-questoes [data-cq="1"] input[type=file]', join(dir, 'grande.png'));
  await page.waitForSelector('#caderno-questoes [data-cq="1"] img');
  await page.click('#salvar-prova');
  const confere = async () => {
    await page.click('#aba-folha');
    const img = page.locator('#caderno img');
    await img.waitFor();
    const [w, h] = await img.evaluate(i => i.decode().then(() => [i.naturalWidth, i.naturalHeight]));
    assert.equal(w, 800); assert.equal(h, 533);
  };
  await confere();
  await page.reload();
  await confere();
  assert.deepEqual(erros, []);
  await ctx.close();
});

// ---------- novas funções 08: caderno embaralhado ----------
test('caderno embaralhado: duas versões impressas e a folha da versão B corrigida pelo gabarito gerado', async () => {
  const { ctx, page, erros } = await abrirApp();
  await page.click('#aba-prova');
  await page.fill('#prova-nome', 'Embaralhada');
  await page.fill('#prova-num', '6');
  await page.dispatchEvent('#prova-num', 'change');
  await page.selectOption('#prova-versoes', '2');
  await page.click('#caderno-editor summary');
  for (const [i, certa] of [...'ABCDEA'].entries()) {
    await page.fill(`#caderno-questoes [data-cq="${i}"] textarea`, `Questão original ${i + 1}`);
    await page.check(`#caderno-questoes [data-cq="${i}"] input[type=radio][value="${certa}"]`);
  }
  await page.check('#embaralhar-questoes');
  await page.check('#embaralhar-alternativas');
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#prova-msg'), /Prova salva/);
  const gabB = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('correcao-v3')).provas)[0].prova.versoes[1].gabarito);
  assert.notDeepEqual(gabB, [...'ABCDEA']);

  await page.click('#aba-folha');
  assert.equal(await page.locator('#folha svg').count(), 2);
  assert.equal(await page.locator('#caderno .caderno-pagina').count(), 2);
  assert.match(await page.textContent('#caderno .caderno-pagina >> nth=1'), /Versão B/);
  await fotografarECorrigir(page, '1A', '08', gabB, 'B');
  assert.equal(await page.inputValue('#versao'), 'B');
  assert.match(await page.textContent('#placar'), /6 de 6/);
  await page.click('#salvar-leitura');
  assert.match(await page.textContent('#corrigir-msg'), /nº 08 \(1A\) salva/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('caderno embaralhado: não dá para embaralhar de novo com correções salvas', async () => {
  const { ctx, page } = await abrirApp();
  await page.click('#aba-prova');
  await page.fill('#prova-nome', 'E2');
  await page.fill('#prova-num', '3');
  await page.dispatchEvent('#prova-num', 'change');
  await page.selectOption('#prova-versoes', '2');
  await page.click('#caderno-editor summary');
  for (const i of [0, 1, 2]) {
    await page.fill(`#caderno-questoes [data-cq="${i}"] textarea`, `Q${i + 1}`);
    await page.check(`#caderno-questoes [data-cq="${i}"] input[type=radio][value="A"]`);
  }
  await page.check('#embaralhar-questoes');
  await page.click('#salvar-prova');
  await fotografarECorrigir(page, '1A', '01', ['A', 'A', 'A'], 'A');
  await page.click('#salvar-leitura');
  await page.click('#aba-prova');
  await page.$eval('#caderno-editor', d => { d.open = true; });
  await page.click('#embaralhar-de-novo');
  assert.match(await page.textContent('#prova-msg'), /Já há correções/);
  await ctx.close();
});

test('caderno embaralhado: folha sem código legível deixa a versão para o professor escolher', async () => {
  const { ctx, page } = await abrirApp();
  await page.click('#aba-prova');
  await page.fill('#prova-nome', 'E3');
  await page.fill('#prova-num', '3');
  await page.dispatchEvent('#prova-num', 'change');
  await page.selectOption('#prova-versoes', '2');
  await page.click('#caderno-editor summary');
  for (const i of [0, 1, 2]) {
    await page.fill(`#caderno-questoes [data-cq="${i}"] textarea`, `Q${i + 1}`);
    await page.check(`#caderno-questoes [data-cq="${i}"] input[type=radio][value="A"]`);
  }
  await page.check('#embaralhar-alternativas');
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#embaralhar-nota'), /Versão B: 1 [A-E], 2 [A-E], 3 [A-E]/);
  const png = await fotografarFolha(page, '04', ['A', 'A', 'A'], 'B', { semCodigo: true });
  await page.click('#aba-corrigir');
  await page.fill('#turma', '1A');
  await page.setInputFiles('#foto', { name: 'f.png', mimeType: 'image/png', buffer: png });
  await page.waitForSelector('#conferencia:not([hidden])');
  assert.equal(await page.inputValue('#versao'), '');
  assert.ok(await page.isDisabled('#salvar-leitura'));
  await ctx.close();
});

test('embaralhar marcado sem caderno não salva versões sem gabarito', async () => {
  const { ctx, page } = await abrirApp();
  await page.click('#aba-prova');
  await page.fill('#prova-nome', 'Sem caderno');
  await page.selectOption('#prova-versoes', '2');
  for (const i of [...Array(10).keys()]) await page.click(`#gabarito button[data-q="${i}"][data-alt="A"]`);
  await page.click('#caderno-editor summary');
  await page.check('#embaralhar-questoes');
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#prova-msg'), /Falta o gabarito da versão B/);
  await ctx.close();
});

// ---------- plano 1: pontuação parcial por alternativa ----------
test('pontuação parcial: errada que vale 75% entra na nota da conferência e continua depois de recarregar', async () => {
  const { ctx, page, erros } = await abrirApp();
  await page.click('#aba-prova');
  await page.fill('#prova-nome', 'Parcial');
  await page.fill('#prova-num', '4');
  await page.dispatchEvent('#prova-num', 'change');
  await page.check('#parcial-ativar');
  for (const [i, a] of [...'ABCD'].entries()) await page.click(`#gabarito button[data-q="${i}"][data-alt="${a}"]`);
  await page.fill('#gabarito input[data-parcial="0"][data-alt="B"]', '75');
  await page.fill('#gabarito input[data-parcial="0"][data-alt="C"]', '50');
  assert.equal(await page.locator('#gabarito input[data-parcial="0"][data-alt="A"]').count(), 0); // a certa vale 100%
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#prova-msg'), /Prova salva/);
  await fotografarECorrigir(page, '2A', '01', [...'BBCD']);
  assert.match(await page.textContent('#placar'), /3 de 4 acertos · nota 9,4/); // 3,75 de 4
  await page.reload();
  await page.click('#aba-prova');
  assert.ok(await page.isChecked('#parcial-ativar'));
  assert.equal(await page.inputValue('#gabarito input[data-parcial="0"][data-alt="B"]'), '75');
  assert.deepEqual(erros, []);
  await ctx.close();
});

// ---------- plano 2: prova a partir de um arquivo Word ----------
test('prova do Word: questões, texto-base, fonte, comando, imagem, cabeçalho e gabarito vêm do .docx', async () => {
  const { ctx, page, erros } = await abrirApp();
  await page.click('#aba-prova');
  await page.setInputFiles('#importar-docx', join(import.meta.dirname, 'fixtures', 'prova-exemplo.docx'));
  await page.waitForFunction(() => /importadas/.test(document.querySelector('#prova-msg').textContent));
  assert.match(await page.textContent('#prova-msg'), /3 questões importadas.*O gabarito também veio do arquivo/);
  assert.equal(await page.inputValue('#prova-nome'), 'AVALIAÇÃO DE RECUPERAÇÃO FINAL');
  assert.equal(await page.inputValue('#prova-valor'), '15'); // 3 questões de 5,0 pontos
  assert.equal(await page.getAttribute('#gabarito button[data-q="0"][data-alt="D"]', 'aria-pressed'), 'true');
  assert.equal(await page.getAttribute('#gabarito button[data-q="2"][data-alt="B"]', 'aria-pressed'), 'true');
  const q = n => `#caderno-questoes [data-cq="${n}"]`;
  assert.match(await page.inputValue(`${q(0)} textarea[data-campo="enunciado"]`), /^Montaigne observou/);
  assert.match(await page.inputValue(`${q(0)} input[data-campo="fonte"]`), /^Texto elaborado a partir de Michel de Montaigne/);
  assert.equal(await page.inputValue(`${q(0)} textarea[data-campo="comando"]`), 'Ao comparar os costumes, Montaigne sugere que:');
  assert.equal(await page.inputValue(`${q(0)} input[data-texto="D"]`), 'chamamos de bárbaro o que difere dos nossos costumes, o que revela um julgamento etnocêntrico.');
  assert.match(await page.inputValue(`${q(1)} input[data-campo="fonte"]`), /^KANT, Immanuel/);
  assert.equal(await page.locator(`${q(1)} img.miniatura`).count(), 1);
  assert.equal(await page.inputValue(`${q(2)} textarea[data-campo="comando"]`), '');
  await page.$eval('#cabecalho-prova', d => { d.open = true; });
  assert.equal(await page.inputValue('[data-cab="professor"]'), 'Tiago Carvalho');
  assert.equal(await page.inputValue('[data-cab="disciplina"]'), 'Filosofia');
  assert.equal(await page.inputValue('[data-cab="subtitulo"]'), 'FILOSOFIA – 2ª SÉRIE DO ENSINO MÉDIO – 2026');
  assert.match(await page.inputValue('[data-cab="escola"]'), /GOVERNO DO ESTADO DO ESPÍRITO SANTO\n.*\nESCOLA ESTADUAL EXEMPLO/);
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#prova-msg'), /Prova salva/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('prova do Word: arquivo que não é .docx explica o que fazer', async () => {
  const { ctx, page } = await abrirApp();
  await page.click('#aba-prova');
  await page.setInputFiles('#importar-docx', { name: 'velha.docx', mimeType: 'application/octet-stream', buffer: Buffer.from('não é zip') });
  await page.waitForFunction(() => /salve como \.docx/.test(document.querySelector('#prova-msg').textContent));
  await ctx.close();
});

// ---------- plano: destacar dupla marcação ou rasura (pesquisa A) ----------
test('conferência avisa marcação dupla ou rasura e questão em branco', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page);
  await fotografarECorrigir(page, '2A', '07', [...'ABCDEABCD', null]);
  await page.selectOption('#respostas select[data-q="1"]', 'dupla');
  const p = await page.textContent('#pendencias');
  assert.match(p, /Dupla marcação \(ou rasura\) na questão 2/);
  assert.match(p, /Em branco: questão 10\./);
  assert.ok(await page.isEnabled('#salvar-leitura')); // é só um aviso
  await ctx.close();
});

// ---------- plano: análise na tela, conceitos e posição ----------
test('resultados: posição, conceito e análise das questões e das notas na tela', async () => {
  const { ctx, page, erros } = await abrirApp();
  await criarProva(page);
  await page.fill('#prova-conceitos', 'A 9\nB 7\nC 0');
  await page.click('#salvar-prova');
  await fotografarECorrigir(page, '2A', '01', [...'ABCDEABCDE']); await page.click('#salvar-leitura');
  await fotografarECorrigir(page, '2A', '02', [...'ABCDEABCEE']); await page.click('#salvar-leitura');
  await page.click('#aba-resultados');
  const linhas = await page.locator('#resultados tbody tr').allTextContents();
  assert.match(linhas[0], /01.*10\/10.*10,0.*1º.*percentil 100.*A/s);
  assert.match(linhas[1], /02.*9\/10.*9,0.*2º.*percentil 0.*A/s);
  await page.click('#analise-tela summary');
  assert.match(await page.textContent('#analise-notas'), /2 aluno\(s\) · média 9,5/);
  const q9 = await page.locator('#analise-questoes tbody tr >> nth=8').textContent();
  assert.match(q9, /^9\s*50%/); // metade acertou a Q9
  assert.equal(await page.locator('#analise-questoes tbody tr >> nth=8 >> td.certa-analise').textContent(), '50%');
  // faixa de conceito inválida não salva
  await page.click('#aba-prova');
  await page.fill('#prova-conceitos', 'A nove');
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#prova-msg'), /Em Conceitos/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

// ---------- plano: importar lista e gabarito de planilha/CSV ----------
test('lista da turma e gabarito trazidos de arquivos CSV', async () => {
  const { ctx, page, erros } = await abrirApp();
  await page.click('#aba-prova');
  await page.fill('#prova-nome', 'Do CSV');
  await page.setInputFiles('#gabarito-arquivo', { name: 'gabarito.csv', mimeType: 'text/csv', buffer: Buffer.from('Questão;Resposta\n1;b\n2;C\n3;a\n') });
  await page.waitForFunction(() => /Gabarito de 3 questões/.test(document.querySelector('#prova-msg').textContent));
  assert.equal(await page.inputValue('#prova-num'), '3');
  assert.equal(await page.getAttribute('#gabarito button[data-q="1"][data-alt="C"]', 'aria-pressed'), 'true');
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#prova-msg'), /Prova salva/);
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#baixar-gabarito')]);
  assert.equal(download.suggestedFilename(), 'Gabarito - Do CSV.csv');
  assert.match((await readFile(await download.path(), 'utf8')), /Questão;Gabarito\n1;B\n2;C\n3;A/);
  await page.click('#aba-resultados');
  await page.click('#lista summary');
  await page.setInputFiles('#lista-arquivo', { name: 'turma.csv', mimeType: 'text/csv', buffer: Buffer.from('Nº,Nome\n1,Ana Souza\n2,Bia Lima\n') });
  await page.waitForFunction(() => /2 nomes trazidos/.test(document.querySelector('#lista-msg').textContent));
  assert.equal(await page.inputValue('#lista-nomes'), '01 Ana Souza\n02 Bia Lima');
  assert.deepEqual(erros, []);
  await ctx.close();
});

// ---------- plano: duplicar prova ----------
test('duplicar prova: cópia com o mesmo gabarito, outro nome e sem correções', async () => {
  const { ctx, page, erros } = await abrirApp();
  await criarProva(page, { nome: 'Original', gabarito: 'EDCBAEDCBA' });
  await fotografarECorrigir(page, '2A', '01', [...'EDCBAEDCBA']); await page.click('#salvar-leitura');
  await page.click('#aba-prova');
  await page.click('#duplicar-prova');
  assert.equal(await page.inputValue('#prova-nome'), 'Original (cópia)');
  assert.equal(await page.getAttribute('#gabarito button[data-q="0"][data-alt="E"]', 'aria-pressed'), 'true');
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#prova-msg'), /Prova salva/);
  const provas = await page.evaluate(() => Object.values(JSON.parse(localStorage.getItem('correcao-v3')).provas));
  assert.equal(provas.length, 2);
  const copia = provas.find(e => e.prova.nome === 'Original (cópia)'), original = provas.find(e => e.prova.nome === 'Original');
  assert.deepEqual(Object.keys(copia.correcoes), []);
  assert.notEqual(copia.prova.codigo, original.prova.codigo);
  assert.deepEqual(erros, []);
  await ctx.close();
});

// ---------- plano: várias fotos da galeria e corrigir digitando ----------
test('várias fotos da galeria: uma conferência por vez e aviso das que não deu para ler', async () => {
  const { ctx, page, erros } = await abrirApp();
  await criarProva(page);
  const f1 = await fotografarFolha(page, '01', [...'ABCDEABCDE']);
  const f2 = await fotografarFolha(page, '02', [...'ABCDEABCDA']);
  await page.click('#aba-corrigir');
  await page.fill('#turma', '2A');
  await page.setInputFiles('#fotos', [
    { name: 'a.png', mimeType: 'image/png', buffer: f1 },
    { name: 'ruim.png', mimeType: 'image/png', buffer: await page.screenshot() },
    { name: 'b.png', mimeType: 'image/png', buffer: f2 },
  ]);
  await page.waitForSelector('#conferencia:not([hidden])');
  assert.equal(await page.inputValue('#numero'), '01');
  assert.match(await page.textContent('#fila-status'), /faltam 2/);
  await page.click('#salvar-leitura');
  await page.waitForFunction(() => document.querySelector('#numero').value === '02');
  assert.match(await page.textContent('#placar'), /9 de 10/);
  await page.click('#salvar-leitura');
  await page.waitForSelector('#erro-leitura:not([hidden])');
  assert.match(await page.textContent('#erro-leitura'), /Não consegui ler: ruim\.png/);
  assert.equal(await page.evaluate(() => Object.keys(Object.values(JSON.parse(localStorage.getItem('correcao-v3')).provas)[0].correcoes).length), 2);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('corrigir digitando as respostas, sem foto', async () => {
  const { ctx, page, erros } = await abrirApp();
  await criarProva(page);
  await page.click('#aba-corrigir');
  await page.fill('#turma', '2A');
  await page.click('#digitar');
  await page.waitForSelector('#conferencia:not([hidden])');
  assert.ok(await page.isHidden('#canvas'));
  assert.ok(await page.isDisabled('#salvar-leitura'));
  for (const [i, a] of [...'ABCDEABCDA'].entries()) await page.selectOption(`#respostas select[data-q="${i}"]`, a);
  await page.fill('#numero', '15');
  assert.match(await page.textContent('#placar'), /9 de 10/);
  await page.click('#salvar-leitura');
  assert.match(await page.textContent('#corrigir-msg'), /nº 15 \(2A\) salva/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

// ---------- plano E: modo pesquisa ----------
test('modo pesquisa: salva sem gabarito, conta respostas e a planilha tem a aba Pesquisa', async () => {
  const { ctx, page, erros } = await abrirApp();
  await page.click('#aba-prova');
  await page.fill('#prova-nome', 'Questionário');
  await page.fill('#prova-num', '4'); await page.dispatchEvent('#prova-num', 'change');
  await page.check('#prova-pesquisa');
  assert.ok(await page.isHidden('#gabarito'));
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#prova-msg'), /Prova salva/);
  await fotografarECorrigir(page, '9A', '01', ['A', 'B', null, 'D']);
  assert.match(await page.textContent('#placar'), /Pesquisa: 3 de 4 questões respondidas/);
  await page.click('#salvar-leitura');
  await page.click('#aba-resultados');
  assert.match(await page.locator('#resultados tbody tr').first().textContent(), /01.*3\/4/s);
  await page.click('#analise-tela summary');
  assert.ok(await page.isHidden('#analise-notas'));
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#baixar')]);
  const wb = XLSX.read(await readFile(await download.path()), { type: 'buffer' });
  assert.deepEqual(wb.SheetNames.slice(0, 2), ['9A', 'Pesquisa']);
  assert.deepEqual(erros, []);
  await ctx.close();
});

// ---------- plano 5: relatório da turma ----------
test('relatório da turma: junta a nota de cada prova e baixa a planilha', async () => {
  const { ctx, page, erros } = await abrirApp();
  await criarProva(page, { nome: 'P1', gabarito: 'EDCBAEDCBA' });
  await fotografarECorrigir(page, '2A', '01', [...'EDCBAEDCBA']); await page.click('#salvar-leitura');
  await page.click('#aba-prova');
  await page.click('#duplicar-prova');
  await page.fill('#prova-nome', 'P2');
  await page.click('#salvar-prova');
  await fotografarECorrigir(page, '2A', '01', [...'EDCBAEEEEE']); await page.click('#salvar-leitura');
  await fotografarECorrigir(page, '2A', '02', [...'EDCBAEDCBA']); await page.click('#salvar-leitura');
  await page.click('#aba-resultados');
  await page.click('#relatorio summary');
  await page.fill('#relatorio-turma', '3c');
  await page.click('#baixar-relatorio');
  assert.match(await page.textContent('#relatorio-msg'), /Nenhuma correção da turma 3C/);
  await page.fill('#relatorio-turma', '2a');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('#baixar-relatorio')]);
  assert.equal(download.suggestedFilename(), 'Relatorio 2A.xlsx');
  const wb = XLSX.read(await readFile(await download.path()), { type: 'buffer' });
  const l = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  assert.deepEqual(l[0], ['Nº', 'Nome', 'P1 (valor 10)', 'P2 (valor 10)', 'Soma', 'Média (0 a 10)']);
  assert.deepEqual(l[1], ['01', '', 10, 6, 16, 8]);
  assert.deepEqual(l[2], ['02', '', 'falta', 10, 10, 10]);
  assert.deepEqual(erros, []);
  await ctx.close();
});

// ---------- plano 6: banco de questões ----------
test('banco de questões: guarda uma questão, acha na busca e usa em outra prova com o gabarito', async () => {
  const { ctx, page, erros } = await abrirApp();
  await criarProva(page, { nome: 'Origem', gabarito: 'ABCDE' });
  await page.$eval('#caderno-editor', d => { d.open = true; });
  await page.$eval('#cabecalho-prova', d => { d.open = true; });
  await page.fill('[data-cab="disciplina"]', 'Filosofia');
  const q = n => `#caderno-questoes [data-cq="${n}"]`;
  await page.fill(`${q(2)} textarea[data-campo="enunciado"]`, 'Para Sócrates, só sei que nada sei.');
  await page.check(`${q(2)} input[type=radio][value="D"]`);
  for (const a of 'ABCDE') await page.fill(`${q(2)} input[data-texto="${a}"]`, `alternativa ${a}`);
  await page.$eval('#banco', d => { d.open = true; });
  await page.fill('#banco-assunto', 'Filosofia antiga');
  await page.click(`${q(2)} [data-guardar]`);
  assert.match(await page.textContent('#banco-msg'), /Questão 3 guardada/);
  await page.click('#salvar-prova');
  await page.click('#nova-prova');
  await page.fill('#prova-nome', 'Destino');
  await page.fill('#prova-num', '1'); await page.dispatchEvent('#prova-num', 'change');
  await page.$eval('#caderno-editor', d => { d.open = true; });
  await page.$eval('#banco', d => { d.open = true; });
  await page.fill('#banco-busca', 'socrates');
  assert.match(await page.textContent('#banco-lista'), /Filosofia · Filosofia antiga.*Para Sócrates/s);
  await page.fill('#banco-busca', 'kant');
  assert.match(await page.textContent('#banco-lista'), /Nada encontrado/);
  await page.fill('#banco-busca', '');
  await page.click('#banco-lista [data-usar]');
  assert.match(await page.textContent('#banco-msg'), /como questão 1/);
  assert.equal(await page.inputValue(`${q(0)} textarea[data-campo="enunciado"]`), 'Para Sócrates, só sei que nada sei.');
  assert.equal(await page.getAttribute('#gabarito button[data-q="0"][data-alt="D"]', 'aria-pressed'), 'true');
  await page.click('#banco-lista [data-usar]'); // de novo: vira a questão 2
  assert.equal(await page.inputValue('#prova-num'), '2');
  await page.click('#salvar-prova');
  assert.match(await page.textContent('#prova-msg'), /Prova salva/);
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('modo pesquisa ligado numa prova com gabarito guarda o gabarito', async () => {
  const { ctx, page } = await abrirApp();
  await criarProva(page, { gabarito: 'EDCBAEDCBA' });
  await page.check('#prova-pesquisa');
  await page.click('#salvar-prova');
  const prova = await page.evaluate(() => { const a = JSON.parse(localStorage.getItem('correcao-v3')); return a.provas[a.ativa].prova; });
  assert.equal(prova.pesquisa, true);
  assert.equal(prova.versoes[0].gabarito.join(''), 'EDCBAEDCBA');
  await ctx.close();
});

test('o botão de tema troca entre claro e escuro e lembra a escolha', async () => {
  const { ctx, page, erros } = await abrirApp();
  const tema = () => page.evaluate(() => document.documentElement.dataset.tema);
  await page.click('#tema');
  assert.equal(await tema(), 'escuro');
  assert.equal(await page.getAttribute('#tema', 'aria-pressed'), 'true');
  await page.reload();
  assert.equal(await tema(), 'escuro');
  await page.click('#tema');
  assert.equal(await tema(), 'claro');
  assert.deepEqual(erros, []);
  await ctx.close();
});

test('elenco comenta a correção e some com o deboche desligado', async () => {
  const { ctx, page, erros } = await abrirApp();
  await criarProva(page);
  await page.click('#gabarito [data-anular="6"]');
  assert.match(await page.textContent('#fala-anulada'), /Coordenador Valdir.*questão 7 foi anulada/s);
  await page.click('#salvar-prova');
  await page.click('#aba-resultados');
  await page.click('#lista summary');
  await page.fill('#lista-turma', '2A');
  await page.fill('#lista-nomes', 'Ana\nBruno\nCarla\nDavi');
  await page.click('#salvar-lista');
  await fotografarECorrigir(page, '2A', '01', [...'ABCCCABCDE']); // 8 de 10 (Q7 anulada conta)
  assert.match(await page.textContent('#fala-leitura'), /Kevin do fundão/);
  assert.equal(await page.locator('#fala-leitura img').evaluate(i => i.complete && i.naturalWidth > 0), true);
  await page.click('#salvar-leitura');
  assert.match(await page.textContent('#cafe'), /Café da Prof.ª Neide: 75%.*Faltam 3 provas/s);
  await page.click('#aba-resultados');
  assert.match(await page.textContent('.termometro'), /7–8: Mandou bem.*1/s);
  assert.match(await page.textContent('#resultados'), /Prof.ª Neide.*Q4: só 0% acertaram/s);
  await page.click('#aba-corrigir');
  await page.click('#deboche label:has([value=desligado])');
  assert.match(await page.textContent('#cafe'), /Pilha da 2A.*Faltam 3 de 4/s); // só a conta, sem personagem
  assert.equal(await page.locator('#cafe img').count(), 0);
  await page.click('#aba-resultados');
  assert.match(await page.textContent('.termometro'), /7–8\s*1/);
  assert.equal(await page.locator('#resultados .fala, .termometro img').count(), 0);
  assert.deepEqual(erros, []);
  await ctx.close();
});
