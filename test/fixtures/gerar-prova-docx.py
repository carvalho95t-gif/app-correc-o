# Gera prova-exemplo.docx (fixture dos testes de importar prova do Word). Requer python-docx.
import io, struct, zlib
from docx import Document
from docx.enum.text import WD_ALIGN_PARAGRAPH

def png(cor):  # PNG 4x4 de uma cor só
    linha = b'\x00' + bytes(cor) * 4
    dados = zlib.compress(linha * 4)
    ch = lambda t, d: struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d))
    return b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', 4, 4, 8, 2, 0, 0, 0)) + ch(b'IDAT', dados) + ch(b'IEND', b'')

d = Document()
for l in ['GOVERNO DO ESTADO DO ESPÍRITO SANTO', 'SECRETARIA DE ESTADO DA EDUCAÇÃO', 'ESCOLA ESTADUAL EXEMPLO', 'AVALIAÇÃO DE RECUPERAÇÃO FINAL', 'FILOSOFIA – 2ª SÉRIE DO ENSINO MÉDIO – 2026']:
    d.add_paragraph(l)
d.add_paragraph('Estudante: ________________')
d.add_paragraph('Professor: Tiago Carvalho    Turma: _____    Data: ____/____/2026')
d.add_paragraph('Disciplina: Filosofia    Série: 2ª    Nota: _______ / 100')
d.add_paragraph('INSTRUÇÕES AO ESTUDANTE')
d.add_paragraph('1. A prova contém 3 questões objetivas.')
questoes = [
    ('Montaigne observou que cada pessoa chama de barbárie aquilo que não faz parte dos seus costumes.', 'Texto elaborado a partir de Michel de Montaigne, Dos canibais (1580).', 'Ao comparar os costumes, Montaigne sugere que:', ['os indígenas eram inferiores.', 'a barbárie existe só sem escrita.', 'os costumes europeus são modelo.', 'chamamos de bárbaro o que difere dos nossos costumes,', 'todos os costumes são bons.']),
    ('Kant afirmou que o ser humano é a única criatura que precisa ser educada.', 'KANT, Immanuel. Sobre a pedagogia. Piracicaba: Unimep, 1996.', 'Para Kant, o ser humano:', ['só se humaniza pela educação.', 'é humano pelos instintos.', 'não precisa de educação.', 'nasce moralmente formado.', 'deve abandonar a cultura.']),
    ('Rawls defende que ninguém merece o lugar em que nasce.', '', '', ['premiam o mérito.', 'corrigem desvantagens de origem.', 'tratam todos de forma idêntica.', 'dispensam o Estado.', 'mantêm a posição social.']),
]
for i, (base, fonte, comando, alts) in enumerate(questoes, 1):
    r = d.add_paragraph().add_run(f'QUESTÃO {i:02d} (5,0 pontos)'); r.bold = True
    d.add_paragraph(base)
    if i == 2: d.add_paragraph().add_run().add_picture(io.BytesIO(png((200, 30, 30))))
    if fonte: d.add_paragraph(fonte).alignment = WD_ALIGN_PARAGRAPH.RIGHT if i == 1 else None
    if comando: d.add_paragraph().add_run(comando).bold = True
    for j, a in enumerate(alts):
        d.add_paragraph(f'{"abcde"[j]}) {a}')
        if i == 1 and j == 3: d.add_paragraph('o que revela um julgamento etnocêntrico.')  # alternativa em dois parágrafos
d.add_paragraph('GABARITO COMENTADO')
d.add_paragraph('1. Gabarito')
t = d.add_table(rows=1, cols=6)
for c, v in zip(t.rows[0].cells, ['01', 'd', '02', 'a', '03', 'b']): c.text = v
d.add_paragraph('Habilidade EM13CHS204 – Questões 01 a 03')
d.add_paragraph('Questão 01 – Alternativa d (EM13CHS204)')
d.save('prova-exemplo.docx')
