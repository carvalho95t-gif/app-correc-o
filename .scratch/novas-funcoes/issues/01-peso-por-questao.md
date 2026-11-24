# 01: Peso por questão

**What to build:** o professor dá um peso a cada questão (padrão 1, e pode aplicar a um intervalo). A nota usa os pesos, a anulada dá o peso cheio, e a planilha mostra Pontos quando há pesos diferentes de 1. A regra da nota fica toda no módulo de nota (prefactor: planilha e app param de reimplementar o acerto).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Seam Planilha: nota com pesos e anulada; coluna Pontos só quando há peso ≠ 1; com todos os pesos 1, nada muda
- [ ] Seam Planilha: restaurar traz os pesos
- [ ] Seam App: definir peso 2 nas questões 1–5 e ver a nota na conferência
