// Accessibility settings shared by the panel (client) and the root layout (server).
export const A11Y_STORAGE_KEY = 'lf_a11y';

export const A11Y_TOGGLES = ['highlightLinks', 'readableFont', 'textSpacing', 'stopAnimations', 'bigCursor', 'hideImages'] as const;
export type A11yToggle = (typeof A11Y_TOGGLES)[number];

/** Inline script for <head>: restores saved settings before the page paints (no flash). */
export const a11yBootScript = `(function(){try{var s=JSON.parse(localStorage.getItem('${A11Y_STORAGE_KEY}')||'{}'),r=document.documentElement;if(s.fontScale&&s.fontScale!==1)r.style.fontSize=Math.round(s.fontScale*100)+'%';if(s.colorMode&&s.colorMode!=='default')r.classList.add('a11y-'+s.colorMode);${JSON.stringify(
  A11Y_TOGGLES
)}.forEach(function(k){if(s[k])r.classList.add('a11y-'+k)})}catch(e){}})();`;
