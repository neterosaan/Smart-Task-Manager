const nodemailer = require('nodemailer')


module.exports = class Email{
    constructor(user,url){
        this.to= user.email
        this.firstName= user.name.split(' ')[0]
        this.url= url
        this.from= `netero<${process.env.EMAIL_FROM}>`
    }

    newTransport(){
        return nodemailer.createTransport({
            host: process.env.EMAIL_HOST,
            port: process.env.EMAIL_PORT,
            auth: {
                user: process.env.EMAIL_USERNAME,
                pass: process.env.EMAIL_PASSWORD
            }
        })
    }
    

    async send(subject,message){


        if (process.env.NODE_ENV === 'test') {
            return;
        }

        const mailOptions={
            from: this.from,
            to: this.to,
            subject,
            text:message,
            html: `<p>${message}</p>`
        };

        await this.newTransport().sendMail(mailOptions)
    }

    async sendWelcome(){
        await this.send('welcome',`<h1>Welcome, ${this.firstName}!</h1>
        <p>We're excited to have you onboard 🎉</p>
        <p>Click <a href="${this.url}">here</a> to get started with your account.</p>
        <p>Best regards, <br> The Smart Task Manager Team</p>`)
    }

    async sendPasswordReset() {
        await this.send(
            'passwordReset',
            `<h1>Password Reset Request</h1>
            <p>Hello, ${this.firstName}!</p>
            <p>We received a request to reset your password. Click the link below to reset it:</p>
            <p><a href="${this.url}">Reset Password</a></p>
            <p>If you didn't request this, please ignore this email.</p>
            <p>Best regards, <br> The Smart Task Manager Team</p>`)
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