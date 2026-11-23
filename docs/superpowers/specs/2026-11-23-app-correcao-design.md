# App de correção de provas objetivas: design

Data: 2026-11-23 · Pedido por: Tiago (professor)

## Intenção

O Tiago aplica provas objetivas no estilo ENEM (alternativas A a E) e corrige à mão. Ele quer um app que leia as folhas de resposta em papel e coloque o resultado numa planilha, sem digitar nada.

## Objetivos

- Cadastrar uma prova: nome, número de questões e gabarito.
- Gerar uma folha de respostas padrão para imprimir (a mesma folha para todos os alunos).
- Fotografar cada folha com o celular e ler as marcações na hora.
- Mostrar o resultado lido sobre a foto para o professor conferir e corrigir antes de salvar.
- Exportar uma planilha `.xlsx` com o resultado da turma.

## Não objetivos (v1)

- Nota TRI (exige calibração das questões; nota é por acertos).
- Várias versões da mesma prova (cores/tipos A, B, C...).
- Ler folhas de outros sistemas ou folhas já existentes.
- Contas, login, servidor, sincronização entre aparelhos.
- Envio de notas para o SEGES ou devolutiva para o aluno.
- Nomes dos alunos no app (a planilha sai pelo número de chamada).
- Guardar as fotos das folhas (só as respostas lidas são guardadas).

## Anti-objetivos

- Ler errado sem avisar. Uma folha nunca é salva sem o professor ver o que foi lido.
- Perder correções já feitas ao fechar a aba ou o celular apagar a tela.

## Restrições

- Roda no navegador do celular (Android e iPhone), sem instalar nada.
- Toda a leitura acontece no aparelho. Nenhuma foto sai do celular.
- Hospedagem estática gratuita (por exemplo GitHub Pages). Sem servidor, sem custo.
- Funciona com foto de celular em sala de aula: folha levemente torta, inclinada, luz irregular.
- As folhas provavelmente serão **fotocopiadas** (decisão do Claude: projetar para cópia, não só impressão direta): marcadores grandes e de alto contraste, tolerância a cópia clara/escura, pequena mudança de escala e pontinhos cinza.
- **Funciona sem internet** depois da primeira abertura (decisão do Claude: cache offline; evitar dependências pesadas como OpenCV.js, de ~8 MB, se a detecção própria for suficiente).

## Abordagens consideradas

1. **App web no celular (escolhida pelo Tiago).** Página estática; câmera do celular; leitura das bolinhas no próprio aparelho; exporta `.xlsx`. Prós: só um link, corrige em sala, sem custo. Contra: uma folha por foto.
2. **Programa no computador.** Pasta de fotos ou escaneamentos corrigidos em lote. Código mais simples e leitura mais robusta com scanner, mas exige computador e transferir as fotos.
3. **App nativo (Android/iOS).** Descartado: publicar em loja e manter dois apps é muito mais trabalho sem ganho real para o caso.

## Como funciona (decidido)

### 1. Prova
- Campos: nome da prova, número de questões (1 a 90), gabarito (uma letra A–E por questão).
- Uma questão pode ser marcada como **anulada**: conta como acerto para todos.
- A prova fica salva no aparelho (armazenamento local do navegador).
- Uma prova ativa por vez é suficiente na v1; ao criar outra, a anterior pode ser apagada após confirmação (exportar antes).

### 2. Folha de respostas
- Gerada pelo app em página pronta para imprimir (imprimir/salvar como PDF pelo navegador), tamanho A4.
- Contém: 4 marcadores pretos nos cantos (para endireitar a foto), nome da prova, linha para o aluno escrever o nome, **número de chamada em bolinhas (dois dígitos, 00–99)**, e as questões em colunas com bolinhas A–E.
- O layout depende só do número de questões. Instrução impressa: "pinte toda a bolinha com caneta preta ou azul".

### 3. Correção
- Antes de corrigir, o professor escolhe ou digita a **turma** (ex.: "2A"). A mesma prova pode ser aplicada em várias turmas; o resultado é identificado por turma + número de chamada (decisão do Claude, para evitar que o nº 05 da 2A sobrescreva o nº 05 da 2B).
- Botão "Corrigir folha" abre a câmera (foto única, não vídeo contínuo).
- O app acha os 4 marcadores, endireita a imagem e mede o quanto cada bolinha está preenchida.
- Regras de leitura por questão:
  - uma bolinha marcada → essa resposta;
  - nenhuma → **em branco** (errada);
  - duas ou mais → **dupla marcação** (errada, como no ENEM);
  - preenchimento ambíguo → marcada como **duvidosa** e destacada para conferência.
- Tela de conferência: a foto endireitada com as leituras desenhadas por cima (verde certo, vermelho errado, amarelo duvidoso/branco/dupla), o número de chamada lido e os acertos. O professor pode tocar numa questão para trocar a resposta lida e pode corrigir o número de chamada.
- Se os marcadores não forem encontrados, o app pede outra foto com uma dica ("enquadre a folha inteira").
- Se o número de chamada já tiver resultado salvo, o app avisa e pergunta se substitui.
- "Salvar" grava o resultado no aparelho imediatamente. São guardadas as respostas lidas, não a nota; assim, corrigir o gabarito ou anular uma questão depois recalcula todas as notas.

### 4. Resultados e planilha
- Lista por turma: número de chamada, acertos, e um aviso em quem teve leitura alterada manualmente.
- Dá para apagar ou refazer a correção de um aluno.
- Os dados ficam no navegador do celular, que pode apagá-los (o Safari do iPhone apaga dados de sites não visitados por ~7 dias). Por isso a **planilha exportada é o registro definitivo**: o app mostra um aviso "há correções não exportadas" até a planilha ser baixada (decisão do Claude).
- "Baixar planilha" gera `.xlsx` com uma aba por turma e, em cada aba, uma linha por aluno: Nº de chamada, resposta de cada questão (letra, ou "branco"/"dupla"), acertos, percentual, e uma nota de 0 a 10 (acertos ÷ total × 10, uma casa decimal). Primeira linha abaixo do cabeçalho com o gabarito.
- A planilha tem também uma aba **Análise**: para cada questão, o gabarito, o percentual de acerto (por turma e geral) e quantos alunos marcaram A, B, C, D, E, branco e dupla. (Acrescentado em 2026-11-23 após a pesquisa de apps parecidos.)

### 5. Testes
- A lógica de leitura (achar marcadores, endireitar, medir bolinhas, aplicar as regras) é testada com imagens sintéticas: gerar a folha, preencher bolinhas conhecidas, aplicar rotação, perspectiva, ruído e variação de luz, e conferir a leitura.
- Cálculo de nota e geração da planilha com testes unitários.
- Teste final com fotos reais: o Tiago fornece de 20 a 30 folhas **fotocopiadas** e preenchidas à mão (incluindo brancos, dupla marcação e marcação fraca), fotografadas na sala de aula.

## Deixado para quem construir

- Bibliotecas: como achar os marcadores e endireitar a imagem (OpenCV.js ou código próprio), como gerar o `.xlsx` (por exemplo SheetJS). Preferir o mínimo de dependências; tudo servido como arquivos estáticos.
- Limiares de preenchimento das bolinhas, calibrados nos testes.
- Visual das telas, desde que simples e usável com uma mão no celular.
- Estrutura do código e ferramenta de testes.
