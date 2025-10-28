// ===============================
// SMARTDESK MAP — SERVER EXPRESS
// ===============================
import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// Percorso file dati - usa volume persistente su Fly.io, altrimenti locale
const DATA_PATH = process.env.FLY_APP_NAME 
  ? "/data/tables.json" 
  : path.join(__dirname, "data", "tables.json");

// Inizializza file JSON su Fly.io se non esiste
function initDataFile() {
  try {
    // Se su Fly.io, crea la cartella /data se non esiste
    if (process.env.FLY_APP_NAME) {
      const dataDir = path.dirname(DATA_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
        console.log(`📁 Creata cartella: ${dataDir}`);
      }
    }
    
    // Se il file non esiste, crealo con dati di esempio
    if (!fs.existsSync(DATA_PATH)) {
      const initialData = {
        tables: [
          { id: 1, x: "50px", y: "100px", rotation: 0, reservations: [] },
          { id: 2, x: "150px", y: "100px", rotation: 90, reservations: [] },
          { id: 3, x: "250px", y: "100px", rotation: 0, reservations: [] },
          { id: 4, x: "350px", y: "100px", rotation: 90, reservations: [] },
          { id: 5, x: "450px", y: "100px", rotation: 0, reservations: [] },
          { id: 6, x: "50px", y: "200px", rotation: 0, reservations: [] },
          { id: 7, x: "150px", y: "200px", rotation: 90, reservations: [] },
          { id: 8, x: "250px", y: "200px", rotation: 0, reservations: [] },
          { id: 9, x: "350px", y: "200px", rotation: 90, reservations: [] },
          { id: 10, x: "450px", y: "200px", rotation: 0, reservations: [] }
        ]
      };
      fs.writeFileSync(DATA_PATH, JSON.stringify(initialData, null, 2), "utf8");
      console.log(`📄 File dati creato: ${DATA_PATH}`);
    } else {
      console.log(`✅ File dati trovato: ${DATA_PATH}`);
    }
  } catch (err) {
    console.error("❌ Errore inizializzazione file dati:", err);
  }
}

// ===============
// Helper functions
// ===============
function readData() {
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Errore lettura file JSON:", err);
    return { tables: [] };
  }
}

function writeData(data) {
  try {
    fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), "utf8");
  } catch (err) {
    console.error("Errore scrittura file JSON:", err);
  }
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  // Intervalli [aStart, aEnd) e [bStart, bEnd) si sovrappongono se:
  return aStart < bEnd && bStart < aEnd;
}

// =======================
// 🔹 GET /api/tables
// =======================
app.get("/api/tables", (req, res) => {
  const data = readData();
  res.json(data.tables);
});

// =======================
// 🔹 GET /api/tables/:id
// =======================
app.get("/api/tables/:id", (req, res) => {
  const id = Number(req.params.id);
  const data = readData();
  const tavolo = data.tables.find((t) => t.id === id);
  if (!tavolo) return res.status(404).json({ error: "Tavolo non trovato" });
  res.json(tavolo);
});

// =======================
// 🔹 POST /api/tables/:id/reserve
// =======================
app.post("/api/tables/:id/reserve", (req, res) => {
  try {
    const id = Number(req.params.id);
    const { username, start, end } = req.body;

    if (!username || !start || !end) {
      return res.status(400).json({ error: "Campi mancanti" });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);

    if (isNaN(startDate) || isNaN(endDate) || startDate >= endDate) {
      return res.status(400).json({ error: "Date non valide" });
    }

    const data = readData();
    const tavolo = data.tables.find((t) => t.id === id);
    if (!tavolo) return res.status(404).json({ error: "Tavolo non trovato" });

    // controllo conflitti
    const conflitto = tavolo.reservations.some((r) =>
      overlaps(new Date(r.start), new Date(r.end), startDate, endDate)
    );
    if (conflitto) {
      return res
        .status(409)
        .json({ error: "Tavolo già prenotato in quell'intervallo" });
    }

    // aggiungi prenotazione
    tavolo.reservations.push({
      username,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
    });

    writeData(data);
    console.log(
      `✅ Prenotazione tavolo ${id}: ${username} (${startDate.toISOString()} → ${endDate.toISOString()})`
    );
    res.status(201).json(tavolo);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore prenotazione" });
  }
});

// =======================
// 🔹 POST /api/tables/:id/release
// =======================
app.post("/api/tables/:id/release", (req, res) => {
  try {
    const id = Number(req.params.id);
    const data = readData();
    const tavolo = data.tables.find((t) => t.id === id);
    if (!tavolo) return res.status(404).json({ error: "Tavolo non trovato" });

    // rimuove tutte le prenotazioni scadute o correnti
    tavolo.reservations = [];
    writeData(data);
    console.log(`🟢 Tavolo ${id} liberato manualmente`);
    res.json(tavolo);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore liberazione tavolo" });
  }
});

// =======================
// 🔹 Pulizia prenotazioni scadute
// =======================
app.post("/api/cleanup", (req, res) => {
  try {
    const data = readData();
    const now = new Date();
    let removed = 0;
    data.tables.forEach((t) => {
      const before = t.reservations.length;
      t.reservations = t.reservations.filter((r) => new Date(r.end) > now);
      removed += before - t.reservations.length;
    });
    writeData(data);
    res.json({ ok: true, removed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore cleanup" });
  }
});

// =======================
// 🔹 POST /api/init - Carica tutti i tavoli dal client
// =======================
app.post("/api/init", (req, res) => {
  try {
    const { tables } = req.body;
    
    if (!tables || !Array.isArray(tables)) {
      return res.status(400).json({ error: "Array 'tables' mancante" });
    }
    
    // Sovrascrivi i tavoli con quelli ricevuti
    const data = { tables };
    writeData(data);
    
    console.log(`✅ Caricati ${tables.length} tavoli dal client`);
    res.json({ ok: true, count: tables.length });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Errore inizializzazione" });
  }
});

// =======================
// 🔹 AVVIO SERVER
// =======================
// 🔹 AVVIO SERVER
// =======================
const PORT = process.env.PORT || 4000;

// Inizializza file dati prima di avviare il server
initDataFile();

app.listen(PORT, () => {
  console.log(`✅ Server attivo su porta ${PORT}`);
  console.log(`📂 Percorso dati: ${DATA_PATH}`);
});
