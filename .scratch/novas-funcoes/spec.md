# Spec: Novas funções após a comparação com EvalBee e Gradepen

**Status:** ready-for-agent

Approved by Tiago on 2026-11-24, from the comparison in `docs/research/2026-11-24-evalbee-gradepen.md`. He approved items 1, 2, 4, 5, 6 and 7 and declined 3 (nota de dissertativas) and 8 (WhatsApp link).

## Problem Statement

Correcting in class still takes one photo and one confirmation per folha. Every questão is worth the same, so a prova with harder questões can't be weighted. Nothing on the folha says which prova it belongs to, so a folha can be corrected against the wrong gabarito. The planilha shows no nota per área, such as Linguagens and Matemática. Provas with A–D, C/E or V/F questões can't be graded. Different versões have to be put together by hand outside the app, and so do their gabaritos.

## Solution

- **Câmera ao vivo.** The professor points the phone at the folha. The app captures it by itself once the four marcadores are steady, beeps and vibrates, and opens the conferência. After saving, it returns to the camera for the next folha.
- **Peso por questão.** Each questão has a peso, 1 by default. The nota uses the pesos.
- **Código da prova on the folha.** A strip of black squares identifies the prova and, when it applies, the versão. The app picks the right prova by itself. It asks before correcting against a prova other than the active one.
- **Áreas.** Named ranges of questões, for example "Linguagens 1–45". The planilha shows acertos and % for each área.
- **Alternativas.** Each prova chooses its alternativas: A–E, A–D, A–C, A–B, C/E or V/F.
- **Caderno de prova.** The professor types or pastes each questão (enunciado, optional image, alternativas) and prints the caderno. Optionally, the app shuffles the order of the questões and of the alternativas into up to 4 versões. Each versão gets its own gabarito automatically, and its own folha with the versão in the código.

## User Stories

