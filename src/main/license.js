import crypto from 'crypto';
import https from 'https';
import fs from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { app } from 'electron';
import { 
  SystemSetting, sequelize, Payment, TeacherPayment, Expense, Absence, AuditLog, 
  Schedule, ScheduleRequest, StudentCourses, Course, Student, Teacher, User 
} from './database/models.js';

let cachedMachineId = null;

// Database monotonic date check
async function getLatestDatabaseDate() {
  try {
    if (!sequelize) return null;
    const results = await sequelize.query(`
      SELECT MAX(latest_date) as max_date FROM (
        SELECT MAX(date) as latest_date FROM Payments
        UNION ALL
        SELECT MAX(date) as latest_date FROM TeacherPayments
        UNION ALL
        SELECT MAX(date) as latest_date FROM Expenses
        UNION ALL
        SELECT MAX(createdAt) as latest_date FROM AuditLogs
      )
    `, { type: sequelize.QueryTypes.SELECT });
    
    if (results && results[0] && results[0].max_date) {
      const maxDateStr = new Date(results[0].max_date).toISOString().split('T')[0];
      return maxDateStr;
    }
  } catch (err) {
    console.error("Error fetching latest database date:", err.message);
  }
  return null;
}

function getLicenseStateFilePath() {
  try {
    if (app && app.getPath) {
      const userDataPath = app.getPath('userData');
      return join(userDataPath, 'app_state.bin');
    }
  } catch (e) {
    // Fail silently, fall back to current directory/temp directory if testing
  }
  return join(process.cwd(), 'app_state.bin');
}

function getAESKey() {
  const hardwareId = getMachineHardwareId() || 'default-secret-hw-id-key';
  return crypto.createHash('sha256').update(hardwareId).digest(); // 32 bytes
}

