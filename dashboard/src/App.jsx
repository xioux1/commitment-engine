import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Overview }          from './pages/Overview';
import { Commitments }       from './pages/Commitments';
import { CommitmentDetail }  from './pages/CommitmentDetail';
import { Evaluations }       from './pages/Evaluations';
import { Wallet }            from './pages/Wallet';
import { VROralReview }      from './pages/VROralReview';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"                   element={<Overview />} />
          <Route path="/commitments"        element={<Commitments />} />
          <Route path="/commitments/:id"    element={<CommitmentDetail />} />
          <Route path="/evaluations"        element={<Evaluations />} />
          <Route path="/wallet"             element={<Wallet />} />
          <Route path="/oral-review"        element={<VROralReview />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
