// Keep area, governorate, block and official postcode consistent in address forms.
export function bindDeliveryFields(form,config){
 const area=form.elements.area,block=form.elements.block,postal=form.elements.postal_code,governorate=form.elements.governorate;if(!area||!block||!postal)return;
 const current=()=>config.delivery_directory?.find(a=>[a.name_en,a.name_ar].includes(area.value));
 const sync=reset=>{const a=current();if(!a)return;if(governorate)governorate.value=a.governorate;const b=a.blocks.find(b=>b.block===block.value.trim());if(b)postal.value=b.postal_code;else if(reset)postal.value='';};
 if(!area.dataset.directoryBound){area.dataset.directoryBound='1';area.addEventListener('change',()=>sync(true));block.addEventListener('input',()=>sync(true));postal.addEventListener('change',()=>{const a=current(),b=a?.blocks.find(b=>b.postal_code===postal.value);if(b)block.value=b.block;sync(false)});}
 sync(false);
}
