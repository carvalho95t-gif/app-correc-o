# Spec: App de correção de provas objetivas

**Status:** ready-for-agent

## Problema

O professor aplica provas objetivas no estilo ENEM (alternativas A a E) em papel e corrige à mão, folha por folha. Depois digita as notas numa planilha. Isso toma horas, gera erros de conferência e não mostra quais questões a turma mais errou.

## Solução

Um app que abre por um link no navegador do celular, sem instalar nada e sem servidor. O professor cadastra a prova e o gabarito, imprime a folha de respostas gerada pelo app, fotografa cada folha preenchida, confere a leitura e salva. No fim, baixa uma planilha `.xlsx` com as notas por turma, uma análise por questão e um resumo. Toda a leitura acontece no aparelho, e nenhuma foto sai do celular. Depois da primeira abertura, o app funciona sem internet. Toda a interface, a folha e a planilha são em português do Brasil.

## Histórias de uso

1. Como professor, quero criar uma prova com nome e de 1 a 90 questões, para que o app corresponda à prova que apliquei.
2. Como professor, quero marcar o gabarito tocando em A–E em cada questão, para preenchê-lo rápido no celular.
3. Como professor, quero anular uma questão, para que ela conte como acerto para todos.
4. Como professor, quero ser avisado de quais questões estão sem gabarito ao salvar, para não salvar uma prova incompleta.
5. Como professor, quero corrigir uma letra do gabarito depois de já ter corrigido folhas, para que todas as notas sejam recalculadas.
6. Como professor, quero que o app recuse mudar o número de questões quando já há correções, para não estragar as correções salvas.
7. Como professor, quero informar o valor da prova (ex.: 3 pontos), para que a planilha traga a nota nessa escala além de 0 a 10.
8. Como professor, quero imprimir uma folha de respostas A4 gerada a partir da prova, para que todo aluno responda numa folha que o app consegue ler.
9. Como professor, quero que a mesma folha sirva para todos os alunos e todas as turmas, para imprimir um original e tirar cópias.
10. Como professor, quero que a folha tenha o nome da prova, uma linha para o nome do aluno, bolinhas para o número de chamada e para as questões e a instrução "Pinte toda a bolinha com caneta preta ou azul.", para que o aluno saiba preencher.
11. Como professor, quero imprimir duas folhas por página A4 em provas de até 30 questões, para economizar papel.
12. Como professor, quero digitar a turma antes de fotografar, e que o app lembre a última turma, para que as correções vão para a turma certa.
13. Como professor, quero fotografar a folha com a câmera do celular, para que o app leia na hora.
14. Como professor, quero que a leitura funcione com a folha um pouco torta, girada, fotocopiada mais clara ou mais escura, com luz desigual ou sobre uma mesa escura, para corrigir numa sala de aula normal.
15. Como professor, quero uma mensagem clara quando o app não acha os 4 marcadores, para saber que devo tirar outra foto.
16. Como professor, quero ver a leitura desenhada sobre a foto (verde certa, vermelha errada, amarela para conferir) e o número de acertos, para confiar nela de relance.
17. Como professor, quero que marcações duvidosas (bolinha fraca ou pintada pela metade) sejam destacadas e bloqueiem o salvar até eu escolher, para que nada errado seja salvo sem eu ver.
18. Como professor, quero que em branco e dupla marcação contem como erro, como no ENEM, para seguir as regras que os alunos conhecem.
19. Como professor, quero trocar qualquer marcação durante a conferência, para corrigir uma leitura errada.
20. Como professor, quero digitar ou corrigir o número de chamada quando ele está em branco ou confuso, e não conseguir salvar sem ele, para que toda correção seja identificada.
21. Como professor, quero ser avisado quando a mesma turma e número de chamada já foi corrigida, escolhendo trocar ou manter, para não sobrescrever por engano.
22. Como professor, quero que as correções fiquem salvas no celular na hora, para não perdê-las ao fechar o navegador.
23. Como professor, quero ver as correções por turma, com número, nome, acertos, nota e um sinal quando alterei a leitura, para acompanhar o andamento.
24. Como professor, quero apagar uma correção e fotografar de novo, para refazer uma correção ruim.
25. Como professor, quero colar a lista de chamada da turma (um nome por linha, podendo começar pelo número), para que a planilha e os resultados mostrem o nome do aluno ao lado do número.
26. Como professor, quero baixar a planilha com uma aba por turma (número, nome, marcação de cada questão, acertos, %, nota) e o gabarito no topo, para usar nos sistemas da escola.
27. Como professor, quero uma aba Análise com o % de acerto de cada questão (geral e por turma), quantos marcaram cada alternativa, em branco e dupla, a dificuldade e a discriminação com alerta "Revisar", para ver o que a turma não aprendeu e quais questões podem ter problema.
28. Como professor, quero uma aba Resumo com alunos, média, maior e menor nota e as 3 questões mais fáceis e as 3 mais difíceis por turma e no geral, para ter a visão geral rápido.
29. Como professor, quero um aviso enquanto houver correções que não estão na planilha, para lembrar de exportar (o celular pode apagar os dados do site).
30. Como professor, quero restaurar uma prova e suas correções importando uma planilha exportada pelo app, para não perder trabalho se o celular apagar os dados.
31. Como professor, quero guardar várias provas no app e alternar entre elas, para corrigir provas diferentes no mesmo período.
32. Como professor, quero ver com clareza qual prova está sendo corrigida na tela Corrigir, para não corrigir uma folha com o gabarito errado.
33. Como professor, quero criar uma prova com até 4 versões (A–D), cada uma com seu gabarito, para dificultar a cola.
34. Como professor, quero que o aluno marque a versão na folha e que o app me peça para escolher quando ela estiver em branco ou confusa, para que cada folha seja corrigida com o gabarito certo.
35. Como professor, quero que o app funcione sem internet depois da primeira visita, para corrigir numa sala com sinal fraco.
36. Como professor, quero botões grandes e texto legível numa tela pequena, usável com uma mão, para que corrigir 40 folhas não seja cansativo.

