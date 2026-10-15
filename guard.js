(function(){
  "use strict";
  var root = document.documentElement;
  root.classList.add('js');
  /* Anti-framing: GitHub Pages cannot send X-Frame-Options / frame-ancestors, so a framed copy hides itself. */
  try{
    if(window.top !== window.self){
      root.style.display = 'none';
      try{ window.top.location = window.self.location.href; }catch(e){}
    }
  }catch(e){ root.style.display = 'none'; }
})();
