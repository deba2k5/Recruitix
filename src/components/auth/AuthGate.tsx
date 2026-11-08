import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, Lock, User as UserIcon, GraduationCap, Building2, IdCard } from 'lucide-react';
import { apiPost, setToken } from '@/lib/api';

interface AuthGateProps {
  onBack: () => void;
  onAuthenticated: () => Promise<void> | void;
}

/** Account access against the Express API. Camera access is requested only for exam proctoring. */
const AuthGate = ({ onBack, onAuthenticated }: AuthGateProps) => {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [year, setYear] = useState('');
  const [department, setDepartment] = useState('');
  const [enrollmentNo, setEnrollmentNo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const isSignupValid =
    name.trim() &&
    email.trim() &&
    year.trim() &&
    department.trim() &&
    enrollmentNo.trim() &&
    password.length >= 6;
  const isSigninValid = email.trim() && password.length > 0;

  const handleSubmit = async () => {
    setError('');
    setIsLoading(true);
    try {
      const path = mode === 'signup' ? '/api/auth/signup' : '/api/auth/login';
      const body =
        mode === 'signup'
          ? { name, email, year, department, enrollmentNo, password }
          : { email, password };
      const { token } = await apiPost<{ token: string }>(path, body);
      setToken(token);
      await onAuthenticated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader className="space-y-3 text-center">
            <CardTitle className="text-2xl text-white">Hirex Account</CardTitle>
            <CardDescription className="text-slate-300">
              {mode === 'signup'
                ? 'Create your candidate account'
                : 'Sign in to continue to your exam portal'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">Full Name</label>
                  <div className="relative">
                    <UserIcon className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Your Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-white text-sm font-medium mb-2 block">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="text-white text-sm font-medium mb-2 block">Year of Study</label>
                  <div className="relative">
                    <GraduationCap className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="e.g. 3rd Year"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>
              )}

              {mode === 'signup' && (
                <>
                  <div>
                    <label className="text-white text-sm font-medium mb-2 block">Department</label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="e.g. Computer Science"
                        value={department}
                        onChange={(e) => setDepartment(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-white text-sm font-medium mb-2 block">Enrollment Number</label>
                    <div className="relative">
                      <IdCard className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Your enrollment number"
                        value={enrollmentNo}
                        onChange={(e) => setEnrollmentNo(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="text-white text-sm font-medium mb-2 block">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                  <input
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <Button
                onClick={handleSubmit}
                disabled={isLoading || (mode === 'signup' ? !isSignupValid : !isSigninValid)}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg"
              >
                {isLoading ? 'Please wait...' : mode === 'signup' ? 'Create Account' : 'Sign In'}
              </Button>

              <button
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setError('');
                }}
                className="w-full text-slate-300 hover:text-white text-sm py-2"
              >
                {mode === 'signin' ? "Don't have an account? Sign Up" : 'Already have an account? Sign In'}
              </button>
            </div>

            <Button
              onClick={onBack}
              variant="outline"
              className="w-full bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800"
            >
              Back
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AuthGate;
