/* <Sheet> — Apple-style bottom sheet: grabber pill, drag down to dismiss
   (follows the finger, springs back if released early), dimmed backdrop that
   fades with the drag, tap outside to close. Pure RN (PanResponder + Animated). */
import { useEffect, useRef, useState } from 'react';
import { Modal, View, Pressable, Animated, PanResponder, StyleSheet, Platform, Easing, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Glass from './glass';

const native = Platform.OS !== 'web';

export default function Sheet({ t, visible, onClose, children, maxWidth = 560 }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const y = useRef(new Animated.Value(height)).current;
  const [shown, setShown] = useState(false);
  const closing = useRef(false);

  const open = () => Animated.spring(y, { toValue: 0, useNativeDriver: native, damping: 28, stiffness: 300, mass: 0.9 }).start();
  const close = (then) => {
    if (closing.current) return;
    closing.current = true;
    Animated.timing(y, { toValue: height, duration: 220, easing: Easing.in(Easing.cubic), useNativeDriver: native }).start(() => {
      closing.current = false; setShown(false); then && then();
    });
  };

  useEffect(() => {
    if (visible) { setShown(true); y.setValue(height); requestAnimationFrame(open); }
    else if (shown) close();
  }, [visible]);

  const pan = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
    onPanResponderMove: (_, g) => { y.setValue(Math.max(0, g.dy)); },
    onPanResponderRelease: (_, g) => {
      if (g.dy > 110 || g.vy > 0.9) close(() => onCloseRef.current && onCloseRef.current());
      else open();
    },
    onPanResponderTerminate: () => open(),
  })).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const dim = y.interpolate({ inputRange: [0, height], outputRange: [1, 0], extrapolate: 'clamp' });
  const requestClose = () => close(() => onClose && onClose());

  return (
    <Modal visible={shown} transparent animationType="none" onRequestClose={requestClose}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)', opacity: dim }]}>
        <Pressable style={{ flex: 1 }} onPress={requestClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View pointerEvents="box-none" style={[st.wrap, { paddingBottom: Math.max(10, insets.bottom), transform: [{ translateY: y }] }]}>
        <View style={{ width: '100%', maxWidth }}>
          <Glass t={t} regular radius={34} style={st.sheet}>
            <View {...pan.panHandlers} style={st.grabZone} accessibilityLabel="Drag down to close">
              <View style={[st.grabber, { backgroundColor: t.dark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)' }]} />
            </View>
            {children}
          </Glass>
        </View>
      </Animated.View>
    </Modal>
  );
}

// Grabber pill for native page sheets (Settings, Models), which iOS already
// lets you swipe down.
export function Grabber({ t }) {
  return <View style={[st.grabber, { alignSelf: 'center', marginTop: 6, marginBottom: 2, backgroundColor: t.dark ? 'rgba(235,235,245,0.3)' : 'rgba(60,60,67,0.3)' }]} />;
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', paddingHorizontal: 8 },
  sheet: { paddingHorizontal: 14, paddingBottom: 16 },
  grabZone: { alignItems: 'center', paddingTop: 8, paddingBottom: 12 },
  grabber: { width: 36, height: 5, borderRadius: 3 },
});
