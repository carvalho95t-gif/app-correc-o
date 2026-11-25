# 03: QR code da prova e da versão no quadro

**Status:** resolved
**Blocked by:** 02

**What to build:** o quadro ganha um QR code (gerador vendorizado, qrcode-generator, MIT) com a prova e a versão, por exemplo `AC1:123:B`. Na leitura, o app lê o QR (BarcodeDetector quando existe; senão jsQR vendorizado, Apache-2.0) e escolhe a prova e a versão como hoje faz com a faixa de código, inclusive a pergunta "Esta folha é da prova X?". Sem QR legível, usa a prova ativa. Com versões, cada versão é impressa inteira (página 1 com o seu QR e as questões na ordem dela). Funciona offline (service worker guarda os arquivos novos).

- [x] Seam Leitura: QR gerado para a prova 123 versão B volta como { prova: 123, versao: 'B' }
- [x] Seam App: foto sintética da página 1 de outra prova pergunta antes de corrigir
- [x] Seam App: página sem QR legível é corrigida na prova ativa
