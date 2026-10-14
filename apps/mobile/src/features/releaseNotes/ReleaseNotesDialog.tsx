import { useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { useOrionTheme } from '../../context/ThemeContext';
import { OrionContentDialog } from '../feedback/OrionContentDialog';
import { parseReleaseNotes, safeNoteLink, type ReleaseDocument } from './releaseNotesModel';
export function ReleaseNotesDialog({ document, onClose }: { document: ReleaseDocument | null; onClose: () => void }) {
  const { theme } = useOrionTheme(); const [failed, setFailed] = useState(false);
  const blocks = useMemo(() => parseReleaseNotes(document?.notes || ''), [document]);
  return <OrionContentDialog visible={!!document} title={document?.title || 'Release Notes'} eyebrow={`ORION ${document?.version || ''}`} onClose={onClose}>
    {blocks.map((block, id) => <View key={id} style={{flexDirection:'row',gap:10,marginTop:block.kind==='heading'?12:0}}>{block.kind==='bullet' && <Text accessible={false} style={{color:theme.accent,fontSize:17}}>•</Text>}<Text accessibilityRole={block.kind==='heading'?'header':undefined} style={{flex:1,color:block.kind==='heading'?theme.text:theme.textSecondary,fontFamily:block.kind==='heading'?'Outfit':'Inter',fontSize:block.kind==='heading'?(block.level===1?26:21):16,lineHeight:block.kind==='heading'?34:25}}>{block.parts.map((part,index)=><Text key={index} accessibilityRole={part.href?'link':undefined} accessibilityHint={part.href?'Opens in your browser':undefined} onPress={part.href?()=>{const url=safeNoteLink(part.href!);if(url)void Linking.openURL(url).catch(()=>setFailed(true));}:undefined} style={{fontWeight:part.emphasis?'700':undefined,color:part.href?theme.accent:undefined,textDecorationLine:part.href?'underline':undefined}}>{part.text}</Text>)}</Text></View>)}
    {failed && <Text accessibilityRole="alert" style={{color:theme.textSecondary}}>This link couldn’t open. Please try again.</Text>}
  </OrionContentDialog>;
}
