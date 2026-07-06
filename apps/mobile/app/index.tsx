import { Redirect } from 'expo-router';

export default function Index() {
  // Auth gate stubbed — always land on diary for now
  return <Redirect href="/(tabs)/diary" />;
}
