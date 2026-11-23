# Spec: App de correção de provas objetivas

**Status:** ready-for-agent

## Problem Statement

O professor aplica provas objetivas no estilo ENEM (alternativas A a E) em papel e corrige à mão, folha por folha, depois digita as notas numa planilha. Isso toma horas, gera erros de conferência e não mostra quais questões a turma errou mais.

## Solution

Um app que abre por um link no navegador do celular, sem instalar nada e sem servidor. O professor cadastra a prova e o gabarito, imprime uma folha de respostas gerada pelo app, fotografa cada folha preenchida, confere a leitura e salva. No fim, baixa uma planilha `.xlsx` com as notas por turma, uma análise por questão e um resumo. Toda a leitura acontece no aparelho e nenhuma foto sai do celular. O app funciona sem internet depois da primeira abertura.

## User Stories

1. As a professor, I want to create a prova with a name and a number of questões from 1 to 90, so that the app matches the prova I applied.
2. As a professor, I want to mark the gabarito by tapping A–E for each questão, so that I can enter it quickly on the phone.
3. As a professor, I want to mark a questão as anulada, so that it counts as correct for everyone.
4. As a professor, I want to be told which questões still have no gabarito when I save, so that I don't save an incomplete prova.
5. As a professor, I want to fix a letter in the gabarito after correcting some folhas, so that all notas are recalculated.
6. As a professor, I want the app to refuse changing the number of questões when correções exist, so that saved correções are not corrupted.
7. As a professor, I want to start a new prova, with a warning if there are correções not yet in the planilha, so that I don't lose work by accident.
8. As a professor, I want to print a folha de respostas in A4 generated from the prova, so that every aluno answers on a sheet the app can read.
9. As a professor, I want the same folha to serve all alunos and all turmas, so that I print one master and photocopy it.
10. As a professor, I want the folha to have the prova name, a line for the aluno's name, bubbles for the número de chamada and the questões, and the instruction "Pinte toda a bolinha com caneta preta ou azul.", so that alunos know how to fill it.
11. As a professor, I want to type the turma before photographing, and have the app remember the last turma, so that correções go to the right turma.
12. As a professor, I want to photograph a folha with the phone camera, so that the app reads it right away.
13. As a professor, I want the leitura to work with a folha that is slightly tilted, rotated, photocopied lighter or darker, with uneven light, or lying on a dark table, so that I can correct in a normal classroom.
14. As a professor, I want a clear message when the app can't find the 4 marcadores, so that I know to take another photo.
15. As a professor, I want to see the leitura drawn over the photo (green right, red wrong, yellow to check) and the number of acertos, so that I can trust it at a glance.
16. As a professor, I want marcações duvidosas (light or half-filled bubbles) to be flagged and to block saving until I choose, so that nothing wrong is saved silently.
17. As a professor, I want em branco and dupla marcação to count as errors, as in the ENEM, so that grading follows the rules alunos know.
18. As a professor, I want to change any marcação during conferência, so that I can fix a misread.
19. As a professor, I want to type or fix the número de chamada when it is blank or unclear, and be blocked from saving without it, so that every correção is identified.
20. As a professor, I want a warning when the same turma + número de chamada was already corrected, choosing to replace or keep, so that I don't overwrite by mistake.
21. As a professor, I want correções saved on the phone immediately, so that closing the browser doesn't lose them.
22. As a professor, I want to see the correções by turma with número, acertos, nota and a mark when I changed the leitura, so that I can follow progress.
23. As a professor, I want to delete a correção and photograph it again, so that I can redo a bad one.
24. As a professor, I want to download the planilha with one aba per turma (número, marcação of each questão, acertos, %, nota) and the gabarito on top, so that I can use it in the school's systems.
25. As a professor, I want an Análise aba with % de acerto per questão (overall and per turma), how many marked each alternativa, em branco and dupla, the dificuldade and the discriminação with a "Revisar" flag, so that I see what the turma didn't learn and which questões may be flawed.
26. As a professor, I want a Resumo aba with alunos, média, maior and menor nota and the 3 easiest and 3 hardest questões per turma and overall, so that I get the big picture fast.
27. As a professor, I want a banner while there are correções not in the planilha, so that I remember to export (the phone may erase site data).
28. As a professor, I want the app to keep working without internet after the first visit, so that I can correct in a classroom with weak signal.
30. As a professor, I want to paste the turma's lista de chamada (one name per line, optionally starting with the número), so that the planilha and the results show each aluno's name next to the número.
31. As a professor, I want to set the valor da prova (e.g. 3 pontos), so that the planilha shows the nota in that scale besides 0–10.
32. As a professor, I want to print two folhas per A4 page for provas with up to 30 questões, so that I save paper.
33. As a professor, I want to keep several provas in the app and switch between them, so that I can correct different provas in the same period.
34. As a professor, I want the prova being corrected shown clearly on the Corrigir screen, so that I don't correct a folha against the wrong prova.
35. As a professor, I want to restore a prova and its correções by importing a planilha the app exported, so that I don't lose work if the phone erases the app's data.
36. As a professor, I want to create a prova with up to 4 versões (A–D), each with its own gabarito, so that neighbours can't copy.
37. As a professor, I want the aluno to mark the versão on the folha, and the app to require me to choose it when it's blank or unclear, so that each folha is graded against the right gabarito.
29. As a professor, I want large controls and readable text on a small screen, usable with one hand, so that correcting 40 folhas isn't tiring.

