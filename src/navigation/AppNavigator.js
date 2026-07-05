import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';
import { COLORS } from '../config';
import DashboardScreen  from '../screens/DashboardScreen';
import MerchantsScreen  from '../screens/MerchantsScreen';
import TicketsScreen    from '../screens/TicketsScreen';
import CommunityScreen  from '../screens/CommunityScreen';
import MessagesScreen   from '../screens/MessagesScreen';
import ProfileScreen    from '../screens/ProfileScreen';
import SettingsScreen   from '../screens/SettingsScreen';
import PartnerPrime49Screen from '../screens/PartnerPrime49Screen';

const Tab   = createBottomTabNavigator();
const Stack = createStackNavigator();

function TabIcon({ icon, focused }) {
  return <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}>{icon}</Text>;
}

function TabNavigator({ person, onLogout }) {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.muted,
        tabBarStyle: {
          backgroundColor:  '#fff',
          borderTopColor:   COLORS.border,
          paddingBottom:    6,
          paddingTop:       6,
          height:           60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
      }}
    >
      <Tab.Screen
        name="Home"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏠" focused={focused} />, tabBarLabel: 'Home' }}
      >
        {(props) => <DashboardScreen {...props} person={person} />}
      </Tab.Screen>

      <Tab.Screen
        name="Merchants"
        component={MerchantsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🏪" focused={focused} />, tabBarLabel: 'Merchants' }}
      />

      <Tab.Screen
        name="Tickets"
        component={TicketsScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🎫" focused={focused} />, tabBarLabel: 'Tickets' }}
      />

      <Tab.Screen
        name="Community"
        component={CommunityScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="🌐" focused={focused} />, tabBarLabel: 'Community' }}
      />

      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="💬" focused={focused} />, tabBarLabel: 'Messages' }}
      />

      <Tab.Screen
        name="Profile"
        options={{ tabBarIcon: ({ focused }) => <TabIcon icon="👤" focused={focused} />, tabBarLabel: 'Profile' }}
      >
        {(props) => <ProfileScreen {...props} onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function AppNavigator({ person, onLogout }) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main">
          {(props) => <TabNavigator {...props} person={person} onLogout={onLogout} />}
        </Stack.Screen>
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
          options={{
            headerShown: true,
            title: 'Settings',
            headerTintColor: COLORS.primary,
            headerTitleStyle: { fontWeight: '800', color: COLORS.text },
          }}
        />
        <Stack.Screen
          name="Prime49"
          component={PartnerPrime49Screen}
          options={{
            headerShown: true,
            title: 'My Prime49',
            headerTintColor: COLORS.primary,
            headerTitleStyle: { fontWeight: '800', color: COLORS.text },
          }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
