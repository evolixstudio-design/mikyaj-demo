const router=require('express').Router();
router.get('/listing-count',(req,res,next)=>require('../services/listing-billing').report(req.query).then(result=>res.json(result)).catch(next));
module.exports=router;
