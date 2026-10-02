const crypto = require('crypto');
const https = require('https');

const API_KEY = process.env.MYFATOORAH_API_KEY;
const BASE_URL = process.env.MYFATOORAH_BASE_URL.replace(/\/$/, ''); // remove trailing slash

function makeRequest(endpoint, method, data = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + endpoint);
    
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          if (res.statusCode >= 200 && res.statusCode < 300 && json.IsSuccess === true) {
            resolve(json.Data);
          } else {
            console.error('MyFatoorah request failed with body:', body);
            reject(new Error(json.Message || 'MyFatoorah request failed'));
          }
        } catch (err) {
          console.error('MyFatoorah parse failed. Raw body:', body);
          reject(new Error('Invalid response from MyFatoorah'));
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function initiatePayment({ invoiceAmount, orderId, customerName, customerPhone, customerEmail }) {
  const data = {
    NotificationOption: 'ALL',
    InvoiceValue: invoiceAmount,
    CustomerName: customerName,
    DisplayCurrencyIso: 'KWD',
    CustomerMobile: customerPhone,
    CustomerEmail: customerEmail || 'test@example.com',
    CallBackUrl: process.env.MYFATOORAH_SUCCESS_URL,
    ErrorUrl: process.env.MYFATOORAH_FAILURE_URL,
    Language: 'en',
    CustomerReference: orderId.toString(),
  };

  return await makeRequest('/v2/SendPayment', 'POST', data);
}

async function getPaymentStatus(keyId, keyType = 'PaymentId') {
  const data = {
    KeyType: keyType,
    Key: keyId
  };
  return await makeRequest('/v2/GetPaymentStatus', 'POST', data);
}

function verifyWebhookSignature(payload, signature, secret) {
  if (!signature || !secret) return false;
  
  // Flatten and order payload according to MyFatoorah Webhook V2 rules
  // 1. Order alphabetically
  // 2. exclude null, empty, or array values
  // 3. format: Key=Value,Key=Value
  
  function flattenObj(obj, prefix = '') {
    let result = {};
    for (const key in obj) {
      const val = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (val === '' || Array.isArray(val)) {
        continue;
      }
      
      if (val === null) {
        result[newKey] = '';
        continue;
      }
      
      if (typeof val === 'object') {
        result = { ...result, ...flattenObj(val, newKey) };
      } else {
        result[newKey] = val;
      }
    }
    return result;
  }
  
  const flat = flattenObj(payload);
  const sortedKeys = Object.keys(flat).sort();
  const stringToSign = sortedKeys.map(k => `${k}=${flat[k]}`).join(',');
  
  const hash = crypto.createHmac('sha256', secret).update(stringToSign).digest('base64');
  return hash === signature;
}

async function makeRefund({ paymentId, amount, currency, comment }) {
  const data = {
    KeyType: 'PaymentId',
    Key: paymentId,
    RefundChargeOnCustomer: false,
    ServiceChargeOnCustomer: false,
    Amount: parseFloat(amount), // Send numeric amount
    Comment: comment || 'Refund',
    AmountDeductedFromSupplier: parseFloat(amount)
  };
  return await makeRequest('/v2/MakeRefund', 'POST', data);
}

module.exports = {
  initiatePayment,
  getPaymentStatus,
  verifyWebhookSignature,
  makeRefund
};