1. As a professor, I want to tap "Corrigir com a câmera" and just point the phone at the folha, so that I don't have to take and confirm each photo.
2. As a professor, I want a beep and a vibration when the folha is captured, so that I know I can lower the phone.
3. As a professor, I want the capture to wait until the folha is steady, so that the photo is not blurred.
4. As a professor, I want to see on the screen whether the four marcadores are found, so that I know how to frame the folha.
5. As a professor, I want the camera to come back after I save, so that I can correct a pile of folhas in a row.
6. As a professor, I want to keep the "Tirar foto" option, so that I can still correct when live capture doesn't work on my phone.
7. As a professor, I want the conferência after a live capture to be the same as after a photo, so that no folha is saved without my review.
8. As a professor, I want the camera to turn off when I leave the Corrigir tab, so that it doesn't drain the battery.
9. As a professor, I want to give a peso to each questão, with 1 by default, so that harder questões count more.
10. As a professor, I want to set the same peso for a range of questões at once, so that I don't type 90 numbers.
11. As a professor, I want the nota to be valor × pontos obtidos ÷ pontos possíveis, so that the pesos change the nota as expected.
12. As a professor, I want an anulada questão to give its full peso to everyone, so that anulação keeps working with pesos.
13. As a professor, I want the planilha to show pontos next to acertos when pesos are not all 1, so that I can explain the nota to a student.
14. As a professor, I want to change the pesos after correcting, so that all notas are recalculated.
15. As a professor, I want each printed folha to carry a código da prova, so that the app knows which prova it is.
16. As a professor, I want the app to ask "Esta folha é da prova X. Corrigir nela?" when the código names another stored prova, so that I don't grade with the wrong gabarito.
17. As a professor, I want the app to warn me when the código names a prova that is not on this phone, so that I notice before saving.
18. As a professor, I want folhas without a readable código, including folhas printed before this change, to be corrected against the active prova, so that old folhas still work.
19. As a professor, I want a versão in the código to take priority over the versão bubbles, so that a student can't mark the wrong versão.
20. As a professor, I want to define áreas with a name and a range of questões, so that I can see the result by área like the ENEM.
21. As a professor, I want the app to refuse overlapping áreas or ranges beyond the last questão, so that the áreas are consistent.
22. As a professor, I want acertos and % for each área in the turma aba, so that I can see where each aluno is weak.
23. As a professor, I want the average % per área for each turma in the Resumo, so that I can compare turmas.
24. As a professor, I want to choose the alternativas of a prova (A–E, A–D, A–C, A–B, C/E or V/F), so that I can grade other kinds of provas.
25. As a professor, I want the folha to print only the alternativas of the prova, so that students can't mark a letter that doesn't exist.
26. As a professor, I want the gabarito buttons, the conferência and the planilha to use the prova's alternativas, so that everything is consistent.
27. As a professor, I want the app to refuse changing the alternativas when correções exist, so that saved correções are not corrupted.
28. As a professor, I want to type or paste each questão of the caderno with its enunciado and alternativas, so that the app can print the prova itself.
29. As a professor, I want to add an image to a questão, so that questões with graphs and figures work.
30. As a professor, I want images to be shrunk on the phone, so that the caderno doesn't fill the phone's storage.
31. As a professor, I want to mark the gabarito inside the caderno editor, so that I enter each questão and its answer together.
32. As a professor, I want to print the caderno with the prova name, a line for the aluno's name and numbered questões, so that it is ready to photocopy.
33. As a professor, I want to choose 1 to 4 versões and whether to shuffle the questões, the alternativas or both, so that students sitting side by side get different provas.
34. As a professor, I want each versão's gabarito to be generated by the app, so that I never type a shuffled gabarito by hand.
35. As a professor, I want each versão to be printed with its own folha, with the versão in the código, so that the folhas can't be mixed up.
36. As a professor, I want the shuffle to stay the same once I've printed, so that reprinting gives the same versões.
37. As a professor, I want to shuffle again only on purpose, and with a warning when correções exist, so that I don't break saved correções.
38. As a professor, I want the Análise of a shuffled prova to be per original questão, gathering all versões, so that I see which content the class missed.
39. As a professor, I want pesos and áreas to follow the original questão in every versão, so that a shuffled questão keeps its peso and área.
40. As a professor, I want C/E and V/F alternativas never to be shuffled, so that the order stays natural.
41. As a professor, I want the restore from the planilha to bring back the caderno, the images, the pesos, the áreas and the alternativas, so that clearing the phone loses nothing.
42. As a professor, I want the planilha's turma aba to show the marcações by original questão for a shuffled prova, so that the rows are comparable across versões.

## Implementation Decisions

- **Prova shape** gains these fields; all are optional and default to today's behaviour:
  - `alternativas`: a string of letters, one of `ABCDE` (default), `ABCD`, `ABC`, `AB`, `CE` or `VF`.
  - `pesos`: a number > 0 per questão; missing means 1.
  - `areas`: a list of `{ nome, de, ate }` (1-based, inclusive, no overlap).
  - `codigo`: a random integer that the app assigns to each prova and never changes.
  - `caderno`: `{ questoes: [{ enunciado, imagem?, alternativas: [texto] }], embaralhar: { questoes, alternativas }, semente }`.
  - Each versão can have `ordem`, the original questão index at each folha position, and `trocas`, the per-questão permutation of alternativas. These appear only for a shuffled caderno.
