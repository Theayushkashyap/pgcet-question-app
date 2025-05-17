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
  year: number;
  explanation: string;
}

interface StatRow {
  date: string;
  wrongCount: number;
  year: number;
  wrongAnswers: {
    question: string;
    selectedOption: string;
    correctAnswer: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    year: number;
    explanation: string;
  }[];
}

interface UserAnswer {
  created_at: string;
  selected_option: string;
  is_correct: boolean;
  mcq_questions: {
    question: string;
    answer: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
    year: number;
    explanation: string;
  };
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
  const [feedbackState, setFeedbackState] = useState<'correct' | 'incorrect' | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  // Fetch list of years with questions
  const fetchAvailableYears = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('mcq_questions')
        .select('year')
        .order('year', { ascending: false });

      if (!error && data) {
        const years = [...new Set(data.map(q => q.year))];
        setAvailableYears(years);
      }
    } catch (err) {
      console.error('Error fetching years:', err);
    }
  };

  // Fetch questions for a given year
  const fetchQuestions = async (year: number) => {
    try {
      const { data, error } = await supabaseClient
        .from('mcq_questions')
        .select(
          'id, question, option_a, option_b, option_c, option_d, answer, year, explanation'
        )
        .eq('year', year);

      if (error) {
        setError(error.message);
        setQuestions([]);
      } else {
        const randomizedQuestions = [...(data ?? [])].sort(() => Math.random() - 0.5);
        setQuestions(randomizedQuestions);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Fetch stats of wrong answers grouped by date
  const fetchStats = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('user_answers')
        .select(`
          created_at,
          selected_option,
          is_correct,
          mcq_questions (
            question,
            answer,
            option_a,
            option_b,
            option_c,
            option_d,
            year,
            explanation
          )
        `)
        .eq('is_correct', false)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const grouped: Record<string, {
          wrongCount: number;
          year: number;
          wrongAnswers: StatRow['wrongAnswers'];
        }> = {};

        (data as unknown as UserAnswer[]).forEach(({ created_at, selected_option, mcq_questions }) => {
          const date = new Date(created_at).toISOString().split('T')[0];
          if (!grouped[date]) {
            grouped[date] = {
              wrongCount: 0,
              year: mcq_questions.year,
              wrongAnswers: []
            };
          }
          grouped[date].wrongCount += 1;
          grouped[date].wrongAnswers.push({
            question: mcq_questions.question,
            selectedOption: selected_option,
            correctAnswer: mcq_questions.answer,
            optionA: mcq_questions.option_a,
            optionB: mcq_questions.option_b,
            optionC: mcq_questions.option_c,
            optionD: mcq_questions.option_d,
            year: mcq_questions.year,
            explanation: mcq_questions.explanation
          });
        });

        const rows = Object.entries(grouped)
          .map(([date, { wrongCount, wrongAnswers, year }]) => ({ 
            date, 
            wrongCount,
            year,
            wrongAnswers
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
        
        setStats(rows);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  useEffect(() => {
    fetchAvailableYears();
  }, []);

  useEffect(() => {
    if (activeTab === 'stats') {
      fetchStats();
    }
  }, [activeTab]);

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    setLoading(true);
    fetchQuestions(year);
  };

  const handleStart = () => {
    setShowWelcome(false);
  };

  const handleSubmitOrNext = async () => {
    const current = questions[currentIndex];
    if (!submitted) {
      setSubmitted(true);
      
      const correctOption = current.answer.toUpperCase();
      const correctValue = current[`option_${correctOption.toLowerCase()}` as keyof Question];
      
      const isCorrect = selectedOption === correctValue;
      
      if (isCorrect) {
        setScore(s => s + 1);
        setFeedbackClass('blink-green');
        setFeedbackState('correct');
      } else {
        setFeedbackClass('blink-red');
        setFeedbackState('incorrect');
      }

      // Log last answer
      if (currentIndex + 1 === questions.length) {
        await supabaseClient.from('user_answers').insert({
          question_id: current.id,
          selected_option: selectedOption,
          is_correct: isCorrect,
        });
      }
    } else {
      // Next question
      setSubmitted(false);
      setSelectedOption('');
      setFeedbackClass('');
      setFeedbackState(null);
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex(i => i + 1);
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
    fetchQuestions(selectedYear ?? 0);
  };

  // Welcome screen
  if (showWelcome) {
    return (
      <main className="p-8 text-center min-h-screen flex flex-col justify-center items-center glass">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-6xl font-bold mb-8 animate-welcome gradient-text">
            Welcome Deekshitha Jha!
          </h1>
          <p className="mb-12 text-2xl text-foreground/80 animate-welcome" style={{ animationDelay: '0.3s' }}>
            Choose a year to start your PGCET practice
          </p>
          <div className="grid grid-cols-2 gap-4 mb-8">
            {availableYears.map(year => (
              <button
                key={year}
                onClick={() => handleYearSelect(year)}
                className={`px-8 py-4 rounded-xl transition-all hover-lift border-2 ${
                  selectedYear === year
                    ? 'bg-gradient-to-r from-primary to-primary-hover text-white border-primary/50'
                    : 'bg-secondary text-foreground border-secondary/50 hover:bg-secondary/80'
                }`}
              >
                PGCET {year}
              </button>
            ))}
          </div>
          {selectedYear && (
            <button
              onClick={handleStart}
              className="px-10 py-5 bg-gradient-to-r from-primary to-primary-hover text-white rounded-xl hover:bg-primary-hover animate-welcome text-xl font-medium hover-lift border-2 border-primary/30 hover:border-primary/50 transition-all duration-300 shadow-lg hover:shadow-xl"
              style={{ animationDelay: '0.6s' }}
            >
              Start Quiz
            </button>
          )}
        </div>
      </main>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="p-6 text-center min-h-screen flex items-center justify-center">
        <div className="p-8 rounded-2xl glass">
          <p className="text-2xl loading">Loading…</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
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
  }

  // Main Quiz / Stats UI
  return (
    <main className="p-8 max-w-3xl mx-auto my-8 rounded-2xl glass">
      {/* ===== Tabs ===== */}
      <div className="flex mb-6 space-x-4">
        <button
          onClick={() => setActiveTab('quiz')}
          className={`px-4 py-2 rounded ${
            activeTab === 'quiz' ? 'bg-primary text-white' : 'bg-secondary text-foreground'
          }`}
        >
          Quiz
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`px-4 py-2 rounded ${
            activeTab === 'stats' ? 'bg-primary text-white' : 'bg-secondary text-foreground'
          }`}
        >
          Stats
        </button>
      </div>

      {activeTab === 'quiz' ? (
        // ========== QUIZ VIEW ==========
        <>
          {finished ? (
            <div className="text-center">
              <h2 className="text-3xl font-bold mb-4">Quiz Complete!</h2>
              <p className="text-xl mb-6">
                You scored {score} out of {questions.length}
              </p>
              <button
                onClick={handleRestart}
                className="px-6 py-3 bg-gradient-to-r from-primary to-primary-hover text-white rounded-xl hover:from-primary-hover hover:to-primary text-lg"
              >
                Restart
              </button>
            </div>
          ) : (
            // ========== QUESTION CARD ==========
            <div className="space-y-6">
              <div className="text-lg font-medium">
                Q{currentIndex + 1}. {questions[currentIndex].question}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {(['a','b','c','d'] as const).map(letter => {
                  // *** CAST TO STRING HERE ***
                  const opt = questions[currentIndex][`option_${letter}` as keyof Question] as string;
                  const isSelected = selectedOption === opt;
                  const baseClass = `p-4 border rounded-lg cursor-pointer hover:shadow-md transition-all`;
                  let appliedClass = baseClass;
                  if (submitted) {
                    // highlight correct/incorrect after submit
                    if (opt === questions[currentIndex].answer) {
                      appliedClass += ' border-green-500 bg-green-100';
                    } else if (isSelected && feedbackState === 'incorrect') {
                      appliedClass += ' border-red-500 bg-red-100';
                    } else {
                      appliedClass += ' border-gray-300';
                    }
                  } else if (isSelected) {
                    appliedClass += ' border-primary bg-primary/10';
                  }
                  return (
                    <div
                      key={letter}
                      className={appliedClass}
                      onClick={() => !submitted && setSelectedOption(opt)}
                    >
                      <strong>{letter.toUpperCase()}.</strong> {opt}
                    </div>
                  );
                })}
              </div>
              <div className="text-right">
                <button
                  onClick={handleSubmitOrNext}
                  disabled={!submitted && !selectedOption}
                  className="px-6 py-3 bg-gradient-to-r from-primary to-primary-hover text-white rounded-xl hover:from-primary-hover hover:to-primary transition-all"
                >
                  {submitted
                    ? currentIndex + 1 === questions.length
                      ? 'Finish'
                      : 'Next'
                    : 'Submit'}
                </button>
              </div>
              {submitted && (
                <div className={`mt-4 text-center font-medium ${feedbackClass}`}>
                  {feedbackState === 'correct' ? '✅ Correct!' : '❌ Incorrect'}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        // ========== STATS VIEW ==========
        <div className="space-y-4">
          {stats.map(row => (
            <div key={row.date} className="border-b pb-4">
              <div
                className="flex justify-between items-center cursor-pointer"
                onClick={() =>
                  setExpandedDate(expandedDate === row.date ? null : row.date)
                }
              >
                <div className="font-medium">
                  {row.date} — {row.wrongCount} wrong
                </div>
                <div>{expandedDate === row.date ? '▾' : '▸'}</div>
              </div>
              {expandedDate === row.date && (
                <ul className="mt-2 pl-4 list-disc space-y-2">
                  {row.wrongAnswers.map((wa, i) => (
                    <li key={i}>
                      <div>
                        <strong>Q:</strong> {wa.question}
                      </div>
                      <div>
                        <strong>Your:</strong> {wa.selectedOption} |{' '}
                        <strong>Correct:</strong> {wa.correctAnswer}
                      </div>
                      <div className="italic text-sm text-foreground/80">
                        {wa.explanation}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
