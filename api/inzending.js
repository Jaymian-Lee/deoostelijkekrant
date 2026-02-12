import nodemailer from 'nodemailer';
import fs from 'node:fs';
import path from 'node:path';

const DATA_PATH = path.join(process.cwd(), 'data', 'ncsmp-players.json');

function loadPlayers() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    const data = JSON.parse(raw);
    return {
      oost: (data?.teams?.oost || []).map(String),
      all: (data?.allPlayersSorted || []).map(String),
      unlockDate: data?.unlockAllTeamsFrom || '2026-02-20',
    };
  } catch {
    return { oost: [], all: [], unlockDate: '2026-02-20' };
  }
}

function norm(v = '') { return String(v).trim(); }
function low(v = '') { return norm(v).toLowerCase(); }

function levenshtein(a, b) {
  a = low(a); b = low(b);
  const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[a.length][b.length];
}

function bestMatch(input, names) {
  const x = norm(input);
  if (!x) return null;
  const exact = names.find(n => n === x);
  if (exact) return { name: exact, score: 0 };
  const ci = names.find(n => low(n) === low(x));
  if (ci) return { name: ci, score: 0 };
  let best = null;
  for (const n of names) {
    const d = levenshtein(x, n);
    if (!best || d < best.score) best = { name: n, score: d };
  }
  return best && best.score <= 2 ? best : null;
}

async function readBody(req) {
  if (typeof req.body === 'string') {
    return new URLSearchParams(req.body);
  }
  if (req.body && typeof req.body === 'object') {
    return new URLSearchParams(Object.entries(req.body));
  }
  return new URLSearchParams();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const form = await readBody(req);
  const honey = norm(form.get('_honey'));
  if (honey) return res.redirect(303, '/inzendingen/?verzonden=1');

  const minecraftNaamRaw = norm(form.get('minecraft_naam'));
  const onderwerp = norm(form.get('onderwerp'));
  const datumInzending = norm(form.get('datum_inzending'));
  const wanneer = norm(form.get('wanneer'));
  const gebeurtenis = norm(form.get('gebeurtenis'));
  const anoniem = norm(form.get('anoniem_publiceren')) || 'Nee';
  const bewijs = norm(form.get('bewijs_link'));

  if (!minecraftNaamRaw || !onderwerp || !datumInzending || !wanneer || !gebeurtenis) {
    return res.status(400).send('Verplichte velden ontbreken.');
  }

  const { oost, all, unlockDate } = loadPlayers();
  const allowAll = new Date() >= new Date(`${unlockDate}T00:00:00`);
  const allowed = allowAll ? all : oost;
  const match = bestMatch(minecraftNaamRaw, allowed);

  if (!match) {
    const msg = allowAll
      ? 'Je gebruikersnaam staat niet in de deelnemerslijst. Weet je zeker dat je je naam juist hebt ingevuld, denk aan hoofdletters, speciale tekens en cijfers.'
      : 'Je hoort helaas niet bij team OOST en mag daarom geen tips sturen. Dit zal later komen na de val van de muur. Weet je zeker dat je je naam juist hebt ingevuld, denk aan hoofdletters, speciale tekens en cijfers.';
    return res.status(403).send(msg);
  }

  const minecraftNaam = match.name;

  const host = process.env.KRANT_SMTP_HOST || 'mail.deoostelijkekrant.nl';
  const port = Number(process.env.KRANT_SMTP_PORT || 587);
  const user = process.env.KRANT_SMTP_USER;
  const pass = process.env.KRANT_SMTP_PASS;
  const to = process.env.KRANT_INZENDING_TO || 'inzending@deoostelijkekrant.nl';
  const from = process.env.KRANT_INZENDING_FROM || user || 'inzending@deoostelijkekrant.nl';

  if (!user || !pass) {
    return res.status(500).send('SMTP is nog niet geconfigureerd.');
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: false,
    auth: { user, pass },
    tls: { minVersion: 'TLSv1.2' },
  });

  const subject = `[Inzending] ${onderwerp} (${minecraftNaam})`;
  const text = [
    'Nieuwe inzending via website',
    '',
    `Minecraft naam: ${minecraftNaam}`,
    `Onderwerp: ${onderwerp}`,
    `Datum inzending: ${datumInzending}`,
    `Wanneer gebeurd: ${wanneer}`,
    `Anoniem publiceren: ${anoniem}`,
    bewijs ? `Bewijs link: ${bewijs}` : 'Bewijs link: (geen)',
    '',
    'Gebeurtenis:',
    gebeurtenis,
  ].join('\n');

  try {
    await transporter.sendMail({ from, to, subject, text, replyTo: from });
    return res.redirect(303, '/inzendingen/?verzonden=1');
  } catch {
    return res.status(500).send('Verzenden mislukt, probeer later opnieuw.');
  }
}
