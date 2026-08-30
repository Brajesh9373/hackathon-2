const TrustSource = require('../models/TrustSource');
const defaults = require('../data/trusted-sources.json');

async function listTrustedSources() { const existing = await TrustSource.find({ active: true }).lean(); return existing.length ? existing : defaults; }
module.exports = { listTrustedSources };
