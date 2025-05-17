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
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [activeTab, setActiveTab] = useState<'quiz' | 'stats'>('quiz');
  const [stats, setStats] = useState<StatRow[]>([]);
  const [feedbackClass, setFeedbackClass] = useState<string>('');
  const [feedbackState, setFeedbackState] = useState<'correct' | 'incorrect' | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

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

  const fetchQuestions = async (year: number) => {
    try {
      const { data, error } = await supabaseClient
        .from('mcq_questions')
        .select(
          'id, question, option_a, option_b, option_c, option_d, answer, year'
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
            year
          )
        `)
        .eq('is_correct', false)
        .order('created_at', { ascending: true });

      if (!error && data) {
        const grouped: Record<string, {
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
          }[];
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
            year: mcq_questions.year
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

  const handleYearSelect = (year: number) => {
    setSelectedYear(year);
    setLoading(true);
    fetchQuestions(year);
  };

  useEffect(() => {
    if (activeTab === 'stats') {
      fetchStats();
    }
  }, [activeTab]);

  const handleStart = () => {
    setIsTransitioning(true);
    setTimeout(() => {
      setShowWelcome(false);
      setIsTransitioning(false);
    }, 500); // Match this with the animation duration
  };

  const handleSubmitOrNext = async () => {
    const current = questions[currentIndex];
    if (!submitted) {
      setSubmitted(true);
      
      // Get the correct option value based on the letter (A, B, C, D)
      const correctOption = current.answer.toUpperCase();
      const correctValue = current[`option_${correctOption.toLowerCase()}` as keyof Question];
      
      const isCorrect = selectedOption === correctValue;
      
      if (isCorrect) {
        setScore((s) => s + 1);
        setFeedbackClass('blink-green');
        setFeedbackState('correct');
      } else {
        setFeedbackClass('blink-red');
        setFeedbackState('incorrect');
      }

      // Only save to database if it's the last question
      if (currentIndex + 1 === questions.length) {
        await supabaseClient.from('user_answers').insert({
          question_id: current.id,
          selected_option: selectedOption,
          is_correct: isCorrect,
        });
      }
    } else {
      setSubmitted(false);
      setSelectedOption('');
      setFeedbackClass('');
      setFeedbackState(null);
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
    fetchQuestions(selectedYear ?? 0);
  };

  if (showWelcome) {
    return (
      <main className="p-8 text-center min-h-screen flex flex-col justify-center items-center glass">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-6xl font-bold mb-8 animate-welcome gradient-text">Welcome Deekshitha Jha!</h1>
          <p className="mb-12 text-2xl text-foreground/80 animate-welcome" style={{ animationDelay: '0.3s' }}>
            Choose a year to start your PGCET practice
          </p>
          <div className="grid grid-cols-2 gap-4 mb-8">
            {availableYears.map((year) => (
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
      <h1 className="text-5xl font-bold mb-2 gradient-text">PGCET MCQ Quiz</h1>
      <p className="text-xl text-foreground/60 mb-10">Year {selectedYear}</p>
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
              className="px-10 py-5 bg-gradient-to-r from-accent to-accent-hover text-white rounded-xl hover:bg-accent-hover text-xl font-medium hover-lift border-2 border-accent/30 hover:border-accent/50 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              Restart Quiz
            </button>
          </div>
        ) : (
          <div 
            className={`question-transition p-8 rounded-2xl bg-secondary/10 glass ${feedbackClass} ${
              feedbackState === 'correct' ? 'feedback-correct' : 
              feedbackState === 'incorrect' ? 'feedback-incorrect' : ''
            }`}
          >
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
              className="w-full px-8 py-5 bg-gradient-to-r from-primary to-primary-hover text-white rounded-xl hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-xl font-medium hover-lift border-2 border-primary/30 hover:border-primary/50 transition-all duration-300 shadow-lg hover:shadow-xl"
            >
              {!submitted 
                ? (currentIndex + 1 === questions.length ? 'Submit Quiz' : 'Next Question')
                : (currentIndex + 1 === questions.length ? 'Finish' : 'Next Question')}
            </button>
          </div>
        )
      ) : (
        <div className="p-8 rounded-2xl bg-secondary/10 glass">
          {stats.length === 0 ? (
            <p className="text-center text-foreground/60 text-xl">No wrong answers recorded.</p>
          ) : (
            <div className="space-y-6">
              {stats.map(({ date, wrongCount, wrongAnswers, year }) => (
                <div key={date} className="rounded-xl overflow-hidden border border-border/20">
                  <div 
                    className="flex items-center justify-between p-4 bg-secondary/30 cursor-pointer hover:bg-secondary/40 transition-colors"
                    onClick={() => setExpandedDate(expandedDate === date ? null : date)}
                  >
                    <div className="flex items-center space-x-4">
                      <span className="text-lg font-medium">{date}</span>
                      <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm">
                        PGCET {year}
                      </span>
                      <span className="px-3 py-1 rounded-full bg-error/20 text-error text-sm">
                        {wrongCount} wrong {wrongCount === 1 ? 'answer' : 'answers'}
                      </span>
                    </div>
                    <svg 
                      className={`w-6 h-6 transform transition-transform ${expandedDate === date ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                  {expandedDate === date && (
                    <div className="p-4 space-y-4 bg-secondary/10">
                      {wrongAnswers.map((item, index) => (
                        <div key={index} className="p-6 rounded-lg bg-secondary/20">
                          <div className="flex items-center justify-between mb-4">
                            <p className="text-lg font-medium">{item.question}</p>
                            <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-sm">
                              PGCET {item.year}
                            </span>
                          </div>
                          <div className="space-y-3">
                            <div className="p-3 rounded-lg bg-error/10">
                              <p className="text-error font-medium mb-1">Your answer:</p>
                              <p className="text-error">{item.selectedOption}</p>
                            </div>
                            <div className="p-3 rounded-lg bg-success/10">
                              <p className="text-success font-medium mb-1">Correct answer:</p>
                              <p className="text-success">{item.correctAnswer} - {item[`option${item.correctAnswer}` as keyof typeof item]}</p>
                            </div>
                            <div className="mt-4 p-4 rounded-lg bg-secondary/30">
                              <p className="font-medium mb-2">All options:</p>
                              <div className="grid grid-cols-2 gap-3">
                                <div className="p-2 rounded bg-secondary/20">
                                  <span className="font-medium">A:</span> {item.optionA}
                                </div>
                                <div className="p-2 rounded bg-secondary/20">
                                  <span className="font-medium">B:</span> {item.optionB}
                                </div>
                                <div className="p-2 rounded bg-secondary/20">
                                  <span className="font-medium">C:</span> {item.optionC}
                                </div>
                                <div className="p-2 rounded bg-secondary/20">
                                  <span className="font-medium">D:</span> {item.optionD}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </main>
  );
}
