import nodemailer from 'nodemailer';
import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';

const sns = new SNSClient();

type Action = 'SCHEDULED' | 'CANCELLED';

interface NotificationInput {
  action: Action;
  sessionDate: string;
  startTime: string;
  endTime: string;
  trainerName: string;
  trainerEmail: string;
  trainerPhone: string;
  trainerTimezone: string;
  leadTeacherName: string;
  leadTeacherEmail: string;
  leadTeacherTimezone: string;
  memberSchoolName: string;
  partnerSchoolName: string;
}

interface NotificationEvent {
  arguments: NotificationInput;
}

interface NotificationResult {
  success: boolean;
  message: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

/** Convert a UTC "HH:mm" to local "HH:mm" in the given IANA timezone for a specific date. */
function utcToLocal(time: string, dateStr: string, tz: string): string {
  const [h, m] = time.split(':').map(Number);
  const [y, mo, d] = dateStr.split('-').map(Number);
  const utcMs = Date.UTC(y, mo - 1, d, h, m, 0, 0);
  const local = new Date(utcMs).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
  return local;
}

function formatTimeRange(start: string, end: string, dateStr: string, tz: string): string {
  const localStart = utcToLocal(start, dateStr, tz);
  const localEnd = utcToLocal(end, dateStr, tz);
  return `${localStart} – ${localEnd} (${tz})`;
}

const EMAIL_STYLES = {
  wrapper: 'margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,sans-serif;background:#f8fafc;',
  card: 'max-width:560px;margin:32px auto;background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;',
  table: 'font-size:14px;color:#334155;',
  label: 'padding:8px 0;font-weight:600;width:130px;',
  value: 'padding:8px 0;',
  footer: 'margin:0;font-size:13px;color:#94a3b8;',
};

function buildEmailHtmlForTrainer(input: NotificationInput): string {
  const { action, sessionDate, startTime, endTime, trainerTimezone, leadTeacherName, memberSchoolName } = input;
  const statusColor = action === 'SCHEDULED' ? '#21AEBE' : '#ef4444';
  const statusLabel = action === 'SCHEDULED' ? 'Scheduled' : 'Cancelled';
  const dateFormatted = formatDate(sessionDate);
  const localTime = formatTimeRange(startTime, endTime, sessionDate, trainerTimezone);

  const intro =
    action === 'SCHEDULED'
      ? `A training session has been scheduled for you to provide training at <strong>${memberSchoolName}</strong>. Your contact at the school is ${leadTeacherName}.`
      : `The training session at <strong>${memberSchoolName}</strong> (contact: ${leadTeacherName}) has been cancelled.`;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="${EMAIL_STYLES.wrapper}">
  <table width="100%" cellpadding="0" cellspacing="0" style="${EMAIL_STYLES.card}">
    <tr>
      <td style="padding:32px 24px 0;">
        <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#0f172a;">P2P Training Session</h1>
        <span style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:13px;font-weight:600;color:#fff;background:${statusColor};">${statusLabel}</span>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px 8px;">
        <p style="margin:0;font-size:15px;line-height:1.5;color:#334155;">${intro}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 24px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="${EMAIL_STYLES.table}">
          <tr><td style="${EMAIL_STYLES.label}">Date</td><td style="${EMAIL_STYLES.value}">${dateFormatted}</td></tr>
          <tr><td style="${EMAIL_STYLES.label}">Time</td><td style="${EMAIL_STYLES.value}">${localTime}</td></tr>
          <tr><td style="${EMAIL_STYLES.label}">School</td><td style="${EMAIL_STYLES.value}">${memberSchoolName}</td></tr>
          <tr><td style="${EMAIL_STYLES.label}">Lead Teacher</td><td style="${EMAIL_STYLES.value}">${leadTeacherName}</td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 24px 24px;">
        <p style="${EMAIL_STYLES.footer}">Angaza P2P Scheduling System</p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function buildEmailHtmlForLeadTeacher(input: NotificationInput): string {
  const { action, sessionDate, startTime, endTime, leadTeacherTimezone, trainerName, memberSchoolName, partnerSchoolName } = input;
  const statusColor = action === 'SCHEDULED' ? '#21AEBE' : '#ef4444';
  const statusLabel = action === 'SCHEDULED' ? 'Scheduled' : 'Cancelled';
  const dateFormatted = formatDate(sessionDate);
  const localTime = formatTimeRange(startTime, endTime, sessionDate, leadTeacherTimezone);

  const intro =
    action === 'SCHEDULED'
      ? `A training session has been successfully scheduled between your school <strong>${memberSchoolName}</strong> and trainer <strong>${trainerName}</strong> (${partnerSchoolName}) at the date and time below.`
      : `The training session between your school <strong>${memberSchoolName}</strong> and trainer <strong>${trainerName}</strong> has been cancelled.`;

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="${EMAIL_STYLES.wrapper}">
  <table width="100%" cellpadding="0" cellspacing="0" style="${EMAIL_STYLES.card}">
    <tr>
      <td style="padding:32px 24px 0;">
        <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#0f172a;">P2P Training Session</h1>
        <span style="display:inline-block;padding:4px 12px;border-radius:9999px;font-size:13px;font-weight:600;color:#fff;background:${statusColor};">${statusLabel}</span>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 24px 8px;">
        <p style="margin:0;font-size:15px;line-height:1.5;color:#334155;">${intro}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:8px 24px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="${EMAIL_STYLES.table}">
          <tr><td style="${EMAIL_STYLES.label}">Date</td><td style="${EMAIL_STYLES.value}">${dateFormatted}</td></tr>
          <tr><td style="${EMAIL_STYLES.label}">Time</td><td style="${EMAIL_STYLES.value}">${localTime}</td></tr>
          <tr><td style="${EMAIL_STYLES.label}">Your School</td><td style="${EMAIL_STYLES.value}">${memberSchoolName}</td></tr>
          <tr><td style="${EMAIL_STYLES.label}">Trainer</td><td style="${EMAIL_STYLES.value}">${trainerName}</td></tr>
          <tr><td style="${EMAIL_STYLES.label}">Trainer's School</td><td style="${EMAIL_STYLES.value}">${partnerSchoolName}</td></tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 24px 24px;">
        <p style="${EMAIL_STYLES.footer}">Angaza P2P Scheduling System</p>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
}

function buildSmsBody(input: NotificationInput): string {
  const verb = input.action === 'SCHEDULED' ? 'scheduled' : 'cancelled';
  const localTime = formatTimeRange(input.startTime, input.endTime, input.sessionDate, input.trainerTimezone);
  return `Angaza P2P: Session ${verb} on ${formatDate(input.sessionDate)} ${localTime} with ${input.memberSchoolName}. Teacher: ${input.leadTeacherName}.`;
}

function getTransporter() {
  const host = (process.env.SMTP_HOST ?? '').trim();
  if (!host) return null;

  const port = Math.max(1, parseInt(process.env.SMTP_PORT ?? '587', 10) || 587);
  const secure = process.env.SMTP_SECURE === 'true' || process.env.SMTP_SECURE === '1';
  const user = (process.env.SMTP_USER ?? '').trim();
  const pass = (process.env.SMTP_PASS ?? process.env.SMTP_PASSWORD ?? '').trim();

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined,
  });
}

