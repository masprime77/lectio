const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const SEMESTERS_DIR = path.join(__dirname, 'semesters');

app.use(express.json());
app.use(express.static(__dirname));

// Reject ids that could escape the semesters directory
const safeId = (id) => /^[a-zA-Z0-9_-]+$/.test(id);
const fileFor = (id) => path.join(SEMESTERS_DIR, `${id}.json`);

// List all semester files
app.get('/api/semesters', (req, res) => {
  const files = fs.readdirSync(SEMESTERS_DIR).filter((f) => f.endsWith('.json'));
  const list = files.map((f) => {
    const data = JSON.parse(fs.readFileSync(path.join(SEMESTERS_DIR, f), 'utf8'));
    return { id: path.basename(f, '.json'), name: data.name || data.id };
  });
  res.json(list);
});

// Load one semester
app.get('/api/semesters/:id', (req, res) => {
  const { id } = req.params;
  if (!safeId(id) || !fs.existsSync(fileFor(id))) return res.status(404).json({ error: 'Not found' });
  res.json(JSON.parse(fs.readFileSync(fileFor(id), 'utf8')));
});

// Save (or create) a semester
app.put('/api/semesters/:id', (req, res) => {
  const { id } = req.params;
  if (!safeId(id)) return res.status(400).json({ error: 'Invalid id' });
  fs.writeFileSync(fileFor(id), JSON.stringify(req.body, null, 2));
  res.json({ ok: true, id });
});

// Delete a semester
app.delete('/api/semesters/:id', (req, res) => {
  const { id } = req.params;
  if (!safeId(id) || !fs.existsSync(fileFor(id))) return res.status(404).json({ error: 'Not found' });
  fs.unlinkSync(fileFor(id));
  res.json({ ok: true, id });
});

app.listen(PORT, () => {
  console.log(`Semester planner running at http://localhost:${PORT}`);
});
