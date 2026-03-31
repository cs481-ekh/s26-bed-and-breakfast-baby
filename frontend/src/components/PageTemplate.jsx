import Header from './Header';
import './PageTemplate.css';

export default function PageTemplate({ children }) {
  return (
    <div className="page-layout">
      <Header />
      <main className="page-content">
        {children}
      </main>
    </div>
  );
}
