var t={};function s(n,o=.6){if(document.hidden)return;let e=t[n]||=new Audio(`/assets/sounds/${n}.mp3`);e.volume=o,e.currentTime=0,e.play().catch(()=>{})}export{s as a};
