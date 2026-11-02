export type SkillInput = { skill:string; rating:number; source:"self_reported"|"tested"; weight:number };
export function scoreCareer(skills:SkillInput[]) {
  const totalWeight = skills.reduce((a,s)=>a+s.weight,0);
  const match = totalWeight ? Math.round(skills.reduce((a,s)=>a+s.weight*(Math.max(0,Math.min(5,s.rating))/5),0)/totalWeight*100) : 0;
  return { match, gaps:skills.filter(s=>s.rating<3).sort((a,b)=>b.weight-a.weight), improving:skills.filter(s=>s.rating>=3&&s.rating<4), strong:skills.filter(s=>s.rating>=4), note:"Indicative guidance based on supplied ratings and configured skill weights; not a validated aptitude test." };
}