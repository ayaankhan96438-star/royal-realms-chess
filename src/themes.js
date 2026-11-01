export const themes = [
  { id:'obsidian-realm', name:'Obsidian Realm', tagline:'Power. Strategy. Elegance.', material:'Black obsidian · antique gold', light:'#d4c2a5', dark:'#413126', accent:'#d8ae70', glow:'rgba(216,174,112,.34)', surface:'#17120f', piece:'obsidian', art:'/assets/obsidian-realm.webp' },
  { id:'frostspire', name:'Frostspire', tagline:'Cold mind. Sharp moves.', material:'Glacier glass · arctic blue', light:'#e1edf4', dark:'#55758e', accent:'#83d8ff', glow:'rgba(89,194,255,.34)', surface:'#0c1720', piece:'crystal', art:'/assets/frostspire.webp' },
  { id:'mystic-empire', name:'Mystic Empire', tagline:'Play beyond reality.', material:'Amethyst · royal violet', light:'#ddcbe8', dark:'#49345e', accent:'#bd8aff', glow:'rgba(173,104,255,.36)', surface:'#170f20', piece:'mystic', art:'/assets/mystic-empire.webp' },
  { id:'zenith-classic', name:'Zenith Classic', tagline:'Timeless. Refined. Unique.', material:'Ivory · brushed silver', light:'#eee7dc', dark:'#625c57', accent:'#d0c0a2', glow:'rgba(208,192,162,.3)', surface:'#191817', piece:'zenith', art:'/assets/zenith-classic.webp' },
  { id:'shadow-crown', name:'Shadow Crown', tagline:'Rule in the shadows.', material:'Dark steel · moon silver', light:'#c3c2c0', dark:'#30333a', accent:'#aeb6c9', glow:'rgba(154,172,211,.32)', surface:'#101116', piece:'shadow', art:'/assets/shadow-crown.webp' },
  { id:'celestial-order', name:'Celestial Order', tagline:'Play among the stars.', material:'White marble · celestial gold', light:'#f5e9cb', dark:'#9b784e', accent:'#edcb83', glow:'rgba(235,192,105,.34)', surface:'#1b1711', piece:'celestial', art:'/assets/celestial-order.webp' },
  { id:'dragons-fang', name:'Dragon’s Fang', tagline:'Unleash the strategy.', material:'Crimson steel · ember red', light:'#e4bdb5', dark:'#581f25', accent:'#f06b5d', glow:'rgba(242,79,68,.34)', surface:'#1d0d10', piece:'dragon', art:'/assets/dragons-fang.webp' },
  { id:'nordic-legacy', name:'Nordic Legacy', tagline:'Timeless. Strong. Noble.', material:'Runic stone · frozen blue', light:'#d9edf0', dark:'#426c7a', accent:'#77d8eb', glow:'rgba(91,211,240,.32)', surface:'#0e1a20', piece:'nordic', art:'/assets/nordic-legacy.webp' },
  { id:'void-realm', name:'Void Realm', tagline:'Beyond the board.', material:'Void crystal · neon violet', light:'#d3c4e7', dark:'#392451', accent:'#c38bff', glow:'rgba(187,116,255,.4)', surface:'#130d1c', piece:'void', art:'/assets/void-realm.webp' },
  { id:'royal-aurora', name:'Royal Aurora', tagline:'Elegance in every move.', material:'Champagne gold · warm ivory', light:'#f1e3c7', dark:'#927448', accent:'#f0d08a', glow:'rgba(239,204,127,.34)', surface:'#1c1710', piece:'aurora', art:'/assets/royal-aurora.webp' }
];

// Skill Level is used for beginner-to-expert play. Master uses a strong Elo limit.
// Grandmaster disables strength limiting and requests Stockfish's full available strength.
export const difficulties = [
  { id:'beginner', name:'Beginner', skill:0, time:250, note:'A gentle introduction with deliberately weakened engine play.' },
  { id:'easy', name:'Easy', skill:3, time:450, note:'Relaxed play while you learn.' },
  { id:'medium', name:'Medium', skill:7, time:700, note:'A solid club-level challenge.' },
  { id:'hard', name:'Hard', skill:12, time:1100, note:'Punishes careless moves.' },
  { id:'expert', name:'Expert', skill:16, time:1600, note:'A demanding, high-strength opponent.' },
  { id:'master', name:'Master', elo:2800, time:2600, note:'High engine strength, limited to an approximate 2800 CCRL Elo target.' },
  { id:'grandmaster', name:'Grandmaster', fullPower:true, skill:20, time:5000, note:'Full Stockfish build (about 94 MB): maximum available engine strength with the longest search.' }
];
