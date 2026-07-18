import nodemailer from 'nodemailer';
import { SystemSetting } from './database/models.js';

/**
 * Fetch SMTP settings from database
 */
async function getSMTPSettings() {
  const emailSetting = await SystemSetting.findOne({ where: { key: 'smtp_email' } });
  const passwordSetting = await SystemSetting.findOne({ where: { key: 'smtp_password' } });
  const hostSetting = await SystemSetting.findOne({ where: { key: 'smtp_host' } });
  const portSetting = await SystemSetting.findOne({ where: { key: 'smtp_port' } });

  return {
    email: emailSetting ? emailSetting.value : '',
    password: passwordSetting ? passwordSetting.value : '',
    host: hostSetting ? hostSetting.value : 'smtp.gmail.com',
    port: portSetting ? parseInt(portSetting.value, 10) : 465,
  };
}

/**
 * Create a nodemailer transporter
 */
async function getTransporter() {
  const settings = await getSMTPSettings();

  if (!settings.email || !settings.password) {
    throw new Error('SMTP credentials are not configured. Please set them in Settings.');
  }

  // Determine if secure connection is used (port 465 usually uses secure: true)
  const isSecure = settings.port === 465;

  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: isSecure,
    auth: {
      user: settings.email,
      pass: settings.password,
    },
  });
}

/**
 * Replace placeholders in template text
 */
function renderTemplate(text, data = {}) {
  if (!text) return '';
  let rendered = text;
  Object.keys(data).forEach((key) => {
    const value = data[key] !== undefined && data[key] !== null ? data[key] : '';
    rendered = rendered.replace(new RegExp(`{${key}}`, 'g'), value);
  });
  return rendered;
}

/**
 * Test SMTP connection
 */
export async function testSMTPConnection(config) {
  try {
    const isSecure = parseInt(config.port, 10) === 465;
    const transporter = nodemailer.createTransport({
      host: config.host || 'smtp.gmail.com',
      port: parseInt(config.port, 10) || 465,
      secure: isSecure,
      auth: {
        user: config.email,
        pass: config.password,
      },
    });

    await transporter.verify();
    return { success: true };
  } catch (error) {
    console.error('SMTP test failed:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send a single email
 */
export async function sendEmail({ to, subject, body, attachments = [], placeholders = {} }) {
  try {
    const transporter = await getTransporter();
    const settings = await getSMTPSettings();
    const renderedSubject = renderTemplate(subject, placeholders);
    const renderedBody = renderTemplate(body, placeholders);

    const mailOptions = {
      from: `"${placeholderSettingsName(settings.email)}" <${settings.email}>`,
      to,
      subject: renderedSubject,
      text: renderedBody.replace(/<[^>]*>/g, ''), // Strip HTML tags for plain text body
      html: renderedBody.replace(/\n/g, '<br>'), // Simple HTML format
      attachments: attachments.map(att => ({
        filename: att.filename,
        path: att.path // Absolute path to file on system
      }))
    };

    const info = await transporter.sendMail(mailOptions);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send bulk emails, resolving templates dynamically for each recipient
 * recipients: Array of objects e.g. [{ email: 'parent@mail.com', placeholders: { student_name: 'John' } }]
 */
export async function sendBulkEmails({ recipients, subject, body, attachments = [] }) {
  try {
    const transporter = await getTransporter();
    const settings = await getSMTPSettings();
    const results = [];

    for (const recipient of recipients) {
      try {
        const renderedSubject = renderTemplate(subject, recipient.placeholders);
        const renderedBody = renderTemplate(body, recipient.placeholders);

        const mailOptions = {
          from: `"${placeholderSettingsName(settings.email)}" <${settings.email}>`,
          to: recipient.email,
          subject: renderedSubject,
          text: renderedBody.replace(/<[^>]*>/g, ''),
          html: renderedBody.replace(/\n/g, '<br>'),
          attachments: attachments.map(att => ({
            filename: att.filename,
            path: att.path
          }))
        };

        const info = await transporter.sendMail(mailOptions);
        results.push({ email: recipient.email, success: true, messageId: info.messageId });
      } catch (err) {
        console.error(`Failed sending bulk email to ${recipient.email}:`, err);
        results.push({ email: recipient.email, success: false, error: err.message });
      }
    }

    const successCount = results.filter(r => r.success).length;
    return { success: true, total: recipients.length, successCount, results };
  } catch (error) {
    console.error('Bulk email operation failed:', error);
    return { success: false, error: error.message };
  }
}

function placeholderSettingsName(email) {
  // Simple extraction of school name from email or default name
  if (!email) return 'School Admin';
  const namePart = email.split('@')[0];
  return namePart.charAt(0).toUpperCase() + namePart.slice(1);
}
