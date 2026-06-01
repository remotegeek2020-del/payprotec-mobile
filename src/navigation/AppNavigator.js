import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { enableScreens } from 'react-native-screens';
enableScreens(false);

import { COLORS } from '../config';
import LoginScreen          from '../screens/LoginScreen';
import TwoFAScreen          from '../screens/TwoFAScreen';
import HomeScreen           from '../screens/HomeScreen';
import MerchantsScreen      from '../screens/MerchantsScreen';
import MerchantDetailScreen from '../screens/MerchantDetailScreen';
import ReturnsScreen        from '../screens/ReturnsScreen';
import DeploymentsScreen    from '../screens/DeploymentsScreen';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

const headerOpts = {
  headerStyle: { backgroundColor: COLORS.primaryDk },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '800' },
};

function TabIcon({ emoji, focused }) {
  return <Text style={{ fontSize: focused ? 22 : 18, opacity: focused ? 1 : 0.5 }}>{emoji}</Text>;
}

function MerchantsStack() {
  return (
    <Stack.Navigator screenOptions={headerOpts}>
      <Stack.Screen name="MerchantsList"  component={MerchantsScreen}      options={{ title: 'Merchants' }} />
      <Stack.Screen name="MerchantDetail" component={MerchantDetailScreen} options={{ title: 'Merchant Detail' }} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.light,
        tabBarStyle: { borderTopColor: COLORS.border, backgroundColor: '#fff', height: 60, paddingBottom: 8 },
        tabBarLabelStyle: { fontSize: 10, fontWeight: '700' },
        ...headerOpts,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: 'Dashboard', tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} /> }}
      />
      <Tab.Screen
        name="Merchants"
        component={MerchantsStack}
        options={{ headerShown: false, title: 'Merchants', tabBarIcon: ({ focused }) => <TabIcon emoji="🏪" focused={focused} /> }}
      />
      <Tab.Screen
        name="Returns"
        component={ReturnsScreen}
        options={{ title: 'Returns / RMA', tabBarIcon: ({ focused }) => <TabIcon emoji="📦" focused={focused} /> }}
      />
      <Tab.Screen
        name="Deployments"
        component={DeploymentsScreen}
        options={{ title: 'Deployments', tabBarIcon: ({ focused }) => <TabIcon emoji="🚚" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: COLORS.primaryDk } }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="TwoFA" component={TwoFAScreen} />
        <Stack.Screen name="Main"  component={MainTabs} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
