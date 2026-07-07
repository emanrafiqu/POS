import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';

const AUTH_ERRORS = {
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/too-many-requests': 'Too many attempts — try again in a few minutes.',
  'auth/user-disabled': 'This account has been disabled.',
};

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { email: '', password: '', rememberMe: true },
  });

  const onSubmit = async ({ email, password, rememberMe }) => {
    try {
      await login(email.trim(), password, rememberMe);
      toast.success('Welcome back!');
      navigate(location.state?.from?.pathname || '/', { replace: true });
    } catch (err) {
      toast.error(AUTH_ERRORS[err.code] || 'Sign in failed. Please try again.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-4">
      {/* Ambient gold glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 h-96 w-96 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 h-72 w-72 rounded-full bg-gold/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gold font-serif text-3xl font-bold text-ink shadow-gold">
            V
          </div>
          <h1 className="text-2xl font-semibold tracking-[0.3em] text-white">VELOURA</h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-white/40">Premium Fashion · Point of Sale</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="glass-dark rounded-2xl p-7 text-white shadow-2xl" noValidate>
          <h2 className="mb-5 text-lg font-semibold">Sign in to your store</h2>

          <Field label={<span className="text-white/60">Email</span>} error={errors.email?.message}>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input
                type="email"
                placeholder="you@veloura.pk"
                className="border-white/15 bg-white/5 pl-9 text-white placeholder:text-white/25"
                error={errors.email}
                {...register('email', {
                  required: 'Email is required.',
                  pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address.' },
                })}
              />
            </div>
          </Field>

          <Field label={<span className="text-white/60">Password</span>} error={errors.password?.message} className="mt-4">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" />
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                className="border-white/15 bg-white/5 pl-9 pr-10 text-white placeholder:text-white/25"
                error={errors.password}
                {...register('password', { required: 'Password is required.' })}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </Field>

          <div className="mt-4 flex items-center justify-between text-sm">
            <label className="flex cursor-pointer items-center gap-2 text-white/60">
              <input type="checkbox" className="h-4 w-4 rounded accent-gold" {...register('rememberMe')} />
              Remember me
            </label>
            <Link to="/forgot-password" className="text-gold hover:text-gold-light">
              Forgot password?
            </Link>
          </div>

          <Button type="submit" variant="gold" size="lg" className="mt-6 w-full" loading={isSubmitting}>
            Sign In
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-white/30">
          © {new Date().getFullYear()} Veloura. Secured with Firebase Authentication.
        </p>
      </div>
    </div>
  );
}
