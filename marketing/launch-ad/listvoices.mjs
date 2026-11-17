import { pathToFileURL } from 'node:url';
const base = 'C:/Users/user/.claude/skills/media-use/audio/scripts/lib/heygen.mjs';
const { heygenAuthHeaders, heygenJSON } = await import(pathToFileURL(base).href);
const h = heygenAuthHeaders();
let token = '', all = [];
for (let i = 0; i < 60; i++) {
  const p = await heygenJSON(`/voices?engine=starfish&type=public&limit=100${token ? `&token=${token}` : ''}`, { headers: h });
  if (i === 0) console.error('keys', Object.keys(p), p.data && !Array.isArray(p.data) ? Object.keys(p.data) : '');
  const arr = p.data ?? p.voices ?? [];
  all.push(...arr);
  token = p.next_token ?? p.token ?? p.pagination?.next_token ?? p.next_page_token ?? '';
  if (!token || !arr.length) break;
}
console.error('total', all.length);
(await import('node:fs')).writeFileSync('voices.json', JSON.stringify(all));
for (const v of all) if (/hindi|india|hi-|^hi$/i.test(`${v.language} ${v.locale ?? ''} ${v.accent ?? ''}`)) console.log(`${v.voice_id}\t${v.name}\t${v.language}\t${v.gender}\t${v.preview_audio_url ? 'preview' : ''}`);
