import {readFileSync,writeFileSync} from 'node:fs';
import {generate,type GeneratorOptions} from '../src/levels/generator';
import {analyze} from '../src/core/solver';
import {type Level} from '../src/core/puzzle';
const tutorials:Level[]=JSON.parse(readFileSync('public/levels/campaign.json','utf8')).slice(0,5);
const chapters=['ANKOMMEN','PERSPEKTIVEN','HOCH HINAUS','VERBINDUNGEN','WEITE','VERBORGENE WEGE','INNENRÄUME','VERFLECHTUNGEN','WEITBLICK','FREIER RAUM'];
const names=['Morgenlicht','Seitenwechsel','Leise Schritte','Zwischenräume','Aufwind','Wendepunkt','Lichtblick','Ausblick','Zusammenspiel','Horizont'];
const levels=[...tutorials],report:any[]=[];let evaluated=0;
for(let id=6;id<=100;id++){
 const chapter=Math.floor((id-1)/10),fraction=((id-1)%10)/9;
 const counts=[8,15,24,34,46,60,76,94,116,138];
 const count=Math.round(counts[chapter]+fraction*(chapter===9?12:chapter===0?5:9));
 const shape:GeneratorOptions['shape']=chapter===2?'tower':chapter===6?'shell':chapter===7?'cross':chapter===8?'ring':chapter>2&&id%4===0?'shell':'block';
 let dim: [number,number,number]=[Math.ceil(Math.cbrt(count)*1.3),Math.ceil(Math.cbrt(count)*1.1),Math.ceil(Math.cbrt(count)*1.3)];
 if(shape==='tower')dim=[3,Math.ceil(count/6),3];if(shape==='cross'||shape==='ring')dim=[9,Math.ceil(count/(shape==='cross'?14:28))+1,9];
 const target=count*1.1+chapter*7;
 let best:Level|undefined,bestAnalysis:ReturnType<typeof analyze>|undefined,bestCost=Infinity;
 for(let attempt=0;attempt<12;attempt++){
  const seed=id*1009+attempt*7919;evaluated++;
  try{const candidate=generate({seed,count,dimensions:dim,shape});if(candidate.arrows.length!==count)continue;const metrics=analyze(candidate.arrows);if(!metrics.solvable||metrics.startMoves.length===count)continue;
   const cost=Math.abs(metrics.score-target)+metrics.startMoves.length/count*8;
   if(cost<bestCost){bestCost=cost;best=candidate;bestAnalysis=metrics;}
  }catch{/* Candidate cannot satisfy requested occupancy; try next seed. */}
 }
 if(!best||!bestAnalysis)throw new Error(`No candidate for level ${id}`);
 best.id=id;best.name=`${names[(id-1)%10]}${chapter>0?' '+(chapter+1):''}`;best.chapter=`${String(chapter+1).padStart(2,'0')} / ${chapters[chapter]}`;
 best.hint=shape==='shell'?'Auch innen gibt es freie Wege. Drehe die Hülle und schau genauer hin.':shape==='tower'?'Wechsle zwischen oben, unten und den Seiten. Jeder Blick hilft.':shape==='ring'?'Folge dem Ring. Ein freier Pfeil kann eine ganze Reihe öffnen.':'Gib dir Zeit. Schau entlang der Pfeilspitzen und öffne neue Wege.';
 levels.push(best);report.push({id,shape,count,startMoves:bestAnalysis.startMoves.length,depth:bestAnalysis.dependencyDepth,score:bestAnalysis.score,averageChoices:Number(bestAnalysis.averageChoices.toFixed(2))});
}
writeFileSync('public/levels/campaign.json',JSON.stringify(levels)+'\n');
writeFileSync('public/levels/curation.json',JSON.stringify({version:1,tutorials:5,candidatesEvaluated:evaluated,method:'12 reverse-generated candidates per level; deterministic heuristic selection, not human playtest curation',levels:report},null,2)+'\n');
console.log(`Selected ${levels.length} levels; ${evaluated} candidates analyzed. ${Math.max(...levels.map(l=>l.arrows.length))} arrows in largest level.`);
