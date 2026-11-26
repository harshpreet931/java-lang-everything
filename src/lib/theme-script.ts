const KEY = "jle-theme";

/** runs before paint (inlined in <head>) so there's no flash. a saved choice wins; on a first visit
 *  the os preference decides. */
export const themeScript = `(function(){var d=document.documentElement,t;try{t=localStorage.getItem('${KEY}')}catch(e){}if(t!=='dark'&&t!=='light'){try{t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){t='light'}}d.dataset.theme=t})();`;
