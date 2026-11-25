# Correção de provas

Correção de provas objetivas no estilo ENEM (alternativas A a E) aplicadas em papel, por um professor, em uma ou mais turmas.

## Language

**Prova**:
Uma avaliação objetiva com nome, número de questões e gabarito. Uma prova ativa por vez.
_Avoid_: Teste, avaliação, exame

**Gabarito**:
A alternativa certa de cada questão da prova.
_Avoid_: Chave, resposta certa

**Questão anulada**:
Questão que conta como acerto para todos os alunos.
_Avoid_: Questão cancelada

**Folha de respostas**:
A folha impressa, igual para todos os alunos, onde o aluno pinta o número de chamada e as respostas.
_Avoid_: Cartão-resposta, gabarito do aluno

**Quadro do gabarito**:
O quadro na página 1 da prova impressa (provas de até 30 questões) onde o aluno pinta o número de chamada e as respostas. Tem um QR code com a prova e a versão. Substitui a folha de respostas separada.
_Avoid_: Cartão-resposta

**Marcadores**:
Os quatro quadrados pretos nos cantos da folha de respostas, usados para localizar e endireitar a folha na foto.

**Turma**:
Grupo de alunos que fez a prova, identificado por um nome curto como "2A".
_Avoid_: Classe, sala

**Número de chamada**:
Número de dois dígitos (00–99) que identifica o aluno dentro da turma.
_Avoid_: Matrícula, ID

**Leitura**:
O que o app entende de uma foto da folha de respostas: o número de chamada e a marcação de cada questão.

**Marcação**:
O que o aluno marcou numa questão: uma alternativa, em branco ou dupla marcação.

**Em branco**:
Questão sem nenhuma alternativa pintada. Conta como erro.

**Dupla marcação**:
Questão com duas ou mais alternativas pintadas (ou uma apagada mal: rasura). Conta como erro.

**Marcação duvidosa**:
Marcação que a leitura não consegue decidir com segurança, como uma bolinha pintada fraca ou pela metade. O professor resolve antes de salvar.

**Conferência**:
O passo em que o professor vê a leitura sobre a foto e corrige o que for preciso antes de salvar.

**Correção**:
A leitura conferida e salva de um aluno: turma, número de chamada e marcações.
_Avoid_: Resultado, resposta

**Nota**:
Pontos obtidos ÷ pontos possíveis × 10, com uma casa decimal. Com todos os pesos 1, é acertos ÷ total de questões × 10.
_Avoid_: Pontuação, score

**Peso**:
Quanto uma questão vale na nota; 1 quando o professor não muda. Questão anulada dá o peso inteiro a todos.

**Pontos**:
A soma, em cada questão, do peso × crédito: 1 na alternativa certa ou na questão anulada, a fração da pontuação parcial numa alternativa errada que vale parte, 0 no resto.

**Pontuação parcial**:
Fração da questão (0 a 1) que uma alternativa errada vale. Opcional, por questão.

**Conceito**:
Letra ou palavra que o professor associa a uma nota mínima, na escala do valor da prova (ex.: "A 9", "B 7").

**Posição**:
A colocação do aluno pela nota dentro da prova; empates dividem a mesma posição.

**Diário**:
A aba da planilha com turma, nº, nome, nota no valor da prova e conceito, para passar ao diário de classe.

**Área**:
Um intervalo nomeado de questões, como "Linguagens, 1 a 45", com acertos e % próprios na planilha.

**Alternativas da prova**:
As letras que a prova usa em todas as questões: A–E, A–D, A–C, A–B, C/E (Certo/Errado) ou V/F.

**Código da prova**:
A faixa de quadradinhos no alto da folha de respostas que diz de qual prova (e de qual versão) ela é.

**Versão**:
Uma das até 4 variações da mesma prova (A–D), cada uma com seu gabarito.

**Caderno de prova**:
As questões da prova, digitadas no app e impressas no modelo do professor. Cada questão tem texto-base (guardado no campo `enunciado`), imagem opcional, fonte, comando e o texto das alternativas.

**Texto-base**:
O texto de apoio da questão, impresso recuado. Nas provas antigas é o enunciado inteiro.

**Fonte**:
A referência do texto-base, impressa em itálico à direita.

**Comando**:
A pergunta da questão, impressa em negrito antes das alternativas.

**Embaralhamento**:
A troca da ordem das questões e/ou das alternativas nas versões B–D de um caderno. A versão A é o caderno como foi digitado; pesos, áreas e análise seguem sempre a questão original.

**Planilha**:
O arquivo `.xlsx` exportado: uma aba por turma, uma aba de análise e uma aba de resumo. É o registro definitivo das correções.

**Análise**:
Para cada questão: percentual de acerto, alternativas marcadas, dificuldade e discriminação.

**Dificuldade**:
Fácil (85% ou mais de acerto), média (50 a 84%) ou difícil (menos de 50%).

**Discriminação**:
Quanto a questão separa os alunos que foram bem na prova dos que foram mal. Abaixo de 0,2 a questão é marcada para revisar.
