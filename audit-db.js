const { Client } = require('pg');
require('dotenv').config();

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function verify() {
  await client.connect();
  
  const ordersSchema = await client.query("SELECT column_name, data_type, character_maximum_length, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'orders'");
  
  const orderItemsSchema = await client.query("SELECT column_name, data_type, character_maximum_length, column_default, is_nullable FROM information_schema.columns WHERE table_name = 'order_items'");
  
  console.log('--- ORDERS SCHEMA ---');
  console.table(ordersSchema.rows);
  
  console.log('--- ORDER ITEMS SCHEMA ---');
  console.table(orderItemsSchema.rows);
  
  const fkeys = await client.query("SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name, rc.update_rule, rc.delete_rule FROM information_schema.table_constraints AS tc JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name JOIN information_schema.referential_constraints AS rc ON rc.constraint_name = tc.constraint_name WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name IN ('order_items')");
  
  console.log('--- FOREIGN KEYS ---');
  console.table(fkeys.rows);
  
  const orders = await client.query('SELECT * FROM orders');
  console.log('--- ORDERS DATA ---');
  console.table(orders.rows);

  await client.end();
}

verify().catch(console.error);
