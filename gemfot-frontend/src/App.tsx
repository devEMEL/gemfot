import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import Providers from '@/components/gemfot/Providers';
import Header from '@/components/gemfot/Header';
import Footer from '@/components/gemfot/Footer';
import Explore from '@/app/Explore';
import LaunchToken from '@/app/LaunchToken';
import TokenDetail from '@/app/TokenDetail';
import Portfolio from '@/app/Portfolio';

export default function App() {
  return (
    <Providers>
      <BrowserRouter>
        <div className="flex flex-col min-h-screen">
          <Header />
          <main className="flex-1">
            <Routes>
              <Route path="/" element={<Explore />} />
              <Route path="/launch" element={<LaunchToken />} />
              <Route path="/token/:address" element={<TokenDetail />} />
              <Route path="/portfolio" element={<Portfolio />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </Providers>
  );
}
