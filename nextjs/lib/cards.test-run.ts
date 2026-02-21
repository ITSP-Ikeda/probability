/**
 * Minimal tests: run with npm run test (ts-node required)
 */
import { parseCard, parseCards, findDuplicates, validateInput, buildDeck, createSeededRng } from "./cards";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

const as = parseCard("As");
assert("card" in as && as.card === "As", "parseCard As");
const td = parseCard("Td");
assert("card" in td && td.card === "Td", "parseCard Td");
assert("error" in parseCard("1s"), "parseCard invalid");
const parsed = parseCards("As Kd 7h");
assert("cards" in parsed && parsed.cards.length === 3, "parseCards");
assert(findDuplicates(["As", "Kd"], ["7h", "As"]).length === 1, "findDuplicates");
const v1 = validateInput(["As", "Kd"], []);
assert("ok" in v1 && v1.ok, "validate hero2 board0");
assert("error" in validateInput(["As"], []), "validate hero length");
assert("error" in validateInput(["As", "Kd"], ["7h"]), "validate board length");
assert(buildDeck(["As", "Kd"]).length === 50, "buildDeck");
const r1 = createSeededRng(12345);
const r2 = createSeededRng(12345);
assert(r1() === r2() && r1() === r2(), "seed reproducibility");
console.log("cards.test-run: all passed");
process.exit(0);
