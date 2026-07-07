import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface p-6 text-center">
      <p className="font-serif text-7xl font-bold text-gold">404</p>
      <h1 className="mt-2 text-xl font-semibold">Page not found</h1>
      <p className="mt-1 text-sm text-ink/50">The page you're looking for doesn't exist or was moved.</p>
      <Link to="/" className="mt-6"><Button variant="gold">Back to Dashboard</Button></Link>
    </div>
  );
}
