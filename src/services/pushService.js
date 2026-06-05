// services/pushService.js
import admin from '../firebaseAdmin.js';
import db from '../models/index.js';

const FcmToken = db.FcmToken;

export const sendPushToUser = async ({ userId, title, body, click_action, icon, data = {} }) => {
  try {
    
    // Get user's FCM tokens
    const userTokens = await FcmToken.findAll({
      where: { user_id: userId },
      attributes: ['token']
    });

    if (!userTokens || userTokens.length === 0) {
      return { success: false, message: 'No tokens found' };
    }

    const tokens = userTokens.map(t => t.token);

    if (!admin.apps.length) {
      console.error('❌ Firebase Admin not initialized');
      return { success: false, message: 'Firebase Admin not initialized' };
    }
    
    // ✅ CRITICAL FIX: Convert all data values to strings
    const stringData = {};
    for (const [key, value] of Object.entries(data)) {
      // Convert any non-string value to string
      if (value === null || value === undefined) {
        stringData[key] = '';
      } else if (typeof value === 'object') {
        stringData[key] = JSON.stringify(value);
      } else {
        stringData[key] = String(value);
      }
    }
    
    // Add click_action to data as string
    if (click_action) {
      stringData.click_action = String(click_action);
    }
    
    // Prepare message for multicast
    const message = {
      notification: {
        title: title,
        body: body,
        ...(icon && { imageUrl: icon })
      },
      data: stringData, // ✅ Now all values are strings
      tokens: tokens,
      android: {
        priority: 'high',
        notification: {
          click_action: click_action || 'FLUTTER_NOTIFICATION_CLICK',
          sound: 'default'
        }
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      },
      webpush: {
        headers: {
          Urgency: 'high'
        },
        notification: {
          icon: icon || '/logo.jpeg',
          badge: '/logo.jpeg',
          requireInteraction: true,
          vibrate: [200, 100, 200]
        }
      }
    };

    // Send to all tokens using multicast
    const response = await admin.messaging().sendEachForMulticast(message);
        
    // Handle failed tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
          console.error(`❌ Failed token error:`, resp.error?.message);
        }
      });
      
      // Remove invalid tokens from database
      if (failedTokens.length > 0) {
        await FcmToken.destroy({
          where: { token: failedTokens }
        });
      }
    }
    
    return { 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount
    };
    
  } catch (error) {
    console.error('❌ Error sending push notification:', error);
    return { success: false, message: error.message };
  }
};