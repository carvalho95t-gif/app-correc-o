# App de correção: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App web estático, usado no celular, que gera a folha de respostas, lê fotos das folhas preenchidas e exporta as notas em `.xlsx`.

**Architecture:** HTML + JavaScript com módulos ES, sem etapa de build. A lógica fica em módulos puros testáveis no Node: layout, leitura da imagem, nota, armazenamento e planilha. `app.js` só liga essas peças à tela. A leitura trabalha com uma imagem em tons de cinza `{width, height, data: Uint8Array}`, então os testes usam imagens sintéticas geradas em JS puro.

**Tech Stack:** JavaScript (ES2022, módulos), Node 22 `node --test`, Playwright (já instalado) para o teste ponta a ponta, SheetJS 0.18.5 `xlsx.mini.min.js` copiado para `vendor/` (só usado para escrever), service worker para funcionar offline.

**Spec:** `docs/superpowers/specs/2026-11-23-app-correcao-design.md`

## Global Constraints

- Interface toda em português do Brasil.
- Alternativas A–E; 1 a 90 questões; número de chamada com dois dígitos, de 00 a 99.
- Nenhuma foto sai do aparelho e nenhuma foto é guardada. Só as respostas lidas são salvas.
- Nenhum servidor. Só arquivos estáticos. Única dependência de runtime: `vendor/xlsx.mini.min.js`.
- Funciona sem internet depois da primeira abertura.
- Nota = acertos ÷ total × 10, com uma casa decimal. Questão anulada conta como acerto para todos.
- Branco e dupla marcação contam como erro. Leitura duvidosa precisa ser resolvida antes de salvar.
- Resultado identificado por `turma + número de chamada`.

## Review Focus

1. Foto com a folha sobre uma mesa escura ou com objetos escuros perto da borda: o app deve achar os 4 marcadores certos, ou recusar a foto, nunca ler com marcadores errados. Teste na Task 4.
2. Foto grande, de 12 MP: a leitura deve terminar em menos de 2 s no Node, porque a imagem é reduzida antes. Teste na Task 4.
3. Marcação fraca, de lápis ou com a bolinha meio pintada: deve virar "duvidosa", nunca "branco" sem aviso. Teste na Task 3.
4. Número de chamada em branco ou com marcação dupla: `numero` vira `null` e a tela exige digitar o número antes de salvar. Teste na Task 3 (leitura) e na Task 8 (tela).
5. Mudar o gabarito ou anular uma questão depois de corrigir: a nota na lista e na planilha é recalculada, porque o que fica salvo são as respostas. Mudar o número de questões com resultados salvos é recusado. Testes nas Tasks 6 e 7.

## Estrutura de arquivos

```
index.html        telas (prova, folha, corrigir/conferir, resultados)
style.css
app.js            liga a tela aos módulos (sem lógica de negócio)
sw.js             cache offline
manifest.webmanifest
src/layout.js     geometria da folha em mm
src/folha.js      SVG da folha para impressão
src/leitor.js     achar marcadores, homografia, ler bolinhas
src/nota.js       cálculo da nota
src/estado.js     estado e localStorage
src/planilha.js   monta o workbook
vendor/xlsx.mini.min.js
test/sintetico.js gera fotos sintéticas da folha (só teste)
test/*.test.js
test/e2e.test.js  Playwright
```

---

### Task 1: Projeto e layout da folha

**Files:**
- Create: `package.json` (`"type": "module"`, script `"test": "node --test test/"`), `.gitignore`, `src/layout.js`
- Test: `test/layout.test.js`

**Interfaces:**
- Produces: `montarLayout(numQuestoes: number) -> Layout`, onde todas as medidas estão em mm, numa página A4 de 210 × 297:
  ```
  Layout = {
    pagina: {w: 210, h: 297},
    marcadorLado: 10,
    marcadores: [{x,y}×4],        // centros na ordem TL, TR, BR, BL: (15,15) (195,15) (195,282) (15,282)
    raio: 2.2,                     // raio da bolinha
    numero: [[{x,y}×10], [{x,y}×10]], // dezena e unidade, dígitos 0..9
    questoes: [[{x,y}×5], ...]     // uma entrada por questão, alternativas A..E
  }
  ```