function writeSecureLastRunDate(dateStr) {
  try {
    const filePath = getLicenseStateFilePath();
    if (!filePath) return;
    const key = getAESKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    
    let encrypted = cipher.update(dateStr, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    const payload = JSON.stringify({
      iv: iv.toString('base64'),
      data: encrypted
    });
    
    fs.writeFileSync(filePath, payload, 'utf8');
  } catch (err) {
    console.error("Failed to write secure last run date:", err);
  }
}

function readSecureLastRunDate() {
  try {
    const filePath = getLicenseStateFilePath();
    if (!filePath || !fs.existsSync(filePath)) return null;
    
    const raw = fs.readFileSync(filePath, 'utf8');
    const { iv, data } = JSON.parse(raw);
    
    const key = getAESKey();
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(iv, 'base64'));
    
    let decrypted = decipher.update(data, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted.trim();
  } catch (err) {
    console.error("Failed to read secure last run date:", err);
    return null;
  }
}

export function getOfflineLimits(planType) {
  switch (planType) {
    case '1-month':
      return { hardLimit: 5, silentLimit: 3 };
    case '1-year':
      return { hardLimit: 90, silentLimit: 60 };
    case 'forever':
      return { hardLimit: 365, silentLimit: 270 };
    default:
      return { hardLimit: 5, silentLimit: 3 };
  }
}

// Helper to get filepath for fallback ID
function getMachineIdFilePath() {
  try {
    const userDataPath = app.getPath('userData');
    return join(userDataPath, 'machine_id.json');
  } catch (e) {
    return null;
  }
}

// Instant synchronous getter (returns cached ID immediately without blocking)
export function getMachineHardwareId() {
  if (cachedMachineId) return cachedMachineId;

  // 1. Try to read registry MachineGuid via native reg.exe (takes ~5ms, extremely stable)
  try {
    const output = execSync('reg query HKLM\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid', {
      encoding: 'utf8',
      timeout: 1000,
      stdio: ['ignore', 'pipe', 'ignore'] // ignore stderr to prevent throwing on missing keys
    });
    const match = output.match(/MachineGuid\s+REG_SZ\s+(\S+)/i);
    if (match && match[1]) {
      cachedMachineId = match[1].trim();
      console.log("Hardware UUID initialized (Registry REG):", cachedMachineId);
      return cachedMachineId;
    }
  } catch (err) {
    console.log("Registry REG query failed or timed out. Trying fallback file.");
  }

  // 2. Persistent File-based Fallback
  try {
    const filePath = getMachineIdFilePath();
    if (filePath && fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (data && data.machineId) {
        cachedMachineId = data.machineId.trim();
        console.log("Hardware UUID initialized (File Cache):", cachedMachineId);
        return cachedMachineId;
      }
    }
    
    // Generate a new persistent UUID
    const newId = crypto.randomUUID();
    if (filePath) {
      fs.writeFileSync(filePath, JSON.stringify({ machineId: newId }), 'utf8');
    }
    cachedMachineId = newId;
    console.log("Hardware UUID generated and cached:", cachedMachineId);
    return cachedMachineId;
  } catch (fileErr) {
    console.error("Failed to read/write persistent machine ID file:", fileErr);
    cachedMachineId = 'fallback-pc-id-1234';
    return cachedMachineId;
  }
}

// Asynchronous hardware UUID initializer called at app startup (for compatibility)
export function initMachineId() {
  return Promise.resolve(getMachineHardwareId());
}

const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAsI7diFpjJvcnfzjZsNRb
7qJ0KGqlef7+II3USYh6efp1FYVMYOme0cfUCBaLWi1gaFwE1PjBizhqhF0ZotcD
RtjS1QGhzLEB6XcHNbb3d0DZvPHYQaqfI9KZhdrDdb8YjgbpXKEOytA+2pDs7CFU
syhuG9+2yvWzLtrlkN1vYyXyMP6XWESM3KPVdTdFxU6YJNsWbYpEIA7CotE2YjSQ
a7tqop5/crmZvd8dTg1r+2FWMz1jGj00w3og0FKpUG4236NJBT1li3+pKR8qcWZj
I4EaNj5BIUaQEmbGFgs3Xb3QcxrPNUXEimbJiSSIH2D+4f8rPZP0lLP/vVB0y6R5
NQIDAQAB
-----END PUBLIC KEY-----`;

// Helper: Safery query current internet date from a secure server (Google)
function getNetworkDate() {
  return new Promise((resolve) => {
    const req = https.get('https://www.google.com', { timeout: 3000 }, (res) => {
      const dateStr = res.headers.date;
      if (dateStr) {
        resolve(new Date(dateStr));
      } else {
        resolve(null);
      }
    });

    req.on('error', () => resolve(null));
    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });
  });
}

export function verifyLicenseKey(licenseStr) {
  try {
    if (!licenseStr || typeof licenseStr !== 'string') {
      return { valid: false, error: 'Empty license key' };
    }

    const parts = licenseStr.trim().split('.');
    if (parts.length !== 2) {
      return { valid: false, error: 'Invalid license format' };
    }

    const [payloadBase64, signatureBase64] = parts;
    const payloadStr = Buffer.from(payloadBase64, 'base64').toString('utf8');
    const signature = Buffer.from(signatureBase64, 'base64');

    // Verify RSA signature
    const verify = crypto.createVerify('SHA256');
    verify.update(payloadStr);
    verify.end();

    const verified = verify.verify(PUBLIC_KEY, signature);
    if (!verified) {
      return { valid: false, error: 'Invalid license signature (Key has been modified)' };
    }

    const payload = JSON.parse(payloadStr);
    
    // Check expiration against local date
    if (payload.type !== 'forever' && payload.expiresAt) {
      const expiresAt = new Date(payload.expiresAt);
      const now = new Date();
      if (now > expiresAt) {
        return { valid: false, error: `License expired on ${payload.expiresAt}`, payload };
      }
    }

    return { valid: true, payload };
  } catch (e) {
    return { valid: false, error: `Verification failed: ${e.message}` };
  }
}

export async function checkLicenseStatus() {
  try {
    const keySetting = await SystemSetting.findOne({ where: { key: 'license_key' } });
    if (!keySetting || !keySetting.value) {
      return { valid: false, reason: 'MISSING', error: 'No license key activated.' };
    }

    const verification = verifyLicenseKey(keySetting.value);
    if (!verification.valid) {
      return { valid: false, reason: 'INVALID', error: verification.error, payload: verification.payload };
    }

    const payload = verification.payload;
    const nowStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    // 1. Basic Offline Check: System clock is before the license issuance date
    if (payload.createdAt && nowStr < payload.createdAt) {
      return {
        valid: true,
        warning: 'CLOCK_TAMPERED',
        error: `System clock tampering detected. The current PC date (${nowStr}) is set before the license was issued (${payload.createdAt}).`,
        payload
      };
    }

    // 2. Offline Progression Check: System date rolled back since last run
    const lastRunSetting = await SystemSetting.findOne({ where: { key: 'license_last_run_date' } });
    if (lastRunSetting && lastRunSetting.value) {
      if (nowStr < lastRunSetting.value) {
        return { 
          valid: true, 
          warning: 'CLOCK_TAMPERED', 
          error: `System clock tampering detected. The PC date was rolled back (${nowStr}) before the last recorded run date (${lastRunSetting.value}).`,
          payload
        };
      }
    }

    // 3. Secure File Progression Check: System date rolled back since last run date in encrypted file
    const secureLastRun = readSecureLastRunDate();
    if (secureLastRun && nowStr < secureLastRun) {
      return {
        valid: true,
        warning: 'CLOCK_TAMPERED',
        error: `System clock tampering detected. System time (${nowStr}) is before the last verified operation (${secureLastRun}).`,
        payload
      };
    }

    // 4. Database Monotonic Check: System date rolled back since last recorded activity (Payments, Absences, etc.)
    const maxDbDate = await getLatestDatabaseDate();
    if (maxDbDate && nowStr < maxDbDate) {
      return {
        valid: true,
        warning: 'CLOCK_TAMPERED',
        error: `System clock tampering detected. System time (${nowStr}) is before the last database record date (${maxDbDate}).`,
        payload
      };
    }

    // 5. Online Verification: Compare local clock with actual network date (if connected)
    const networkDate = await getNetworkDate();
    if (networkDate) {
      const networkStr = networkDate.toISOString().split('T')[0];
      
      // Check if network date is before license issuance
      if (payload.createdAt && networkStr < payload.createdAt) {
        return {
          valid: true,
          warning: 'CLOCK_TAMPERED',
          error: `System clock tampering detected. The network date (${networkStr}) is set before the license was issued (${payload.createdAt}).`,
          payload
        };
      }

      // Check if system clock is desynchronized from the internet by more than 24 hours
      const now = new Date();
      const diffTime = Math.abs(networkDate - now);
      const diffDays = diffTime / (1000 * 60 * 60 * 24);
      if (diffDays > 1.2) { // 1.2 days to account for time zones comfortably
        return {
          valid: true,
          warning: 'CLOCK_TAMPERED',
          error: `System clock desynchronized. Your PC date (${nowStr}) differs significantly from the network date (${networkStr}). Please correct your clock.`,
          payload
        };
      }

      // Check if network time shows that the license is expired
      if (payload.type !== 'forever' && payload.expiresAt) {
        const expiresAt = new Date(payload.expiresAt);
        if (networkDate > expiresAt) {
          return {
            valid: false,
            reason: 'INVALID',
            error: `License expired on ${payload.expiresAt} (Verified via network time).`,
            payload
          };
        }
      }
    }

    // Determine offline grace and silent check limits
    const { hardLimit, silentLimit } = getOfflineLimits(payload.type);

    // Retrieve last online check date
    const lastOnlineCheckSetting = await SystemSetting.findOne({ where: { key: 'license_last_online_check' } });
    const lastOnlineCheck = lastOnlineCheckSetting && lastOnlineCheckSetting.value
      ? lastOnlineCheckSetting.value
      : (payload.createdAt || nowStr);

    const lastCheckDate = new Date(lastOnlineCheck);
    const currentDate = new Date(nowStr);
    const diffTime = currentDate - lastCheckDate;
    const daysOffline = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    // 6. Online Key Verification: Check if license key has been revoked or shared (Website API Sync)
    const SYNC_URL = 'https://ayoubyounsihocine.online/api/licenses/verify';
    let onlineCheckSuccessful = false;

    // Run online sync if they have been offline for at least 1 day, or if it is time to check
    try {
      const machineId = getMachineHardwareId();
      const response = await fetch(`${SYNC_URL}?key=${encodeURIComponent(keySetting.value)}&machineId=${encodeURIComponent(machineId)}`, {
        headers: {
          'Authorization': 'Bearer EDU-SECURE-APP-TOKEN-999'
        },
        signal: AbortSignal.timeout(3000)
      });
      
      if (response.status === 200) {
        const data = await response.json();
        if (data.valid === false) {
          return {
            valid: false,
            reason: 'INVALID',
            error: data.error || 'This license key has been deactivated or suspended by the administrator.',
            payload
          };
        }
        
        // Save database updates from server
        if (data.customMessage) {
          await SystemSetting.upsert({ key: 'license_custom_message', value: data.customMessage });
        } else {
          await SystemSetting.upsert({ key: 'license_custom_message', value: '' });
        }
        if (data.schoolId) {
          await SystemSetting.upsert({ key: 'school_id', value: data.schoolId });
        }
        
        // Mark last successful online check
        await SystemSetting.upsert({ key: 'license_last_online_check', value: nowStr });
        await SystemSetting.upsert({ key: 'license_last_run_date', value: nowStr });
        writeSecureLastRunDate(nowStr);
        onlineCheckSuccessful = true;
      } else if (response.status === 404 || response.status === 400 || response.status === 403 || response.status === 401) {
        let errorMsg = 'This license key is invalid or has been revoked by the administrator.';
        try {
          const data = await response.json();
          if (data && data.error) errorMsg = data.error;
        } catch (_) {}
        
        return {
          valid: false,
          reason: 'INVALID',
          error: errorMsg,
          payload
        };
      } else {
        throw new Error(`Server returned status code ${response.status}`);
      }
    } catch (e) {
      console.log("Online check failed (offline or server error). Proceeding offline.", e.message);
    }

    if (!onlineCheckSuccessful) {
      // Hardware Lock Check (If license is specifically locked to hardware)
      if (payload.machineId) {
        const localMachineId = getMachineHardwareId();
        if (payload.machineId !== localMachineId) {
          return {
            valid: false,
            reason: 'INVALID',
            error: 'This offline license key is registered to a different computer (Hardware ID mismatch).',
            payload
          };
        }
      }

      // Check if they exceeded the offline grace period limit
      if (daysOffline > hardLimit) {
        return {
          valid: true,
          warning: 'OFFLINE_EXPIRED',
          error: `You have been offline for ${daysOffline} days (Limit: ${hardLimit} days). Please connect to the internet to verify your license.`,
          payload
        };
      }
    }

    // Update last run date (only forward)
    if (!lastRunSetting || nowStr > lastRunSetting.value) {
      await SystemSetting.upsert({ key: 'license_last_run_date', value: nowStr });
    }
    const currentSecureLastRun = readSecureLastRunDate();
    if (!currentSecureLastRun || nowStr > currentSecureLastRun) {
      writeSecureLastRunDate(nowStr);
    }

    const schoolIdSetting = await SystemSetting.findOne({ where: { key: 'school_id' } });
    const schoolId = schoolIdSetting ? schoolIdSetting.value : (payload.schoolId || '');
    const enhancedPayload = { ...payload, schoolId };

    return { valid: true, reason: 'ACTIVE', payload: enhancedPayload };
  } catch (e) {
    return { valid: false, reason: 'ERROR', error: `Internal license check error: ${e.message}` };
  }
}

export async function activateLicense(keyStr) {
  try {
    const verification = verifyLicenseKey(keyStr);
    if (!verification.valid) {
      return { success: false, error: verification.error };
    }

    const payload = verification.payload;
    const nowStr = new Date().toISOString().split('T')[0];

    // Perform validation checks against network time during activation
    const networkDate = await getNetworkDate();
    if (networkDate) {
      const networkStr = networkDate.toISOString().split('T')[0];
      
      if (payload.createdAt && networkStr < payload.createdAt) {
        return { success: false, error: `Activation failed: The network date (${networkStr}) is before the key was created (${payload.createdAt}).` };
      }

      if (payload.type !== 'forever' && payload.expiresAt) {
        const expiresAt = new Date(payload.expiresAt);
        if (networkDate > expiresAt) {
          return { success: false, error: `Activation failed: The license key already expired on ${payload.expiresAt} according to network time.` };
        }
      }
    }

    // Check offline creation dates
    if (payload.createdAt && nowStr < payload.createdAt) {
      return { success: false, error: `Activation failed: Your current PC date (${nowStr}) is before the license creation date (${payload.createdAt}).` };
    }

    // Perform remote check against online server (Website API Sync) during activation
    const SYNC_URL = 'https://ayoubyounsihocine.online/api/licenses/verify';
    try {
      const machineId = getMachineHardwareId();
      const response = await fetch(`${SYNC_URL}?key=${encodeURIComponent(keyStr.trim())}&machineId=${encodeURIComponent(machineId)}`, {
        headers: {
          'Authorization': 'Bearer EDU-SECURE-APP-TOKEN-999'
        },
        signal: AbortSignal.timeout(4000)
      });
      if (response.ok) {
        const data = await response.json();
        if (data.valid === false) {
          return { success: false, error: `Activation failed: ${data.error || 'This license key has been deactivated by the administrator.'}` };
        }
        if (data.customMessage) {
          await SystemSetting.upsert({ key: 'license_custom_message', value: data.customMessage });
        }
        if (data.schoolId) {
          await SystemSetting.upsert({ key: 'school_id', value: data.schoolId });
        }
      } else if (response.status === 404 || response.status === 400 || response.status === 403 || response.status === 401) {
        let errorMsg = 'This license key is invalid or has been revoked by the administrator.';
        try {
          const data = await response.json();
          if (data && data.error) errorMsg = data.error;
        } catch (_) {}
        return { success: false, error: `Activation failed: ${errorMsg}` };
      } else {
        throw new Error(`Server returned status code ${response.status}`);
      }
    } catch (e) {
      console.log("Online activation check failed (offline). Proceeding with strict offline hardware binding check.", e.message);
      if (!payload.machineId) {
        return { success: false, error: 'Internet connection is required to activate a standard license. For offline activation, you must use a hardware-locked license key.' };
      }
      const localMachineId = getMachineHardwareId();
      if (payload.machineId !== localMachineId) {
        return { success: false, error: 'This offline license key is registered to a different computer (Hardware ID mismatch).' };
      }
      console.log("Strict offline hardware-locked license activated successfully.");
    }

    // Check if there is an existing active license for a DIFFERENT holder
    const keySetting = await SystemSetting.findOne({ where: { key: 'license_key' } });
    if (keySetting && keySetting.value) {
      const oldVerification = verifyLicenseKey(keySetting.value);
      if (oldVerification.valid && oldVerification.payload.holder) {
        const oldHolder = oldVerification.payload.holder.trim();
        const newHolder = payload.holder.trim();
        if (oldHolder.toLowerCase() !== newHolder.toLowerCase()) {
          // Tell the frontend that the school holder name is different
          return {
            success: true,
            differentHolder: true,
            oldHolder,
            newHolder,
            keyStr: keyStr.trim()
          };
        }
      }
    }

    // Store key
    await SystemSetting.upsert({ key: 'license_key', value: keyStr.trim() });
    await SystemSetting.upsert({ key: 'license_last_run_date', value: nowStr });
    await SystemSetting.upsert({ key: 'license_last_online_check', value: nowStr });
    writeSecureLastRunDate(nowStr);

    const schoolId = payload.schoolId || '';
    if (schoolId) {
      await SystemSetting.upsert({ key: 'school_id', value: schoolId });
    }

    return { success: true, payload: { ...payload, schoolId } };
  } catch (e) {
    return { success: false, error: `Activation error: ${e.message}` };
  }
}

export async function confirmActivationAndWipe(keyStr, wipeData) {
  try {
    const verification = verifyLicenseKey(keyStr);
    if (!verification.valid) {
      return { success: false, error: verification.error };
    }

    const payload = verification.payload;
    const nowStr = new Date().toISOString().split('T')[0];

    if (wipeData) {
      await sequelize.query('PRAGMA foreign_keys = OFF;');
      try {
        await Payment.destroy({ where: {}, force: true });
        await TeacherPayment.destroy({ where: {}, force: true });
        await Expense.destroy({ where: {}, force: true });
        await Absence.destroy({ where: {}, force: true });
        await AuditLog.destroy({ where: {}, force: true });
        await Schedule.destroy({ where: {}, force: true });
        await ScheduleRequest.destroy({ where: {}, force: true });
        await StudentCourses.destroy({ where: {}, force: true });
        await Course.destroy({ where: {}, force: true });
        await Student.destroy({ where: {}, force: true });
        await Teacher.destroy({ where: {}, force: true });
        await User.destroy({ where: {}, force: true });
        await SystemSetting.destroy({ where: {}, force: true });

        // Re-seed default admin user (admin / admin)
        const salt = crypto.randomBytes(16).toString('hex');
        const derivedKey = crypto.scryptSync('admin', salt, 64).toString('hex');
        const defaultHash = `${salt}:${derivedKey}`;
        
        await User.create({
          username: 'admin',
          password_hash: defaultHash,
          role: 'Admin',
          is_active: true
        });

        // Seed settings - Default School Name matches the new License holder!
        await SystemSetting.bulkCreate([
          { key: 'school_name', value: payload.holder },
          { key: 'academic_year', value: '2026-2027' }
        ]);

        console.log(`Database wiped successfully for new license holder: ${payload.holder}`);
      } finally {
        await sequelize.query('PRAGMA foreign_keys = ON;');
      }
    }

    // Save key
    await SystemSetting.upsert({ key: 'license_key', value: keyStr.trim() });
    await SystemSetting.upsert({ key: 'license_last_run_date', value: nowStr });
    await SystemSetting.upsert({ key: 'license_last_online_check', value: nowStr });
    writeSecureLastRunDate(nowStr);

    const schoolId = payload.schoolId || '';
    if (schoolId) {
      await SystemSetting.upsert({ key: 'school_id', value: schoolId });
    }

    return { success: true, payload: { ...payload, schoolId } };
  } catch (e) {
    return { success: false, error: `Activation error: ${e.message}` };
  }
}
