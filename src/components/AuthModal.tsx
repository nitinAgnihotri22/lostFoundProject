'use client';
import React, { useState } from 'react';
import { User } from '@/types';
import { setStoredUser } from '@/lib/itemService';
import { supabaseBrowser } from '@/lib/supabaseBrowser';
import { AuthError, loginWithEmail, registerWithEmail } from '@/lib/authClient';
import { trackRequest } from '@/lib/loading';
import { X } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (user: User) => void;
  promptMessage?: string | null;
}

type AuthMethod = 'email' | 'phone';

export default function AuthModal({
  isOpen,
  onClose,
  onLoginSuccess,
  promptMessage,
}: AuthModalProps) {
  const [method, setMethod] = useState<AuthMethod>('email');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Email form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Phone OTP form fields
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpStep, setOtpStep] = useState<'input_phone' | 'input_otp'>('input_phone');
  const [otpCode, setOtpCode] = useState('');
  const [phoneName, setPhoneName] = useState('');
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  if (!isOpen) return null;

  const finish = (user: User) => {
    setStoredUser(user);
    onLoginSuccess(user);
    onClose();
  };

  // 1. Google – redirects to Google. On return, the callback handler in
  //    page.tsx calls /api/auth/login (or /api/auth/register for new users).
  const handleGoogleLogin = async () => {
    setError(null);
    const { error } = await trackRequest(
      supabaseBrowser.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}${window.location.pathname}` },
      }),
      'Redirecting to Google…'
    );
    if (error) {
      console.error('Google login error:', error);
      setError('Google sign-in failed. Please try again.');
    }
  };

  // 2. Email & Password – /api/auth/login or /api/auth/register
  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError('Please fill out email and password.');
      return;
    }
    setIsSubmitting(true);
    try {
      const user = isRegister
        ? await registerWithEmail({ name: name.trim(), email: email.trim(), password })
        : await loginWithEmail(email.trim(), password);
      finish(user);
    } catch (err) {
      if (err instanceof AuthError && err.code === 'USER_NOT_FOUND') {
        setIsRegister(true);
        setError('No account found for this email. Add your name to sign up.');
      } else if (err instanceof AuthError && err.code === 'USER_EXISTS') {
        setIsRegister(false);
        setError('An account with this email already exists. Please log in.');
      } else {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // 3. Phone Number & OTP Submit (still a local mock – not wired to the API yet)
  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumber.trim() || phoneNumber.length < 8) {
      alert('Please enter a valid phone number with area/country code.');
      return;
    }
    setIsSendingOtp(true);
    setTimeout(() => {
      setIsSendingOtp(false);
      setOtpStep('input_otp');
    }, 600);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.length < 4) {
      alert('Please enter the 6-digit verification code.');
      return;
    }
    const displayName = phoneName.trim() || `User (${phoneNumber.slice(-4)})`;
    finish({
      id: `user-phone-${Date.now()}`,
      name: displayName,
      email: `${phoneNumber.replace(/[^0-9]/g, '')}@phone.lostfound`,
      phone: phoneNumber.trim(),
      avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}`,
    });
  };

  return (
    <>
      {/* Main Auth Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
        <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 p-6 sm:p-8 my-auto max-h-[92vh] flex flex-col">
          <button onClick={onClose} className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition">
            <X className="w-5 h-5" />
          </button>
          <div className="text-center mb-5">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-sm font-black text-xl">LF</div>
            <h2 className="text-2xl font-black text-gray-900">
              {isRegister ? 'Join LostFound' : 'Log In to Continue'}
            </h2>
            {promptMessage ? (
              <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs font-semibold">
                🔒 {promptMessage}
              </div>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                Sign in to report found items, create lost reports, and verify ownership claims.
              </p>
            )}
          </div>
          {error && (
            <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs font-semibold">
              {error}
            </div>
          )}
          {/* Google button */}
          <div className="mb-4">
            <button type="button" onClick={handleGoogleLogin} className="w-full py-2.5 px-4 bg-white border border-gray-300 hover:border-gray-400 hover:bg-gray-50 text-gray-700 font-bold text-xs sm:text-sm rounded-xl shadow-xs transition flex items-center justify-center gap-3">
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z" />
                <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z" />
                <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.99 0 12s.45 3.83 1.25 5.42l4.03-3.15z" />
                <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z" />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>
          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-gray-200 w-full"></div>
            <span className="bg-white px-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">or continue with</span>
            <div className="border-t border-gray-200 w-full"></div>
          </div>
          {/* Method tabs */}
          <div className="flex p-1 bg-gray-100 rounded-xl mb-4">
            <button type="button" onClick={() => setMethod('email')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${method === 'email' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}>
              Email
            </button>
            <button type="button" onClick={() => setMethod('phone')} className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 ${method === 'phone' ? 'bg-white text-blue-600 shadow-xs' : 'text-gray-600 hover:text-gray-900'}`}>
              Phone
            </button>
          </div>
          {/* Forms (simplified) */}
          {method === 'email' && (
            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {isRegister && (
                <input type="text" placeholder="Name" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded px-3 py-2" required />
              )}
              <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} className="w-full border rounded px-3 py-2" required />
              <input type="password" placeholder="Password" minLength={isRegister ? 8 : undefined} value={password} onChange={e => setPassword(e.target.value)} className="w-full border rounded px-3 py-2" required />
              <button type="submit" disabled={isSubmitting} className="w-full py-2 bg-blue-600 text-white rounded disabled:opacity-60">
                {isSubmitting ? 'Please wait…' : isRegister ? 'Sign Up' : 'Log In'}
              </button>
              <p className="text-center text-xs text-gray-500">
                {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button type="button" onClick={() => { setIsRegister(!isRegister); setError(null); }} className="font-bold text-blue-600 hover:underline">
                  {isRegister ? 'Log in' : 'Sign up'}
                </button>
              </p>
            </form>
          )}
          {method === 'phone' && (
            <form onSubmit={otpStep === 'input_phone' ? handleSendOtp : handleVerifyOtp} className="space-y-4">
              {otpStep === 'input_phone' && (
                <>
                  <input type="tel" placeholder="Phone number" value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} className="w-full border rounded px-3 py-2" required />
                  <button type="submit" disabled={isSendingOtp} className="w-full py-2 bg-blue-600 text-white rounded">
                    {isSendingOtp ? 'Sending...' : 'Send OTP'}
                  </button>
                </>
              )}
              {otpStep === 'input_otp' && (
                <>
                  <input type="text" placeholder="OTP code" value={otpCode} onChange={e => setOtpCode(e.target.value)} className="w-full border rounded px-3 py-2" required />
                  <input type="text" placeholder="Display name (optional)" value={phoneName} onChange={e => setPhoneName(e.target.value)} className="w-full border rounded px-3 py-2" />
                  <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded">Verify OTP</button>
                </>
              )}
            </form>
          )}
        </div>
      </div>

    </>
  );
}