- Valores fixos: número de chamada nas colunas x = 150 e x = 157, com o dígito d em y = 40 + 6d. Questões em até 3 colunas de 30, com início em x0 = 25, 85 e 145. A questão i da coluna fica em y = 110 + 5.5i, e a alternativa j em x = x0 + 8 + 6j.

- [ ] **Step 1: Escrever os testes que falham.** `montarLayout(90)` tem 90 questões, cada uma com 5 posições. A questão 0 tem A em (33,110). A questão 89 tem E em (177, 110+29·5.5). Nenhuma bolinha encosta num marcador (distância > 5 + raio). `montarLayout(0)` e `montarLayout(91)` lançam `RangeError`. `montarLayout(10)` tem 10 questões, todas na primeira coluna.
- [ ] **Step 2:** `npm test`. Resultado esperado: FAIL (módulo não existe).
- [ ] **Step 3: Implementar `montarLayout`** em `src/layout.js`.
- [ ] **Step 4:** `npm test`. Resultado esperado: PASS.
- [ ] **Step 5:** `git init` já feito; commit `feat: layout da folha de respostas`.

### Task 2: Cálculo da nota

**Files:** Create `src/nota.js`; Test `test/nota.test.js`

**Interfaces:**
- Produces: `corrigir(gabarito: string[], anuladas: number[], respostas: string[]) -> {acertos, total, percentual, nota}`. Cada resposta é `'A'..'E' | 'branco' | 'dupla'`. `percentual` é inteiro de 0 a 100, arredondado. `nota` é um número com uma casa decimal.

- [ ] **Step 1: Testes.** Com o gabarito `['A','B','C','D']`, as respostas `['A','B','branco','dupla']` dão `{acertos:2,total:4,percentual:50,nota:5}`. Com `anuladas:[2]`, as mesmas respostas dão 3 acertos e nota 7.5. Com 3 questões e 1 acerto, a nota é `3.3`. Se o tamanho das respostas for diferente do gabarito, lança `Error`.
- [ ] **Step 2:** `npm test`. Resultado esperado: FAIL.
- [ ] **Step 3: Implementar.**
- [ ] **Step 4:** `npm test`. Resultado esperado: PASS.
- [ ] **Step 5:** Commit `feat: cálculo da nota`.

### Task 3: Leitura das bolinhas com marcadores conhecidos

**Files:** Create `src/leitor.js`, `test/sintetico.js`; Test `test/leitor.test.js`

**Interfaces:**
- Consumes: `montarLayout` (Task 1).
- Produces, em `src/leitor.js`:
  - `homografia(origem: {x,y}[4], destino: {x,y}[4]) -> number[9]` e `aplicar(H, x, y) -> {x,y}`.
  - `classificar(preenchimentos: number[5]) -> {marca: 'A'..'E'|'branco'|'dupla', duvidosa: boolean}`. As constantes exportadas são `MARCADO = 0.45` e `VAZIO = 0.20`. Quem tem ≥ MARCADO conta como marcado: 1 marcado dá a letra, 0 dá `'branco'` e 2 ou mais dão `'dupla'`. Se algum valor estiver entre VAZIO e MARCADO, `duvidosa = true`. Os limiares podem ser ajustados na Task 4, mantendo os nomes.
  - `lerComMarcadores(cinza, layout, marcadoresPx: {x,y}[4]) -> Leitura`
    ```
    Leitura = { numero: '00'..'99' | null, numeroDuvidoso: boolean,
                respostas: [{marca, duvidosa, preenchimentos:number[5]}],
                marcadoresPx }
    ```
    `numero` é `null` quando alguma coluna do número fica em branco ou com dupla marcação.
- Medida do preenchimento: mapear mm para px com `homografia(layout.marcadores, marcadoresPx)`. O nível da tinta é a mediana dos pixels dentro dos marcadores, e o nível do papel é a mediana de uma faixa de pixels entre as colunas. O limiar fica no meio dos dois. O preenchimento é a fração dos pixels amostrados dentro de `0.7 × raio` que ficam mais escuros que o limiar. Isso mantém a leitura igual em cópias claras e escuras.
- `test/sintetico.js` (só para teste): `gerarFoto(layout, marcas, opcoes) -> cinza`. `marcas = {numero:'05', respostas: ['A', null, ['A','B'], {letra:'C', fracao:0.3}, ...]}`, em que `null` é branco, um array é dupla marcação e `fracao` pinta só parte da bolinha. `opcoes = {pxPorMm=4, rotacaoGraus=0, perspectiva=0, papel=235, tinta=25, ruido=0, gradiente=0, fundo=null, largura, altura}`. O gerador percorre cada pixel de saída, faz o mapeamento inverso para mm e pinta marcador, contorno da bolinha (anel fino), bolinha cheia ou papel. Depois aplica gradiente e ruído. `fundo` define a cor fora da folha. Função auxiliar `cantosPx(...)`: devolve onde ficaram os centros dos marcadores, para a Task 3 não depender da Task 4.

