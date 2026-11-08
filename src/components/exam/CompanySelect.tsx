import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquareText, Calculator, BrainCircuit, Code2, Mic2, ArrowRight, ShieldCheck } from 'lucide-react';
import { apiPost } from '@/lib/api';

interface CompanySelectProps {
  onSessionReady: (sessionId: string) => void;
  onBack: () => void;
  onReports: () => void;
}

type Section = 'english' | 'aptitude' | 'ai_technical' | 'coding1' | 'coding2' | 'technical_interview';

/** Starts either shared assessment section without exposing company-specific exams. */
const CompanySelect = ({ onSessionReady, onBack, onReports }: CompanySelectProps) => {
  const [starting, setStarting] = useState<Section | null>(null);
  const [error, setError] = useState('');

  const startRound = async (section: Section) => {
    setStarting(section);
    setError('');
    try {
      const { sessionId } = await apiPost<{ sessionId: string }>('/api/exam/sessions', { section });
      onSessionReady(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start the Communication Round.');
      setStarting(null);
    }
  };

  return (
    <div className="hirex-app-shell min-h-screen p-4">
      <div className="max-w-4xl mx-auto py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Assessment Sections</h1>
        <p className="text-slate-400 mb-8">Choose a section to begin. Each section has its own questions and timer.</p>

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 mb-6">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="hirex-card bg-slate-900 border-slate-700">
            <CardHeader className="flex flex-row items-center gap-3">
              <MessageSquareText className="w-8 h-8 text-blue-400" />
              <div>
                <CardTitle className="text-white">English Communication</CardTitle>
                <CardDescription className="text-slate-400">Listening, reading, speaking, grammar and sentence formation</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-300"><ShieldCheck className="w-4 h-4 text-green-400" /> Only camera and screen sharing are required for proctoring.</div>
              <Button onClick={() => startRound('english')} disabled={starting !== null} className="hirex-action w-full bg-blue-600 hover:bg-blue-700 text-white">
                {starting === 'english' ? 'Starting...' : 'Start English Communication'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
          <Card className="hirex-card bg-slate-900 border-slate-700">
            <CardHeader className="flex flex-row items-center gap-3">
              <Mic2 className="w-8 h-8 text-emerald-400" />
              <div><CardTitle className="text-white">Technical Interview</CardTitle><CardDescription className="text-slate-400">Voice-assisted, CV-based technical interview with recorded answers</CardDescription></div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-300"><ShieldCheck className="w-4 h-4 text-green-400" /> Upload a readable CV, listen to questions and answer by voice.</div>
              <Button onClick={() => startRound('technical_interview')} disabled={starting !== null} className="hirex-action w-full bg-emerald-600 hover:bg-emerald-700 text-white">{starting === 'technical_interview' ? 'Starting...' : 'Start Technical Interview'}<ArrowRight className="w-4 h-4 ml-2" /></Button>
            </CardContent>
          </Card>
          <Card className="hirex-card bg-slate-900 border-slate-700">
            <CardHeader className="flex flex-row items-center gap-3">
              <Code2 className="w-8 h-8 text-fuchsia-400" />
              <div>
                <CardTitle className="text-white">Coding 2</CardTitle>
                <CardDescription className="text-slate-400">AI-assisted DSA and debugging challenge with a 2,000-token assistance budget</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-300"><ShieldCheck className="w-4 h-4 text-green-400" /> DSA case study plus one debugging task in Python, C, C++ or Java.</div>
              <Button onClick={() => startRound('coding2')} disabled={starting !== null} className="hirex-action w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white">
                {starting === 'coding2' ? 'Starting...' : 'Start Coding 2'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
          <Card className="hirex-card bg-slate-900 border-slate-700">
            <CardHeader className="flex flex-row items-center gap-3">
              <Code2 className="w-8 h-8 text-cyan-400" />
              <div>
                <CardTitle className="text-white">Coding 1</CardTitle>
                <CardDescription className="text-slate-400">2 real-time DSA problems with constraints, sample tests and hidden evaluation cases</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-300"><ShieldCheck className="w-4 h-4 text-green-400" /> Choose C, C++, Java or Python for each solution.</div>
              <Button onClick={() => startRound('coding1')} disabled={starting !== null} className="hirex-action w-full bg-cyan-600 hover:bg-cyan-700 text-white">
                {starting === 'coding1' ? 'Starting...' : 'Start Coding 1'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
          <Card className="hirex-card bg-slate-900 border-slate-700">
            <CardHeader className="flex flex-row items-center gap-3">
              <BrainCircuit className="w-8 h-8 text-purple-400" />
              <div>
                <CardTitle className="text-white">AI Literacy and Technical Knowledge</CardTitle>
                <CardDescription className="text-slate-400">40 difficult MCQs: GenAI, Agentic AI, RAG, LLMs, DBMS, OOP, networking and web development</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-300"><ShieldCheck className="w-4 h-4 text-green-400" /> 20 AI Literacy and 20 Technical Knowledge questions.</div>
              <Button onClick={() => startRound('ai_technical')} disabled={starting !== null} className="hirex-action w-full bg-purple-600 hover:bg-purple-700 text-white">
                {starting === 'ai_technical' ? 'Starting...' : 'Start AI and Technical Section'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
          <Card className="hirex-card bg-slate-900 border-slate-700">
            <CardHeader className="flex flex-row items-center gap-3">
              <Calculator className="w-8 h-8 text-amber-400" />
              <div>
                <CardTitle className="text-white">Hard Aptitude</CardTitle>
                <CardDescription className="text-slate-400">30 advanced aptitude MCQs covering quantitative reasoning and problem solving</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-slate-300"><ShieldCheck className="w-4 h-4 text-green-400" /> Camera and screen sharing are required for proctoring.</div>
              <Button onClick={() => startRound('aptitude')} disabled={starting !== null} className="hirex-action w-full bg-amber-600 hover:bg-amber-700 text-white">
                {starting === 'aptitude' ? 'Starting...' : 'Start Hard Aptitude'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
          </div>

        <div className="flex flex-wrap gap-3 mt-8">
          <Button onClick={onReports} variant="outline" className="bg-transparent border-blue-500/60 text-blue-200 hover:bg-blue-950/40">
            View my exam reports
          </Button>
          <Button onClick={onBack} variant="outline" className="bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800">
            Log out
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CompanySelect;
