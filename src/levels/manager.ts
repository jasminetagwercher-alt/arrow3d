import {parseLevel,type Level} from '../core/puzzle';
export class LevelManager {
  levels:Level[]=[];
  async load(){const r=await fetch(`${import.meta.env.BASE_URL}levels/campaign.json`);if(!r.ok)throw new Error('Leveldatei konnte nicht geladen werden.');const raw:unknown=await r.json();if(!Array.isArray(raw))throw new Error('Kampagne ist ungültig.');this.levels=raw.map(parseLevel);if(this.levels.some((l,i)=>l.id!==i+1))throw new Error('Level-IDs müssen fortlaufend sein.');}
  get(id:number){const l=this.levels[id-1];if(!l)throw new Error('Level nicht gefunden.');return l;}
}
