import type { Claim, Material, Version } from './domain';

// Pure view helpers: this module can be shared by server and browser without crypto.
export function versionChanges(current: Version, previous?: Version) {
 const before = new Map(previous?.claims.map(c => [c.id, c]) ?? []);
 return {
  added: current.claims.filter(c => !before.has(c.id)),
  changed: current.claims.flatMap(c => {
   const old = before.get(c.id);
   return old && old.status !== c.status ? [{ claim: c, from: old.status, to: c.status }] : [];
  }),
  stage: previous && previous.stage !== current.stage ? { from: previous.stage, to: current.stage } : null,
 };
}
export function evidencePairs(claims: Claim[]) {
 return claims.filter(c => c.replacesKey).map(c => ({
  response: c,
  earlier: claims.filter(old => old.key === c.replacesKey && old.id !== c.id),
 }));
}
export function earliestKnownSource(snapshot: Version, materials: Material[]) {
 const ids = new Set(snapshot.materialIds);
 const known = materials.filter(m => ids.has(m.id));
 const dated = known.filter(m => m.publishedAt).sort((a,b) => Date.parse(a.publishedAt!) - Date.parse(b.publishedAt!) || a.id.localeCompare(b.id));
 return { source: dated[0] ?? null, unknownCount: known.filter(m => !m.publishedAt).length };
}