async function sendEmailSmtp(
  transporter: nodemailer.Transporter,
  to: string,
  subject: string,
  html: string,
  from: string,
): Promise<void> {
  await transporter.sendMail({
    from,
    to,
    subject,
    html,
  });
}

async function sendSms(phoneNumber: string, message: string): Promise<void> {
  if (!phoneNumber) return;
  await sns.send(new PublishCommand({
    PhoneNumber: phoneNumber,
    Message: message,
    MessageAttributes: {
      'AWS.SNS.SMS.SMSType': {
        DataType: 'String',
        StringValue: 'Transactional',
      },
    },
  }));
}

export const handler = async (event: NotificationEvent): Promise<NotificationResult> => {
  const input = event.arguments;
  if (!input?.action || !input?.trainerEmail || !input?.leadTeacherEmail) {
    return { success: false, message: 'Missing required fields.' };
  }

  const sender = (process.env.SENDER_EMAIL ?? '').trim();
  const transporter = getTransporter();
  const emailEnabled = transporter != null && sender.length > 0;

  const statusLabel = input.action === 'SCHEDULED' ? 'Scheduled' : 'Cancelled';
  const subject = `Training Session ${statusLabel} – ${formatDate(input.sessionDate)}`;
  const smsBody = buildSmsBody(input);

  const results: string[] = [];

  if (!emailEnabled) {
    results.push('Email skipped (set SMTP_HOST, SMTP_USER, SMTP_PASS, SENDER_EMAIL)');
  } else {
    try {
      const trainerHtml = buildEmailHtmlForTrainer(input);
      await sendEmailSmtp(transporter, input.trainerEmail, subject, trainerHtml, sender);
      results.push('Trainer email sent');
    } catch (err) {
      console.error('Trainer email failed:', err);
      results.push('Trainer email failed');
    }
    try {
      const teacherHtml = buildEmailHtmlForLeadTeacher(input);
      await sendEmailSmtp(transporter, input.leadTeacherEmail, subject, teacherHtml, sender);
      results.push('Teacher email sent');
    } catch (err) {
      console.error('Teacher email failed:', err);
      results.push('Teacher email failed');
    }
  }

  if (input.trainerPhone) {
    try {
      await sendSms(input.trainerPhone, smsBody);
      results.push('Trainer SMS sent');
    } catch (err) {
      console.error('Trainer SMS failed:', err);
      results.push('Trainer SMS failed');
    }
  }

  return { success: true, message: results.join('; ') };
};
