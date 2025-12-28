# Netlify Deployment Guide

## Overview

This guide explains how to deploy your DevOps AI platform with:
- **Frontend**: Deployed on Netlify (static hosting)
- **Backend**: Deployed on Render, Railway, or Heroku (Node.js hosting)

## Prerequisites

1. **Backend deployed and running** on a service like Render
2. **GitHub repository** with your code
3. **Netlify account**

## Step 1: Deploy Backend

First, deploy your backend to a service that supports Node.js:

### Option A: Render (Recommended)
1. Go to [render.com](https://render.com)
2. Connect your GitHub repository
3. Create a new Web Service
4. Set build command: `npm install`
5. Set start command: `npm run server`
6. Add environment variables:
   ```
   NODE_ENV=production
   JWT_SECRET=your-secret-key
   EMAIL_USER=your-email@gmail.com
   EMAIL_PASS=your-gmail-app-password
   ```
7. Deploy and note the URL (e.g., `https://your-app.onrender.com`)

### Option B: Railway
1. Go to [railway.app](https://railway.app)
2. Connect your GitHub repository
3. Deploy and note the URL

### Option C: Heroku
1. Go to [heroku.com](https://heroku.com)
2. Create a new app
3. Connect your GitHub repository
4. Deploy and note the URL

## Step 2: Deploy Frontend to Netlify

### Method 1: Connect to GitHub (Recommended)

1. **Go to Netlify Dashboard**
   - Visit [netlify.com](https://netlify.com)
   - Sign in with your GitHub account

2. **Create New Site from Git**
   - Click "New site from Git"
   - Choose GitHub
   - Select your repository

3. **Configure Build Settings**
   - **Build command**: `npm run build`
   - **Publish directory**: `dist`
   - **Base directory**: (leave empty)

4. **Add Environment Variables**
   - Go to Site settings → Environment variables
   - Add:
     ```
     VITE_API_URL=https://your-backend-url.onrender.com
     ```
   - Replace `your-backend-url.onrender.com` with your actual backend URL

5. **Deploy**
   - Click "Deploy site"
   - Wait for build to complete

### Method 2: Manual Upload

1. **Build locally**:
   ```bash
   npm run build
   ```

2. **Upload to Netlify**:
   - Go to Netlify dashboard
   - Drag and drop the `dist` folder
   - Add environment variables in site settings

## Step 3: Configure Environment Variables

In your Netlify site settings, add these environment variables:

```
VITE_API_URL=https://your-backend-url.onrender.com
```

**Important**: Replace `your-backend-url.onrender.com` with your actual backend URL.

## Step 4: Test the Deployment

1. **Test the frontend**: Visit your Netlify URL
2. **Test the backend**: Visit your backend URL + `/api/health`
3. **Test the connection**: Try the forgot password flow

## Troubleshooting

### Issue: "Server returned empty response"

**Cause**: Frontend can't reach the backend
**Solution**: 
1. Check that `VITE_API_URL` is set correctly in Netlify
2. Verify your backend is running and accessible
3. Check CORS settings on your backend

### Issue: CORS errors

**Solution**: Update your backend CORS configuration:

```javascript
// In server/index.js
const CORS_ORIGIN = process.env.CORS_ORIGIN || [
  'http://localhost:5173', 
  'http://localhost:5174',
  'https://your-netlify-app.netlify.app'  // Add your Netlify URL
];
```

### Issue: Environment variables not working

**Solution**:
1. Rebuild and redeploy after adding environment variables
2. Check that variables start with `VITE_` for Vite to include them
3. Verify in browser console that `process.env.VITE_API_URL` is set

## Environment Variables Reference

### Frontend (Netlify)
```
VITE_API_URL=https://your-backend-url.onrender.com
```

### Backend (Render/Railway/Heroku)
```
NODE_ENV=production
JWT_SECRET=your-secret-key
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
CORS_ORIGIN=https://your-netlify-app.netlify.app
```

## Security Considerations

1. **Use HTTPS**: Both Netlify and Render provide HTTPS by default
2. **Environment Variables**: Never commit secrets to your repository
3. **CORS**: Only allow your frontend domain in CORS settings
4. **Rate Limiting**: Ensure your backend has proper rate limiting

## Monitoring

1. **Netlify**: Check build logs and function logs
2. **Backend**: Monitor logs in your hosting service dashboard
3. **Browser**: Use developer tools to check network requests

## Custom Domain (Optional)

1. **Netlify**: Add custom domain in site settings
2. **Backend**: Update CORS settings to include your custom domain
3. **DNS**: Configure DNS records as instructed by Netlify

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify all environment variables are set
3. Test the backend API directly
4. Check the deployment logs in both services 