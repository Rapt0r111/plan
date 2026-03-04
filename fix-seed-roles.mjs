#!/usr/bin/env node
/**
 * fix-seed-roles.mjs
 * Заменяет несуществующие роли в seed.ts на валидные.
 *
 * Запуск: node fix-seed-roles.mjs
 *
 * deputy_commander  → deputy_platoon_1  (ЗКВ-1, Антипов)
 * research_officer  → squad_commander_2 (КО-2, Арсенов)
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

const seedPath = resolve(process.cwd(), "shared/db/seed.ts");

let content = readFileSync(seedPath, "utf-8");

const before = content;

content = content.replaceAll('"deputy_commander"', '"deputy_platoon_1"');
content = content.replaceAll('"research_officer"', '"squad_commander_2"');

if (content === before) {
  console.log("✅ Файл уже исправлен — невалидных ролей не найдено.");
} else {
  writeFileSync(seedPath, content, "utf-8");
  const dc = (before.match(/"deputy_commander"/g) ?? []).length;
  const ro = (before.match(/"research_officer"/g) ?? []).length;
  console.log(`✅ seed.ts исправлен:`);
  console.log(`   "deputy_commander"  → "deputy_platoon_1"  (${dc} замен)`);
  console.log(`   "research_officer"  → "squad_commander_2" (${ro} замен)`);
  console.log(`\nЗапустите повторно сид:`);
  console.log(`   bun run db:seed`);
}
