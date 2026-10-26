(() => {
 const button=document.getElementById('menuToggle');
 const mobile=window.matchMedia('(max-width:760px)');
 const sync=()=>button.setAttribute('aria-expanded',String(mobile.matches?document.body.classList.contains('nav-open'):!document.body.classList.contains('nav-hidden')));
 button.addEventListener('click',()=>{document.body.classList.toggle(mobile.matches?'nav-open':'nav-hidden');sync()});
 document.getElementById('nav').addEventListener('click',e=>{if(mobile.matches&&e.target.closest('button')){document.body.classList.remove('nav-open');sync()}});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){document.body.classList.remove('nav-open');sync()}});
 document.querySelector('main').addEventListener('click',()=>{if(mobile.matches){document.body.classList.remove('nav-open');sync()}});
 mobile.addEventListener('change',sync);sync();
})();
