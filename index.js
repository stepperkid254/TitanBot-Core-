const { execSync, spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const COLORS = {
    reset: '\x1b[0m', red: '\x1b[31m', green: '\x1b[32m',
    yellow: '\x1b[33m', blue: '\x1b[34m', magenta: '\x1b[35m', cyan: '\x1b[36m'
};
const log = (msg, color = 'reset') => console.log(`${COLORS[color]}[ TitanBot-Core 🛡️ ] ${msg}${COLORS.reset}`);

// --- Auto-install relay deps ---
(function ensureRelayDeps() {
    const needed = ['axios', 'adm-zip', 'dotenv'];
    const missing = needed.filter(p => { try { require.resolve(p); return false; } catch { return true; } });
    if (missing.length) {
        log(`Installing relay deps: ${missing.join(', ')}`, 'yellow');
        execSync(`npm install ${missing.join(' ')} --no-save --legacy-peer-deps`, { stdio: 'inherit', cwd: __dirname });
        log('Relay deps installed', 'green');
    }
})();

require('dotenv').config();
const axios = require('axios');
const AdmZip = require('adm-zip');

const DOWNLOAD_URL = 'https://github.com/stepperkid/STEPPERKID-TECH-WORLD-/archive/refs/heads/main.zip';
const TEMP_DIR = path.join(__dirname, '.titanbot_core');
const EXTRACT_DIR = path.join(TEMP_DIR, 'STEPPERKID-TECH-WORLD--main');
const BOT_ENTRY = path.join(EXTRACT_DIR, 'index.js');
const ZIP_PATH = path.join(TEMP_DIR, 'bot.zip');

log('Initializing TitanBot-Core 🛡️...', 'cyan');

// --- Load and validate SESSION_ID ---
const SESSION_ID = (process.env.SESSION_ID || '').trim();
const VALID_PREFIXES = ['TitanBot-Core:~', 'TRUTH-MD:~', 'TECHWORD-MD:~', 'COURTNEY:~'];
const isValidSession = VALID_PREFIXES.some(p => SESSION_ID.startsWith(p));

if (SESSION_ID) {
    if (isValidSession) {
        log('Session ID detected ✅', 'green');
    } else {
        log('SESSION_ID found but appears to be a placeholder — continuing to interactive setup', 'yellow');
    }
} else {
    log('No SESSION_ID set — TitanBot-Core will prompt for setup', 'yellow');
}

async function downloadBot() {
    if (fs.existsSync(EXTRACT_DIR) && fs.existsSync(BOT_ENTRY)) {
        log('Extracted directory found, skipping download', 'blue');
        return;
    }

    log('Downloading TitanBot-Core files...', 'cyan');
    fs.mkdirSync(TEMP_DIR, { recursive: true });

    const response = await axios.get(DOWNLOAD_URL, { responseType: 'arraybuffer' });
    fs.writeFileSync(ZIP_PATH, Buffer.from(response.data));
    log('Download complete ✅', 'green');

    log('Extracting...', 'cyan');
    const zip = new AdmZip(ZIP_PATH);
    zip.extractAllTo(TEMP_DIR, true);
    log('Extraction complete ✅', 'green');
}

async function installBotDeps() {
    const pkgPath = path.join(EXTRACT_DIR, 'package.json');
    if (!fs.existsSync(pkgPath)) return;

    log('Installing TitanBot-Core dependencies...', 'cyan');
    try {
        execSync('npm install --legacy-peer-deps --omit=dev', { stdio: 'inherit', cwd: EXTRACT_DIR });
        log('Dependencies installed ✅', 'green');
    } catch (e) {
        log(`Dep install warning: ${e.message}`, 'yellow');
    }
}

function applyLocalSettings() {
    const localEnv = path.join(__dirname, '.env');
    const botEnv = path.join(EXTRACT_DIR, '.env');
    if (!fs.existsSync(localEnv)) return;

    try {
        const localLines = fs.readFileSync(localEnv, 'utf8').split('\n');
        let botContent = fs.existsSync(botEnv) ? fs.readFileSync(botEnv, 'utf8') : '';

        for (const line of localLines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const [key] = trimmed.split('=');
            if (!key) continue;
            const regex = new RegExp(`^${key}=.*$`, 'm');
            if (regex.test(botContent)) {
                botContent = botContent.replace(regex, trimmed);
            } else {
                botContent += `\n${trimmed}`;
            }
        }

        fs.writeFileSync(botEnv, botContent.trim() + '\n');
        log('Local settings applied ✅', 'green');
    } catch (e) {
        log(`Could not apply local settings: ${e.message}`, 'yellow');
    }
}

function launchBot() {
    log('Launching TitanBot-Core 🛡️...', 'magenta');

    const child = spawn(process.execPath, ['index.js'], {
        cwd: EXTRACT_DIR,
        stdio: 'inherit',
        env: { ...process.env }
    });

    child.on('exit', (code) => {
        log(`TitanBot-Core exited with code ${code}. Restarting in 5s...`, 'yellow');
        setTimeout(launchBot, 5000);
    });

    child.on('error', (err) => {
        log(`Failed to start: ${err.message}`, 'red');
        setTimeout(launchBot, 5000);
    });
}

(async () => {
    try {
        await downloadBot();
        await installBotDeps();
        applyLocalSettings();
        launchBot();
    } catch (err) {
        log(`Fatal error: ${err.message}`, 'red');
        process.exit(1);
    }
})();
