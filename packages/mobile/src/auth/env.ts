import Constants from 'expo-constants';

// 'storeClient' === running inside Expo Go. Native OAuth (Google/Apple) needs a
// dev build, so we use this to show a graceful "installed app only" message in Go.
export const isExpoGo = Constants.executionEnvironment === 'storeClient';