- [ ] **Step 1: Testes.** Folha sintética reta com 20 questões, `numero:'05'`, respostas conhecidas com A..E, branco e dupla. `lerComMarcadores` com `cantosPx` acerta todas as marcas e o número `'05'`. Marcação com `fracao:0.3` dá `duvidosa:true`. Número com a coluna da unidade em branco dá `numero:null`. `classificar([0,0.9,0,0,0])` dá `{marca:'B',duvidosa:false}`, e `classificar([0.3,0,0,0,0])` dá `{marca:'branco',duvidosa:true}`. Mesma folha com `papel:200, tinta:70` (cópia clara) dá as mesmas respostas.
- [ ] **Step 2:** `node --test test/leitor.test.js`. Resultado esperado: FAIL.
- [ ] **Step 3: Implementar** `homografia` (sistema linear 8×8 por eliminação de Gauss), `aplicar`, `classificar` e `lerComMarcadores`.
- [ ] **Step 4:** `node --test test/leitor.test.js`. Resultado esperado: PASS.
- [ ] **Step 5:** Commit `feat: leitura das bolinhas`.

### Task 4: Achar os marcadores numa foto

**Files:** Modify `src/leitor.js`; Test `test/marcadores.test.js`

**Interfaces:**
- Produces:
  - `paraCinza(imageData: {width,height,data: RGBA}) -> cinza`.
  - `acharMarcadores(cinza) -> {x,y}[4] | null`, na ordem TL, TR, BR, BL, em pixels da imagem original.
  - `lerFolha(cinza, layout) -> Leitura | null`. Retorna `null` quando não acha os marcadores.
- Abordagem: reduzir a imagem para no máximo 1000 px no lado maior, binarizar com Otsu e achar componentes conexos (BFS com pilha, sem recursão). Candidato a marcador: proporção da caixa entre 0.6 e 1.6, ≥ 75% da caixa preenchida e área entre 1/5000 e 1/50 da imagem. Escolher os 4 candidatos que formam o quadrilátero convexo de maior área. Aceitar o resultado só se a razão entre os lados ficar a ±25% de 180/267. Depois ler com `lerComMarcadores` na imagem em resolução cheia.

- [ ] **Step 1: Testes** com `gerarFoto`, 45 questões e respostas aleatórias com semente fixa. Cada caso deve ler 100% das respostas:
  - reta;
  - girada 8°;
  - com perspectiva 0.15;
  - com ruído 20 e gradiente 60;
  - cópia escura (`papel:180, tinta:20`);
  - folha ocupando 60% de uma foto com `fundo:40` e 3 retângulos escuros soltos perto das bordas (Review Focus 1);
  - foto de 4000 × 3000 lida em menos de 2000 ms (Review Focus 2).
  Uma imagem toda cinza, ou uma folha com um marcador apagado, devolve `null`.
- [ ] **Step 2:** `node --test test/marcadores.test.js`. Resultado esperado: FAIL.
- [ ] **Step 3: Implementar.** Se algum caso falhar por causa dos limiares, ajustar `MARCADO`/`VAZIO` e rodar a Task 3 de novo.
- [ ] **Step 4:** `npm test`. Resultado esperado: PASS (todas as tasks até aqui).
- [ ] **Step 5:** Commit `feat: localizar marcadores na foto`.

### Task 5: Folha para imprimir

**Files:** Create `src/folha.js`; Test `test/folha.test.js`

**Interfaces:**
- Produces: `folhaSVG(layout, nomeProva: string) -> string`. É um SVG com `viewBox="0 0 210 297"`, `width="210mm" height="297mm"`. Tem 4 `<rect>` pretos de marcador. Cada bolinha é um `<circle>` com contorno, a letra dentro, `data-q="<índice>" data-alt="<A..E>"` (e `data-dig` para o número). Inclui o nome da prova (texto escapado), a linha "Nome:", o número de cada questão e a instrução exata "Pinte toda a bolinha com caneta preta ou azul."

