class Email {
  constructor(user, url) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.url = url;
    this.from = `netero <${process.env.EMAIL_FROM}>`;
  }

  async send(subject, message) {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    const response = await fetch(
      `https://sandbox.api.mailtrap.io/api/send/${process.env.MAILTRAP_INBOX_ID}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.MAILTRAP_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: { email: process.env.EMAIL_FROM, name: 'Smart Task Manager' },
          to: [{ email: this.to }],
          subject,
          text: message,
          html: `<p>${message}</p>`,
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Mailtrap API request failed (${response.status}): ${errorBody}`);
    }
  }

  async sendWelcome() {
    await this.send(
      'welcome',
      `<h1>Welcome, ${this.firstName}!</h1>
            <p>We're excited to have you onboard 🎉</p>
            <p>Click <a href="${this.url}">here</a> to get started with your account.</p>
            <p>Best regards, <br> The Smart Task Manager Team</p>`
    );
  }

  async sendPasswordReset() {
    await this.send(
      'passwordReset',
      `<h1>Password Reset Request</h1>
            <p>Hello, ${this.firstName}!</p>
            <p>We received a request to reset your password. Click the link below to reset it:</p>
            <p><a href="${this.url}">Reset Password</a></p>
            <p>If you didn't request this, please ignore this email.</p>
            <p>Best regards, <br> The Smart Task Manager Team</p>`
    );
  }

  async sendEmailReminder() {
    await this.send(
      'Task Reminder',
      `<h1>Task Reminder</h1>
            <p>Hello, ${this.firstName}!</p>
            <p>This is a friendly reminder to complete your task soon.</p>
            <p>Click <a href="${this.url}">here</a> to view your task details.</p>
            <p>Best regards, <br> The Smart Task Manager Team</p>`
    );
  }
}

module.exports = Email;
