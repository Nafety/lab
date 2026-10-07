// Récupère la liste des sites du patrimoine mondial de l'UNESCO ayant un article sur Wikipédia en français
// (Wikidata, CC0) et l'enregistre dans src/data/unesco.json. Usage : node tools/fetch-unesco.mjs
import { writeFile } from 'node:fs/promises';

const QUERY = `SELECT ?itemLabel ?countryLabel ?coord ?article WHERE {
  ?item wdt:P1435 wd:Q9259; wdt:P625 ?coord; wdt:P17 ?country.
  ?article schema:about ?item; schema:isPartOf <https://fr.wikipedia.org/>.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "fr". }
}`;

const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(QUERY)}`, {
  headers: { Accept: 'application/sparql-results+json', 'User-Agent': 'le-labo/0.1' },
});
const rows = (await res.json()).results.bindings;
const seen = new Set();
const sites = [];
for (const r of rows) {
  const title = decodeURIComponent(r.article.value.split('/wiki/')[1]);
  if (seen.has(title)) continue; // un site peut apparaître plusieurs fois (plusieurs pays ou coordonnées)
  seen.add(title);
  const [lon, lat] = r.coord.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/).slice(1).map(Number);
  sites.push({ name: r.itemLabel.value, country: r.countryLabel.value, lat: +lat.toFixed(3), lon: +lon.toFixed(3), wiki: title });
}
await writeFile('src/data/unesco.json', JSON.stringify(sites));
console.log(`${sites.length} sites enregistrés.`);
