const cloudinary = require('cloudinary').v2;

const secretsToTest = [
  "3_csMWmGmN0N9IGRInF2ytHo1NQ", // I
  "3_csMWmGmN0N9lGRlnF2ytHo1NQ", // l
  "3_cSMWmGmN0N9IGRInF2ytHo1NQ", // cS
  "3_csMWmGmNON9lGRlnF2ytHo1NQ", // O and l
  "3_csMWmGmN0N9lGRInF2ytHo1NQ", // l and I
  "3_csMWmGmN0N9IGRlnF2ytHo1NQ"  // I and l
];

async function test() {
  for (const secret of secretsToTest) {
    console.log(`\nTesting secret: ${secret}`);
    cloudinary.config({
      cloud_name: 'j92jrsvt',
      api_key: '496578692519299',
      api_secret: secret
    });
    
    try {
      const res = await cloudinary.api.ping();
      console.log("SUCCESS! The correct secret is:", secret);
      return;
    } catch (e) {
      console.log("Failed:", e);
    }
  }
}

test();
