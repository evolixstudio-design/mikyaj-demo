const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
test('order alarm requires explicit unlock, repeats for 30 seconds and stops all scheduled audio',async()=>{
 const source=fs.readFileSync(require.resolve('../frontend/mikyaj-demo/js/admin/order-alarm.js'),'utf8').replace('export function ','function ');
 const context={setInterval,clearInterval,setTimeout,clearTimeout};vm.createContext(context);vm.runInContext(source,context);
 let created=0,voices=0,stopped=0,repeat,finish,intervalCleared=0,timeoutCleared=0,clock=0;const states=[];
 class Audio{constructor(){created++;this.currentTime=0;this.destination={}}async resume(){}createOscillator(){voices++;return{frequency:{},connect:()=>({connect:()=>{}}),start:()=>{},stop:()=>{stopped++}}}createGain(){return{gain:{setValueAtTime(){},exponentialRampToValueAtTime(){}}}}}
 const alarm=context.createOrderAlarm({Audio,now:()=>clock,setIntervalFn:(fn,ms)=>{assert.equal(ms,1800);repeat=fn;return 1},clearIntervalFn:()=>intervalCleared++,setTimeoutFn:(fn,ms)=>{assert.equal(ms,30000);finish=fn;return 2},clearTimeoutFn:()=>timeoutCleared++,onChange:active=>states.push(active)});
 assert.equal(await alarm.ring(),false);assert.equal(created,0);
 await alarm.unlock();assert.equal(created,1);assert.equal(await alarm.ring(),true);assert.equal(voices,3);clock=1800;repeat();assert.equal(voices,6);
 const before=stopped;alarm.stop();assert.equal(stopped-before,6);assert.ok(intervalCleared);assert.ok(timeoutCleared);assert.equal(states.at(-1),false);
 await alarm.ring();clock=32000;repeat();assert.equal(states.at(-1),false);assert.ok(finish);
});
