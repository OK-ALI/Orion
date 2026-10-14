import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radii, spacing } from '@orion/shared/tokens';
import { useOrionTheme } from '../../context/ThemeContext';
import { usePerformanceProfile } from '../../context/PerformanceContext';
import { resolveMotionPolicy } from '../../services/motionPolicy';
type Icon = React.ComponentProps<typeof Ionicons>['name'];
const sections: { title: string; copy?: string; items?: [Icon, string, string][] }[] = [
 { title: 'Meet Glimpse', copy: 'Feel a story before you decide what to watch. Move through clips from movies, series and anime, save the moments that catch your attention, and open the whole story in Orion.' },
 { title: 'Discover. Like. Explore.', items: [['swap-vertical-outline','Discover','Swipe through stories, not lists. Explore clips from across Orion.'],['heart-outline','Like','Keep the moments that catch you. Save Glimpses privately and revisit them from Liked.'],['arrow-forward-outline','Explore','Go from a moment to the whole story. Open the movie, series or anime behind a clip.']] },
 { title: 'How Glimpse works', items: [['swap-vertical-outline','Swipe','Move between Glimpses.'],['heart-outline','Like','Save a Glimpse privately.'],['search-outline','Search & Filter','Find titles, genres and regions.'],['information-circle-outline','Details','Open the full Orion title.'],['volume-high-outline','Sound','Mute or unmute whenever you want.']] },
 { title: 'Two ways to Glimpse', items: [['compass-outline','Discover','A stream of clips built around what you want to explore.'],['heart-outline','Liked','Your private collection, ready when you want to return.']], copy: 'Your Glimpse Likes are private and stored on this device.' },
 { title: 'Make Glimpse yours', copy: 'Start muted, auto-advance when a clip ends, or remember your place. Use filters and sorting to shape what you explore. Ambient glow brings clip colors to the edges. Glimpse follows your Orion theme, Performance Profile and Reduce Animations preference.' },
 { title: 'Everything you already know is still here.', copy: 'Home, Discovery, Search, Library, Downloads, movies, television, anime, Orion Connect and your existing playback experience remain exactly where you expect them.' },
 { title: 'STAY CONNECTED TO ORION', copy: 'Your voice has a place in Orion. Report a problem, suggest an idea, or share your experience directly from the new Feedback Center. Find it in the sidebar footer after entering Orion.\n\nOrion can include safe technical diagnostics with bug reports, so you do not need to provide technical information yourself. Nothing is sent until you choose Send.', items: [['chatbubble-ellipses-outline', 'Feedback Center', 'Report a Problem · Suggest a Feature · General Feedback. Keep your Orion Feedback IDs in Feedback History and add more information later.']] },
 { title: 'The Final Chapter of Orion', copy: 'Orion 4.0 is the final major feature update to Orion. It brings discovery, playback, offline media, connected devices and now Glimpse into one final major release.\n\nOrion will remain the Orion you know. Version 4.0 is where its feature journey reaches its complete form. Bug fixes, compatibility work, essential maintenance and improvements driven by your feedback may still follow where necessary.' },
];
export default function ReleaseWelcomeScreen({ active, leaving, destination, error, onExit, onExitComplete }: { active: boolean; leaving: boolean; destination: 'glimpse' | 'home'; onExitComplete: () => void; error: boolean; onExit: (destination: 'glimpse' | 'home') => void }) {
 const { theme, preferences, systemReducedMotion } = useOrionTheme();
 const { resolvedProfile } = usePerformanceProfile(); const insets = useSafeAreaInsets(); const { width, height } = useWindowDimensions();
 const compact = width < 380 || height < 700;
 const policy = resolveMotionPolicy(preferences.reducedMotion, systemReducedMotion); const animate = !policy.reduceMotion && resolvedProfile !== 'efficiency';
 const [revealed, setRevealed] = useState<Set<number>>(() => new Set()); const positions = useRef(new Map<number, number>()); const scroll = useRef(0);
 const exit = useRef(new Animated.Value(0)).current;
 const exitCallback = useRef(onExitComplete); exitCallback.current = onExitComplete;
 useEffect(() => { if (!leaving) { exit.setValue(0); return; } if (!animate) { exit.setValue(1); exitCallback.current(); return; } const transition = Animated.timing(exit, { toValue: 1, duration: policy.duration(180), useNativeDriver: true, isInteraction: false }); transition.start(({finished}) => { if (finished) exitCallback.current(); }); return () => transition.stop(); }, [leaving, animate, exit, policy.reduceMotion]);
 const hero = useRef(new Animated.Value(0)).current;
 const entered = useRef(false);
 const intro = useRef(new Animated.Value(0)).current;
 const reveal = (offset: number) => { scroll.current = offset; setRevealed(previous => { const next = new Set(previous); positions.current.forEach((y,id) => { if(y <= offset + height) next.add(id); }); return next.size === previous.size ? previous : next; }); };
 useEffect(() => { if (!active) return; if (entered.current) { intro.setValue(1); hero.setValue(1); return; } entered.current = true; if (!animate) { intro.setValue(1); hero.setValue(1); return; } const animation = Animated.parallel([Animated.timing(intro,{toValue:1,duration:policy.duration(260),useNativeDriver:true,isInteraction:false}),Animated.timing(hero,{toValue:1,delay:policy.duration(80),duration:policy.duration(260),useNativeDriver:true,isInteraction:false})]); animation.start(); return () => animation.stop(); }, [active, animate, intro, hero, policy.reduceMotion]);
 const heading = { color: theme.text, fontFamily: 'Outfit', fontSize: 28, lineHeight: 36 };
 return <View style={{ flex: 1, backgroundColor: theme.background, paddingTop: insets.top, paddingBottom: insets.bottom }} accessibilityViewIsModal>
  <StatusBar style={theme.dark ? 'light' : 'dark'} />
  <Animated.View style={{flex:1, opacity:exit.interpolate({inputRange:[0,1],outputRange:[1,0]}), transform:animate?[{translateY:exit.interpolate({inputRange:[0,1],outputRange:[0,-spacing[2]]})}]:[]}}><ScrollView contentContainerStyle={[styles.page,{paddingTop:spacing[5],paddingBottom:spacing[5],paddingLeft:insets.left+spacing[4],paddingRight:insets.right+spacing[4]}]} onScroll={event=>reveal(event.nativeEvent.contentOffset.y)} scrollEventThrottle={32}>
   <Animated.View style={{ opacity: animate ? intro : 1, transform: animate ? [{translateY:intro.interpolate({inputRange:[0,1],outputRange:[spacing[3],0]})}] : [] }}>
    <Text style={[styles.eyebrow,{color:theme.accent}]}>ORION 4.0</Text>
    <Text accessibilityRole="header" style={{color:theme.text,fontFamily:'Outfit',fontSize:compact?32:width>600?56:40,lineHeight:compact?40:width>600?64:48,marginTop:spacing[3]}}>A New Way to Discover.</Text>
    <Text style={[styles.copy,{color:theme.textSecondary}]}>{compact ? 'Orion 4.0 brings Glimpse to movies, series and anime—one clip at a time.' : 'Orion 4.0 brings Glimpse into your media universe—a faster, more visual way to discover movies, series and anime worth watching.'}</Text>
    <Text style={[styles.copy,{color:theme.accent}]}>The final major update to Orion.</Text>
    <Animated.View style={{opacity:animate?hero:1,transform:animate?[{scale:hero.interpolate({inputRange:[0,1],outputRange:[0.985,1]})}]:[]}}><View accessible accessibilityLabel="Illustration of a Glimpse clip with Like and Details" style={[styles.hero,{backgroundColor:theme.elevated,borderColor:theme.border,shadowColor:theme.accent,shadowOpacity:resolvedProfile==='quality'?0.2:0,shadowRadius:spacing[5]}]}>
     <View importantForAccessibility="no-hide-descendants" style={[styles.visual,{backgroundColor:theme.accentSoft,minHeight:compact?spacing[5]*3:180,padding:compact?spacing[3]:spacing[5]}]}><Ionicons name="sparkles-outline" color={theme.accent} size={compact?36:56}/><Text style={[styles.eyebrow,{color:theme.accent,marginTop:spacing[3]}]}>A MOMENT. A WHOLE STORY.</Text></View>
     <Text style={[heading,{padding:spacing[3]}]}>Glimpse</Text>
     <View style={[styles.row,{padding:spacing[3]}]}><Ionicons name="heart-outline" size={24} color={theme.accent}/><Text style={{color:theme.text,fontFamily:'Inter'}}>Like</Text><Text style={{color:theme.accent,fontFamily:'Inter'}}>Details →</Text></View>
    </View></Animated.View>
   </Animated.View>
   {sections.map((section,id)=><Reveal key={section.title} visible={active && (!animate || revealed.has(id))} animate={animate} duration={policy.duration(260)} onLayout={y=>{positions.current.set(id,y);reveal(scroll.current);}}>
    <Text accessibilityRole="header" style={heading}>{section.title}</Text>
    {section.items?.map(([icon,title,copy])=><View key={title} style={[styles.card,{backgroundColor:theme.elevated,borderColor:theme.border}]}><Ionicons accessible={false} name={icon} size={24} color={theme.accent}/><View style={{flex:1,minWidth:0}}><Text style={{color:theme.text,fontFamily:'Outfit',fontSize:20}}>{title}</Text><Text style={[styles.copy,{color:theme.textSecondary}]}>{copy}</Text></View></View>)}
    {!!section.copy&&<Text style={[styles.copy,{color:theme.textSecondary}]}>{section.copy}</Text>}
   </Reveal>)}
   {error&&<Text accessibilityRole="alert" style={[styles.copy,{color:theme.accent}]}>We couldn’t save your choice. Please try again.</Text>}
   <Pressable accessibilityRole="button" accessibilityLabel="Explore Glimpse" disabled={leaving} onPress={()=>onExit('glimpse')} style={({pressed})=>[styles.button,{backgroundColor:theme.accent,opacity:pressed||leaving?0.75:1}]}><Text style={{fontFamily:'Outfit',fontSize:20,color:theme.onAccent}}>Explore Glimpse →</Text></Pressable>
   <Pressable accessibilityRole="button" accessibilityLabel="Continue to Orion" disabled={leaving} onPress={()=>onExit('home')} style={({pressed})=>[styles.button,{borderWidth:1,borderColor:theme.border,backgroundColor:theme.elevated,opacity:pressed||leaving?0.75:1}]}><Text style={{fontFamily:'Outfit',fontSize:20,color:theme.text}}>Continue to Orion</Text></Pressable>
  </ScrollView></Animated.View>
  {leaving && <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill,{alignItems:'center',justifyContent:'center',opacity:exit}]}><Ionicons accessible={false} name={destination==='glimpse'?'sparkles-outline':'planet-outline'} color={theme.accent} size={48}/><Text accessibilityRole="header" style={[heading,{marginTop:spacing[3]}]}>{destination==='glimpse'?'Glimpse':'Orion'}</Text></Animated.View>}
 </View>;
}
function Reveal({visible,animate,duration,onLayout,children}:{visible:boolean;animate:boolean;duration:number;onLayout:(y:number)=>void;children:React.ReactNode}) {
 const opacity=useRef(new Animated.Value(0)).current; const shown=useRef(false);
 useEffect(()=>{ if(!visible)return; if(!animate){opacity.setValue(1);shown.current=true;return;} if(shown.current)return;shown.current=true;const animation=Animated.timing(opacity,{toValue:1,duration,useNativeDriver:true,isInteraction:false});animation.start();return()=>{animation.stop();opacity.setValue(1);}; },[visible,animate,duration,opacity]);
 return <Animated.View onLayout={event=>onLayout(event.nativeEvent.layout.y)} style={[styles.section,{opacity:animate?opacity:1,transform:animate?[{translateY:opacity.interpolate({inputRange:[0,1],outputRange:[spacing[2],0]})}]:[]}]}>{children}</Animated.View>;
}
const styles=StyleSheet.create({page:{width:'100%',maxWidth:760,alignSelf:'center'},eyebrow:{fontFamily:'Inter',fontSize:12,letterSpacing:2},copy:{fontFamily:'Inter',fontSize:16,lineHeight:25,marginTop:spacing[2]},hero:{borderWidth:1,borderRadius:radii.lg,overflow:'hidden',marginTop:spacing[4]},visual:{padding:spacing[5],minHeight:180,justifyContent:'center',alignItems:'center'},row:{flexDirection:'row',flexWrap:'wrap',alignItems:'center',gap:spacing[3]},section:{marginTop:spacing[5]},card:{borderWidth:1,borderRadius:radii.lg,padding:spacing[3],gap:spacing[3],flexDirection:'row',marginTop:spacing[3]},button:{minHeight:56,borderRadius:radii.lg,padding:spacing[3],alignItems:'center',justifyContent:'center',marginTop:spacing[3]}});
