import AppProviders from "./app/AppProviders.tsx";
import AppRoot from "./app/AppRoot.tsx";

export default function App() {
  return (
    <AppProviders>
      <AppRoot />
    </AppProviders>
  );
}
