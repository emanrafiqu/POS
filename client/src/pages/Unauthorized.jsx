import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function Unauthorized() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-surface p-6 text-center">
      <ShieldAlert className="h-14 w-14 text-gold" />
      <h1 className="mt-4 text-xl font-semibold">Access denied</h1>
      <p className="mt-1 max-w-sm text-sm text-ink/50">
        Your role doesn't have permission to view this page. Contact an administrator if you believe this is a mistake.
      </p>
      <Link to="/" className="mt-6"><Button variant="gold">Back to Dashboard</Button></Link>
    </div>
  );
}
