// A single fixed-name JSON entry. No compression work, paths or user filenames.
const name = new TextEncoder().encode('orion-diagnostics.json');
const crcTable = Uint32Array.from({length:256},(_,index)=>{
 let crc=index;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);return crc>>>0;
});
export function diagnosticsZip(json: string): Uint8Array {
 const content=new TextEncoder().encode(json);if(content.length>200_000)throw Error('DIAGNOSTICS_TOO_LARGE');
 let crc=0xffffffff;for(const byte of content)crc=(crc>>>8)^crcTable[(crc^byte)&255];crc=(crc^0xffffffff)>>>0;
 const localLength=30+name.length+content.length,centralLength=46+name.length;
 const bytes=new Uint8Array(localLength+centralLength+22),view=new DataView(bytes.buffer);
 const u16=(at:number,value:number)=>view.setUint16(at,value,true),u32=(at:number,value:number)=>view.setUint32(at,value,true);
 u32(0,0x04034b50);u16(4,20);u16(6,0x0800);u16(12,0x21);u32(14,crc);u32(18,content.length);u32(22,content.length);u16(26,name.length);
 bytes.set(name,30);bytes.set(content,30+name.length);
 const central=localLength;u32(central,0x02014b50);u16(central+4,20);u16(central+6,20);u16(central+8,0x0800);u16(central+14,0x21);u32(central+16,crc);u32(central+20,content.length);u32(central+24,content.length);u16(central+28,name.length);bytes.set(name,central+46);
 const end=central+centralLength;u32(end,0x06054b50);u16(end+8,1);u16(end+10,1);u32(end+12,centralLength);u32(end+16,central);
 return bytes;
}
export function diagnosticsAttachment(json: string) {
 const bytes=diagnosticsZip(json);let binary='';for(let offset=0;offset<bytes.length;offset+=16_384)binary+=String.fromCharCode(...bytes.subarray(offset,offset+16_384));
 return {name:'orion-diagnostics.zip',content:btoa(binary)};
}
