const nodemailer = require('nodemailer');

const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '465', 10);
  const user = process.env.SMTP_USER || 'md.hasibuzzaman001@gmail.com';
  const pass = process.env.SMTP_PASS || 'rmks cymi zzsr mxwu';

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // true for 465, false for 587
    auth: {
      user,
      pass,
    },
  });
};

const defaultFrom = process.env.EMAIL_FROM || '"Milkimom" <md.hasibuzzaman001@gmail.com>';

/**
 * Send SMM Onboarding Invitation Email
 */
const sendSmmInvitationEmail = async (toEmail, inviteUrl) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: defaultFrom,
      to: toEmail,
      subject: '🎯 You have been invited to join EsyTaka Lite as an SMM Agent',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #e2e8f0; margin: 0; padding: 24px; }
            .container { max-width: 600px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
            .header { background: linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%); padding: 32px 24px; text-align: center; color: white; }
            .header h1 { margin: 0 0 8px 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
            .header p { margin: 0; font-size: 14px; opacity: 0.9; }
            .body { padding: 32px 28px; }
            .badge { display: inline-block; background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.4); color: #a5b4fc; padding: 6px 14px; border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 18px; }
            .greeting { font-size: 18px; font-weight: 700; color: #ffffff; margin-bottom: 12px; }
            .text { font-size: 14px; line-height: 1.6; color: #94a3b8; margin-bottom: 20px; }
            .steps-box { background: #0f172a; border: 1px solid #1e293b; border-radius: 14px; padding: 18px; margin: 24px 0; }
            .step-item { display: flex; align-items: flex-start; margin-bottom: 12px; font-size: 13px; color: #cbd5e1; }
            .step-num { background: #4f46e5; color: white; border-radius: 50%; width: 20px; height: 20px; display: inline-flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; margin-right: 10px; flex-shrink: 0; }
            .btn-wrapper { text-align: center; margin: 32px 0; }
            .btn { display: inline-block; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 18px rgba(79, 70, 229, 0.4); }
            .footer { background: #090d16; padding: 20px; text-align: center; font-size: 12px; color: #64748b; border-top: 1px solid #1e293b; }
            .link-text { word-break: break-all; color: #60a5fa; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>EsyTaka Lite Workspace</h1>
              <p>Facebook Media & Task Operations Portal</p>
            </div>
            <div class="body">
              <span class="badge">Official Administrator Invitation</span>
              <div class="greeting">Welcome to the Team!</div>
              <p class="text">
                An administrator has invited you to set up your Social Media Marketer (SMM) account on <strong>EsyTaka Lite</strong>.
              </p>
              
              <div class="steps-box">
                <div style="font-weight: 700; color: #f8fafc; font-size: 13px; margin-bottom: 10px;">Quick 2-Step Onboarding Process:</div>
                <div class="step-item">
                  <span class="step-num">1</span>
                  <span><strong>Personal Info & Photo:</strong> Enter your full name, phone number, set a password, and upload your profile picture.</span>
                </div>
                <div class="step-item" style="margin-bottom: 0;">
                  <span class="step-num">2</span>
                  <span><strong>National ID (NID) Verification:</strong> Upload clear photos of both the Front and Back of your National ID card and agree to workspace policies.</span>
                </div>
              </div>

              <div class="btn-wrapper">
                <a href="${inviteUrl}" target="_blank" class="btn">Complete Account Registration &rarr;</a>
              </div>

              <p class="text" style="font-size: 12px;">
                After submission, your account will undergo quick administrator verification before login access is granted.
              </p>
              
              <p class="text" style="font-size: 11px; color: #64748b; margin-top: 24px;">
                If the button above does not work, copy and paste this link into your browser:<br>
                <a href="${inviteUrl}" class="link-text">${inviteUrl}</a>
              </p>
            </div>
            <div class="footer">
              &copy; ${new Date().getFullYear()} EsyTaka Lite. All rights reserved. This invitation is intended solely for ${toEmail}.
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Mailer] Invitation email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Mailer Error] Failed to send invitation email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send Account Approved Email
 */
const sendAccountApprovedEmail = async (toEmail, name, loginUrl) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: defaultFrom,
      to: toEmail,
      subject: '🎉 Congratulations! Your SMM Account has been Verified & Approved',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #e2e8f0; margin: 0; padding: 24px; }
            .container { max-width: 600px; margin: 0 auto; background: #111827; border: 1px solid #10b981; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
            .header { background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 32px 24px; text-align: center; color: white; }
            .body { padding: 32px 28px; }
            .btn-wrapper { text-align: center; margin: 28px 0; }
            .btn { display: inline-block; background: linear-gradient(135deg, #10b981, #059669); color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 12px; }
            .footer { background: #090d16; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0 0 8px 0; font-size: 24px;">Account Approved!</h1>
              <p style="margin:0; font-size:14px; opacity:0.9;">Welcome to EsyTaka Lite</p>
            </div>
            <div class="body">
              <h2 style="color: #f8fafc; font-size: 18px; margin-top:0;">Hello ${name || 'SMM Agent'},</h2>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
                Great news! Your National ID verification and profile documents have been reviewed and approved by the Administrator team.
              </p>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
                You can now log in to access your Facebook profile management tools, daily routine checklists, and tasks to earn rewards.
              </p>
              <div class="btn-wrapper">
                <a href="${loginUrl}" target="_blank" class="btn">Log In to Your Workspace &rarr;</a>
              </div>
            </div>
            <div class="footer">
              &copy; ${new Date().getFullYear()} EsyTaka Lite.
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Mailer] Approval email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Mailer Error] Failed to send approval email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send Account Rejection Email
 */
const sendAccountRejectedEmail = async (toEmail, name, reason) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: defaultFrom,
      to: toEmail,
      subject: '⚠️ Update on your EsyTaka Lite Account Verification',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #e2e8f0; margin: 0; padding: 24px; }
            .container { max-width: 600px; margin: 0 auto; background: #111827; border: 1px solid #ef4444; border-radius: 20px; overflow: hidden; }
            .header { background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%); padding: 28px 24px; text-align: center; color: white; }
            .body { padding: 28px; }
            .reason-box { background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 16px; margin: 18px 0; color: #fca5a5; font-size: 13px; }
            .footer { background: #090d16; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0 0 8px 0; font-size: 22px;">Verification Status Update</h1>
              <p style="margin:0; font-size:13px; opacity:0.9;">EsyTaka Lite Workspace</p>
            </div>
            <div class="body">
              <h2 style="color: #f8fafc; font-size: 16px; margin-top:0;">Hello ${name || 'Applicant'},</h2>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
                Our administrator reviewed your submitted profile and National ID documentation. Unfortunately, your verification could not be approved at this time.
              </p>
              <div class="reason-box">
                <strong>Reason / Feedback from Admin:</strong><br>
                ${reason || 'The provided National ID or identity information was unclear or did not meet requirements.'}
              </div>
              <p style="color: #94a3b8; font-size: 13px; line-height: 1.6;">
                Please contact our administrator or support if you believe this was an error or to submit updated documents.
              </p>
            </div>
            <div class="footer">
              &copy; ${new Date().getFullYear()} EsyTaka Lite.
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Mailer] Rejection email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Mailer Error] Failed to send rejection email:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send Temporary Password Email (Admin-triggered password reset)
 */
const sendTempPasswordEmail = async (toEmail, name, tempPassword, loginUrl) => {
  try {
    const transporter = createTransporter();
    const mailOptions = {
      from: defaultFrom,
      to: toEmail,
      subject: '🔑 Your EsyTaka Lite Password has been Reset',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0f19; color: #e2e8f0; margin: 0; padding: 24px; }
            .container { max-width: 600px; margin: 0 auto; background: #111827; border: 1px solid #1f2937; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.5); }
            .header { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); padding: 28px 24px; text-align: center; color: white; }
            .body { padding: 32px 28px; }
            .pass-box { background: #0f172a; border: 1px dashed #4f46e5; border-radius: 12px; padding: 18px; margin: 20px 0; text-align: center; }
            .pass-value { font-family: 'Courier New', monospace; font-size: 22px; font-weight: 800; letter-spacing: 2px; color: #a5b4fc; }
            .btn-wrapper { text-align: center; margin: 28px 0; }
            .btn { display: inline-block; background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 15px; padding: 14px 32px; border-radius: 12px; }
            .warn { background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 12px; padding: 14px; margin-top: 20px; color: #fcd34d; font-size: 12px; }
            .footer { background: #090d16; padding: 20px; text-align: center; font-size: 12px; color: #64748b; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1 style="margin:0 0 8px 0; font-size: 22px;">Password Reset</h1>
              <p style="margin:0; font-size:13px; opacity:0.9;">EsyTaka Lite Workspace</p>
            </div>
            <div class="body">
              <h2 style="color: #f8fafc; font-size: 16px; margin-top:0;">Hello ${name || 'Agent'},</h2>
              <p style="color: #94a3b8; font-size: 14px; line-height: 1.6;">
                An administrator has reset your account password. Use the temporary password below to log in.
              </p>
              <div class="pass-box">
                <span class="pass-value">${tempPassword}</span>
              </div>
              <div class="btn-wrapper">
                <a href="${loginUrl}" target="_blank" class="btn">Log In Now &rarr;</a>
              </div>
              <div class="warn">
                For security, you will be required to set a new password immediately after logging in with this temporary one.
              </div>
            </div>
            <div class="footer">
              &copy; ${new Date().getFullYear()} EsyTaka Lite. This email is intended solely for ${toEmail}.
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('[Mailer] Temp password email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('[Mailer Error] Failed to send temp password email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendSmmInvitationEmail,
  sendAccountApprovedEmail,
  sendAccountRejectedEmail,
  sendTempPasswordEmail,
};
