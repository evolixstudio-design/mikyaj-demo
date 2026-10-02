const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function validateSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });

  try {
    await client.connect();
    console.log("Connected to database successfully.");

    // We can optionally drop tables if we want a fresh state for catalog schema
    // But to be completely safe, we'll just run the script which uses IF NOT EXISTS.
    // However, to ensure we get the NEW schema, we might want to drop them.
    // Let's drop them to ensure our exact Phase 1B schema is what's tested.
    console.log("Dropping existing catalog tables for fresh schema test...");
    await client.query(`
      DROP TABLE IF EXISTS product_images CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS brands CASCADE;
      DROP TABLE IF EXISTS categories CASCADE;
    `);

    const sqlPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log("Executing schema.sql...");
    await client.query(sql);
    console.log("schema.sql executed successfully!");

    // Verification queries
    console.log("\n--- VERIFICATION ---");
    
    // Check tables
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    console.log("Tables found:");
    tablesRes.rows.forEach(r => console.log(` - ${r.table_name}`));

    // Check columns and types for products
    const colRes = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'products'
      ORDER BY ordinal_position;
    `);
    console.log("\nProducts table columns:");
    colRes.rows.forEach(r => {
      console.log(` - ${r.column_name} (${r.data_type}) | Nullable: ${r.is_nullable}`);
    });

    // Check unique constraints / indexes for products
    const idxRes = await client.query(`
      SELECT
          i.relname as index_name,
          a.attname as column_name
      FROM
          pg_class t,
          pg_class i,
          pg_index ix,
          pg_attribute a
      WHERE
          t.oid = ix.indrelid
          and i.oid = ix.indexrelid
          and a.attrelid = t.oid
          and a.attnum = ANY(ix.indkey)
          and t.relkind = 'r'
          and t.relname = 'products'
      ORDER BY
          t.relname,
          i.relname;
    `);
    console.log("\nProducts table indexes/constraints:");
    const indexes = {};
    idxRes.rows.forEach(r => {
      if (!indexes[r.index_name]) indexes[r.index_name] = [];
      indexes[r.index_name].push(r.column_name);
    });
    Object.keys(indexes).forEach(idx => {
       console.log(` - ${idx} on (${indexes[idx].join(', ')})`);
    });

  } catch (err) {
    console.error("Error applying schema:", err);
  } finally {
    await client.end();
  }
}

validateSchema();
