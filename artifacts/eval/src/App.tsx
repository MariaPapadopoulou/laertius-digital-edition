import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { Toaster } from 'sonner';

import Layout from './Layout';
import Dashboard from './pages/Dashboard';
import SnapshotsList from './pages/snapshots/SnapshotsList';
import SnapshotDetail from './pages/snapshots/SnapshotDetail';
import TopicsList from './pages/topics/TopicsList';
import TopicDetail from './pages/topics/TopicDetail';
import RunsList from './pages/runs/RunsList';
import RunDetail from './pages/runs/RunDetail';
import RunCompare from './pages/runs/RunCompare';
import PoolsList from './pages/pools/PoolsList';
import PoolDetail from './pages/pools/PoolDetail';
import Judge from './pages/Judge';
import NotFound from './pages/NotFound';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function MainRouter() {
  const [location] = useLocation();

  if (location.startsWith('/judge')) {
    return (
      <Switch>
        <Route path="/judge" component={Judge} />
      </Switch>
    );
  }

  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/snapshots" component={SnapshotsList} />
        <Route path="/snapshots/:id" component={SnapshotDetail} />
        <Route path="/topics" component={TopicsList} />
        <Route path="/topics/:id" component={TopicDetail} />
        <Route path="/runs" component={RunsList} />
        <Route path="/runs/compare" component={RunCompare} />
        <Route path="/runs/:id" component={RunDetail} />
        <Route path="/pools" component={PoolsList} />
        <Route path="/pools/:id" component={PoolDetail} />
        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <MainRouter />
      </WouterRouter>
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
