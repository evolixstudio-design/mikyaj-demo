require('dotenv').config({path:require('path').join(__dirname,'../.env'),quiet:true});
const {createApp}=require('./app');
const port=process.env.PORT||3000;
createApp().listen(port,()=>console.log('Mikyaj listening on port '+port));