## Implementation Decisions

- Static site: HTML, CSS and JavaScript ES modules, no build step and no server. The only runtime dependency is SheetJS (`xlsx.mini`, vendored) to write the `.xlsx`. A service worker caches the files for offline use.
- Deep modules, each pure and testable without a browser:
  - **Folha (layout + desenho):** given the number of questões, the geometry of the folha in millimetres on A4 (marcadores at the 4 corners, número de chamada as two columns of digits 0–9, up to 3 columns of 30 questões with A–E), and an SVG of the folha for printing. The same geometry is used to read.
  - **Leitura:** `lerFolha(imagem em tons de cinza, layout) -> Leitura | null`. It finds the 4 marcadores, maps the folha geometry onto the photo with a homography, and measures how dark each bubble is relative to the paper and to the marcadores (so photocopies lighter or darker read the same). Each questão becomes an alternativa, em branco, dupla marcação, or is flagged duvidosa. Returns `null` when it can't find the marcadores.
  - **Nota:** acertos, total, % and nota for a correção, with questões anuladas counting as correct.
  - **Estado:** prova + correções keyed by turma + número de chamada, a "pendente de exportar" flag, and persistence in the browser's local storage. Pure functions that never mutate the input.
  - **Planilha:** from the estado to a workbook with the turma abas, Análise and Resumo. Notas are computed at export from the saved marcações, so fixing the gabarito recalculates everything.
- The UI module only wires the screens (Prova, Folha, Corrigir/Conferência, Resultados) to these modules.
- **Nomes:** a lista de chamada is stored per turma inside the prova; line N without a number means número N; a line starting with a number uses that número.
- **Valor da prova:** default 10. When different from 10, turma abas get an extra column "Nota (valor X)".
- **Duas por página:** for ≤ 30 questões the print view can place two copies of the folha, scaled to A5, side by side on an A4 landscape page. Reading needs no change because it works from the marcadores, whatever the scale.
- **Várias provas:** the estado holds a list of provas, each with its own correções, lista de chamada and pendente flag, plus which one is active. No code on the folha identifies the prova: the professor picks it, and the Corrigir screen shows its name.
- **Restaurar:** the planilha carries a "Dados" aba with the prova and its correções serialized (split across cells to respect Excel's cell limit). Importing a planilha rebuilds that prova; if a prova with the same name exists, the professor chooses to replace it or keep both.
- **Versões:** 1 to 4 versões (A–D), each with its own gabarito and anuladas. With more than one versão the folha prints a "Versão" bubble column. A correção stores its versão; nota uses that versão's gabarito. With versões, the planilha has one Análise aba per versão, and Resumo lists the easiest/hardest questões per versão.
- Photos are scaled down to at most 2000 px before reading. Only marcações are saved, never photos.
- Dificuldade: Fácil ≥ 85% de acerto, Média 50–84%, Difícil < 50%. Discriminação: point-biserial correlation between getting the questão right and the aluno's total acertos, with 2 decimals; "Revisar" below 0.2; empty when fewer than 2 alunos or everyone got it right/wrong.

## Testing Decisions

- Good tests check external behavior through the agreed seams only, with expected values from worked examples, never recomputed the way the code does.
- Agreed seams (confirmed by Tiago on 2026-11-23):
  1. **Leitura:** image in, número de chamada and marcações out. Tested with synthetic photos generated from the folha geometry: straight, rotated, in perspective, with noise and light gradient, light and dark photocopies, on a dark table with dark objects near the edges, a 12 MP photo, light pencil marks, half-filled bubbles, blank and double número de chamada, the versão bubbles, a folha printed at half size (two per A4), and images without a folha.
  2. **Planilha:** prova + correções in, workbook out (abas, notas, Análise, Resumo, Dados), read back with SheetJS; and the reverse, workbook in, prova + correções out (restore). Includes recalculation after a gabarito change, refusal to change the number of questões, nomes, valor da prova and versões.
  3. **App no navegador:** Playwright with a phone viewport runs the whole flow: create prova, render folha, fill bubbles, screenshot as the photo, correct, conferência, save, results, download planilha, blocked save without número de chamada, error message without folha, and offline reload.
- Test runner: Node's built-in `node --test`; Playwright is preinstalled in the environment.

## Out of Scope

- TRI scoring.
- A PDF with each aluno's corrected folha (devolutiva) — Tiago declined it on 2026-11-23.
- Reading folhas from other systems or pre-existing folhas.
- Accounts, login, server, syncing between devices.
- Sending notas to SEGES or to alunos.
- Storing photos.

## Further Notes

- Real-world validation: Tiago will fill 20–30 photocopied folhas by hand (including em branco, dupla marcação and light marks) and photograph them in class. Failures become new synthetic test cases.
- Publishing needs a GitHub repository (GitHub Pages). Until it exists, work stays local.
