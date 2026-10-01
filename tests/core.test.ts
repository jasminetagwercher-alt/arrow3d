import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {vectors,canArrowEscape,applyMove,getAvailableMoves,isSolved,parseLevel,type Arrow} from '../src/core/puzzle';
import {solve} from '../src/core/solver';
import {decodeSave} from '../src/storage/save';
for(const [direction,d] of Object.entries(vectors))test(`collision and release in ${direction}`,()=>{
 const a:Arrow={id:'a',x:0,y:0,z:0,direction:direction as keyof typeof vectors},b:Arrow={id:'b',x:d[0]*3,y:d[1]*3,z:d[2]*3,direction:a.direction};
 assert.equal(canArrowEscape([a],a.id),true);assert.equal(canArrowEscape([a,b],a.id),false);assert.throws(()=>applyMove([a,b],'a'));assert.deepEqual(getAvailableMoves([a,b]),['b']);assert.equal(canArrowEscape(applyMove([a,b],'b'),'a'),true);assert.deepEqual([a,b].length,2);
 assert.equal(canArrowEscape([a,{...b,x:b.x+(d[0]===0?1:0),y:b.y+(d[0]!==0?1:0)}],'a'),true);
});
test('empty solved, nonexistent arrow is not a move',()=>{assert.equal(isSolved([]),true);assert.equal(canArrowEscape([],'missing'),false);assert.throws(()=>applyMove([],'missing'));assert.equal(solve([]).solvable,true);});
test('cycle is unsolvable',()=>{const s:Arrow[]=[{id:'a',x:0,y:0,z:0,direction:'POS_X'},{id:'b',x:1,y:0,z:0,direction:'NEG_X'}];assert.equal(solve(s).solvable,false);assert.equal(solve(s).steps,null);});
test('parser rejects unsafe directions and overlapping cells',()=>{const l={id:1,name:'Test',arrows:[{id:'a',x:0,y:0,z:0,direction:'POS_X'}]};assert.equal(parseLevel(l).arrows.length,1);assert.throws(()=>parseLevel({...l,arrows:[...l.arrows,{...l.arrows[0],id:'b'}]}));assert.throws(()=>parseLevel({...l,arrows:[{...l.arrows[0],direction:'toString'}]}));assert.throws(()=>parseLevel({...l,arrows:[{...l.arrows[0],x:.5}]}));});
test('all shipped levels have valid replayable solutions',()=>{const levels=JSON.parse(readFileSync('public/levels/campaign.json','utf8'));for(const raw of levels){const l=parseLevel(raw),r=solve(l.arrows);assert.equal(r.solvable,true,`level ${l.id}`);let state=l.arrows;for(const id of r.solution)state=applyMove(state,id);assert.equal(isSolved(state),true);assert.equal(r.steps,l.arrows.length);}});
test('save handles corrupt data and unknown versions',()=>{assert.equal(decodeSave('{').unlocked,1);assert.equal(decodeSave('{"version":2}').unlocked,1);const s=decodeSave(JSON.stringify({version:1,unlocked:900,current:500,sound:true,results:{1:{stars:3,mistakes:0,hints:0},2:{stars:99}}}));assert.equal(s.current,100);assert.equal(s.sound,true);assert.equal(s.results[1].stars,3);assert.equal(s.results[2],undefined);});
import {generate} from '../src/levels/generator';
test('reverse generation is deterministic and shared core replays its inverse order',()=>{
 for(const shape of ['block','tower','shell','cross','ring'] as const){const options={seed:42,count:30,dimensions:[7,7,7] as [number,number,number],shape};const l=generate(options);assert.deepEqual(l,generate(options));let state=l.arrows;for(const a of [...state].reverse())state=applyMove(state,a.id);assert.equal(isSolved(state),true);}
});
test('all legal branches remain solvable in sample generated levels',()=>{
 for(let seed=1;seed<=10;seed++){let state=generate({seed,count:30,dimensions:[5,5,5],shape:'block'}).arrows;while(state.length){const moves=getAvailableMoves(state);for(const move of moves)assert.equal(solve(applyMove(state,move)).solvable,true);state=applyMove(state,moves[moves.length-1]);}}
});
