BEGIN;
-- Conservative name-based defaults; admins can correct the routine step per product.
UPDATE products SET routine_step=CASE
 WHEN name_ar ~ '(قلم|محدد).*(شفاه|شفايف)' THEN 'lipliner'
 WHEN name_ar ~ '(احمر|أحمر|روج).*(شفاه|شفايف)' THEN 'lipstick'
 WHEN name_ar ~ '(ماسكارا|مسكرة)' THEN 'mascara'
 WHEN name_ar ~ '(ايلاينر|آيلاينر|كحل)' THEN 'eyeliner'
 WHEN name_ar ~ '(برايمر)' THEN 'primer'
 WHEN name_ar ~ '(فاونديشن|كريم أساس|كريم اساس)' THEN 'foundation'
 WHEN name_ar ~ '(كونسيلر|خافي العيوب)' THEN 'concealer'
 WHEN name_ar ~ '(مثبت المكياج|بودرة تثبيت)' THEN 'setting'
 WHEN name_ar ~ '(غسول|منظف).*(وجه|الوجه)' THEN 'cleanser'
 WHEN name_ar ~ '(تونر)' THEN 'toner'
 WHEN name_ar ~ '(سيروم).*(وجه|بشرة)' THEN 'serum'
 WHEN name_ar ~ '(مرطب).*(وجه|بشرة)' THEN 'moisturizer'
 WHEN name_ar ~ '(واقي).*(شمس)' THEN 'sunscreen'
 ELSE routine_step END WHERE routine_step IS NULL;
COMMIT;
