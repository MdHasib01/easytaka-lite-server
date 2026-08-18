const cron = require('node-cron');
const { ImapFlow } = require('imapflow');
const { simpleParser } = require('mailparser');
const SystemSetting = require('../models/SystemSetting');
const FacebookMailLog = require('../models/FacebookMailLog');
const { decrypt } = require('../utils/encryption');
const { analyzeEmail } = require('./aiEmailAnalyzerService');

const FACEBOOK_SENDER_HINTS = ['facebook', 'facebookmail.com', 'meta.com', 'fb.com'];
const INITIAL_LOOKBACK_MS = 24 * 60 * 60 * 1000; // on first poll after (re)start, also pick up mail already sitting in the inbox

let isPolling = false;
let lastPolledAt = 0;
let watermark = null; // Date of the last successful poll; messages are searched by "since" this point, not by read/unread state

// Pulls just the display-name portion out of "Facebook <notification@facebook.com>"
// (everything before "<"), or returns the input unchanged if there's no "<".
const extractSenderName = (value) => {
  const raw = String(value || '');
  const idx = raw.indexOf('<');
  const namePart = idx >= 0 ? raw.slice(0, idx) : raw;
  return namePart.trim().toLowerCase();
};

// When the admin has configured a trigger sender, match on the sender NAME only
// (e.g. "Facebook" matches "Facebook <notification@facebook.com>" or
// "Facebook <security@facebookmail.com>"). Otherwise fall back to a generic
// facebook/meta sender heuristic.
const looksLikeFacebookMail = ({ subject, from }, triggerSender) => {
  const configuredName = extractSenderName(triggerSender);
  if (configuredName) {
    return String(from || '').toLowerCase().includes(configuredName);
  }
  const haystack = `${subject || ''} ${from || ''}`.toLowerCase();
  return FACEBOOK_SENDER_HINTS.some((hint) => haystack.includes(hint));
};

const processMessage = async (message, ai, triggerSender) => {
  const messageId = message.envelope?.messageId || `${message.uid}-${message.envelope?.date || Date.now()}`;

  const already = await FacebookMailLog.findOne({ messageId });
  if (already) return;

  const parsed = await simpleParser(message.source);
  const subject = parsed.subject || '';
  const from = parsed.from?.text || '';
  const text = parsed.text || parsed.html || '';

  if (!looksLikeFacebookMail({ subject, from }, triggerSender)) {
    return;
  }

  console.log(`[FB Mail Watcher] Candidate mail from "${from}" — subject: "${subject}" — asking AI...`);

  let verdict = { isOtp: false, otp: '' };
  try {
    verdict = await analyzeEmail({ subject, from, text }, ai);
  } catch (err) {
    console.error('[FB Mail Watcher] AI email analysis failed:', err.message);
  }

  await FacebookMailLog.create({
    messageId,
    subject,
    from,
    receivedAt: parsed.date || null,
    isOtp: verdict.isOtp,
    otpCode: verdict.otp || '',
  });

  if (verdict.isOtp && verdict.otp) {
    console.log(`[FB Mail Watcher] OTP detected: ${verdict.otp} — broadcasting notification.`);
    const { sendNotificationToAll } = require('../socket');
    await sendNotificationToAll({
      type: 'facebook_otp_received',
      title: 'Facebook Recovery OTP Received',
      message: `A Facebook recovery verification code was received: ${verdict.otp} (from ${from})`,
      metadata: { otp: verdict.otp, from, subject },
    });
  } else {
    console.log('[FB Mail Watcher] AI did not find an OTP in this mail.');
  }
};

const pollMailbox = async () => {
  if (isPolling) return; // avoid overlapping ticks if a previous poll is still running
  isPolling = true;
  try {
    const settings = await SystemSetting.getSettings();
    const { recoveryEmailConfig, aiConfig } = settings;

    if (!recoveryEmailConfig?.enabled || !aiConfig?.enabled) {
      console.log(
        `[FB Mail Watcher] Skipped — recoveryEmailConfig.enabled=${Boolean(
          recoveryEmailConfig?.enabled
        )}, aiConfig.enabled=${Boolean(aiConfig?.enabled)} (both must be on).`
      );
      return;
    }
    if (!recoveryEmailConfig.address || !recoveryEmailConfig.appPassword) {
      console.log('[FB Mail Watcher] Skipped — recovery email address or app password not configured.');
      return;
    }
    if (!aiConfig.apiKey) {
      console.log('[FB Mail Watcher] Skipped — AI API key not configured.');
      return;
    }

    const pollIntervalMs = Math.max(30, recoveryEmailConfig.pollIntervalSeconds || 60) * 1000;
    if (Date.now() - lastPolledAt < pollIntervalMs) return;
    lastPolledAt = Date.now();

    // Note: IMAP SEARCH SINCE has day-level granularity, not minute-level — it may
    // return the same day's messages on every poll. That's fine: FacebookMailLog
    // dedupes by messageId, so already-processed mail is just skipped, not re-notified.
    const since = watermark || new Date(Date.now() - INITIAL_LOOKBACK_MS);

    const appPassword = decrypt(recoveryEmailConfig.appPassword);
    const apiKey = decrypt(aiConfig.apiKey);
    const ai = { provider: aiConfig.provider, model: aiConfig.model, apiKey };

    const client = new ImapFlow({
      host: recoveryEmailConfig.imapHost || 'imap.gmail.com',
      port: recoveryEmailConfig.imapPort || 993,
      secure: true,
      auth: { user: recoveryEmailConfig.address, pass: appPassword },
      logger: false,
    });

    await client.connect();
    let messageCount = 0;
    try {
      const lock = await client.getMailboxLock('INBOX');
      try {
        for await (const message of client.fetch({ since }, { source: true, envelope: true, uid: true })) {
          messageCount += 1;
          await processMessage(message, ai, recoveryEmailConfig.triggerSender);
        }
      } finally {
        lock.release();
      }
    } finally {
      await client.logout();
    }

    console.log(`[FB Mail Watcher] Poll complete — checked ${messageCount} message(s) since ${since.toISOString()}.`);
    watermark = new Date(); // only advance once a poll has fully succeeded
  } catch (err) {
    // IMAP auth failures carry extra detail (Gmail's actual rejection reason) that
    // err.message alone often doesn't include — surface it to make misconfigured
    // credentials vs. disabled IMAP access vs. other failures distinguishable in logs.
    const detail = err.responseText || err.response || err.code;
    console.error(`[FB Mail Watcher] Poll failed: ${err.message}${detail ? ` (${detail})` : ''}`);
    if (err.authenticationFailed) {
      console.error(
        '[FB Mail Watcher] This looks like a login/authentication failure. Common causes: ' +
          '(1) IMAP is disabled for this Gmail account — Gmail Settings → See all settings → ' +
          'Forwarding and POP/IMAP → enable IMAP access; ' +
          '(2) the App Password is wrong, stale, or was regenerated since it was saved; ' +
          '(3) Google flagged this sign-in as suspicious and is blocking it — check the ' +
          'account\'s inbox/security page for a "sign-in was blocked" alert to approve.'
      );
    }
  } finally {
    isPolling = false;
  }
};

let scheduledTask = null;

// Ticks every minute; pollMailbox itself honors the admin-configured pollIntervalSeconds
// and no-ops entirely while recovery-email/AI config is disabled or incomplete.
const startFacebookMailWatcher = () => {
  if (scheduledTask) return;
  scheduledTask = cron.schedule('* * * * *', pollMailbox);
};

module.exports = { startFacebookMailWatcher };
