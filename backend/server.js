const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Initialize SQLite DB
const db = new sqlite3.Database('./suggestions.db', (err) => {
    if (err) throw err;
});

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS suggestions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        text TEXT NOT NULL,
        time INTEGER NOT NULL
    )`);
    db.run(`CREATE TABLE IF NOT EXISTS votes (
        suggestion_id INTEGER,
        vote INTEGER, -- 1 for up, -1 for down
        voter TEXT,   -- e.g., IP or session id
        PRIMARY KEY (suggestion_id, voter)
    )`);
});

// Get all suggestions with vote counts
app.get('/suggestions', (req, res) => {
    db.all(`SELECT s.id, s.text, s.time, IFNULL(SUM(v.vote),0) as votes
            FROM suggestions s
            LEFT JOIN votes v ON s.id = v.suggestion_id
            GROUP BY s.id
            ORDER BY votes DESC, s.time ASC`, [], (err, rows) => {
        if (err) return res.status(500).json({error: err.message});
        res.json(rows);
    });
});

// Add a suggestion
app.post('/suggestions', (req, res) => {
    const { text } = req.body;
    if (!text || !text.trim()) return res.status(400).json({error: 'Text required'});
    const time = Date.now();
    db.run('INSERT INTO suggestions (text, time) VALUES (?, ?)', [text.trim(), time], function(err) {
        if (err) return res.status(500).json({error: err.message});
        res.json({ id: this.lastID, text: text.trim(), time, votes: 0 });
    });
});

// Vote on a suggestion
app.post('/vote', (req, res) => {
    const { suggestion_id, vote, voter } = req.body;
    if (!suggestion_id || ![1, -1].includes(vote) || !voter) {
        return res.status(400).json({error: 'Invalid vote'});
    }
    // Upsert vote
    db.run('INSERT OR REPLACE INTO votes (suggestion_id, vote, voter) VALUES (?, ?, ?)',
        [suggestion_id, vote, voter],
        function(err) {
            if (err) return res.status(500).json({error: err.message});
            res.json({ success: true });
        }
    );
});

app.listen(PORT, () => {
    console.log(`Suggestion backend running on http://localhost:${PORT}`);
});