- [ ] **Step 1: Testes.** `folhaSVG(montarLayout(30), 'Simulado <1>')` tem 150 círculos `data-q`, 20 `data-dig` e 4 marcadores. Contém `Simulado &lt;1&gt;`. Contém a frase da instrução.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: folha de respostas em SVG`.

### Task 6: Estado e armazenamento

**Files:** Create `src/estado.js`; Test `test/estado.test.js`

**Interfaces:**
- Produces:
  ```
  Estado = { prova: {nome, gabarito: string[], anuladas: number[]} | null,
             resultados: { [chave]: {turma, numero, respostas: string[], editado: boolean, salvoEm: ISOString} },
             exportadoEm: ISOString | null, alteradoEm: ISOString | null }
  ```
  - `chave(turma, numero) -> string`: `turma.trim().toUpperCase() + '|' + numero`.
  - `carregar(storage) -> Estado` usa a chave `'correcao-v1'`. Se estiver vazio ou com JSON inválido, devolve o estado inicial e não lança erro.
  - `salvar(storage, estado)`.
  - `definirProva(estado, prova) -> Estado`. Lança `Error('Já há correções com outro número de questões. Exporte e apague antes.')` quando há resultados salvos e o tamanho do gabarito muda (Review Focus 5).
  - `registrar(estado, resultado) -> Estado`: atualiza `alteradoEm`.
  - `remover(estado, chave) -> Estado`.
  - `marcarExportado(estado) -> Estado`.
  - `temNaoExportado(estado) -> boolean`, que é verdadeiro quando `alteradoEm > exportadoEm`.
  - `apagarTudo() -> Estado`.
  As funções não alteram o estado recebido.
- `storage` é qualquer objeto com `getItem`/`setItem`. Nos testes, um objeto simples. No app, `localStorage`.

- [ ] **Step 1: Testes.** O estado salvo é igual ao carregado. JSON inválido dá o estado inicial. `chave(' 2a ','05')` dá `'2A|05'`. Mudar o gabarito de 10 para 12 questões com resultados salvos lança erro. Mudar uma letra do gabarito é aceito. `temNaoExportado` fica verdadeiro depois de `registrar` e falso depois de `marcarExportado`.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: estado e armazenamento local`.

### Task 7: Planilha

**Files:** Create `src/planilha.js`, `vendor/xlsx.mini.min.js` (copiado de `xlsx@0.18.5/dist`); Test `test/planilha.test.js`

**Interfaces:**
- Consumes: `corrigir` (Task 2) e `Estado` (Task 6).
- Produces: `montarPlanilha(XLSX, estado) -> Workbook`. Cria uma aba por turma, com o nome da turma e as abas em ordem alfabética. Cabeçalho: `Nº`, `Q1`…`Qn`, `Acertos`, `%`, `Nota`. Segunda linha: `Gabarito`, as letras (anulada aparece como `ANULADA`) e células vazias. Depois uma linha por aluno, em ordem de número, com o número como texto `'05'` e as respostas como estão salvas (`'branco'`/`'dupla'`). A nota é calculada na hora com `corrigir`. Por último vem a aba `Análise`, com uma linha por questão e as colunas `Questão`, `Gabarito`, `% acerto geral`, `% acerto <turma>` (uma por turma), `A`, `B`, `C`, `D`, `E`, `Branco` e `Dupla` (contagens). O nome do arquivo vem de `nomeArquivo(prova) -> string`: o nome da prova sem caracteres inválidos, mais `.xlsx`.

- [ ] **Step 1: Testes** (carregar o vendor com `createRequire`). Com 2 turmas, o workbook tem as abas `[turma1, turma2, 'Análise']`. Na Análise, com 4 alunos dos quais 3 acertam a Q1 e 1 deixa em branco, a Q1 tem `% acerto geral` 75 e `Branco` 1. Uma linha de aluno tem as respostas e a nota corretas. Gerar um buffer com `XLSX.write(wb,{type:'buffer'})` e ler de volta dá os mesmos valores. Mudar o gabarito no estado e montar de novo muda a nota (Review Focus 5).
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** PASS.
- [ ] **Step 5:** Commit `feat: exportação da planilha`.

### Task 8: Telas

