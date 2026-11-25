// Comic remix of the captured artwork. Original builders and map remain intact.
const PALETTES = [
  ['#aee7d7', '#ff87b3', '#fff3b9'], ['#ffd4a8', '#9f9fe9', '#fff5c9'],
  ['#c8bbed', '#80d7de', '#ffeaa6'], ['#ffe998', '#ffad95', '#fff7d4'],
  ['#f7bed8', '#98d4b0', '#fff4cc'], ['#b9def2', '#b4a4e6', '#fff2bb'],
];
const GLASS = new Set(['#567f82', '#688f9c', '#40565a', '#485c56', '#455b57', '#52727a', '#5d8790', '#567981']);
const ROOF = new Set(['#657772', '#6b7c78', '#657b77', '#847967', '#7c8173', '#859483', '#746d59', '#899b93']);

export function comicBuilding(building, sourceBoxes, metadata) {
  let hash = 0; for (const char of building.id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const [wall, roof, cream] = PALETTES[hash % PALETTES.length];
  const ink = '#39324e';
  const boxes = sourceBoxes.map(b => {
    const color = String(b.color).toLowerCase();
    const rgb = color.match(/^#([0-9a-f]{6})$/)?.[1];
    const light = rgb ? (parseInt(rgb.slice(0, 2), 16) + parseInt(rgb.slice(2, 4), 16) + parseInt(rgb.slice(4, 6), 16)) / 3 : 140;
    return { ...b, sourceColor: b.color, role: 'artwork',
      color: GLASS.has(color) ? ink : ROOF.has(color) ? roof : light > 195 ? cream : light < 115 ? ink : wall };
  });
  function add(x, y, z, w, h, d, color, role) {
    boxes.push({ x, y, z, w, h, d, color, role });
  }
  const openTheater = building.id === 'amphitheater';
  const bw = openTheater ? building.w * .47 : building.w;
  const bd = openTheater ? building.d * .42 : building.d;
  const bz = openTheater ? building.d * .3 : 0;
  const top = metadata.height || 10;
  // Thick icing-like tiers, dark seams and an oversized asymmetric roof button.
  add(0, top + .18, bz, bw * 1.14, .34, bd * 1.16, ink, 'roof');
  add(0, top + .7, bz, bw * 1.14, .72, bd * 1.16, roof, 'roof');
  add(0, top + 1.25, bz, bw * .87, .55, bd * .88, cream, 'roof');
  add(0, top + 1.75, bz, bw * .64, .48, bd * .62, roof, 'roof');
  add(bw * .24, top + 2.36, bz, 1.5, .8, 1.5, cream, 'roof');
  const faceY = openTheater ? top + .6 : Math.max(2, Math.min(top * .6, 9));
  const front = openTheater ? bz + bd * .59 : building.d / 2 + .6;
  const eyeW = Math.max(1.25, Math.min(2.45, bw * .115));
  const eyeH = Math.max(1.7, Math.min(3.25, top * .23));
  for (const sign of [-1, 1]) {
    const x = sign * bw * .19;
    add(x, faceY, front, eyeW + .3, eyeH + .3, .22, ink, 'face');
    add(x, faceY + .03, front + .17, eyeW, eyeH, .2, '#fffdf0', 'face');
    add(x + sign * .16, faceY - .16, front + .33, eyeW * .46, eyeH * .56, .17, ink, 'face');
    add(x + sign * .16 - .15, faceY + .27, front + .44, .28, .35, .1, '#ffffff', 'face');
    add(x, faceY + eyeH / 2 + .52 + (sign > 0 ? .25 : 0), front + .08, eyeW + .25, .27, .2, ink, 'face');
    add(x + sign * eyeW * .75, faceY - eyeH * .42, front + .18, .8, .38, .17, '#ff8fba', 'face');
  }
  add(0, faceY - eyeH * .69, front + .15, Math.max(1.1, eyeW * .9), .8, .25, ink, 'face');
  add(0, faceY - eyeH * .69 + .2, front + .32, Math.max(.7, eyeW * .65), .3, .12, '#fffdf0', 'face');
  return { boxes, palette: { wall, roof, cream, ink }, faceY };
}
