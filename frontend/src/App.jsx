// App.jsx is intentionally tiny. All routing lives in routes/AppRouter.jsx;
// global state lives in context/AuthContext.jsx. This keeps App.jsx easy to
// reason about and easy to test.

import AppRouter from './routes/AppRouter.jsx';

export default function App() {
  return <AppRouter />;
}
