# 01: Prova impressa no modelo do professor (sem o quadro ainda)

**Status:** resolved
**Blocked by:** none

**What to build:** a impressão do caderno sai no modelo da Recuperação Final do Tiago. Página 1: cabeçalho da escola (linhas configuráveis, a última maior e em negrito), título, subtítulo, tabela de identificação (Estudante; Professor, Turma, Data; Disciplina, Série, Nota / valor) e a caixa cinza "Instruções ao estudante" gerada a partir da prova (nº de questões, alternativas, pontos por questão, total) mais instruções extras. Questões: "QUESTÃO 01 (5,0 pontos)" com os pontos vindos do peso e do valor, texto-base recuado e justificado, fonte em itálico à direita, comando em negrito, alternativas "a)"… com a letra em negrito. Cabeçalho corrido com o nome curto e o nº da página. Questão antiga (só enunciado) imprime como texto-base. Editor ganha "Cabeçalho da prova" e, por questão, fonte e comando. A folha de respostas continua separada, como hoje.

- [x] Seam App: com cabeçalho, título e uma questão com fonte e comando, o HTML de impressão tem a tabela de identificação, as instruções com "20 questões" e "5,0 pontos", e o comando em negrito
- [x] Seam Planilha: restaurar traz os campos novos da prova e das questões
- [x] Prova antiga sem os campos novos imprime sem erro
