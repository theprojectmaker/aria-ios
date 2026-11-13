/* <Glass> — Apple materials with graceful fallbacks:
   iOS 26+  → real Liquid Glass (expo-glass-effect GlassView)
   older iOS → system material blur (expo-blur BlurView)
   web/other → translucent fill with a hairline rim
   Native modules are required lazily and guarded, so a binary without them
   still renders the fallback instead of crashing. */
import { View, Platform, StyleSheet } from 'react-native';

let mods = null;
function native() {
  if (mods) return mods;
  mods = { glass: null, blur: null, liquid: false };
  try {
    const g = require('expo-glass-effect');
    mods.glass = g.GlassView;
    mods.liquid = Platform.OS === 'ios' && !!(g.isLiquidGlassAvailable && g.isLiquidGlassAvailable());
  } catch (e) {}
  try { mods.blur = require('expo-blur').BlurView; } catch (e) {}
  return mods;
}
export const hasLiquidGlass = () => native().liquid;

export default function Glass({ t, style, children, interactive, tint, clear, radius, intensity = 70, pointerEvents }) {
  const m = native();
  const flat = StyleSheet.flatten(style) || {};
  const r = radius != null ? radius : flat.borderRadius != null ? flat.borderRadius : 22;
  if (m.liquid && m.glass) {
    const G = m.glass;
    return (
      <G pointerEvents={pointerEvents} glassEffectStyle={clear ? 'clear' : 'regular'} isInteractive={!!interactive} tintColor={tint}
        style={[style, { borderRadius: r, overflow: 'hidden' }]}>
        {children}
      </G>
    );
  }
  const rim = { borderWidth: StyleSheet.hairlineWidth, borderColor: t.dark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.7)' };
  if (m.blur && Platform.OS !== 'android') {
    const B = m.blur;
    return (
      <B pointerEvents={pointerEvents} intensity={intensity} tint={t.dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'}
        style={[{ borderRadius: r, overflow: 'hidden', backgroundColor: tint || (t.dark ? 'rgba(40,40,44,0.35)' : 'rgba(255,255,255,0.45)') }, rim, style]}>
        {children}
      </B>
    );
  }
  return (
    <View pointerEvents={pointerEvents} style={[{ borderRadius: r, overflow: 'hidden', backgroundColor: tint || (t.dark ? 'rgba(44,44,48,0.72)' : 'rgba(255,255,255,0.78)') }, rim, style]}>
      {children}
    </View>
  );
}
