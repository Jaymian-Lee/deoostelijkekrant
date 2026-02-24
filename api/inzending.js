import { kv } from '@vercel/kv';

const INZENDINGEN_KEY = 'inzendingen:raw';

function norm(v = '') {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const l = s.toLowerCase();
  if (l === 'undefined' || l === 'null') return '';
  return s;
}
async function readBody(req) {
  if (typeof req.body === 'string') return new URLSearchParams(req.body);
  if (req.body && typeof req.body === 'object') return new URLSearchParams(Object.entries(req.body));
  return new URLSearchParams();
}

async function saveInzending(item) {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    throw new Error('Vercel KV env vars ontbreken (KV_REST_API_URL/KV_REST_API_TOKEN).');
  }

  await kv.lpush(INZENDINGEN_KEY, JSON.stringify(item));
  await kv.ltrim(INZENDINGEN_KEY, 0, 1999);
}

export default async function handler(req, res) {
  try {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const form = await readBody(req);
    const honey = norm(form.get('_honey'));
    if (honey) {
      res.statusCode = 303;
      res.setHeader('Location', '/inzendingen/?verzonden=1');
      return res.end();
    }

    const minecraftNaamRaw = norm(form.get('minecraft_naam'));
    const onderwerp = norm(form.get('onderwerp'));
    const herkomst = norm(form.get('herkomst_team'));
    const datumInzending = norm(form.get('datum_inzending'));
    const wanneer = norm(form.get('wanneer'));
    const gebeurtenis = norm(form.get('gebeurtenis'));
    const anoniem = norm(form.get('anoniem_publiceren')) || 'Nee';
    const bewijs = norm(form.get('bewijs_link'));

    if (!minecraftNaamRaw || !onderwerp || !herkomst || !datumInzending || !wanneer || !gebeurtenis) {
      return res.status(400).send('Verplichte velden ontbreken.');
    }
    const toegestaneHerkomst = ['Noord', 'Oost', 'Zuid', 'West'];
    if (!toegestaneHerkomst.includes(herkomst)) {
      return res.status(400).send('Ongeldige herkomst.');
    }

    const minecraftNaam = minecraftNaamRaw;
    const now = new Date().toISOString();

    const inzending = {
      id: `inz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'Nieuw',
      minecraftNaam,
      onderwerp,
      herkomst,
      datumInzending,
      wanneer,
      gebeurtenis,
      anoniemPubliceren: anoniem,
      bewijsLink: bewijs || null,
      aangemaaktOp: now,
    };

    try {
      await saveInzending(inzending);
      res.statusCode = 303;
      res.setHeader('Location', '/inzendingen/?verzonden=1');
      return res.end();
    } catch {
      return res.status(500).send('Opslaan mislukt, probeer later opnieuw.');
    }
  } catch (e) {
    return res.status(500).send(`Interne fout: ${e?.message || 'onbekend'}`);
  }
}
