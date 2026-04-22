import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar, StyleSheet, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import LauncherScreen from './app/LauncherScreen';
import EduLoginScreen from './app/eduos/LoginScreen';
import EduDashboard from './app/eduos/DashboardScreen';
import StudentsScreen from './app/eduos/StudentsScreen';
import TeachersScreen from './app/eduos/TeachersScreen';
import FeesScreen from './app/eduos/FeesScreen';
import AttendanceScreen from './app/eduos/AttendanceScreen';
import AcademicsScreen from './app/eduos/AcademicsScreen';
import NoticesScreen from './app/eduos/NoticesScreen';
import ResultsScreen from './app/eduos/ResultsScreen';
import TimetableScreen from './app/eduos/TimetableScreen';
import AIToolsScreen from './app/eduos/AIToolsScreen';
import SchoolsScreen from './app/eduos/SchoolsScreen';
import LearnLoginScreen from './app/learnspace/LoginScreen';
import LearnHomeScreen from './app/learnspace/HomeScreen';
import AssignmentsScreen from './app/learnspace/AssignmentsScreen';
import GradesScreen from './app/learnspace/GradesScreen';
import ExamsScreen from './app/learnspace/ExamsScreen';
import NotesScreen from './app/learnspace/NotesScreen';
import EventsScreen from './app/learnspace/EventsScreen';
import LearnAttendanceScreen from './app/learnspace/AttendanceScreen';

const Stack = createStackNavigator();
const screenOptions = { headerShown: false, gestureEnabled: true, cardStyle: { backgroundColor: '#0A0A0F' } };

function EduOSStack({ route }) {
  const { user, onLogout } = route.params;
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="EduDash">
        {props => <EduDashboard {...props} user={user} onLogout={onLogout} />}
      </Stack.Screen>
      <Stack.Screen name="Students" component={StudentsScreen} />
      <Stack.Screen name="Teachers" component={TeachersScreen} />
      <Stack.Screen name="Fees" component={FeesScreen} />
      <Stack.Screen name="Attendance" component={AttendanceScreen} />
      <Stack.Screen name="Academics" component={AcademicsScreen} />
      <Stack.Screen name="Notices" component={NoticesScreen} />
      <Stack.Screen name="Results" component={ResultsScreen} />
      <Stack.Screen name="Timetable" component={TimetableScreen} />
      <Stack.Screen name="AITools" component={AIToolsScreen} />
      <Stack.Screen name="Schools" component={SchoolsScreen} />
    </Stack.Navigator>
  );
}

function LearnStack({ route }) {
  const { user, onLogout } = route.params;
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="LearnHome">
        {props => (
          <LearnHomeScreen
            {...props}
            user={user}
            onLogout={onLogout}
            onNavigate={(screen) => props.navigation.navigate(screen)}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Assignments" component={AssignmentsScreen} />
      <Stack.Screen name="Grades" component={GradesScreen} />
      <Stack.Screen name="Exams" component={ExamsScreen} />
      <Stack.Screen name="Notes" component={NotesScreen} />
      <Stack.Screen name="Events" component={EventsScreen} />
      <Stack.Screen name="LearnAttendance" component={LearnAttendanceScreen} />
    </Stack.Navigator>
  );
}

export default function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    StatusBar.setBarStyle('light-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor('#0A0A0F');
      StatusBar.setTranslucent(false);
    }
  }, []);

  const handleLogout = async (navigation) => {
    await AsyncStorage.multiRemove(['token', 'learn_token', 'eduos_user']);
    setUser(null);
    navigation.reset({ index: 0, routes: [{ name: 'Launcher' }] });
  };

  return (
    <GestureHandlerRootView style={styles.root}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false, gestureEnabled: false, cardStyle: { backgroundColor: '#0A0A0F' } }}>
          <Stack.Screen name="Launcher" component={LauncherScreen} />
          <Stack.Screen name="EduLogin">
            {props => (
              <EduLoginScreen
                onLogin={(data) => {
                  const u = data.user || data;
                  setUser(u);
                  props.navigation.replace('EduOS', { user: u, onLogout: () => handleLogout(props.navigation) });
                }}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="LearnLogin">
            {props => (
              <LearnLoginScreen
                onLogin={(data) => {
                  const u = data.user || data;
                  setUser(u);
                  props.navigation.replace('Learnspace', { user: u, onLogout: () => handleLogout(props.navigation) });
                }}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="EduOS" component={EduOSStack} />
          <Stack.Screen name="Learnspace" component={LearnStack} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#0A0A0F' } });