**Files:** Create `index.html`, `style.css`, `app.js`; Test `test/e2e.test.js`. Mudar o script `test` para `node --test test/*.test.js` e incluir o e2e.

**Interfaces:**
- Consumes: todas as tasks anteriores. `XLSX` vem como global, por `<script src="vendor/xlsx.mini.min.js">`.
- Telas, todas na mesma página, com abas no rodapé:
  1. **Prova:** campos para nome e número de questões. Para cada questão, uma linha de botões A–E e a opção "anular". Botão "Salvar prova". Botão "Nova prova", que avisa se há algo não exportado e pede confirmação.
  2. **Folha:** mostra `folhaSVG` e o botão "Imprimir". A regra `@media print` mostra só a folha.
  3. **Corrigir:** campo "Turma" (lembra a última digitada) e botão "Fotografar folha", um `<input type="file" accept="image/*" capture="environment">`. A foto passa por canvas, `paraCinza` e `lerFolha`. Se der `null`, aparece a mensagem "Não encontrei os 4 quadrados pretos. Enquadre a folha inteira e tente de novo."
     **Conferência:** mostra a foto endireitada (o canvas desenhado com `aplicar`) e círculos coloridos por cima: verde para certo, vermelho para errado e amarelo para duvidosa, branco ou dupla. Tem o número de chamada editável e a contagem de acertos. Tocar numa questão abre um seletor com A–E, branco e dupla. Quando o professor troca uma resposta, ela marca `editado:true`. "Salvar" fica desativado enquanto houver questão duvidosa sem resolver ou o número estiver vazio (Review Focus 4). Se a chave já existir, um `confirm` pergunta se substitui.
  4. **Resultados:** abas por turma, cada uma com Nº, acertos e nota, um sinal ✎ quando `editado`, e botões para apagar ou refazer. Botão "Baixar planilha", que usa `XLSX.writeFile` e chama `marcarExportado`. Enquanto `temNaoExportado` for verdadeiro, aparece em todas as telas a faixa "Há correções não exportadas".

- [ ] **Step 1: Teste e2e com Playwright.** Servir a pasta com `http.createServer` dentro do teste e usar um viewport de celular, 390 × 844.
  - Criar a prova "Teste" com 10 questões e o gabarito `ABCDEABCDE`.
  - Abrir Folha. Com `page.evaluate`, preencher os círculos de resposta (`fill=black`), tanto `data-q` quanto `data-dig`, para o número 07, com acertos em 8 questões. Tirar o screenshot do SVG.
  - Em Corrigir, digitar turma 2A e usar `setInputFiles` com o screenshot. A conferência mostra "8 de 10" e o número 07. Salvar.
  - Em Resultados, aparece a linha 07 com nota 8,0 e a faixa de não exportado. Baixar a planilha. O download, lido com XLSX, tem a aba `2A`, e a faixa some.
  - Repetir com o número de chamada apagado: o Salvar fica desativado até digitar o número.
- [ ] **Step 2:** `node --test test/e2e.test.js`. Resultado esperado: FAIL.
- [ ] **Step 3: Implementar** as telas.
- [ ] **Step 4:** `npm test`. Resultado esperado: PASS.
- [ ] **Step 5:** Commit `feat: telas do app`.

### Task 9: Funcionar sem internet

**Files:** Create `sw.js` e `manifest.webmanifest`. Modify `index.html`: registrar o service worker e linkar o manifest. Test: estender `test/e2e.test.js`.

**Interfaces:** `sw.js` faz cache-first, com a versão do cache em `const VERSAO = 'v1'`. Na instalação, faz pré-cache de todos os arquivos estáticos da estrutura acima, menos `test/` e `docs/`.

- [ ] **Step 1: Teste.** Abrir o app, esperar `navigator.serviceWorker.ready`, chamar `context.setOffline(true)` e recarregar. A tela Prova aparece e a prova salva continua lá.
- [ ] **Step 2:** FAIL. **Step 3:** Implementar. **Step 4:** `npm test`. Resultado esperado: PASS.
- [ ] **Step 5:** Commit `feat: funcionamento offline`.

### Depois do plano (não é task de código)

- Publicar no GitHub Pages: precisa de um repositório do Tiago.
- Validar com 20 a 30 folhas reais fotocopiadas e preenchidas pelo Tiago. Ajustar os limiares se precisar, adicionando as fotos que falharem como casos de teste.
