const sharp = require('sharp');
(async () => {
  const input = 'assets/logo-deoostelijkekrant.jpg';
  const output = 'assets/logo-deoostelijkekrant.png';
  const { data, info } = await sharp(input).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const idx = (x, y) => (y * width + x) * channels;
  let sr=0, sg=0, sb=0, n=0;
  for (let y=0; y<20; y++) for (let x=0; x<20; x++) {
    const i = idx(x,y); sr+=data[i]; sg+=data[i+1]; sb+=data[i+2]; n++;
  }
  const br=sr/n, bg=sg/n, bb=sb/n;
  const visited = new Uint8Array(width*height);
  const qx = new Int32Array(width*height), qy = new Int32Array(width*height);
  let h=0,t=0;
  const push=(x,y)=>{const p=y*width+x; if(visited[p])return; visited[p]=1; qx[t]=x; qy[t]=y; t++;};
  for(let x=0;x<width;x++){push(x,0);push(x,height-1);} for(let y=1;y<height-1;y++){push(0,y);push(width-1,y);} 
  const tol=36;
  const close=(r,g,b)=>Math.hypot(r-br,g-bg,b-bb)<tol;
  while(h<t){
    const x=qx[h], y=qy[h]; h++;
    const i=idx(x,y); const r=data[i], g=data[i+1], b=data[i+2];
    if(!close(r,g,b)) continue;
    data[i+3]=0;
    if(x>0)push(x-1,y); if(x<width-1)push(x+1,y); if(y>0)push(x,y-1); if(y<height-1)push(x,y+1);
  }
  await sharp(data,{raw:{width,height,channels}}).png({compressionLevel:9}).toFile(output);
  console.log('wrote', output);
})();
