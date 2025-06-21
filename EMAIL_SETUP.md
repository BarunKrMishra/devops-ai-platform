# Email Setup Guide

## Current Issue
The application is showing "Failed to send OTP email" and "Unexpected server error" because email credentials are not configured.

## Solution

### For Development (Local Testing)
In development mode, emails are logged to the console instead of being sent. You can see the OTP in the server logs.

### For Production (Render/Cloud Deployment)

#### Option 1: Gmail Setup (Recommended)

1. **Enable 2-Factor Authentication**
   - Go to your Google Account settings
   - Enable 2-factor authentication

2. **Generate App Password**
   - Go to Google Account → Security → App passwords
   - Generate a new app password for "Mail"
   - Copy the 16-character password

3. **Set Environment Variables**
   In your Render dashboard, add these environment variables:
   ```
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-16-character-app-password
   ```

#### Option 2: Other Email Services

You can also use other email services by modifying the transporter configuration in `server/routes/auth.js`:

```javascript
// For Outlook/Hotmail
transporter = nodemailer.createTransport({
  service: 'outlook',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// For custom SMTP
transporter = nodemailer.createTransport({
  host: 'smtp.your-provider.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});
```

#### Option 3: Email Service Providers

For production applications, consider using dedicated email services:

- **SendGrid**: Free tier with 100 emails/day
- **Mailgun**: Free tier with 5,000 emails/month
- **AWS SES**: Very cost-effective for high volume

Example SendGrid configuration:
```javascript
transporter = nodemailer.createTransport({
  host: 'smtp.sendgrid.net',
  port: 587,
  secure: false,
  auth: {
    user: 'apikey',
    pass: process.env.SENDGRID_API_KEY
  }
});
```

## Testing

Run the email test script to verify your configuration:
```bash
node test-email.js
```

## Current Status

- ✅ Database issues fixed
- ✅ Rate limiting proxy issue fixed  
- ✅ Email error handling improved
- ⚠️ Email credentials need to be configured for production

## Next Steps

1. Set up email credentials in your Render environment variables
2. Deploy the updated code
3. Test the forgot password and registration flows 