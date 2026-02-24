import { kv } from '@vercel/kv';

const INZENDINGEN_KEY = 'inzendingen:raw';
const OPENAI_MODEL = process.env.OPENAI_MODERATION_MODEL || 'gpt-4.1-mini';

function norm(v = '') {
  const s = String(v ?? '').trim();
  if (!s) return '';
  const l = s.toLowerCase();
  if (l === 'undefined' || l === 'null') return '';
  return s;
}

function countWords(s = '') {
  return norm(s).split(/\s+/).filter(Boolean).length;
}

function heuristicModeration({ onderwerp, wanneer, gebeurtenis, bewijs }) {
  const notes = [];
  let score = 100;

  const allText = `${onderwerp} ${wanneer} ${gebeurtenis}`;
  const words = countWords(allText);
  const bodyWords = countWords(gebeurtenis);

  if (bodyWords < 10) {
    score -= 45;
    notes.push('Te weinig inhoud om feitelijk te controleren.');
  }
  if (gebeurtenis.length < 55) {
    score -= 30;
    notes.push('Beschrijving is te kort en mist context.');
  }
  if (words < 16) {
    score -= 15;
    notes.push('Er zijn weinig concrete details genoemd.');
  }
  if (/(.)\1{7,}/i.test(allText)) {
    score -= 35;
    notes.push('Tekst bevat onnatuurlijke herhaling.');
  }
  if (/\b(test|testing|asdf|qwerty|lol|lmao|haha+)\b/i.test(allText)) {
    score -= 25;
    notes.push('Lijkt op testtekst of niet-serieuze inhoud.');
  }
  if (/\b(ik weet niet|geen idee|misschien|idk)\b/i.test(allText)) {
    score -= 15;
    notes.push('Te onzeker geformuleerd voor publicatie.');
  }

  const badWords = /(kanker|kk\b|tering|tyfus|nazi|hitler|faggot|nigger)/i;
  if (badWords.test(allText)) {
    score -= 60;
    notes.push('Bevat beledigende of ongepaste taal.');
  }

  const linkCount = (allText.match(/https?:\/\//g) || []).length;
  if (linkCount > 3) {
    score -= 20;
    notes.push('Te veel links in een enkele inzending.');
  }

  if (!/[0-9]/.test(wanneer) && !/gisteren|vandaag|vanavond|vanochtend|nacht|middag|avond/i.test(wanneer)) {
    score -= 10;
    notes.push('Moment van gebeurtenis is te vaag.');
  }

  const symbolRatio = ((allText.match(/[^\p{L}\p{N}\s.,!?:\-]/gu) || []).length) / Math.max(allText.length, 1);
  if (symbolRatio > 0.2) {
    score -= 25;
    notes.push('Tekst bevat veel onbruikbare tekens of ruis.');
  }

  if (bewijs && !/^https?:\/\//i.test(bewijs)) {
    score -= 10;
    notes.push('Bewijslink is geen geldige URL.');
  }

  return {
    accepted: score >= 60,
    score,
    notes: notes.slice(0, 4),
    source: 'heuristic',
  };
}

function safeModerationResult(x) {
  if (!x || typeof x !== 'object') return null;
  const accepted = !!x.accepted;
  const scoreRaw = Number(x.score);
  const score = Number.isFinite(scoreRaw) ? Math.max(0, Math.min(100, Math.round(scoreRaw))) : (accepted ? 80 : 35);
  const notes = Array.isArray(x.notes) ? x.notes.map(n => norm(n)).filter(Boolean).slice(0, 4) : [];
  return { accepted, score, notes, source: 'llm' };
}

async function llmModeration(payload) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  const system = [
    'Je bent Dirk, moderator voor inzendingen van een online krant.',
    'Beoordeel of tekst voldoende feitelijk en serieus is.',
    'Keur af bij onzin, scheldwoorden, ruis, testberichten, of extreem vage meldingen.',
    'Geef ALLEEN geldige JSON terug met keys: accepted(boolean), score(number 0-100), notes(array van korte Nederlandse redenen).',
    'Houd notes maximaal 4 items.',
  ].join(' ');

  const user = {
    onderwerp: payload.onderwerp,
    wanneer: payload.wanneer,
    gebeurtenis: payload.gebeurtenis,
    bewijsLink: payload.bewijs || null,
  };

  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(user) },
        ],
      }),
    });

    if (!resp.ok) return null;
    const data = await resp.json();
    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    return safeModerationResult(parsed);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
      return res.status(200).json({ accepted: false, onderwerp: '', message: 'Spamfilter actief.' });
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
      return res.status(400).json({ accepted: false, onderwerp, message: 'Verplichte velden ontbreken.' });
    }

    const toegestaneHerkomst = ['Noord', 'Oost', 'Zuid', 'West'];
    if (!toegestaneHerkomst.includes(herkomst)) {
      return res.status(400).json({ accepted: false, onderwerp, message: 'Ongeldige herkomst.' });
    }

    const heuristic = heuristicModeration({ onderwerp, wanneer, gebeurtenis, bewijs });
    const llm = await llmModeration({ onderwerp, wanneer, gebeurtenis, bewijs });
    const moderation = llm || heuristic;

    if (!moderation.accepted) {
      return res.status(200).json({
        accepted: false,
        onderwerp,
        dirk: {
          score: moderation.score,
          notes: moderation.notes,
          source: moderation.source,
        },
        message: 'Dit bericht is helaas niet goedgekeurd door mij, Dirk. Herschrijf het of stuur het door via Discord DM naar @JaymianLee.',
      });
    }

    const inzending = {
      id: `inz_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      status: 'Goedgekeurd door Dirk',
      minecraftNaam: minecraftNaamRaw,
      onderwerp,
      herkomst,
      datumInzending,
      wanneer,
      gebeurtenis,
      anoniemPubliceren: anoniem,
      bewijsLink: bewijs || null,
      aangemaaktOp: new Date().toISOString(),
      moderation: {
        by: 'Dirk',
        source: moderation.source,
        score: moderation.score,
      },
    };

    await saveInzending(inzending);

    return res.status(200).json({
      accepted: true,
      onderwerp,
      dirk: {
        score: moderation.score,
        notes: moderation.notes,
        source: moderation.source,
      },
      message: `Het bericht over \"${onderwerp}\" is geaccepteerd en zal verwerkt worden!`,
    });
  } catch (e) {
    return res.status(500).json({ accepted: false, onderwerp: '', message: `Interne fout: ${e?.message || 'onbekend'}` });
  }
}
