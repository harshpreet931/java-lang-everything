#!/usr/bin/env node
// pnpm indexnow [site-url]
// tells IndexNow search engines (bing, yandex, seznam, naver...) about every url in the live
// sitemap, so new chapters get crawled in minutes instead of weeks. google doesn't use
// IndexNow: for google, submit sitemap.xml once in search console.
import fs from "node:fs";
import path from "node:path";

const site = (process.argv[2] ?? "https://java.harshpreet.com").replace(/\/$/, "");
const keyFile = fs.readdirSync(path.join(process.cwd(), "public")).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) {
  console.error("no IndexNow key file (public/<32 hex>.txt)");
  process.exit(1);
}
const key = keyFile.replace(".txt", "");

const xml = await (await fetch(`${site}/sitemap.xml`)).text();
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (!urlList.length) {
  console.error("sitemap has no urls");
  process.exit(1);
}

// the shared endpoint can lag on new keys, so also submit to bing and yandex directly
const endpoints = ["https://api.indexnow.org/indexnow", "https://www.bing.com/indexnow", "https://yandex.com/indexnow"];
const body = JSON.stringify({ host: new URL(site).host, key, keyLocation: `${site}/${keyFile}`, urlList });
let ok = 0;
for (const url of endpoints) {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json; charset=utf-8" }, body });
    const fine = res.ok || res.status === 202;
    if (fine) ok++;
    console.log(`${fine ? "✓" : "✗"} ${new URL(url).host}: ${urlList.length} urls → ${res.status} ${res.statusText}`);
  } catch (e) {
    console.log(`✗ ${new URL(url).host}: ${e.message}`);
  }
}
process.exit(ok ? 0 : 1);
