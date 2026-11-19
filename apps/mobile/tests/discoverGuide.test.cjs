'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createGuideHarness,testing,dom}=require('./helpers/guideDomHarness.cjs');
test.afterEach(()=>testing.cleanup());test.after(()=>dom.window.close());
const open=h=>h.fireEvent.click(h.screen.getByRole('button',{name:'Open Discover Guide'}));
const gone=()=>testing.waitFor(()=>assert.ok(!testing.screen.queryByText('Discover Guide')));

test('compact Guide has one 26dp badge inside a transparent 44dp target with centered 14dp glyph',()=>{
 const h=createGuideHarness(),trigger=h.screen.getByRole('button',{name:'Open Discover Guide'}),badge=h.screen.getByTestId('guide-badge-discover'),glyph=h.screen.getByText('?');
 const targetStyle=getComputedStyle(trigger),badgeStyle=getComputedStyle(badge),glyphStyle=getComputedStyle(glyph);
 assert.equal(targetStyle.minWidth,'44px');assert.equal(targetStyle.minHeight,'44px');assert.equal(targetStyle.backgroundColor,'rgba(0, 0, 0, 0)');assert.equal(targetStyle.borderTopWidth,'0px');
 assert.equal(badgeStyle.width,'26px');assert.equal(badgeStyle.height,'26px');assert.equal(badgeStyle.borderTopLeftRadius,'13px');assert.equal(targetStyle.alignItems,'center');assert.equal(targetStyle.justifyContent,'center');assert.equal(badgeStyle.alignItems,'center');assert.equal(badgeStyle.justifyContent,'center');assert.equal(glyphStyle.fontSize,'14px');assert.equal(glyphStyle.textAlign,'center');assert.ok(trigger.contains(badge)&&badge.contains(glyph));
 // The outer host remains the accessible interactive button; its padding is not a second control.
 h.fireEvent.click(trigger);assert.ok(h.screen.getByText('Discover Guide'));assert.equal(h.screen.getAllByRole('button',{name:'Open Discover Guide'}).length,1);
});
test('keyboard focus highlights only the compact badge and preserves the trigger label',()=>{
 const h=createGuideHarness(),trigger=h.screen.getByRole('button',{name:'Open Discover Guide'});h.act(()=>trigger.focus());assert.equal(getComputedStyle(h.screen.getByTestId('guide-badge-discover')).borderTopColor,`rgb(${rgb(h.env.theme.text).join(', ')})`);assert.equal(trigger.getAttribute('aria-expanded'),'false');assert.equal(getComputedStyle(trigger).outlineWidth,'0px');
});
test('Guide starts closed and opens the exact approved offline copy without navigation or persistence',()=>{
 const h=createGuideHarness();assert.equal(h.screen.queryByText('Discover Guide'),null);open(h);
 for(const copy of ['Discover Guide','Find something to watch','Search for movies, TV shows, or people using the search bar.','Refine your search','Use the available filters to narrow your results and find relevant titles.','Explore the details','Select a title to view its information and available viewing options.','Got it'])assert.ok(h.screen.getByText(copy));
 assert.equal(h.screen.getByRole('button',{name:'Open Discover Guide'}).getAttribute('aria-expanded'),'true');assert.deepEqual(h.events.network,[]);assert.deepEqual(h.events.writes,[]);assert.deepEqual(h.events.routes,[]);
});
for(const label of ['Got it','Close Discover Guide'])test(label+' dismisses and restores focus to the trigger',async()=>{const h=createGuideHarness();const trigger=h.screen.getByRole('button',{name:'Open Discover Guide'});h.act(()=>trigger.focus());open(h);h.fireEvent.click(h.screen.getByRole('button',{name:label}));await gone();await h.waitFor(()=>assert.ok(document.activeElement===trigger));});
test('the native Modal Android Back callback dismisses without navigation',async()=>{const h=createGuideHarness({platform:'android'});open(h);h.nativeBack();await gone();assert.deepEqual(h.events.routes,[]);assert.ok(h.events.nativeFocus.length>0);});
test('web Escape dismisses via the real platform Modal implementation',async()=>{const h=createGuideHarness();open(h);h.fireEvent.keyUp(document,{key:'Escape'});await gone();});
test('title focus enters the real Modal and content is available through header semantics',async()=>{const h=createGuideHarness();open(h);const heading=h.screen.getByRole('heading',{name:'Discover Guide'});await h.waitFor(()=>assert.ok(h.screen.getByTestId('guide-sheet-discover').contains(document.activeElement)));assert.equal(heading.getAttribute('tabindex'),'-1');assert.ok(h.screen.getByRole('heading',{name:'Refine your search'}));});

