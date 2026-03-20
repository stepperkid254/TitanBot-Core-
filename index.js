const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const log = (msg) => console.log(`[ TitanBot-Core 🛡️ ] ${msg}`);

(function ensureDeps() {
    const needed = ['axios', 'adm-zip'];
    const missing = needed.filter(p => { try { require.resolve(p); return false; } catch { return true; } });
    if (missing.length) execSync(`npm install ${missing.join(' ')} --no-save`, { stdio: 'inherit' });
})();

const axios = require('axios');
const AdmZip = require('adm-zip');

const DOWNLOAD_URL = 'https://github.com/stepperkid/STEPPERKID-TECH-WORLD-/archive/refs/heads/main.zip';
const TEMP_DIR = path.join(__dirname, '.titanbot_core');
const EXTRACT_DIR = path.join(TEMP_DIR, 'STEPPERKID-TECH-WORLD--main');
const ZIP_PATH = path.join(TEMP_DIR, 'bot.zip');

async function start() {
    if (!fs.existsSync(path.join(EXTRACT_DIR, 'index.js'))) {
        log('Downloading latest files...');
        fs.mkdirSync(TEMP_DIR, { recursive: true });
        const res = await axios.get(DOWNLOAD_URL, { responseType: 'arraybuffer' });
        fs.writeFileSync(ZIP_PATH, Buffer.from(res.data));
        new AdmZip(ZIP_PATH).extractAllTo(TEMP_DIR, true);
        log('Download complete ✅');
    } else {
        log('Files found, skipping download');
    }

    log('Installing dependencies...');
    try { execSync('npm install --legacy-peer-deps', { stdio: 'inherit', cwd: EXTRACT_DIR }); } catch {}

    log('Starting TitanBot-Core 🛡️...');
    const child = spawn(process.execPath, ['index.js'], {
        cwd: EXTRACT_DIR,
        stdio: 'inherit',
        env: { ...process.env }
    });

    child.on('exit', code => { log(`Exited (${code}). Restarting in 5s...`); setTimeout(start, 5000); });
    child.on('error', err => { log(`Error: ${err.message}. Restarting in 5s...`); setTimeout(start, 5000); });
}

start().catch(err => { console.error(err); process.exit(1); });
