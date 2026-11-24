// Código da prova impresso na folha: 20 quadradinhos = prova (12 bits) + versão (3 bits) + CRC-5 (5 bits).
// Versão 0 = sem versão, 1–4 = A–D. A folha em branco (tudo 0) ou toda preta não passa no CRC.
const VERSOES = 'ABCD';

function crc5(bits) {
  let crc = 0x1f;
  for (const b of bits) {
    const topo = ((crc >> 4) & 1) ^ (b ? 1 : 0);
    crc = (crc << 1) & 0x1f;
    if (topo) crc ^= 0x05;
  }
  return crc ^ 0x1f;
}
const paraBits = (n, largura) => [...Array(largura)].map((_, i) => ((n >> (largura - 1 - i)) & 1) === 1);
const deBits = bits => bits.reduce((n, b) => n * 2 + (b ? 1 : 0), 0);

export function codificar(prova, versao) {
  if (!(Number.isInteger(prova) && prova >= 1 && prova < 4096)) throw new RangeError('Código da prova deve ser de 1 a 4095');
  const dados = [...paraBits(prova, 12), ...paraBits(versao ? VERSOES.indexOf(versao) + 1 : 0, 3)];
  return [...dados, ...paraBits(crc5(dados), 5)];
}

export function decodificar(bits) {
  const dados = bits.slice(0, 15), prova = deBits(bits.slice(0, 12)), v = deBits(bits.slice(12, 15));
  if (bits.length !== 20 || deBits(bits.slice(15)) !== crc5(dados) || prova === 0 || v > 4) return null;
  return { prova, versao: v ? VERSOES[v - 1] : null };
}
