import { mkdir, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

const root = "http://www.ech.ch/xmlns/eCH-0217/2/eCH-0217-2-0-0.xsd";
const target = process.argv[2] ?? "/tmp/ech0217-xsd";
const queue = [root];
const downloaded = new Map();

await mkdir(target, { recursive: true });
while (queue.length) {
  const url = queue.shift();
  if (downloaded.has(url)) continue;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Schema konnte nicht abgerufen werden: ${url} (${response.status})`);
  const xml = await response.text();
  const filename = basename(new URL(url).pathname);
  await writeFile(resolve(target, filename), xml, "utf8");
  downloaded.set(url, filename);
  for (const match of xml.matchAll(/schemaLocation="([^"]+)"/g)) {
    const dependency = match[1];
    if (dependency.startsWith("http://") || dependency.startsWith("https://")) queue.push(dependency);
  }
}
await writeFile(resolve(target, "catalog.json"), JSON.stringify({ root, schemas: Object.fromEntries(downloaded) }, null, 2), "utf8");
console.log(`eCH-Schemakette gespeichert: ${downloaded.size} XSD-Dateien in ${target}`);
