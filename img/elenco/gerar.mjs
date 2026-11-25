// Gera os SVGs do elenco (Open Peeps, de Pablo Stanley, licença CC0) usados nas falas do app.
// Uso: npm i --no-save @dicebear/core@9.2.2 @dicebear/collection@9.2.2 && node img/elenco/gerar.mjs img/elenco
import {createAvatar} from '@dicebear/core';
import {openPeeps} from '@dicebear/collection';
import fs from 'fs';
const destino=process.argv[2];
const elenco={
 neide:{head:['grayBun'],accessories:['glasses2'],accessoriesProbability:100,skinColor:['edb98a'],clothingColor:['8fa7df'],facialHairProbability:0},
 valdir:{head:['noHair2'],facialHair:['moustache3'],facialHairProbability:100,skinColor:['d08b5b'],clothingColor:['ffcf77'],accessoriesProbability:0},
 kevin:{head:['hatBeanie'],skinColor:['ae5d29'],clothingColor:['78e185'],accessoriesProbability:0,facialHairProbability:0},
 merenda:{head:['bantuKnots'],skinColor:['694d3d'],clothingColor:['e279c7'],accessoriesProbability:0,facialHairProbability:0},
};
const rostos={neide:{tedio:'tired',bravo:'contempt',susto:'awe',feliz:'smileBig'},valdir:{tedio:'serious',bravo:'suspicious',susto:'concernedFear',feliz:'calm'},kevin:{tedio:'blank',bravo:'cheeky',susto:'fear',feliz:'smileLOL'},merenda:{tedio:'eyesClosed',bravo:'contempt',susto:'hectic',feliz:'lovingGrin1'}};
for(const q in elenco) for(const h in rostos[q]) fs.writeFileSync(`${destino}/${q}-${h}.svg`,createAvatar(openPeeps,{seed:q,...elenco[q],face:[rostos[q][h]]}).toString());