- **Original questão** is the unit for pesos, áreas and the Análise. Without a caderno, folha position equals original questão, as today. With a shuffle, each versão maps through `ordem`.
- **Nota** moves fully into the nota module: `corrigir(versao, prova, marcações)` returns acertos, pontos, pontos possíveis, percentual, nota, and acertos per área. All callers use it; nothing else re-implements the rule. With all pesos at 1 the result is identical to today.
- **Alternativas.** The layout, folha, leitura, conferência and planilha take the letters from the prova. The layout spaces bubbles as today and simply draws fewer. The maximum stays at 5.
- **Código da prova** is a strip of 20 small black or white squares between the two top marcadores, read with the same homography as the bubbles. It holds the prova's codigo (12 bits), the versão (3 bits: 0 = none, 1–4 = A–D) and a checksum (5 bits). An unreadable or failed checksum gives "no código", which falls back to the active prova and the versão bubbles. Versão bubbles are printed only when the prova has several versões and no caderno shuffle; with a shuffle, each versão's folha carries the versão in its código.
- **Câmera ao vivo** uses `getUserMedia` with the rear camera, which needs HTTPS (GitHub Pages provides it). About 4 times per second it checks a downscaled frame with the existing marker finder. It captures a full-resolution frame once the marcadores are found in 3 consecutive checks and each moves less than 2% of the frame width. It beeps with Web Audio and vibrates where `navigator.vibrate` exists (Android; iPhone only beeps). The camera stream stops when leaving the Corrigir tab or opening the conferência, and restarts after saving. The leitura module gains a pure "frame ready" decision (marcadores found and steady over the last N frames), so it can be tested without a camera.
- **Caderno.** Questões are edited in a new section of the Prova tab. Images are resized to at most 800 px on the long side, as JPEG, and stored in IndexedDB, because localStorage is too small; texts stay in localStorage with the rest. The shuffle uses a seeded generator, so the same `semente` always gives the same versões; "Embaralhar de novo" draws a new semente. Printing uses the browser's print dialog, like the folha: each versão is the caderno followed by its folha.
- **Gabaritos of shuffled versões** are derived from the master gabarito and are read-only in the UI. Anuladas are set on the original questão and apply in every versão.
- **Planilha.**
  - Turma abas list marcações by original questão when the prova is shuffled.
  - They add "Pontos" when pesos aren't all 1, and "<área> acertos" and "<área> %" columns.
  - A shuffled prova gets one Análise aba by original questão instead of one per versão.
  - Resumo gains average % per área per turma.
  - Dados keeps everything needed for restore, including images as data URLs, split into chunks as today.
- **Storage key** stays the same, with no migration needed: new fields are optional.

## Testing Decisions

- Good tests check external behaviour through the agreed seams only, with expected values from worked examples, never recomputed the way the code does.
- Same three seams as the first spec, no new ones:
  1. **Leitura:** synthetic images in, leitura out. Add: folhas with 2, 3, 4 alternativas and C/E; the código strip read correctly under rotation, perspective, noise and photocopy, a damaged código giving "no código", and an old folha without a strip. Also the frame-ready decision fed with sequences of synthetic frames: steady, moving, and marcadores lost.
  2. **Planilha:** prova + correções in, workbook out, read back with SheetJS, and the restore round trip. Add: notas with pesos and anuladas, Pontos column, área columns and Resumo, A–D and C/E provas, a shuffled prova with marcações and Análise by original questão, and a restore that brings back the caderno with an image, pesos, áreas and alternativas.
  3. **App no navegador:** Playwright with a phone viewport. Add: live capture using Chromium's fake camera fed with a video of a synthetic folha, ending in the conferência, then back to the camera after saving. Also: a folha whose código names another stored prova, which shows the question; editing a caderno, printing two shuffled versões, photographing versão B's folha and getting the right nota.
- Prior art: `test/leitura.test.js`, `test/planilha.test.js` and `test/app.test.js`, with the synthetic generator in `test/sintetico.js`.

## Out of Scope

- Nota de dissertativas (item 3, declined by Tiago).
- WhatsApp or any message to students (item 8, declined; the PDF devolutiva was declined earlier too).
- More than 5 alternativas, numeric answers, matrix questões, or mixed alternativas inside one prova.
- A question bank, AI-generated questões, or importing a caderno from Word or PDF.
- Negative marking and partial credit.
- More than 4 versões.
- Live capture of several folhas in one frame.

## Further Notes

- Live capture depends on the phone's camera and browser; only real phones can confirm it. "Tirar foto" stays as the fallback.
- The código strip must survive photocopies, so its squares are as large as the space between the top marcadores allows. Real photocopied folhas from Tiago are still the final check for the whole leitura.
