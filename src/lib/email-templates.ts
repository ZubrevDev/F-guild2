/**
 * HTML email templates for transactional emails.
 * Each template receives typed data and returns { subject, html }.
 */

export type EmailTemplateType =
  | "welcome"
  | "quest_completed"
  | "level_up"
  | "prayer_answer"
  | "guild_warning"
  | "password_reset";

type WelcomeData = {
  username: string;
  guildName: string;
};

type QuestCompletedData = {
  username: string;
  questTitle: string;
  xpEarned: number;
};

type LevelUpData = {
  username: string;
  newLevel: number;
  className: string;
};

type PrayerAnswerData = {
  username: string;
  prayerTitle: string;
  answer: string;
  answeredBy: string;
};

type GuildWarningData = {
  masterName: string;
  guildName: string;
  lastActivityAt: string;
  deletionDate: string;
};

type PasswordResetData = {
  username: string;
  resetUrl: string;
  expiresIn: string;
};

export type EmailTemplateData = {
  welcome: WelcomeData;
  quest_completed: QuestCompletedData;
  level_up: LevelUpData;
  prayer_answer: PrayerAnswerData;
  guild_warning: GuildWarningData;
  password_reset: PasswordResetData;
};

type RenderedEmail = {
  subject: string;
  html: string;
};

function layout(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <style>
    body { margin: 0; padding: 0; background: #0f0f23; color: #e0e0e0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
    .container { max-width: 560px; margin: 0 auto; padding: 32px 24px; }
    .header { text-align: center; padding-bottom: 24px; border-bottom: 1px solid #2a2a4a; }
    .header h1 { color: #c4a24e; font-size: 22px; margin: 0; }
    .content { padding: 24px 0; line-height: 1.6; }
    .highlight { color: #c4a24e; font-weight: 600; }
    .stat { display: inline-block; background: #1a1a36; border: 1px solid #2a2a4a; border-radius: 6px; padding: 8px 16px; margin: 4px; }
    .footer { text-align: center; padding-top: 24px; border-top: 1px solid #2a2a4a; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Guild</h1>
    </div>
    <div class="content">
      ${body}
    </div>
    <div class="footer">
      <p>You are receiving this because you are a member of the Guild.</p>
    </div>
  </div>
</body>
</html>`;
}

const templates: {
  [K in EmailTemplateType]: (data: EmailTemplateData[K]) => RenderedEmail;
} = {
  welcome(data: WelcomeData): RenderedEmail {
    return {
      subject: `Welcome to ${data.guildName}, ${data.username}!`,
      html: layout(
        "Welcome",
        `<h2>Welcome, <span class="highlight">${data.username}</span>!</h2>
        <p>You have joined <span class="highlight">${data.guildName}</span>. Your adventure begins now.</p>
        <p>Complete quests, earn XP, and level up with your guild.</p>`
      ),
    };
  },

  quest_completed(data: QuestCompletedData): RenderedEmail {
    return {
      subject: `Quest Complete: ${data.questTitle}`,
      html: layout(
        "Quest Completed",
        `<h2>Quest Completed!</h2>
        <p><span class="highlight">${data.username}</span>, you finished <strong>${data.questTitle}</strong>.</p>
        <p><span class="stat">+${data.xpEarned} XP</span></p>`
      ),
    };
  },

  level_up(data: LevelUpData): RenderedEmail {
    return {
      subject: `Level Up! You are now level ${data.newLevel}`,
      html: layout(
        "Level Up",
        `<h2>Level Up!</h2>
        <p><span class="highlight">${data.username}</span>, you have reached <strong>Level ${data.newLevel}</strong> as a <span class="highlight">${data.className}</span>.</p>
        <p>Keep going — greater challenges await.</p>`
      ),
    };
  },

  prayer_answer(data: PrayerAnswerData): RenderedEmail {
    return {
      subject: `Prayer Answered: ${data.prayerTitle}`,
      html: layout(
        "Prayer Answer",
        `<h2>Your Prayer Was Answered</h2>
        <p><span class="highlight">${data.username}</span>, your prayer <strong>${data.prayerTitle}</strong> received a response from <span class="highlight">${data.answeredBy}</span>:</p>
        <blockquote style="border-left: 3px solid #c4a24e; padding-left: 12px; margin: 16px 0; color: #ccc;">${data.answer}</blockquote>`
      ),
    };
  },

  guild_warning(data: GuildWarningData): RenderedEmail {
    return {
      subject: `Action Required: Your guild "${data.guildName}" will be deleted soon`,
      html: layout(
        "Guild Inactivity Warning",
        `<h2>Your Guild Is About to Be Deleted</h2>
        <p>Hello <span class="highlight">${data.masterName}</span>,</p>
        <p>Your guild <span class="highlight">${data.guildName}</span> has been inactive for 11 months.</p>
        <p><span class="stat">Last activity: ${data.lastActivityAt}</span></p>
        <p>If no activity is recorded by <strong>${data.deletionDate}</strong>, the guild will be permanently deleted.</p>
        <p>Log in and perform any action in your guild to reset the inactivity timer and keep it alive.</p>`
      ),
    };
  },

  password_reset(data: PasswordResetData): RenderedEmail {
    return {
      subject: "Reset your password",
      html: layout(
        "Password Reset",
        `<h2>Password Reset Request</h2>
        <p>Hello <span class="highlight">${data.username}</span>,</p>
        <p>We received a request to reset the password for your account. Click the button below to set a new password:</p>
        <p style="text-align: center; margin: 32px 0;">
          <a href="${data.resetUrl}" style="display: inline-block; background: #c4a24e; color: #0f0f23; text-decoration: none; font-weight: 700; padding: 12px 32px; border-radius: 6px; font-size: 15px;">Reset Password</a>
        </p>
        <p>This link will expire in <strong>${data.expiresIn}</strong>.</p>
        <p style="color: #888; font-size: 13px;">If you did not request a password reset, you can safely ignore this email. Your password will not change.</p>`
      ),
    };
  },
};

/**
 * Render an email template by type and data.
 */
export function renderEmailTemplate<T extends EmailTemplateType>(
  template: T,
  data: EmailTemplateData[T]
): RenderedEmail {
  return templates[template](data);
}
