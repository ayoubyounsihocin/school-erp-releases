import crypto from 'crypto';
import https from 'https';
import { exec } from 'child_process';
import { SystemSetting } from './database/models.js';

let cachedMachineId = null;

// Asynchronous hardware UUID initializer called at app startup
export function initMachineId() {
  return new Promise((resolve) => {
    if (cachedMachineId) return resolve(cachedMachineId);
    exec('powershell -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"', { timeout: 2000 }, (error, stdout) => {
      if (!error && stdout) {
        const id = stdout.trim();
        if (id && id.length > 5) {
          cachedMachineId = id;
          console.log("Hardware UUID initialized:", cachedMachineId);
          return resolve(id);
        }
      }
      console.log("PowerShell hardware UUID fetch failed or timed out. Using fallback ID.");
      cachedMachineId = 'fallback-pc-id-1234';
      resolve(cachedMachineId);
    });
  });
}

// Instant synchronous getter (returns cached ID immediately without blocking)
export function getMachineHardwareId() {
  return cachedMachineId || 'fallback-pc-id-1234';
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
        valid: false,
        reason: 'TAMPERED',
        error: `System clock tampering detected. The current PC date (${nowStr}) is set before the license was issued (${payload.createdAt}).`,
        payload
      };
    }

    // 2. Offline Progression Check: System date rolled back since last run
    const lastRunSetting = await SystemSetting.findOne({ where: { key: 'license_last_run_date' } });
    if (lastRunSetting && lastRunSetting.value) {
      if (nowStr < lastRunSetting.value) {
        return { 
          valid: false, 
          reason: 'TAMPERED', 
          error: `System clock tampering detected. The PC date was rolled back (${nowStr}) before the last recorded run date (${lastRunSetting.value}).`,
          payload
        };
      }
    }

    // 3. Online Verification: Compare local clock with actual network date (if connected)
    const networkDate = await getNetworkDate();
    if (networkDate) {
      const networkStr = networkDate.toISOString().split('T')[0];
      
      // Check if network date is before license issuance
      if (payload.createdAt && networkStr < payload.createdAt) {
        return {
          valid: false,
          reason: 'TAMPERED',
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
          valid: false,
          reason: 'TAMPERED',
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

    // 4. Online Key Verification: Check if license key has been revoked or shared (Website API Sync)
    const SYNC_URL = 'https://ayoubyounsihocine.online/api/licenses/verify';
    try {
      const machineId = getMachineHardwareId();
      const response = await fetch(`${SYNC_URL}?key=${encodeURIComponent(keySetting.value)}&machineId=${encodeURIComponent(machineId)}`, {
        headers: {
          'Authorization': 'Bearer EDU-SECURE-APP-TOKEN-999'
        },
        signal: AbortSignal.timeout(4000)
      });
      if (response.ok) {
        const data = await response.json();
        if (data.valid === false) {
          return {
            valid: false,
            reason: 'INVALID',
            error: data.error || 'This license key has been deactivated or suspended by the administrator.',
            payload
          };
        }
        // Save any custom message returned from the server to local settings to display to the user
        if (data.customMessage) {
          await SystemSetting.upsert({ key: 'license_custom_message', value: data.customMessage });
        } else {
          await SystemSetting.upsert({ key: 'license_custom_message', value: '' });
        }
      }
    } catch (e) {
      console.log("Online license key check failed (offline or server error). Falling back to offline signature validation.", e.message);
    }

    // Update last run date (only forward)
    if (!lastRunSetting || nowStr > lastRunSetting.value) {
      await SystemSetting.upsert({ key: 'license_last_run_date', value: nowStr });
    }

    return { valid: true, reason: 'ACTIVE', payload };
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
      }
    } catch (e) {
      console.log("Online activation check failed (offline). Falling back to offline validation.", e.message);
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

    return { success: true, payload };
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
      // Import models dynamically to avoid circular references
      const { 
        sequelize, Payment, TeacherPayment, Expense, Absence, AuditLog, 
        Schedule, ScheduleRequest, StudentCourses, Course, Student, Teacher, User 
      } = await import('./database/models.js');

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

    return { success: true, payload };
  } catch (e) {
    return { success: false, error: `Activation error: ${e.message}` };
  }
}
