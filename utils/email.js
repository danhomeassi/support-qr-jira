import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST && process.env.SMTP_USER) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    return transporter;
  }
  return null;
}

export async function sendEmail({ to, subject, html }) {
  const transport = getTransporter();
  if (!transport) {
    console.log(`[EMAIL NOT CONFIGURED] To: ${to} | Subject: ${subject}`);
    console.log(`Body: ${html}\n`);
    return false;
  }
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to,
      subject,
      html,
    });
    return true;
  } catch (err) {
    console.error('Failed to send email:', err.message);
    return false;
  }
}

export async function sendIssueOpenedEmail({ issue, creator, assignee }) {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const issueUrl = `${appUrl}/issues/${issue.id}`;
  const issueNum = `ISS-${String(issue.id).padStart(4, '0')}`;

  const html = `
    <h2>New Issue Created: ${issueNum}</h2>
    <p><strong>Title:</strong> ${issue.title}</p>
    <p><strong>Priority:</strong> ${issue.priority}</p>
    <p><strong>Created by:</strong> ${creator.full_name}</p>
    ${assignee ? `<p><strong>Assigned to:</strong> ${assignee.full_name}</p>` : ''}
    <p><a href="${issueUrl}">View Issue</a></p>
  `;

  const recipients = new Set();
  if (assignee?.email) recipients.add(assignee.email);
  if (creator?.email) recipients.add(creator.email);

  for (const email of recipients) {
    await sendEmail({ to: email, subject: `[${issueNum}] New Issue: ${issue.title}`, html });
  }
}

export async function sendIssueClosedEmail({ issue, closedBy, assignee, creator }) {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const issueUrl = `${appUrl}/issues/${issue.id}`;
  const issueNum = `ISS-${String(issue.id).padStart(4, '0')}`;

  const html = `
    <h2>Issue Closed: ${issueNum}</h2>
    <p><strong>Title:</strong> ${issue.title}</p>
    <p><strong>Closed by:</strong> ${closedBy.full_name}</p>
    <p><a href="${issueUrl}">View Issue</a></p>
  `;

  const recipients = new Set();
  if (assignee?.email) recipients.add(assignee.email);
  if (creator?.email) recipients.add(creator.email);
  if (closedBy?.email) recipients.add(closedBy.email);

  for (const email of recipients) {
    await sendEmail({ to: email, subject: `[${issueNum}] Issue Closed: ${issue.title}`, html });
  }
}

export async function sendPasswordResetEmail({ email, token }) {
  const appUrl = process.env.APP_URL || 'http://localhost:5173';
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  const html = `
    <h2>Password Reset Request</h2>
    <p>Click the link below to reset your password. This link expires in 1 hour.</p>
    <p><a href="${resetUrl}">Reset Password</a></p>
    <p>If you did not request this, please ignore this email.</p>
  `;

  await sendEmail({ to: email, subject: 'Password Reset Request', html });
}
