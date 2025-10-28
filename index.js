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

// Headers CORS manuali (soluzione più robusta)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Gestisci preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  
  next();
});

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: false
}));

app.use(express.json());

// Percorso file dati
const DATA_PATH = path.join(__dirname, "data", "tables.json");

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
// 🔹 AVVIO SERVER
// =======================
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Server attivo su http://localhost:${PORT}`);
});
