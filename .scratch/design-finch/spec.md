# Spec: Design Finch com elenco e piadas

**Status:** ready-for-agent

Aprovado pelo Tiago em 25/11/2026 ("é assim que quero"), a partir das telas "Finch-*" do canvas https://claude.ai/artifact/Kgsh3jY8smHY5D45AxL5LL. Substitui o visual da spec `.scratch/design-novo/spec.md`; os requisitos 3, 4, 5, 8, 9 e 10 de lá continuam valendo.

## Problema

O app funciona, mas o professor acha o visual "sem graça". Ele quer um app engraçado, sarcástico e brasileiro, com personagens da escola comentando a correção.

## Solução

- **Visual Finch.** Tons pastel (pêssego, rosa, verde), fonte Quicksand, cantos bem arredondados, sem contorno preto. Tema claro e escuro, sem branco nem preto puro.
- **Elenco** (Open Peeps, CC0), cada um com 4 caras (tédio, deboche, susto, alegria):
  - Prof.ª Neide: a voz do app.
  - Coordenador Valdir: aparece quando algo sai do padrão (questão anulada).
  - Kevin do fundão: reage aos erros da turma, sem citar nome de aluno.
  - Dona Merenda: celebra o fim da pilha.
- **Piadas sarcásticas** com memes brasileiros, em 3 níveis de deboche: Desligado (sem personagens nem piadas), Leve e Raiz. O nível fica guardado no aparelho.
- **Onde aparecem:**
  - Corrigir: seletor de nível de deboche; "Café da Prof.ª Neide" quando a turma tem lista de chamada (quanto falta corrigir).
  - Confira a leitura: uma fala sobre a nota da folha.
  - Gabarito: o Valdir comenta quando há questão anulada.
  - Resultados: "Termômetro da nota" (alunos por faixa, cada faixa com sua fala) e a Neide comentando a questão mais errada.

## Histórias

1. Como professor, quero um app com cara divertida, para corrigir uma pilha de provas sem tédio.
2. Como professor, quero desligar as piadas, para usar o app em uma reunião ou na frente da coordenação.
3. Como professor, quero escolher entre deboche leve e raiz, para combinar com meu humor no dia.
4. Como professor, quero que as piadas nunca citem nome ou número de aluno, para não expor ninguém se um aluno vir a tela.
5. Como professor, quero ver quanto falta para acabar a pilha da turma, para saber quando posso parar.
6. Como professor, quero ver quantos alunos ficaram em cada faixa de nota, para entender a turma de relance.
7. Como professor, quero um aviso engraçado sobre a questão que a turma mais errou, para lembrar de revisá-la.
8. Como professor, quero que o app continue funcionando sem internet, com a fonte e os personagens.

## Fora do escopo

Impressão (folha e caderno) não muda. Sem bichinho de estimação, conquistas ou "expectativa x realidade" (ficam para depois, se ele pedir).

## Decisões de implementação

- `src/piadas.js`: funções puras que escolhem a fala (quem, cara, texto) a partir de números; nada de DOM. Testadas com `node:test`.
- Personagens em `img/elenco/<quem>-<cara>.svg`, gerados por `img/elenco/gerar.mjs` (DiceBear 9.2.2).
- Fonte Quicksand (OFL) em `vendor/quicksand/`.
- Tudo no cache do service worker (nova versão).
