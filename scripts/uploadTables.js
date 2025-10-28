// 📤 Upload tutti i tavoli al server Fly.io
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_URL = "https://smartdesk-backend.fly.dev/api/init";
const LOCAL_TABLES = path.join(__dirname, "..", "data", "tables.json");

async function upload() {
  try {
    // Leggi il file locale con tutti i 203 tavoli
    const content = fs.readFileSync(LOCAL_TABLES, "utf8");
    const data = JSON.parse(content);

    console.log(`📊 Trovati ${data.tables.length} tavoli da caricare...`);

    // Invia al server
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    const result = await res.json();
    
    if (result.ok) {
      console.log(`✅ Caricati ${result.count} tavoli su Fly.io!`);
    } else {
      console.error("❌ Errore:", result);
    }
  } catch (err) {
    console.error("❌ Errore upload:", err.message);
  }
}

upload();
