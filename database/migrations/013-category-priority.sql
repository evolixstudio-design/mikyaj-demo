BEGIN;
UPDATE categories SET priority=CASE slug
 WHEN 'lny-blwjh' THEN 90 WHEN 'lny-blyn-wlhwjb' THEN 80 WHEN 'zfr' THEN 70
 WHEN 'lny-blshr' THEN 60 WHEN 'lny-bljsm' THEN 50 WHEN 'twnr-wsyrwm' THEN 45
 WHEN 'lny-lshkhsy' THEN 40 WHEN 'jmy-lmntjt' THEN -10 WHEN 'uncategorized' THEN -20
 ELSE priority END WHERE priority=0;
COMMIT;
