const db = require("../db");
const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

async function saveResetTokenToDatabase(email, resetToken) {
  const tokenExpiration = new Date();
  tokenExpiration.setHours(tokenExpiration.getHours() + 1);

  const query = `
    UPDATE users
    SET resetToken = $1, tokenExpiration = $2
    WHERE email = $3
  `;
  await db.query(query, [resetToken, tokenExpiration, email]);
}

async function sendRecoveryEmail(email, resetLink) {
  try {
    const logoUrl = "https://storage.googleapis.com/vol-images/startImage.png";

    const msg = {
      to: email,
      from: "zach@vol.flights",
      subject: "Password Reset Request",
      text: `You requested to reset your password. Click the link below to proceed. This link will expire in 1 hour. If you didn't request this, please ignore this email.\n\nReset your password: ${resetLink}`,
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; text-align: center; margin: 0 auto; max-width: 600px;">
        <div style="margin-bottom: 20px;">
          <img src="${logoUrl}" alt="Company Logo" style="max-width: 150px;" />
        </div>
        <h2 style="color: #007bff;">Password Reset Request</h2>
        <p>You requested to reset your password. Click the link below to proceed. This link will expire in <strong>1 hour</strong>. If you didn't request this, please ignore this email.</p>
        <a href="${resetLink}" style="display: inline-block; padding: 10px 20px; color: white; background-color: #007bff; text-decoration: none; border-radius: 5px;">Reset Your Password</a>
        <p>If the button above doesn't work, copy and paste this link into your browser:</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;" />
        <p style="font-size: 0.9em; color: #555;">If you did not request a password reset, no further action is required.</p>
        <p style="font-size: 0.9em; color: #555;">
          Vol Inc., 2509 Broadway Street, Apt 8, Boulder, CO, 80304
        </p>
      </div>
      `,
    };
    await sgMail.send(msg);
    console.log("Recovery email sent successfully");
  } catch (error) {
    console.error("Error sending recovery email:", error);
    if (error.response) {
      console.error(error.response.body);
    }
  }
}

module.exports = { saveResetTokenToDatabase, sendRecoveryEmail };