## Decisões de implementação

- Site estático: HTML, CSS e JavaScript com módulos ES, sem etapa de build e sem servidor. A única dependência em tempo de execução é a SheetJS (`xlsx.mini`, copiada para o projeto), para ler e escrever `.xlsx`. Um service worker guarda os arquivos para uso offline.
- Módulos profundos, cada um puro e testável sem navegador:
  - **Folha (geometria + desenho):** dado o número de questões (e de versões), a geometria da folha em milímetros numa A4: marcadores nos 4 cantos, número de chamada em duas colunas de dígitos 0–9, versão A–D quando há mais de uma, e até 3 colunas de 30 questões com A–E. Também gera o SVG da folha para imprimir. A mesma geometria é usada na leitura.
  - **Leitura:** `lerFolha(imagem em tons de cinza, geometria) -> Leitura | null`. Acha os 4 marcadores, projeta a geometria da folha sobre a foto com uma homografia e mede o quanto cada bolinha está escura em relação ao papel e aos marcadores (assim cópias claras e escuras são lidas igual). Cada questão vira uma alternativa, em branco ou dupla marcação, ou é marcada como duvidosa. Devolve `null` quando não acha os marcadores.
  - **Nota:** acertos, total, % e nota de uma correção. Questão anulada conta como acerto.
  - **Estado:** provas, cada uma com suas correções por turma + número de chamada, lista de chamada por turma e o sinal "pendente de exportar"; qual prova está ativa; e a gravação no armazenamento local do navegador. Funções puras, que nunca alteram o estado recebido.
  - **Planilha:** do estado para a pasta de trabalho, com as abas das turmas, Análise, Resumo e Dados, e o caminho inverso (restaurar). As notas são calculadas na exportação a partir das marcações salvas, então corrigir o gabarito recalcula tudo.
