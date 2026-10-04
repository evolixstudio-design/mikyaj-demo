const router=require('express').Router();
const catalog=require('../services/catalog');
router.get('/',async(req,res,next)=>{try{res.set('Cache-Control','public, max-age=0, must-revalidate');res.json(await catalog.listProducts(req.query));}catch(e){next(e)}});
router.get('/:slug',async(req,res,next)=>{try{const product=await catalog.product(req.params.slug);if(!product)return res.status(404).json({error:'Product not found'});res.set('Cache-Control','public, max-age=0, must-revalidate');res.json({product});}catch(e){next(e)}});
module.exports=router;
