// index.js - simple SSE proxy for Render
const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json({ limit: '1mb' }));

let clients = [];

// SSE endpoint Grok will connect to
app.get('/sse', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  res.flushHeaders();

  const id = Date.now() + Math.random();
  clients.push({ id, res });

  // remove client on close
  req.on('close', () => {
    clients = clients.filter(c => c.id !== id);
  });
});

// Broadcast helper
function broadcast(obj) {
  const payload = `data: ${JSON.stringify(obj)}\n\n`;
  clients.forEach(c => {
    try { c.res.write(payload); } catch (e) { /* ignore */ }
  });
}

// Webhook receiver (GitHub / Cloudflare can POST here)
app.post('/webhook', (req, res) => {
  // TODO: add signature verification in production
  const incoming = req.body || {};
  const mcpEvent = {
    // Adapt these fields to Grok's MCP schema if you have it
    type: 'external_event',
    source: incoming.repository?.full_name ? 'github' : 'cloudflare',
    timestamp: new Date().toISOString(),
    payload: incoming
  };
  broadcast(mcpEvent);
  res.status(200).send('ok');
});

// Optional endpoint to trigger a manual test event via browser/postman
app.post('/trigger-test', (req, res) => {
  const mcpEvent = {
    type: 'test',
    timestamp: new Date().toISOString(),
    payload: req.body || { msg: 'manual test' }
  };
  broadcast(mcpEvent);
  res.status(200).json({ sent: true });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on ${PORT}`));
