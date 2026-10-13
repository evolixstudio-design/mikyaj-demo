const {fail}=require('./commerce-quote');

function categoryIds(value){
 if(!Array.isArray(value)||value.length>20)fail('Choose up to 20 additional categories.');
 const ids=value.map(Number);
 if(ids.some(id=>!Number.isSafeInteger(id)||id<1))fail('Invalid additional category.');
 return [...new Set(ids)];
}

async function replace(productId,value,connection){
 const ids=categoryIds(value);
 if(ids.length){const categories=await connection.query('SELECT id FROM categories WHERE id=ANY($1::int[])',[ids]);if(categories.rows.length!==ids.length)fail('An additional category does not exist.');}
 await connection.query('DELETE FROM product_category_memberships WHERE product_id=$1 AND NOT(category_id=ANY($2::int[]))',[productId,ids]);
 if(ids.length)await connection.query('INSERT INTO product_category_memberships(product_id,category_id) SELECT $1,unnest($2::int[]) ON CONFLICT DO NOTHING',[productId,ids]);
 return ids;
}

module.exports={categoryIds,replace};
