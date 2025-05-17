'use client';

import { useEffect, useState } from 'react';
import { supabaseClient } from '@/lib/supabaseClient';

interface Question {
  id: number;
  question: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  answer: string;
}

interface StatRow {
  date: string;
  wrongCount: number;
}

export default function QuizPage() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [finished, setFinished] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [activeTab, setActiveTab] = useState<'quiz' | 'stats'>('quiz');
  const [stats, setStats] = useState<StatRow[]>([]);

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('mcq_questions')
        .select(
          'id, question, option_a, option_b, option_c, option_d, answer'
        );

      if (error) {
        setError(error.message);
        setQuestions([]);
      } else {
        setQuestions(data ?? []);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('user_answers')
        .select('created_at')
        .eq('is_correct', false)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const grouped: Record<string, number> = {};
        data.forEach(({ created_at }) => {
          const date = new Date(created_at).toISOString().split('T')[0];
          grouped[date] = (grouped[date] || 0) + 1;
        });
        const rows = Object.entries(grouped)
          .map(([date, wrongCount]) => ({ date, wrongCount }))
          .sort((a, b) => a.date.localeCompare(b.date));
        setStats(rows);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  useEffect(() => {
    if (activeTab === 'stats') {
      fetchStats();
    }
  }, [activeTab]);

  const handleStart = () => {
    setShowWelcome(false);
  };

  const handleSubmitOrNext = async () => {
    const current = questions[currentIndex];
    if (!submitted) {
      setSubmitted(true);
      const isCorrect = selectedOption === current.answer;
      if (isCorrect) setScore((s) => s + 1);
      await supabaseClient.from('user_answers').insert({
        question_id: current.id,
        selected_option: selectedOption,
        is_correct: isCorrect,
      });
    } else {
      setSubmitted(false);
      setSelectedOption('');
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex((i) => i + 1);
      } else {
        setFinished(true);
      }
    }
  };

  const handleRestart = () => {
    setCurrentIndex(0);
    setSelectedOption('');
    setSubmitted(false);
    setScore(0);
    setFinished(false);
    setError(null);
    setLoading(true);
    setShowWelcome(true);
    setActiveTab('quiz');
    fetchQuestions();
  };

  if (showWelcome) {
    return (
      <main className="p-6 text-center min-h-screen flex flex-col justify-center items-center">
        <h1 className="text-4xl font-bold mb-4">Welcome Deekshitha Jha!</h1>
        <p className="mb-6 text-lg">Ready to answer some PGCET questions?</p>
        <button
          onClick={handleStart}
          className="px-6 py-3 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Start Quiz
        </button>
      </main>
    );
  }

  if (loading) return <p className="p-6 text-center">Loading…</p>;
  if (error)
    return (
      <main className="p-6 text-center">
        <p className="text-red-600">Error: {error}</p>
        <button
          onClick={handleRestart}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded"
        >
          Retry
        </button>
      </main>
    );

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">PGCET MCQ Quiz</h1>
      <div className="flex space-x-4 mb-6">
        <button
          onClick={() => setActiveTab('quiz')}
          className={
            activeTab === 'quiz'
              ? 'px-4 py-2 bg-indigo-600 text-white rounded'
              : 'px-4 py-2 bg-gray-200 rounded'
          }
        >
          Quiz
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={
            activeTab === 'stats'
              ? 'px-4 py-2 bg-indigo-600 text-white rounded'
              : 'px-4 py-2 bg-gray-200 rounded'
          }
        >
          Your Stats
        </button>
      </div>

      {activeTab === 'quiz' ? (
        finished ? (
          <div className="text-center">
            <p className="text-2xl mb-4">Quiz Complete!</p>
            <p className="text-xl">Score: {score} / {questions.length}</p>
            <button
              onClick={handleRestart}
              className="mt-6 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Restart Quiz
            </button>
          </div>
        ) : (
          <div>
            <p className="mb-2">
              Question {currentIndex + 1} of {questions.length}
            </p>
            <p className="font-medium mb-4">{questions[currentIndex].question}</p>
            <div className="space-y-3 mb-6">
              {[
                questions[currentIndex].option_a,
                questions[currentIndex].option_b,
                questions[currentIndex].option_c,
                questions[currentIndex].option_d,
              ].map((opt, idx) => {
                const isCorrect = submitted && opt === questions[currentIndex].answer;
                const isWrong = submitted && opt === selectedOption && selectedOption !== questions[currentIndex].answer;
                return (
                  <label
                    key={idx}
                    className={
                      `flex items-center space-x-2 p-2 rounded cursor-pointer \${
                        isCorrect
                          ? 'bg-green-100'
                          : isWrong
                          ? 'bg-red-100'
                          : ''
                      }`
                    }
                  >
                    <input
                      type="radio"
                      value={opt}
                      checked={selectedOption === opt}
                      disabled={submitted}
                      onChange={() => setSelectedOption(opt)}
                    />
                    <span className={
                      isCorrect
                        ? 'text-green-600 font-semibold'
                        : isWrong
                        ? 'text-red-600 font-semibold'
                        : ''
                    }>{opt}</span>
                  </label>
                );
              })}
            </div>
            {submitted && selectedOption !== questions[currentIndex].answer && (
              <p className="text-green-600 mb-4">
                Correct answer: {questions[currentIndex].answer}
              </p>
            )}
            <button
              onClick={handleSubmitOrNext}
              disabled={!selectedOption && !submitted}
              className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
            >
              {!submitted ? 'Submit' : currentIndex + 1 === questions.length ? 'Finish' : 'Next'}
            </button>
          </div>
        )
      ) : (
        // Stats tab
        <div>
          {stats.length === 0 ? (
            <p className="text-gray-700">No wrong answers recorded.</p>
          ) : (
            <table className="w-full text-left border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Wrong Answers</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(({ date, wrongCount }) => (
                  <tr key={date} className="border-t">
                    <td className="px-4 py-2">{date}</td>
                    <td className="px-4 py-2">{wrongCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </main>
  );
}
