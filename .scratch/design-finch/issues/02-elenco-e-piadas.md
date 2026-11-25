# 02 Elenco e piadas (src/piadas.js)

Status: ready-for-agent

Funções puras que escolhem a fala de cada momento, nos níveis "desligado", "leve" e "raiz". Com "desligado", devolvem `null`.

## Critérios de aceite
- [ ] `falaDaLeitura(acertos, total, nivel)`: fala pela fração de acerto.
- [ ] `faixas(notas, valor)`: alunos em 5 faixas (9–10, 7–8, 5–6, 3–4, 0–2, na escala de 10).
- [ ] `falaDaFaixa(i, nivel)`: fala de cada faixa.
- [ ] `falaDaQuestaoDificil(questao, acerto, nivel)`: fala da Neide sobre a questão mais errada.
- [ ] `falaDaAnulada(questoes, nivel)`: fala do Valdir.
- [ ] `cafe(corrigidas, total)`: % de café que resta e quantas provas faltam.
- [ ] Nenhuma fala leva nome ou número de aluno.
- [ ] SVGs do elenco em `img/elenco/`.
