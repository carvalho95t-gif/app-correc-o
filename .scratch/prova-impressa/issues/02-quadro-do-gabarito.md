# 02: Quadro do gabarito na página 1, lido pela câmera

**Status:** ready-for-agent
**Blocked by:** 01

**What to build:** com até 30 questões, a página 1 traz, no lugar da folha separada, o quadro do gabarito no estilo Gradepen: moldura dupla, a frase "Marque o gabarito preenchendo completamente a região de cada alternativa.", espaço do QR à esquerda (vazio neste ticket), à direita as bolinhas das questões (3 colunas de 10) e do número de chamada entre quatro marcadores, rodapé "Prova: código.versão". Abaixo, assinatura do estudante e visto do professor. A leitura (foto e câmera ao vivo) acha o quadro na página inteira, com texto em volta, e lê número e marcações; a checagem de proporção dos marcadores vem do layout. Acima de 30 questões, imprime a folha separada antiga e avisa. Folhas antigas continuam sendo lidas.

- [ ] Seam Leitura: página 1 sintética com texto em volta do quadro é lida com o número e as marcações certas
- [ ] Seam Leitura: os testes de leitura da folha antiga passam sem mudança
- [ ] Seam App: prova de 31 questões imprime a folha separada com aviso