- O módulo de telas só liga as telas (Prova, Folha, Corrigir/Conferência, Resultados) a esses módulos.
- As fotos são reduzidas para no máximo 2000 px antes da leitura. Só as marcações são salvas, nunca as fotos.
- Dificuldade: Fácil com 85% ou mais de acerto, Média de 50 a 84%, Difícil abaixo de 50%. Discriminação: correlação ponto-bisserial entre acertar a questão e o total de acertos do aluno, com 2 casas; "Revisar" abaixo de 0,2; vazia com menos de 2 alunos ou quando todos acertam ou todos erram.
- **Nomes:** a lista de chamada fica por turma, dentro da prova. A linha N sem número vale para o número N; uma linha que começa com número usa esse número.
- **Valor da prova:** padrão 10. Quando é diferente de 10, as abas das turmas ganham a coluna "Nota (valor X)".
- **Duas por página:** em provas de até 30 questões, a impressão pode pôr duas cópias da folha, reduzidas para A5, lado a lado numa A4 deitada. A leitura não muda, porque trabalha a partir dos marcadores, em qualquer escala.
- **Várias provas:** o estado guarda uma lista de provas, e o professor escolhe a ativa. Nada na folha identifica a prova; a tela Corrigir mostra o nome da prova ativa.
- **Restaurar:** a planilha tem uma aba "Dados" com a prova e as correções serializadas (divididas em várias células, por causa do limite de tamanho de célula do Excel). Importar a planilha reconstrói a prova; se já existir uma prova com o mesmo nome, o professor escolhe substituir ou manter as duas.
- **Versões:** de 1 a 4 versões (A–D), cada uma com seu gabarito e suas anuladas. Com mais de uma versão, a folha tem uma coluna de bolinhas "Versão". A correção guarda a versão, e a nota usa o gabarito dessa versão. Com versões, a planilha tem uma aba de Análise por versão, e o Resumo mostra as questões mais fáceis e mais difíceis por versão.

## Decisões de teste

- Um bom teste verifica o comportamento externo apenas nos pontos de teste combinados, com valores esperados vindos de exemplos calculados à mão, nunca recalculados do mesmo jeito que o código.
- Pontos de teste combinados (confirmados pelo Tiago em 2026-11-23):
  1. **Leitura:** entra uma imagem, sai o número de chamada, a versão e as marcações. Testada com fotos sintéticas geradas a partir da geometria da folha: reta, girada, em perspectiva, com ruído e gradiente de luz, cópias claras e escuras, sobre mesa escura com objetos escuros perto da borda, foto de 12 MP, marcação fraca de lápis, bolinha pintada pela metade, número de chamada em branco e duplo, bolinhas de versão, folha em meio tamanho (duas por A4) e imagens sem folha.
  2. **Planilha:** entram a prova e as correções, sai a pasta de trabalho (abas, notas, Análise, Resumo, Dados), lida de volta com a SheetJS; e o caminho inverso, entra a pasta de trabalho e saem a prova e as correções (restaurar). Inclui recálculo depois de mudar o gabarito, recusa de mudar o número de questões, nomes, valor da prova e versões.
  3. **App no navegador:** o Playwright, com tela de celular, faz o fluxo inteiro: criar a prova, mostrar a folha, pintar bolinhas, usar um print da folha como foto, corrigir, conferir, salvar, ver resultados, baixar a planilha, salvar bloqueado sem número de chamada, mensagem de erro sem folha e recarregar sem internet.
- Executor de testes: o `node --test` do próprio Node; o Playwright já vem instalado no ambiente.

## Fora do escopo

- Nota TRI.
- PDF com a folha corrigida de cada aluno (devolutiva): o Tiago recusou em 2026-11-23.
- Ler folhas de outros sistemas ou folhas já existentes.
- Contas, login, servidor, sincronização entre aparelhos.
- Enviar notas para o SEGES ou para os alunos.
- Guardar fotos.

## Observações

- Validação no mundo real: o Tiago vai preencher à mão de 20 a 30 folhas fotocopiadas (com em branco, dupla marcação e marcação fraca) e fotografá-las em sala. As falhas viram novos casos de teste sintéticos.
- Publicar o link exige um repositório no GitHub (GitHub Pages). Até ele existir, o trabalho fica local.
