const fs=require('node:fs');
module.exports=async function enrich(pg){
 const file='.local-test-data/attar-enrichment/enrichment.json';if(!fs.existsSync(file))return;
 const data=JSON.parse(fs.readFileSync(file,'utf8'));const ids=new Map();
 for(const b of data.brands){const r=await pg.query("INSERT INTO brands(name,slug,search_aliases,status) VALUES($1,$2,$3,'ACTIVE') ON CONFLICT(slug) DO UPDATE SET search_aliases=EXCLUDED.search_aliases RETURNING id",[b.name,b.slug,b.search_aliases||'']);ids.set(b.slug,r.rows[0].id);}
 let descriptions=0,assigned=0;for(const p of data.products){if(p.status==='SOURCE_NOT_FOUND')continue;const brand=p.brands?.length===1?ids.get(p.brands[0].slug):null;
 // Preview only. New Arabic source text invalidates the old English description.
 await pg.query("UPDATE products SET short_description_ar=COALESCE(NULLIF(short_description_ar,''),$1),details_ar=COALESCE(NULLIF(details_ar,''),$2),brand_id=COALESCE(brand_id,$3) WHERE id=$4",[p.short_description_ar||'',p.details_ar||'',brand,p.id]);if(p.status==='FETCHED')descriptions++;if(brand)assigned++;
 }
 const stateFile='.local-test-data/preview-product-state.json';
 if(fs.existsSync(stateFile)){const states=JSON.parse(fs.readFileSync(stateFile,'utf8'));const byId=new Map(states.map(p=>[p.id,p]));for(const p of data.products){const state=byId.get(p.id);if(state)await pg.query('UPDATE products SET status=$1,stock_status=$2,priority=$3 WHERE id=$4',[state.status,state.stock_status,state.priority,p.id]);else await pg.query("UPDATE products SET deleted_at=NOW(),status='INACTIVE' WHERE id=$1",[p.id]);}}
 console.log('Local enrichment: '+descriptions+' descriptions; '+assigned+' product brand links; '+ids.size+' brands.');
};
