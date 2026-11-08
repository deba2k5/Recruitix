import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/api';
import { BarChart3, FileText, LogOut } from 'lucide-react';

interface ReportSummary {
  sessionId: string;
  section: string | null;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  score: number | null;
  percentage: number | null;
}

const SECTION_TITLES: Record<string, string> = {
  english: 'English Communication',
  aptitude: 'Hard Aptitude',
  ai_technical: 'AI Literacy and Technical Knowledge',
  coding1: 'Coding 1',
  coding2: 'Coding 2',
  technical_interview: 'Voice-Assisted Technical Interview',
  technical: 'Technical',
  personal: 'Personal',
  hr: 'HR',
};

interface ExamReportsPageProps {
  onSelectReport: (sessionId: string) => void;
  onBack: () => void;
  onLogout: () => void;
}

const ExamReportsPage = ({ onSelectReport, onBack, onLogout }: ExamReportsPageProps) => {
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiGet<{ reports: ReportSummary[] }>('/api/exam/reports')
      .then(({ reports: result }) => setReports(result))
      .catch((err) => setError(err instanceof Error ? err.message : 'Unable to load exam reports.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-4xl mx-auto py-12 space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-white">My exam reports</h1>
            <p className="text-slate-400 mt-2">Each report belongs to one completed assessment section.</p>
          </div>
          <Button onClick={onLogout} variant="outline" className="border-slate-600 text-slate-300 bg-transparent"><LogOut className="w-4 h-4 mr-2" />Log out</Button>
        </div>

        {error && <Card className="bg-slate-900 border-red-500/50"><CardContent className="p-5 text-red-300">{error}</CardContent></Card>}
        {loading && <Card className="bg-slate-900 border-slate-700"><CardContent className="p-5 text-white">Loading reports...</CardContent></Card>}
        {!loading && !error && reports.length === 0 && (
          <Card className="bg-slate-900 border-slate-700"><CardContent className="p-8 text-center text-slate-300">No completed exam reports yet. Complete an assessment to see it here.</CardContent></Card>
        )}
        <div className="grid gap-4">
          {reports.map((report) => (
            <Card key={report.sessionId} className="bg-slate-900 border-slate-700">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <BarChart3 className="w-7 h-7 text-blue-400 mt-1" />
                  <div>
                    <CardTitle className="text-white">{SECTION_TITLES[report.section ?? ''] ?? 'Assessment'}</CardTitle>
                    <CardDescription className="text-slate-400">
                      {report.endedAt ? `Completed ${new Date(report.endedAt).toLocaleString()}` : 'Completed exam'}
                    </CardDescription>
                  </div>
                </div>
                <Badge className={report.status === 'auto_submitted' ? 'bg-amber-900 text-amber-200' : 'bg-green-900 text-green-200'}>
                  {report.status === 'auto_submitted' ? 'Auto-submitted' : 'Submitted'}
                </Badge>
              </CardHeader>
              <CardContent className="flex items-center justify-between gap-4">
                <div className="text-sm text-slate-300">
                  {report.percentage === null ? 'Score pending' : <><strong className="text-white">{report.percentage}%</strong>{report.score !== null ? ` · Score ${report.score}` : ''}</>}
                </div>
                <Button onClick={() => onSelectReport(report.sessionId)} className="bg-blue-600 hover:bg-blue-700 text-white"><FileText className="w-4 h-4 mr-2" />View report</Button>
              </CardContent>
            </Card>
          ))}
        </div>
        <Button onClick={onBack} variant="outline" className="border-slate-600 text-slate-300 bg-transparent">Back to assessment sections</Button>
      </div>
    </div>
  );
};

export default ExamReportsPage;
