export const openings = [
  { id:'italian', name:'Italian Game', family:'Open Game', idea:'Develop quickly, control the centre and pressure f7.', moves:['e4','e5','Nf3','Nc6','Bc4','Bc5'] },
  { id:'sicilian', name:'Sicilian Defense', family:'Semi-open', idea:'Black challenges the d4-square and creates asymmetrical play.', moves:['e4','c5','Nf3','d6','d4','cxd4','Nxd4','Nf6'] },
  { id:'queens-gambit', name:"Queen's Gambit", family:'Closed Game', idea:'White offers the c-pawn to build central control.', moves:['d4','d5','c4','e6','Nc3','Nf6'] },
  { id:'london', name:'London System', family:'System opening', idea:'A reliable setup with Bf4, e3 and c3.', moves:['d4','d5','Bf4','Nf6','e3','c5','c3'] },
  { id:'ruy-lopez', name:'Ruy Lopez', family:'Open Game', idea:'White develops the bishop to attack the c6-knight and central e5-pawn.', moves:['e4','e5','Nf3','Nc6','Bb5','a6','Ba4','Nf6'] },
  { id:'french', name:'French Defense', family:'Semi-open', idea:'Black supports ...d5 and builds a resilient pawn chain.', moves:['e4','e6','d4','d5','Nc3','Nf6'] },
  { id:'caro-kann', name:'Caro-Kann Defense', family:'Semi-open', idea:"Black prepares ...d5 while keeping the c8-bishop’s diagonal open.", moves:['e4','c6','d4','d5','Nc3','dxe4','Nxe4'] },
  { id:'kings-indian', name:"King's Indian Defense", family:'Indian Defense', idea:'Black fianchettoes the bishop and allows a broad white centre before counterattacking.', moves:['d4','Nf6','c4','g6','Nc3','Bg7','e4','d6'] },
  { id:'english', name:'English Opening', family:'Flank Opening', idea:'White controls d5 from the flank and keeps the centre flexible.', moves:['c4','e5','Nc3','Nf6','g3','d5'] }
];

// Puzzle lines are short, legal and replayable from the standard initial position.
// The player is asked to find the first move; later line moves are the verified continuation.
export const puzzles = [
  {
    id:'fools-mate', title:"Fool's Mate", theme:'Checkmate in one', rating:650,
    description:'Black to move. Find the immediate queen mate against the exposed king.',
    prefix:['f3','e5','g4'], solution:['Qh4#'], side:'b'
  },
  {
    id:'scholars-mate', title:"Scholar's Mate", theme:'Checkmate in one', rating:850,
    description:'White to move. The queen and bishop have a direct attack on f7.',
    prefix:['e4','e5','Bc4','Nc6','Qh5','Nf6'], solution:['Qxf7#'], side:'w'
  }
];
