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
  assert.match(texto, /1\..*Enunciado da questão 1 <b>/s);
  assert.match(texto, /B\).*opção B1/s);
  assert.match(await page.innerHTML('#caderno'), /questão 1 &lt;b&gt;/); // texto digitado não vira HTML
  assert.ok(await page.isVisible('#imprimir-caderno'));
  assert.equal(await page.locator('#folha svg').count(), 1);
  await ctx.close();
});

test('impressão: folha em 1 página e caderno curto + folha em 2 páginas', async () => {
  const paginas = pdf => (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  const { ctx, page } = await abrirApp();
  await criarProva(page, { gabarito: 'ABCDE' });
  await page.click('#aba-folha');
  assert.equal(paginas(await page.pdf({ preferCSSPageSize: true })), 1);
  await page.click('#aba-prova');
  await page.click('#caderno-editor summary');
  for (let i = 0; i < 5; i++) await page.fill(`#caderno-questoes [data-cq="${i}"] textarea`, 'Texto '.repeat(40));
  await page.click('#salvar-prova');
  await page.click('#aba-folha');
  await page.evaluate(() => { document.querySelector('#folha').before(document.querySelector('#caderno')); document.body.classList.add('com-caderno'); });
  assert.equal(paginas(await page.pdf({ preferCSSPageSize: true })), 2);
  await ctx.close();
});
