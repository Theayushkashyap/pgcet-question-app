'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '../lib/supabaseClient';

interface Question {
  id: string;
  question_text: string;
  options: string[];
}

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabaseClient
      .from('questions')
      .select('id,question_text,options')
      .order('fetched_at', { ascending: false })
      .limit(20)
      .then(({ data, error }) => {
        if (error) {
          console.error('Supabase error:', error);
        } else {
          setQuestions(data || []);
        }
        setLoading(false);
      });
  }, []);

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">Latest PGCET Questions</h1>
      {loading ? <p>Loading…</p> : (
        <ul className="space-y-6">
          {questions.map(q => (
            <li key={q.id} className="border p-4 rounded shadow-sm">
              <p className="font-medium">{q.question_text}</p>
              <ul className="list-disc list-inside mt-2">
                {q.options.map((o,i) => <li key={i}>{o}</li>)}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
