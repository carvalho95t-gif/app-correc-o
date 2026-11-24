# Spec: Prova impressa no modelo do Tiago, com quadro de gabarito estilo Gradepen

**Status:** ready-for-agent

Pedido do Tiago em 2026-11-24, depois do estudo de EvalBee e Gradepen (`/mnt/project-files/app-correcao/docs/estudo-apps/`). Modelo do corpo da prova: a prévia "Avaliação de Recuperação Final – Filosofia – 2ª série – 2026" que ele enviou. Modelo do gabarito: a página 1 do PDF real do Gradepen (quadro com QR code e bolinhas). Ele pediu "OMR e QR code juntos".

## Problem Statement

O caderno de prova que o app imprime hoje é uma lista simples: título, uma linha de nome e as questões numeradas, seguido de uma folha de respostas em página separada. O professor monta as provas reais num editor de texto, com cabeçalho da escola, tabela de identificação, instruções, questões com texto-base, fonte e comando em negrito, e gabarito comentado no fim. Depois precisa refazer o gabarito no app. A folha de respostas separada também gasta uma página a mais por aluno.

## Solution

O app imprime a prova inteira no modelo do professor:

- **Página 1**: cabeçalho da escola (até 4 linhas, a última maior), título e subtítulo da prova, tabela de identificação (Estudante; Professor, Turma, Data; Disciplina, Série, Nota / valor), caixa cinza "Instruções ao estudante" e, no lugar do cartão-resposta, o **quadro do gabarito** no estilo Gradepen: moldura dupla, a frase "Marque o gabarito preenchendo completamente a região de cada alternativa.", à esquerda um **QR code** com a prova e a versão, à direita as **bolinhas** das questões e do número de chamada entre quatro marcadores, e no rodapé "Prova: código.versão". Abaixo, "Assinatura do estudante" e "Visto do(a) professor(a)".
- **Questões**: "QUESTÃO 01 (5,0 pontos)", texto-base recuado e justificado, fonte em itálico à direita, comando em negrito, alternativas "a)" a "e)" com a letra em negrito. Cabeçalho corrido com o nome curto da prova e o número da página.
- A leitura pela câmera acha o quadro na página 1, lê o QR para saber a prova e a versão, e lê as bolinhas como hoje.

## User Stories

