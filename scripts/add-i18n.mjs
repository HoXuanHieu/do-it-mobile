// Usage: node scripts/add-i18n.mjs "Vietnamese key=English" ...  — adds mobile-only UI strings to en.json (skips existing).
import { readFileSync, writeFileSync } from 'node:fs'
const file = new URL('../src/i18n/locales/en.json', import.meta.url)
const dict = JSON.parse(readFileSync(file, 'utf8'))
for (const arg of process.argv.slice(2)) {
  const i = arg.indexOf('=')
  const [k, v] = [arg.slice(0, i), arg.slice(i + 1)]
  if (!(k in dict)) dict[k] = v
}
writeFileSync(file, JSON.stringify(dict, null, 2) + '\n')
