import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, CheckCircle, ArrowRight, Code, Video, Lock, Brain, BarChart3, Sparkles, Menu, X } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import RecruiterPortal from '@/components/RecruiterPortal';
import AuthGate from '@/components/auth/AuthGate';
import CandidateFlow from '@/components/exam/CandidateFlow';
import { Footer } from '@/components/ui/modem-animated-footer';
import { Twitter, Linkedin, Github, Mail } from 'lucide-react';
import { trackUserLogin } from '@/utils/userActivityTracker';
import { useAuthProfile } from '@/hooks/useAuthProfile';
import { apiPost, clearToken, getToken, setToken } from '@/lib/api';

const Index = () => {
  // Recruiter/admin login is still Firebase-backed pending a later migration phase.
  const [userType, setUserType] = useState<'recruiter' | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminCredentials, setAdminCredentials] = useState({ id: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [typedHeadline, setTypedHeadline] = useState('');
  const [scrollY, setScrollY] = useState(0);
  const headline = 'really do.';

  useEffect(() => {
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedHeadline(headline.slice(0, index));
      if (index === headline.length) window.clearInterval(timer);
    }, 90);
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Candidate identity/session lives in a JWT (localStorage) + the Express API's /auth/me.
  const { profile: candidateProfile, loading: authLoading, refreshProfile } = useAuthProfile();

  const handleCandidateLogout = () => {
    clearToken();
    setShowAuth(false);
    refreshProfile();
  };

  const handleAdminLogin = async () => {
    setIsLoading(true);
    setLoginError('');
    try {
      const { token } = await apiPost<{ token: string }>('/api/auth/recruiter-login', adminCredentials);
      setToken(token);
      setUserType('recruiter');
      setShowAdminLogin(false);
      setAdminCredentials({ id: '', password: '' });
      
      // Track admin login
      trackUserLogin('recruiter-admin', adminCredentials.id, 'Hirex Administrator', 'recruiter');
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Invalid credentials. Please try again.';
      setLoginError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRecruiterAccess = () => {
    setShowAdminLogin(true);
  };

  const handleAdminLogout = () => {
    setUserType(null);
    clearToken();
  };

  // Candidate access is authenticated with the account credentials. Facial verification
  // is intentionally not required; camera-based exam proctoring starts inside the exam.
  if (userType === 'recruiter') {
    return <RecruiterPortal onBack={handleAdminLogout} />;
  }

  if (getToken()) {
    if (authLoading) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center">
          <p className="text-white">Loading your profile...</p>
        </div>
      );
    }
    if (candidateProfile) {
      return <CandidateFlow onBack={handleCandidateLogout} />;
    }
    // Token existed but /auth/me rejected it (expired/invalid) — useAuthProfile already
    // cleared it, so fall through to the marketing/auth screens below.
  }

  if (showAuth) {
    return <AuthGate onBack={() => setShowAuth(false)} onAuthenticated={refreshProfile} />;
  }

  if (showAdminLogin) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-black to-gray-800">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-gray-400/20 via-transparent to-transparent"></div>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-gray-500/20 via-transparent to-transparent"></div>
        </div>
        
        {/* Floating Elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-gradient-to-r from-gray-400/20 to-gray-500/20 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute bottom-32 right-16 w-32 h-32 bg-gradient-to-r from-gray-600/20 to-gray-400/20 rounded-full blur-xl animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-16 h-16 bg-gradient-to-r from-gray-500/20 to-gray-600/20 rounded-full blur-xl animate-pulse delay-500"></div>
        
        <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
          <div className="w-full max-w-md">
            {/* Glassmorphism Card */}
            <div className="relative group">
              <div className="absolute -inset-1 bg-gradient-to-r from-gray-600 to-black rounded-2xl blur opacity-25 group-hover:opacity-75 transition duration-1000 group-hover:duration-200"></div>
              <Card className="relative backdrop-blur-xl bg-white/10 dark:bg-black/20 border border-white/20 dark:border-white/10 rounded-2xl shadow-2xl">
                <CardHeader className="text-center pb-6">
                  <div className="relative mx-auto mb-6">
                    <div className="w-20 h-20 bg-gradient-to-r from-gray-700 to-black rounded-2xl flex items-center justify-center shadow-2xl shadow-gray-500/25">
                      <Shield className="w-10 h-10 text-white" />
                    </div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full flex items-center justify-center">
                      <Lock className="w-3 h-3 text-white" />
                    </div>
                  </div>
                  <CardTitle className="text-3xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                    Admin Portal
                  </CardTitle>
                  <CardDescription className="text-gray-300/80 text-lg">
                    Secure access to recruiter dashboard
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6 px-8 pb-8">
                  <div className="space-y-4">
                    <div className="relative">
                      <label htmlFor="admin-id" className="block text-sm font-medium text-gray-300 mb-2">
                        Admin ID
                      </label>
                      <input
                        id="admin-id"
                        type="text"
                        value={adminCredentials.id}
                        onChange={(e) => setAdminCredentials(prev => ({ ...prev, id: e.target.value }))}
                        placeholder="Enter admin ID"
                        className="w-full p-4 backdrop-blur-sm bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all duration-300"
                      />
                    </div>
                    <div className="relative">
                      <label htmlFor="admin-password" className="block text-sm font-medium text-gray-300 mb-2">
                        Password
                      </label>
                      <input
                        id="admin-password"
                        type="password"
                        value={adminCredentials.password}
                        onChange={(e) => setAdminCredentials(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="Enter password"
                        className="w-full p-4 backdrop-blur-sm bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:border-transparent transition-all duration-300"
                      />
                    </div>
                  </div>
                  
                  {loginError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 backdrop-blur-sm">
                      <span className="text-red-300 text-sm">{loginError}</span>
                    </div>
                  )}
                  
                  <div className="flex space-x-3 pt-2">
                    <Button 
                      variant="outline" 
                      onClick={() => setShowAdminLogin(false)}
                      disabled={isLoading}
                      className="flex-1 bg-white/5 border-white/20 text-white hover:bg-white/10 backdrop-blur-sm rounded-xl h-12"
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleAdminLogin}
                      disabled={isLoading}
                      className="flex-1 bg-gradient-to-r from-gray-700 to-black hover:from-gray-800 hover:to-gray-900 text-white border-0 rounded-xl h-12 shadow-xl shadow-gray-500/25"
                    >
                      <Lock className="w-4 h-4 mr-2" />
                      {isLoading ? 'Authenticating...' : 'Access'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    );
  }



  return (
    <div className="hirex-home min-h-screen overflow-hidden bg-black text-white selection:bg-white selection:text-black">
      <header className="floating-nav relative z-20 mx-3 mt-3 rounded-full border border-white/20 bg-black/45 backdrop-blur-2xl sm:mx-6 lg:mx-auto lg:max-w-7xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <a href="#" className="flex items-center gap-3" aria-label="Hirex home">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/70 bg-white shadow-lg shadow-white/10">
              <img src="/hirex-placeholder-logo.png" alt="Hirex placeholder logo" className="h-7 w-7 rounded-lg object-cover" />
            </span>
            <span className="text-xl font-bold tracking-tight">hire<span className="text-white">x</span></span>
          </a>
          <nav className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            <a href="#platform" className="transition-colors hover:text-white">Platform</a>
            <a href="#how-it-works" className="transition-colors hover:text-white">How it works</a>
            <a href="#trust" className="transition-colors hover:text-white">Why Hirex</a>
          </nav>
          <div className="hidden items-center gap-3 md:flex">
            <ThemeToggle />
            <Button variant="ghost" className="text-slate-300 hover:bg-white/10 hover:text-white" onClick={() => setShowAuth(true)}>Candidate sign in</Button>
            <Button className="hirex-button hirex-button-small rounded-full bg-white text-black font-semibold hover:bg-slate-200" onClick={handleRecruiterAccess}>For recruiters <ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
          <button className="md:hidden" aria-label="Toggle menu" onClick={() => setMobileMenuOpen((open) => !open)}>
            {mobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
        {mobileMenuOpen && (
          <div className="border-t border-white/10 px-5 py-4 md:hidden">
            <div className="flex flex-col gap-3 text-sm text-slate-300">
              <a href="#platform" onClick={() => setMobileMenuOpen(false)}>Platform</a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)}>How it works</a>
              <Button className="hirex-button hirex-button-wide mt-2 rounded-full bg-white text-black hover:bg-slate-200" onClick={() => setShowAuth(true)}>Candidate sign in</Button>
            </div>
          </div>
        )}
      </header>

      <main>
        <section className="relative isolate">
          <div className="pointer-events-none absolute -left-40 top-0 -z-10 h-[520px] w-[520px] rounded-full bg-white/10 blur-3xl" style={{ transform: `translateY(${scrollY * 0.18}px)` }} />
          <div className="pointer-events-none absolute right-[-12%] top-12 -z-10 h-[500px] w-[500px] rounded-full bg-white/10 blur-3xl" style={{ transform: `translateY(${-scrollY * 0.12}px)` }} />
          <div className="mx-auto grid max-w-7xl gap-14 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:items-center lg:pb-28 lg:pt-24">
            <div>
              <Badge className="mb-7 border-white/25 bg-white/10 px-3 py-1 text-white"><Sparkles className="mr-2 h-3.5 w-3.5" /> The intelligent talent signal</Badge>
              <h1 className="max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-7xl">
                Hire people for what they can <span className="border-b-2 border-white text-white"><span aria-live="polite">{typedHeadline}</span><span className="ml-1 inline-block h-[.85em] w-0.5 animate-pulse bg-white align-[-.08em]" aria-hidden="true" /></span>
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-slate-300 sm:text-xl" style={{ transform: `translateY(${scrollY * -0.035}px)` }}>
                Hirex brings assessments, AI interviews, and evidence-based reports into one beautiful workspace—so great talent never gets lost in a resume pile.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" className="hirex-button hirex-button-hero h-14 rounded-2xl bg-white px-8 text-base font-semibold text-black hover:bg-slate-200" onClick={() => setShowAuth(true)}>Take an assessment <ArrowRight className="ml-2 h-4 w-4" /></Button>
                <Button size="lg" variant="outline" className="hirex-button hirex-button-hero h-14 rounded-2xl border-white/25 bg-white/10 px-8 text-base text-white hover:bg-white/20" onClick={handleRecruiterAccess}>Explore for teams</Button>
              </div>
              <div className="mt-9 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-400">
                {['Structured evaluation', 'Camera + screen proctoring', 'Detailed candidate reports'].map((item) => <span key={item} className="flex items-center gap-2"><CheckCircle className="h-4 w-4 text-white" />{item}</span>)}
              </div>
            </div>

            <div className="relative min-h-[520px] overflow-hidden rounded-[2rem] border border-white/25 bg-black/20 shadow-2xl shadow-black/50 lg:min-h-[calc(100vh-160px)]" id="platform" style={{ transform: `translateY(${scrollY * -0.04}px)` }}>
              <div className="hirex-mountain-layer absolute inset-0 bg-contain bg-center bg-no-repeat sm:bg-cover" style={{ backgroundImage: "url('/hirex-mountain.jpg')", transform: `translateY(${scrollY * -0.04}px) scale(1.01)` }} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-white/10" />
              <div className="relative min-h-[520px] lg:min-h-[calc(100vh-160px)]">
                <div className="absolute bottom-3 left-5 right-5 rounded-2xl border border-white/30 bg-black/35 p-5 shadow-2xl backdrop-blur-xl sm:bottom-5 sm:left-8 sm:right-8">
                  <div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white"><img src="/hirex-placeholder-logo.png" alt="" className="h-full w-full object-cover" /></span><div><p className="font-semibold">One intelligence layer</p><p className="text-sm text-white/70">Every assessment signal, beautifully connected.</p></div></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="trust" className="border-y border-white/10 bg-white/[.025]">
          <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 sm:grid-cols-3 sm:px-8">
            {[['6', 'assessment paths'], ['360°', 'candidate view'], ['1', 'calm hiring workspace']].map(([value, label]) => <div key={label} className="flex items-center gap-4 border-white/10 sm:border-r sm:last:border-0 sm:justify-center"><span className="text-3xl font-semibold text-white">{value}</span><span className="max-w-24 text-sm text-slate-400">{label}</span></div>)}
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-28">
          <div className="max-w-2xl"><p className="text-sm font-semibold uppercase tracking-[.2em] text-white">Built for better decisions</p><h2 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">From first screen to confident yes.</h2><p className="mt-5 text-lg leading-8 text-slate-400">Replace scattered tools and gut feeling with an assessment experience candidates enjoy and hiring teams can trust.</p></div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              { number: '01', title: 'Assess every angle', text: 'Aptitude, English communication, AI literacy, technical knowledge, coding, and interviews in one flow.', icon: Code },
              { number: '02', title: 'Capture real signals', text: 'Camera and screen-share proctoring, voice responses, structured answers, and consistent scoring.', icon: Video },
              { number: '03', title: 'Act with clarity', text: 'Topic-level reports turn every answer into an actionable candidate story for your team.', icon: BarChart3 },
            ].map(({ number, title, text, icon: Icon }) => <div key={number} className="group rounded-2xl border border-white/10 bg-white/[.04] p-6 transition hover:-translate-y-1 hover:border-white/50 hover:bg-white/[.08]"><div className="flex items-center justify-between"><span className="text-sm text-white">{number}</span><Icon className="h-5 w-5 text-slate-500 transition group-hover:text-white" /></div><h3 className="mt-12 text-xl font-semibold">{title}</h3><p className="mt-3 leading-7 text-slate-400">{text}</p></div>)}
          </div>
        </section>
        <section className="mx-5 mb-20 rounded-3xl border border-white/20 bg-white/[.06] px-6 py-12 text-center shadow-2xl shadow-white/5 backdrop-blur-xl sm:mx-8 sm:px-12"><h2 className="text-3xl font-semibold sm:text-4xl">Make your next hire your best one.</h2><p className="mx-auto mt-4 max-w-xl text-slate-300">Start with a fair, focused assessment experience built for the way teams hire today.</p><Button size="lg" className="hirex-button hirex-button-hero mt-7 h-14 rounded-2xl bg-white px-9 font-semibold text-black hover:bg-slate-200" onClick={() => setShowAuth(true)}>Get started with Hirex <ArrowRight className="ml-2 h-4 w-4" /></Button></section>
      </main>
      <Footer brandName="Hirex" brandDescription="AI-powered assessments and interviews that help modern teams discover talent with clarity." socialLinks={[{ icon: <Twitter className="h-5 w-5" />, href: "https://twitter.com", label: "Twitter" }, { icon: <Linkedin className="h-5 w-5" />, href: "https://linkedin.com", label: "LinkedIn" }, { icon: <Github className="h-5 w-5" />, href: "https://github.com", label: "GitHub" }, { icon: <Mail className="h-5 w-5" />, href: "mailto:hello@hirex.ai", label: "Email" }]} navLinks={[{ label: "Platform", href: "#platform" }, { label: "How it works", href: "#how-it-works" }, { label: "Why Hirex", href: "#trust" }]} creatorName="Hirex Team" creatorUrl="https://hirex.ai" brandIcon={<span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl border border-white/70 bg-white"><img src="/hirex-placeholder-logo.png" alt="Hirex placeholder logo" className="h-full w-full object-cover" /></span>} />
    </div>
  );
};

export default Index;