1. As a professor, I want to type the cabeçalho da escola once (governo, secretaria, escola), so that every prova comes out with it.
2. As a professor, I want the last line of the cabeçalho (the school name) larger and in bold, so that it looks like my provas.
3. As a professor, I want to set the título (ex.: "Avaliação de Recuperação Final") and the subtítulo (ex.: "Filosofia – 2ª série do Ensino Médio – 2026"), so that the prova says what it is.
4. As a professor, I want my name, the disciplina and the série printed already filled in the identification table, so that students only write their name, turma and date.
5. As a professor, I want the Nota cell to show "_____ / valor", using the prova's valor, so that the total is clear.
6. As a professor, I want the instruções to be written by the app from the prova (number of questões, alternativas, pontos per questão, total), so that they are always right.
7. As a professor, I want to edit or add instruções, so that I can add rules like "o tempo de prova será informado".
8. As a professor, I want the quadro do gabarito on page 1, so that the student doesn't need a separate folha.
9. As a professor, I want the quadro to have a QR code with the prova and the versão, so that the app knows which gabarito to use.
10. As a professor, I want the quadro to show "Prova: código.versão" in text, so that I can tell versões apart by eye.
11. As a professor, I want the quadro to keep the número de chamada bubbles, so that each nota lands on the right aluno in the planilha.
12. As a professor, I want the bubbles of the quadro to use the prova's alternativas, so that A–D and C/E provas still work.
13. As a professor, I want the quadro to fit up to 30 questões, so that my usual provas (10 to 20 questões) fit on page 1 with the header.
14. As a professor, I want the app to tell me when a prova has too many questões for the quadro, so that I print the separate folha instead.
15. As a professor, I want lines for "Assinatura do estudante" and "Visto do(a) professor(a)" under the quadro, so that it matches my model.
16. As a professor, I want each questão to have a texto-base, a fonte, a comando and the alternativas, so that it prints like an ENEM questão.
17. As a professor, I want the fonte in small italic aligned to the right under the texto-base, so that it looks like my model.
18. As a professor, I want the comando in bold, so that students find what is being asked.
19. As a professor, I want the alternativas as "a)" to "e)" with the letter in bold, so that it looks like my model.
20. As a professor, I want "QUESTÃO 01" with the pontos next to it, using the questão's peso, so that students see what each questão is worth.
21. As a professor, I want a running header with the short name of the prova and the page number on pages 2 onwards, so that loose pages can be put back in order.
22. As a professor, I want to set the short name used in the running header, so that it fits on one line.
23. As a professor, I want a questão to stay together when it fits on a page, so that the texto-base and the alternativas are not split without need.
24. As a professor, I want images in the texto-base to keep working, so that questões with figures still print.
25. As a professor, I want my old questões (only enunciado and alternativas) to print as texto-base without fonte and comando, so that nothing I typed is lost.
26. As a professor, I want to give each questão a habilidade (ex.: EM13CHS204), a trimestre and a comentário, so that the gabarito comentado is generated.
27. As a professor, I want to choose whether to print the gabarito comentado, so that I don't print it by mistake for students.
28. As a professor, I want the gabarito comentado on its own pages with "Gabarito comentado – uso exclusivo do professor" in the running header, so that I can remove it before photocopying.
29. As a professor, I want the gabarito comentado to have the answer table, the table of habilidades and the comentário of each questão, so that it matches my model.
30. As a professor, I want each versão to be printed in full (page 1 with its own QR and the questões in that versão's order), so that I can photocopy each versão.
31. As a professor, I want the gabarito comentado to show the answers of every versão, so that I can check any folha by hand.
32. As a professor, I want the app to read the QR code in the photo, so that it picks the prova and versão by itself.
33. As a professor, I want the app to read page 1 photographed whole, with the questões text around the quadro, so that I don't have to cut anything.
34. As a professor, I want folhas printed before this change (separate folha with the code strip) to keep being read, so that provas already applied still work.
35. As a professor, I want the app to fall back to the active prova when the QR can't be read, so that a smudged QR doesn't block the correção.
36. As a professor, I want the conferência after reading the quadro to be the same as today, so that I review before saving.
37. As a professor, I want the live camera to recognise the quadro too, so that I keep correcting a pile in a row.
38. As a professor, I want all of this to work offline, so that I can correct in a classroom without internet.

## Implementation Decisions

- **Two kinds of folha.** The existing folha de respostas (whole A4 page, code strip) stays as the "folha avulsa". A new "quadro" layout describes the gabarito box on page 1, in its own coordinate system (mm, origin at the top-left of the box). Both are produced by the layout module and read by the same reading code: the reading code already works from four marcadores to a layout via a homography, so the quadro only needs its own geometry and its own aspect ratio for the marcadores check.
- **Marcadores of the quadro.** Four solid squares at the corners of the bubble area, larger than any solid square inside the QR code (the QR's inner finder squares must stay below the 30% size cut used to discard small candidates). The aspect-ratio check of the marcadores takes the expected ratio from the layout instead of the fixed A4 ratio.
- **Finding the quadro among text.** Text glyphs and the QR modules are much smaller than the marcadores, so the existing size filter discards them. The QR sits outside the four marcadores, so the corner pick is not affected by it.
- **QR code content.** A short text: an app prefix, the código da prova and the versão (ex.: `AC1:123:B`). Encoded with a vendored QR generator (qrcode-generator, MIT) as SVG paths, so it prints sharp and works offline.
- **QR reading.** Use the browser's BarcodeDetector when it supports QR (Android Chrome), otherwise a vendored decoder (jsQR, Apache-2.0) on the photo. If no QR is found, fall back to the active prova, as with unreadable code strips today.
- **Versões.** The QR carries the versão, so the quadro has no versão bubbles. The existing limit of 4 versões (A–D) stays for now; one-versão-per-aluno is a separate item of the plan.
- **Prova data.** New optional fields on the prova: cabeçalho (lines of the escola), título, subtítulo, nome curto, professor, disciplina, série, extra instruções, and a flag for the gabarito comentado. New optional fields on each questão of the caderno: fonte, comando, habilidade, trimestre, comentário. The existing enunciado becomes the texto-base. Old provas load unchanged. These fields go in the backup/planilha restore like the rest of the caderno.
- **Printing.** The caderno module produces the whole prova as HTML pages for the browser's print, single column, A4, serif font, with CSS paged-media margin boxes for the running header and page number. The quadro is an SVG inside page 1. The gabarito comentado starts on a new page with its own running header.
- **Too many questões.** The quadro holds up to 30 questões (3 columns of 10, like the cartão-resposta of the model). Above that, the app prints the old separate folha and says so.
- **Editor.** The caderno editor gets fields for fonte, comando, habilidade, trimestre and comentário per questão, and a "Cabeçalho da prova" section. Fields are optional and collapsed by default on the phone.

## Testing Decisions

- Good tests check what the professor sees or gets: the printed HTML/SVG contains the expected texts and elements, and a synthetic photo of page 1 is read back to the right número, marcações, prova and versão. No tests of internal helpers.
- Prior art: `test/leitura.test.js` and `test/sintetico.js` render a folha and read it back; `test/app.test.js` checks the caderno HTML. The new tests follow the same pattern: render page 1 with text around the quadro, rasterise, read.
- QR: test that the generated QR decodes back (with the vendored decoder) to the same prova and versão, and that a page with no QR falls back to the active prova.
- Old folhas: the existing reading tests must keep passing unchanged.

## Out of Scope

- Gabarito comentado: o Tiago recusou em 2026-11-24 (stories 26–29 e 31 saem).

- One versão per aluno (more than 4 versões) and choosing what to shuffle: separate item of the plan.
- Two-column layout and other print styles of the Gradepen (econômico, letra grande).
- Partial pontuação per alternativa, conceitos, análise na tela: separate items.
- A link or page for students to check their answers.
- Generating PDF files: the app uses the browser's print, where the professor can save as PDF.

## Further Notes

- The model PDFs are in `/mnt/project-files/app-correcao/docs/estudo-apps/` (Gradepen example) and the Tiago's upload (Recuperação Final). Do not copy Gradepen's code or assets; only the layout idea.
- Decision pending from Tiago at spec time: keep the número de chamada bubbles in the quadro (recommended, assumed here) or drop them like the Gradepen.
