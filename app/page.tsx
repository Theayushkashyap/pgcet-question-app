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
  const [feedbackClass, setFeedbackClass] = useState<string>('');

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
      if (isCorrect) {
        setScore((s) => s + 1);
        setFeedbackClass('blink-green');
      } else {
        setFeedbackClass('blink-red');
      }
      await supabaseClient.from('user_answers').insert({
        question_id: current.id,
        selected_option: selectedOption,
        is_correct: isCorrect,
      });
    } else {
      setSubmitted(false);
      setSelectedOption('');
      setFeedbackClass('');
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
      <main className="p-8 text-center min-h-screen flex flex-col justify-center items-center glass">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-6xl font-bold mb-8 animate-welcome gradient-text">Welcome Deekshitha Jha!</h1>
          <p className="mb-12 text-2xl text-foreground/80 animate-welcome" style={{ animationDelay: '0.3s' }}>Ready to answer some PGCET questions?</p>
          <button
            onClick={handleStart}
            className="px-10 py-5 bg-gradient-to-r from-primary to-primary-hover text-white rounded-xl hover:bg-primary-hover animate-welcome text-xl font-medium hover-lift"
            style={{ animationDelay: '0.6s' }}
          >
            Start Quiz
          </button>
        </div>
      </main>
    );
  }

  if (loading) return (
    <div className="p-6 text-center min-h-screen flex items-center justify-center">
      <div className="p-8 rounded-2xl glass">
        <p className="text-2xl loading">Loading…</p>
      </div>
    </div>
  );
  
  if (error)
    return (
      <main className="p-8 text-center min-h-screen flex flex-col items-center justify-center glass">
        <div className="max-w-md mx-auto">
          <p className="text-2xl text-error mb-8">Error: {error}</p>
          <button
            onClick={handleRestart}
            className="px-8 py-4 bg-secondary text-foreground rounded-xl hover:bg-secondary/80 hover-lift"
          >
            Retry
          </button>
        </div>
      </main>
    );

  return (
    <main className="p-8 max-w-3xl mx-auto my-8 rounded-2xl glass">
      <h1 className="text-5xl font-bold mb-10 gradient-text">PGCET MCQ Quiz</h1>
      <div className="flex space-x-6 mb-10">
        <button
          onClick={() => setActiveTab('quiz')}
          className={`px-8 py-4 rounded-xl transition-all hover-lift ${
            activeTab === 'quiz'
              ? 'bg-gradient-to-r from-primary to-primary-hover text-white shadow-lg'
              : 'bg-secondary text-foreground hover:bg-secondary/80'
          }`}
        >
          Quiz
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-8 py-4 rounded-xl transition-all hover-lift ${
            activeTab === 'stats'
              ? 'bg-gradient-to-r from-primary to-primary-hover text-white shadow-lg'
              : 'bg-secondary text-foreground hover:bg-secondary/80'
          }`}
        >
          Your Stats
        </button>
      </div>

      {activeTab === 'quiz' ? (
        finished ? (
          <div className="text-center p-10 rounded-2xl bg-secondary/20 glass">
            <p className="text-4xl font-bold mb-6 gradient-text">Quiz Complete!</p>
            <p className="text-3xl mb-10">Score: {score} / {questions.length}</p>
            <button
              onClick={handleRestart}
              className="px-10 py-5 bg-gradient-to-r from-accent to-accent-hover text-white rounded-xl hover:bg-accent-hover text-xl font-medium hover-lift"
            >
              Restart Quiz
            </button>
          </div>
        ) : (
          <div className={`question-transition p-8 rounded-2xl bg-secondary/10 glass ${feedbackClass}`}>
            <p className="mb-4 text-sm font-medium text-foreground/60">
              Question {currentIndex + 1} of {questions.length}
            </p>
            <p className="text-2xl font-medium mb-8">{questions[currentIndex].question}</p>
            <div className="space-y-4 mb-10">
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
                    className={`flex items-center space-x-4 p-5 rounded-xl cursor-pointer transition-all hover-lift ${
                      isCorrect
                        ? 'bg-success/20 text-success'
                        : isWrong
                        ? 'bg-error/20 text-error'
                        : 'bg-secondary/50 hover:bg-secondary/70'
                    }`}
                  >
                    <input
                      type="radio"
                      value={opt}
                      checked={selectedOption === opt}
                      disabled={submitted}
                      onChange={() => setSelectedOption(opt)}
                      className="w-6 h-6"
                    />
                    <span className="text-xl">{opt}</span>
                  </label>
                );
              })}
            </div>
            {submitted && selectedOption !== questions[currentIndex].answer && (
              <p className="text-success mb-8 p-5 rounded-xl bg-success/20 glass">
                Correct answer: {questions[currentIndex].answer}
              </p>
            )}
            <button
              onClick={handleSubmitOrNext}
              disabled={!selectedOption && !submitted}
              className="w-full px-8 py-5 bg-gradient-to-r from-primary to-primary-hover text-white rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-xl font-medium hover-lift"
            >
              {!submitted ? 'Submit' : currentIndex + 1 === questions.length ? 'Finish' : 'Next'}
            </button>
          </div>
        )
      ) : (
        <div className="p-8 rounded-2xl bg-secondary/10 glass">
          {stats.length === 0 ? (
            <p className="text-center text-foreground/60 text-xl">No wrong answers recorded.</p>
          ) : (
            <table className="w-full">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Wrong Answers</th>
                </tr>
              </thead>
              <tbody>
                {stats.map(({ date, wrongCount }) => (
                  <tr key={date} className="hover:bg-secondary/30 transition-colors">
                    <td className="text-lg">{date}</td>
                    <td className="text-lg">{wrongCount}</td>
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