test('actual Discover keeps its typed query and media filter through Guide open/close and Back',async()=>{
 const h=createGuideHarness({screen:true});const input=h.screen.getByRole('textbox',{name:'Search Orion'});h.fireEvent.change(input,{target:{value:'Arrival'}});
 const filter=h.screen.getByRole('button',{name:'Filter search results by Series'});h.fireEvent.click(filter);const before={...h.lastSearch()};assert.equal(before.query,'Arrival');assert.equal(before.activeFilter,'tv');
 for(const close of ['Got it','native-back']){open(h);if(close==='native-back')h.nativeBack();else h.fireEvent.click(h.screen.getByRole('button',{name:close}));await gone();assert.equal(input.value,'Arrival');assert.deepEqual(h.lastSearch(),before);assert.equal(h.lastSearch().activeFilter,'tv');}
 assert.deepEqual(h.events.routes,[]);assert.deepEqual(h.events.writes,[]);assert.deepEqual(h.events.network,[]);
});

function rgb(hex){return [1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));}
function contrast(a,b){const lum=c=>c.map(x=>x/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4).reduce((s,x,i)=>s+x*[.2126,.7152,.0722][i],0);const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function composite(rgba,background){const n=rgba.match(/[\d.]+/g).map(Number);return n.slice(0,3).map((c,i)=>c*n[3]+background[i]*(1-n[3]));}
for(const themeId of ['midnight-premiere','amoled','mocha','slate','projector-silver','custom'])test(themeId+' uses existing semantic colors with readable body/action contrast',()=>{
 const h=createGuideHarness({themeId});open(h);const t=h.env.theme,sheet=h.screen.getByTestId('guide-sheet-discover');assert.equal(sheet.style.backgroundColor,`rgb(${rgb(t.elevated).join(', ')})`);assert.ok(contrast(rgb(t.text),rgb(t.surface))>=4.5);assert.ok(contrast(rgb(t.textSecondary),rgb(t.elevated))>=4.5);assert.ok(contrast(rgb(t.text),composite(t.accentSoft,rgb(t.elevated)))>=4.5);assert.ok(contrast(rgb(t.text),rgb(t.surfaceHover))>=4.5);
});
for(const accent of ['#000000','#FFFFFF','#00FF00'])test('custom accent '+accent+' changes decoration while labels remain readable',()=>{const h=createGuideHarness({themeId:'custom'});const channels=rgb(accent);h.setTheme({...h.themes.custom,accent,accentSoft:`rgba(${channels.join(',')},0.16)`});open(h);assert.equal(h.screen.getByTestId('guide-sheet-discover').style.borderTopColor,`rgb(${channels.join(', ')})`);assert.ok(contrast(rgb(h.env.theme.text),composite(h.env.theme.accentSoft,rgb(h.env.theme.elevated)))>=4.5);});
test('system theme propagation and resizing preserve open Guide and Discover state',()=>{const h=createGuideHarness({screen:true});const input=h.screen.getByRole('textbox',{name:'Search Orion'});h.fireEvent.change(input,{target:{value:'Dune'}});open(h);h.env.height=280;h.env.width=568;h.env.insets={top:12,bottom:12,left:34,right:34};h.setTheme(h.themes['projector-silver']);assert.ok(h.screen.getByText('Discover Guide'));assert.equal(input.value,'Dune');assert.equal(h.screen.getByTestId('guide-sheet-discover').style.maxHeight,'232px');assert.deepEqual(h.events.writes,[]);});
test('Guide fades in and holds the modal through its fade out',async()=>{
 const h=createGuideHarness({platform:'android'});open(h);
 assert.equal(h.env.guideModal.animationType,'none');
 assert.deepEqual(h.events.fades,[{toValue:1,duration:160,useNativeDriver:true}]);
 h.nativeBack();
 assert.deepEqual(h.events.fades.map(fade=>fade.toValue),[1,0]);
 assert.ok(h.screen.getByText('Discover Guide'));
 await gone();
});
for(const [reduced,systemReduced] of [[true,false],[false,true],[false,null]])test('Guide opens and closes without motion for '+JSON.stringify([reduced,systemReduced]),()=>{
 const h=createGuideHarness({reduced,systemReduced});open(h);
 assert.ok(h.screen.getByText('Discover Guide'));
 h.fireEvent.click(h.screen.getByRole('button',{name:'Got it'}));
 assert.equal(h.screen.queryByText('Discover Guide'),null);
 assert.deepEqual(h.events.fades,[]);
});
test('enabling system Reduced Motion finishes an in-progress dismissal',async()=>{
 const h=createGuideHarness();open(h);
 h.fireEvent.click(h.screen.getByRole('button',{name:'Got it'}));
 assert.ok(h.screen.getByText('Discover Guide'));
 h.env.systemReducedMotion=true;h.rerender();
 await gone();
 assert.deepEqual(h.events.fades.map(fade=>fade.toValue),[1,0]);
});
test('same Guide foundation accepts contextual content without page/navigation ownership',async()=>{const content={id:'test',title:'Test Guide',sections:[{id:'one',title:'A section',body:'Synthetic content.'}],actionLabel:'Done'};const h=createGuideHarness({content});h.fireEvent.click(h.screen.getByRole('button',{name:'Open Test Guide'}));assert.ok(h.screen.getByText('Synthetic content.'));h.fireEvent.click(h.screen.getByRole('button',{name:'Done'}));await h.waitFor(()=>assert.ok(!h.screen.queryByText('Test Guide')));assert.deepEqual(h.events.routes,[]);});
