import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, ArrowRight } from 'lucide-react';
import { supabase } from '@/lib/supabase';

interface Company {
  id: string;
  name: string;
  slug: string;
  pass_threshold_pct: number;
  technical_duration_min: number;
  personal_duration_min: number;
  hr_duration_min: number;
}

interface CompanySelectProps {
  onSessionReady: (sessionId: string) => void;
  onBack: () => void;
}

/** Lists active companies; picking one creates (or resumes) an exam_sessions row and hands off to the face gate. */
const CompanySelect = ({ onSessionReady, onBack }: CompanySelectProps) => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    supabase
      .from('companies')
      .select('id, name, slug, pass_threshold_pct, technical_duration_min, personal_duration_min, hr_duration_min')
      .eq('is_active', true)
      .order('name')
      .then(({ data, error: fetchError }) => {
        if (fetchError) setError(fetchError.message);
        setCompanies((data as Company[]) ?? []);
        setLoading(false);
      });
  }, []);

  const handleSelect = async (company: Company) => {
    setStarting(company.id);
    setError('');
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Not signed in.');

      // Resume an unfinished attempt for this company if one exists, else start a new one.
      const { data: existing } = await supabase
        .from('exam_sessions')
        .select('id')
        .eq('user_id', userId)
        .eq('company_id', company.id)
        .in('status', ['face_gate_pending', 'pending_manual_review', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        onSessionReady(existing.id);
        return;
      }

      const { data: created, error: insertError } = await supabase
        .from('exam_sessions')
        .insert({ user_id: userId, company_id: company.id })
        .select('id')
        .single();
      if (insertError) throw insertError;
      onSessionReady(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start this exam. Please try again.');
      setStarting(null);
    }
  };

  return (
    <div className="min-h-screen bg-black p-4">
      <div className="max-w-4xl mx-auto py-12">
        <h1 className="text-3xl font-bold text-white mb-2">Choose Your Exam</h1>
        <p className="text-slate-400 mb-8">Pick the company exam you want to attempt.</p>

        {error && (
          <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-3 mb-6">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {loading ? (
          <p className="text-slate-400">Loading companies...</p>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {companies.map((company) => (
              <Card key={company.id} className="bg-slate-900 border-slate-700 hover:border-blue-500 transition-colors">
                <CardHeader className="flex flex-row items-center gap-3">
                  <Building2 className="w-8 h-8 text-blue-400" />
                  <div>
                    <CardTitle className="text-white">{company.name}</CardTitle>
                    <CardDescription className="text-slate-400">
                      {company.technical_duration_min + company.personal_duration_min + company.hr_duration_min} min · pass at {company.pass_threshold_pct}%
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent>
                  <Button
                    onClick={() => handleSelect(company)}
                    disabled={starting !== null}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    {starting === company.id ? 'Starting...' : 'Start Exam'}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Button onClick={onBack} variant="outline" className="mt-8 bg-transparent border-slate-600 text-slate-300 hover:bg-slate-800">
          Back
        </Button>
      </div>
    </div>
  );
};

export default CompanySelect;
