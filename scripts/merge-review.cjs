// Used by the "App Store listing" workflow before a push. The reviewer's
// contact details live only in App Store Connect (this repo is public), so
// they are copied from a fresh pull into the config that gets pushed.
//   node scripts/merge-review.cjs <pulled.json> <store.config.json>
const fs = require('fs');
const [pulledPath, minePath] = process.argv.slice(2);
const pulled = JSON.parse(fs.readFileSync(pulledPath, 'utf8'));
const mine = JSON.parse(fs.readFileSync(minePath, 'utf8'));
const r = (pulled.apple && pulled.apple.review) || {};
for (const k of ['firstName', 'lastName', 'email', 'phone']) {
  if (!r[k]) { console.error('App Store Connect has no review contact ' + k + '; add it there first.'); process.exit(1); }
  mine.apple.review[k] = r[k];
}
fs.writeFileSync(minePath, JSON.stringify(mine, null, 2) + '\n');
console.log('review contact merged (not printed)');
