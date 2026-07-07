import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input, Field } from '@/components/ui/Input';

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();

  const onSubmit = async ({ email }) => {
    try {
      await resetPassword(email.trim());
      setSent(true);
    } catch (err) {
      // Do not reveal whether the email exists — generic success either way
      if (err.code === 'auth/user-not-found') setSent(true);
      else toast.error('Could not send the reset email. Try again.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="glass-dark rounded-2xl p-7 text-white shadow-2xl">
          {sent ? (
            <div className="py-4 text-center">
              <MailCheck className="mx-auto mb-3 h-12 w-12 text-gold" />
              <h2 className="text-lg font-semibold">Check your inbox</h2>
              <p className="mt-2 text-sm text-white/60">
                If an account exists for that email, a password reset link is on its way.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <h2 className="text-lg font-semibold">Reset your password</h2>
              <p className="mb-5 mt-1 text-sm text-white/50">
                Enter your account email and we'll send you a reset link.
              </p>
              <Field label={<span className="text-white/60">Email</span>} error={errors.email?.message}>
                <Input
                  type="email"
                  placeholder="you@veloura.pk"
                  className="border-white/15 bg-white/5 text-white placeholder:text-white/25"
                  error={errors.email}
                  {...register('email', {
                    required: 'Email is required.',
                    pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address.' },
                  })}
                />
              </Field>
              <Button type="submit" variant="gold" className="mt-5 w-full" loading={isSubmitting}>
                Send Reset Link
              </Button>
            </form>
          )}
          <Link to="/login" className="mt-5 flex items-center justify-center gap-1.5 text-sm text-gold hover:text-gold-light">
            <ArrowLeft className="h-4 w-4" /> Back to sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
