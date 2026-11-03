export function createOrderAlarm({Audio=globalThis.AudioContext||globalThis.webkitAudioContext,setIntervalFn=setInterval,clearIntervalFn=clearInterval,setTimeoutFn=setTimeout,clearTimeoutFn=clearTimeout,now=Date.now,onChange=()=>{}}={}){
 let audio,repeat,end,deadline=0;const voices=new Set();
 function stop(){if(repeat)clearIntervalFn(repeat);if(end)clearTimeoutFn(end);repeat=end=null;for(const voice of voices){try{voice.stop()}catch{}}voices.clear();onChange(false)}
 async function unlock(){if(!Audio)throw Error('Order sounds are not supported in this browser.');audio ||= new Audio();await audio.resume()}
 function burst(){if(now()>=deadline)return stop();for(let i=0;i<3;i++){const voice=audio.createOscillator(),gain=audio.createGain(),at=audio.currentTime+i*.3;voice.frequency.value=i===1?880:660;gain.gain.setValueAtTime(.0001,at);gain.gain.exponentialRampToValueAtTime(.18,at+.02);gain.gain.exponentialRampToValueAtTime(.0001,at+.22);voice.connect(gain).connect(audio.destination);voices.add(voice);voice.onended=()=>voices.delete(voice);voice.start(at);voice.stop(at+.25)}}
 async function ring(duration=30000){if(!audio)return false;stop();await audio.resume();deadline=now()+Math.min(30000,Math.max(500,duration));burst();repeat=setIntervalFn(burst,1800);end=setTimeoutFn(stop,Math.min(30000,Math.max(500,duration)));onChange(true);return true}
 return {unlock,ring,stop};
}
