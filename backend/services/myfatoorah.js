const crypto = require('crypto');
const https = require('https');

const { getSettings, getSecret } = require('./commerce-settings');

async function makeRequest(endpoint, method, data = null) {
  const settings = await getSettings('payments');
  const API_KEY = await getSecret('MYFATOORAH_API_KEY');
  const BASE_URL = settings.mode === 'live' ? 'https://api.myfatoorah.com' : 'https://apitest.myfatoorah.com';
  if (!API_KEY) throw new Error('Payment gateway is not configured.');
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
            const error = new Error('MyFatoorah rejected the request');
            error.definitive = res.statusCode >= 400 && res.statusCode < 500;
            reject(error);
          }
        } catch (err) {
          reject(new Error('Invalid response from MyFatoorah'));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Gateway timeout')));

    if (data) {
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function initiatePayment({ invoiceAmount, orderId, customerName, customerPhone, customerEmail }) {
  const data = {
    NotificationOption: 'LNK',
    InvoiceValue: invoiceAmount,
    CustomerName: customerName,
    DisplayCurrencyIso: 'KWD',
    MobileCountryCode: '+965',
    CustomerMobile: customerPhone.replace(/^\+965/,''),
    ...(customerEmail ? { CustomerEmail: customerEmail } : {}),
    CallBackUrl: process.env.MYFATOORAH_SUCCESS_URL || `${process.env.FRONTEND_URL || 'https://mikyajkw.com'}/api/payment/callback`,
    ErrorUrl: process.env.MYFATOORAH_FAILURE_URL || `${process.env.FRONTEND_URL || 'https://mikyajkw.com'}/checkout-result.html?error=true`,
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
 if(typeof signature!=='string'||!secret||!payload?.Data)return false;
 const data=payload.Data;let keys;
 if(typeof payload.Event==='object'){
  if(payload.Event.Code===1&&payload.Event.Name==='PAYMENT_STATUS_CHANGED')keys=['Invoice.Id','Invoice.Status','Transaction.Status','Transaction.PaymentId','Invoice.ExternalIdentifier'];
  else if(payload.Event.Code===2&&payload.Event.Name==='REFUND_STATUS_CHANGED')keys=['Refund.Id','Refund.Status','Amount.ValueInBaseCurrency','ReferencedInvoice.Id'];
  else return false;
 }else if(payload.Event==='TransactionsStatusChanged')keys=['AuthorizationId','BaseCurrency','CreatedDate','CustomerEmail','CustomerMobile','CustomerName','CustomerReference','DisplayCurrency','InvoiceId','InvoiceReference','InvoiceValueInBaseCurrency','InvoiceValueInDisplayCurreny','InvoiceValueInPayCurrency','PayCurrency','PaymentId','PaymentMethod','ReferenceId','TrackId','TransactionStatus','UserDefinedField'];
 else if(payload.Event==='RefundStatusChanged')keys=['Amount','Comments','CreatedDate','InvoiceId','RefundId','RefundReference','RefundStatus'];
 else return false;
 const stringToSign=keys.map(k=>k+'='+String(k.split('.').reduce((v,key)=>v?.[key],data)??'')).join(',');
 const expected=crypto.createHmac('sha256',secret).update(stringToSign,'utf8').digest('base64');
 const a=Buffer.from(expected),b=Buffer.from(signature);return a.length===b.length&&crypto.timingSafeEqual(a,b);
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
