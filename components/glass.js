/* <Glass> — clear Apple glass with graceful fallbacks:
   iOS 26+  → real Liquid Glass, "clear" variant by default (most transparent)
   older iOS → light system blur with a crisp rim
   web/other → barely-tinted translucent fill with a crisp rim
   Pass `regular` for the denser frosted variant (sheets, menus).
   Native modules are required lazily and guarded. */
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

export default function Glass({ t, style, children, interactive, tint, regular, radius, pointerEvents }) {
  const m = native();
  const flat = StyleSheet.flatten(style) || {};
  const r = radius != null ? radius : flat.borderRadius != null ? flat.borderRadius : 22;
  if (m.liquid && m.glass) {
    const G = m.glass;
    return (
      <G pointerEvents={pointerEvents} glassEffectStyle={regular ? 'regular' : 'clear'} isInteractive={!!interactive} tintColor={tint}
        style={[style, { borderRadius: r, overflow: 'hidden' }]}>
        {children}
      </G>
    );
  }
  // Fallback: a clear pane — faint fill, bright top edge, soft lift.
  const edge = {
    borderWidth: 1,
    borderColor: t.dark ? 'rgba(255,255,255,0.16)' : 'rgba(0,0,0,0.07)',
    borderTopColor: t.dark ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.95)',
  };
  const lift = Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: t.dark ? 0.35 : 0.07, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
    web: { boxShadow: t.dark ? '0 4px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)' : '0 4px 18px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.9)' },
    default: {},
  });
  const fill = tint || (regular
    ? (t.dark ? 'rgba(44,44,48,0.55)' : 'rgba(255,255,255,0.6)')
    : (t.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.28)'));
  if (m.blur && Platform.OS !== 'android') {
    const B = m.blur;
    return (
      <View pointerEvents={pointerEvents} style={[{ borderRadius: r, zIndex: 0 }, lift, style]}>
        <B pointerEvents="none" intensity={regular ? 60 : 28} tint={t.dark ? 'dark' : 'light'}
          style={[StyleSheet.absoluteFill, { borderRadius: r, overflow: 'hidden', backgroundColor: fill, zIndex: -1 }, edge]} />
        {children}
      </View>
    );
  }
  return (
    <View pointerEvents={pointerEvents} style={[{ borderRadius: r, overflow: 'hidden', backgroundColor: fill }, edge, lift, style]}>
      {children}
    </View>
  );
}
