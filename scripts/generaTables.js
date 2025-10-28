// server/scripts/generaTables.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createTavoli } from "../../client/src/tavoliFactory.js"; // <-- percorso corretto se il file è in client/src

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Genera tutti i tavoli con la struttura aggiornata
const tavoli = createTavoli().map((t) => ({
  id: t.id,
  name: `Tavolo ${t.id}`,
  x: t.x,
  y: t.y,
  rotation: t.rotazione || 0,
  reservations: []
}));

// Crea la cartella data se non esiste
const dataDir = path.join(__dirname, "..", "data");
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

// Scrivi il file JSON
const filePath = path.join(dataDir, "tables.json");
fs.writeFileSync(filePath, JSON.stringify({ tables: tavoli }, null, 2), "utf8");

console.log(`✅ Creato file tables.json con ${tavoli.length} tavoli.`);
