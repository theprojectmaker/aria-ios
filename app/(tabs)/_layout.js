import { Tabs } from 'expo-router';
import { useColorScheme } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

function ChatIcon({ color, focused }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Path
        d="M5 4.5h14A2.5 2.5 0 0 1 21.5 7v8A2.5 2.5 0 0 1 19 17.5h-7l-4.6 3.6A.7.7 0 0 1 6.3 20.5V17.5H5A2.5 2.5 0 0 1 2.5 15V7A2.5 2.5 0 0 1 5 4.5Z"
        fill={focused ? color : 'none'} stroke={color} strokeWidth={1.9} strokeLinejoin="round"
      />
      <Path d="M12 7.3c.25 2.3 1.2 3.25 3.5 3.5-2.3.25-3.25 1.2-3.5 3.5-.25-2.3-1.2-3.25-3.5-3.5 2.3-.25 3.25-1.2 3.5-3.5Z" fill={focused ? '#fff' : color} />
    </Svg>
  );
}

function VisionIcon({ color, focused }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 24 24">
      <Path d="M4 6h3l1.4-2h7.2L17 6h3a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" fill={focused ? color : 'none'} stroke={color} strokeWidth={1.8} strokeLinejoin="round" />
      <Circle cx={12} cy={13} r={3.6} fill={focused ? '#fff' : 'none'} stroke={focused ? '#fff' : color} strokeWidth={1.8} />
    </Svg>
  );
}

export default function TabsLayout() {
  const dark = useColorScheme() === 'dark';
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: dark ? '#7D7AFF' : '#5E5CE6',
        tabBarInactiveTintColor: dark ? '#98989F' : '#8E8E93',
        tabBarStyle: {
          backgroundColor: dark ? '#1C1C1E' : '#FFFFFF',
          borderTopColor: dark ? '#38383A' : '#E5E5EA',
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Chat', tabBarIcon: ({ color, focused }) => <ChatIcon color={color} focused={focused} /> }} />
      <Tabs.Screen name="vision" options={{ title: 'Vision', tabBarIcon: ({ color, focused }) => <VisionIcon color={color} focused={focused} /> }} />
    </Tabs>
  );
}
