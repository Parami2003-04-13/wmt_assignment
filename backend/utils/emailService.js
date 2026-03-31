const nodemailer = require('nodemailer');

const transporter = (process.env.EMAIL_USER && process.env.EMAIL_PASS) ? nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
}) : null;

/**
 * Sends an email to the stall owner.
 * Note: If credentials are not in .env, it defaults to simulation mode (console log).
 */
const sendNotificationEmail = async (to, subject, htmlContent) => {
  try {
    if (transporter) {
      await transporter.sendMail({
        from: `"CampusBITES" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html: htmlContent
      });
      console.log(`📧 [REAL EMAIL SENT] To: ${to}`);
    } else {
      console.log(`\n📧 [EMAIL SIMULATION] Sending Email from: CampusBITES`);
      console.log(`To: ${to}`);
      console.log(`Subject: ${subject}`);
      console.log(`Content Highlights: ${htmlContent.substring(0, 150).replace(/<[^>]*>?/gm, '')}...\n`);
      console.log(`[!] TIP: To send real emails, add EMAIL_USER and EMAIL_PASS to your .env file.\n`);
    }

    return { success: true };
  } catch (error) {
    console.error('Email error:', error);
    return { success: false, error };
  }
};

const getApproveEmailTemplate = (ownerName, stallName) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #FF6F3C;">Congratulations, ${ownerName}! 🎉</h2>
      <p>Your stall <strong>"${stallName}"</strong> has been officially <strong>APPROVED</strong> for CampusBITES!</p>
      <p>You can now log in to your dashboard and manage your menu, photos, and status.</p>
      <hr style="border: 1px solid #f0f0f0;" />
      <p style="font-size: 12px; color: #777;">Best regards,<br/><strong>Team CampusBITES</strong></p>
    </div>
  `;
};

const getRejectEmailTemplate = (ownerName, stallName) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #EE5253;">Hello, ${ownerName}</h2>
      <p>We're sorry to inform you that your registration request for stall <strong>"${stallName}"</strong> has been <strong>REJECTED</strong>.</p>
      <p>Please check your documents and try resubmitting a new request with the correct information.</p>
      <hr style="border: 1px solid #f0f0f0;" />
      <p style="font-size: 12px; color: #777;">Best regards,<br/><strong>Team CampusBITES</strong></p>
    </div>
  `;
};

const getReviewEmailTemplate = (ownerName, stallName) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #FF6F3C;">Hello, ${ownerName}</h2>
      <p>Thank you for registering your stall <strong>"${stallName}"</strong> for CampusBITES!</p>
      <p>Your request is currently <strong>UNDER REVIEW</strong>. Our team will verify your documents and notify you within 24-48 hours.</p>
      <hr style="border: 1px solid #f0f0f0;" />
      <p style="font-size: 12px; color: #777;">Best regards,<br/><strong>Team CampusBITES</strong></p>
    </div>
  `;
};

const getAdminNotificationTemplate = (ownerName, stallName) => {
  return `
    <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
      <h2 style="color: #2D3436;">New Stall Request 🏪</h2>
      <p>You have <strong>one new stall request</strong> waiting for approval.</p>
      <p><strong>Stall Name:</strong> ${stallName}</p>
      <p><strong>Owner Name:</strong> ${ownerName}</p>
      <p>Please log in to the Admin Dashboard to review and verify.</p>
      <hr style="border: 1px solid #f0f0f0;" />
      <p style="font-size: 12px; color: #777;">System Notification<br/><strong>CampusBITES Admin</strong></p>
    </div>
  `;
};

module.exports = {
  sendNotificationEmail,
  getApproveEmailTemplate,
  getRejectEmailTemplate,
  getReviewEmailTemplate,
  getAdminNotificationTemplate
};
