import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { COLORS }               from '../config';
import { Notifications }        from '../api';
import LoginScreen              from '../screens/LoginScreen';
import TwoFAScreen              from '../screens/TwoFAScreen';
import HomeScreen               from '../screens/HomeScreen';
import MerchantsScreen          from '../screens/MerchantsScreen';
import MerchantDetailScreen     from '../screens/MerchantDetailScreen';
import ReturnsScreen            from '../screens/ReturnsScreen';
import DeploymentsScreen        from '../screens/DeploymentsScreen';
import TasksScreen              from '../screens/TasksScreen';
import TicketsScreen            from '../screens/TicketsScreen';
import EquipmentScreen          from '../screens/EquipmentScreen';
import RepairQueueScreen        from '../screens/RepairQueueScreen';
import EquipmentROIScreen       from '../screens/EquipmentROIScreen';
import PartnersScreen           from '../screens/PartnersScreen';
import CommunityScreen          from '../screens/CommunityScreen';
import MessagesScreen           from '../screens/MessagesScreen';

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

function HomeStack() {
  return (
    <Stack.Navigator screenOptions={headerOpts}>
      <Stack.Screen name="HomeMain"     component={HomeScreen}         options={{ title: 'Dashboard' }} />
      <Stack.Screen name="Equipment"    component={EquipmentScreen}    options={{ title: 'Inventory' }} />
      <Stack.Screen name="RepairQueue"  component={RepairQueueScreen}  options={{ title: 'Repair Queue' }} />
      <Stack.Screen name="EquipmentROI" component={EquipmentROIScreen} options={{ title: 'Equipment ROI' }} />
      <Stack.Screen name="Partners"     component={PartnersScreen}     options={{ title: 'Partners' }} />
      <Stack.Screen name="Community"    component={CommunityScreen}    options={{ title: 'Community' }} />
      <Stack.Screen name="Messages"     component={MessagesScreen}     options={{ title: 'Messages' }} />
    </Stack.Navigator>
  );
}

function MerchantsStack() {
  return (
    <Stack.Navigator screenOptions={headerOpts}>
      <Stack.Screen name="MerchantsList"  component={MerchantsScreen}      options={{ title: 'Merchants' }} />
      <Stack.Screen name="MerchantDetail" component={MerchantDetailScreen} options={{ title: 'Merchant Detail' }} />
    </Stack.Navigator>
  );
}

function MainTabs({ counts }) {
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
        component={HomeStack}
        options={{
          headerShown: false,
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Merchants"
        component={MerchantsStack}
        options={{
          headerShown: false,
          title: 'Merchants',
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏪" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Returns"
        component={ReturnsScreen}
        options={{
          title: 'Returns / RMA',
          tabBarBadge: counts.returns > 0 ? counts.returns : undefined,
          tabBarIcon: ({ focused }) => <TabIcon emoji="📦" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Deployments"
        component={DeploymentsScreen}
        options={{
          title: 'Deployments',
          tabBarBadge: counts.deployments > 0 ? counts.deployments : undefined,
          tabBarIcon: ({ focused }) => <TabIcon emoji="🚚" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Tasks"
        component={TasksScreen}
        options={{
          title: 'Tasks',
          tabBarBadge: counts.tasks > 0 ? counts.tasks : undefined,
          tabBarIcon: ({ focused }) => <TabIcon emoji="✅" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Tickets"
        component={TicketsScreen}
        options={{
          title: 'Tickets',
          tabBarBadge: counts.tickets > 0 ? counts.tickets : undefined,
          tabBarIcon: ({ focused }) => <TabIcon emoji="🎫" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const [counts, setCounts] = useState({});

  useEffect(() => {
    let active = true;

    async function fetchCounts() {
      try {
        const data = await Notifications.getCounts();
        if (active && data?.counts) setCounts(data.counts);
      } catch {}
    }

    fetchCounts();
    const interval = setInterval(fetchCounts, 60000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false, cardStyle: { backgroundColor: COLORS.primaryDk } }}>
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="TwoFA" component={TwoFAScreen} />
        <Stack.Screen name="Main"  component={() => <MainTabs counts={counts} />} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
