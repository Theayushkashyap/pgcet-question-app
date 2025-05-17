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

  const fetchQuestions = async () => {
    try {
      const { data, error } = await supabaseClient
        .from('mcq_questions')
        .select(
          'id, question, option_a, option_b, option_c, option_d, answer'
        );

      if (error) {
        console.error('Supabase error:', error.message);
        setError(error.message);
        setQuestions([]);
      } else {
        setQuestions(data ?? []);
      }
    } catch (err) {
      console.error('Unexpected fetch error:', err);
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQuestions();
  }, []);

  const handleStart = () => {
    setShowWelcome(false);
  };

  const handleSubmitOrNext = async () => {
    const current = questions[currentIndex];

    if (!submitted) {
      // first click: submit answer
      setSubmitted(true);
      const isCorrect = selectedOption === current.answer;
      if (isCorrect) {
        setScore((prev) => prev + 1);
      }

      // record to DB
      const { error: insertError } = await supabaseClient
        .from('user_answers')
        .insert({
          question_id: current.id,
          selected_option: selectedOption,
          is_correct: isCorrect,
        });

      if (insertError) {
        console.error('Failed to record answer:', insertError.message);
      }
    } else {
      // second click: next question or finish
      setSubmitted(false);
      setSelectedOption('');
      if (currentIndex + 1 < questions.length) {
        setCurrentIndex((prev) => prev + 1);
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

  if (loading) {
    return (
      <main className="p-6 text-center">
        <p>Loading questions…</p>
      </main>
    );
  }

  if (error) {
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
  }

  if (questions.length === 0) {
    return (
      <main className="p-6 text-center">
        <p className="text-gray-700">No questions available.</p>
        <button
          onClick={handleRestart}
          className="mt-4 px-4 py-2 bg-gray-600 text-white rounded"
        >
          Reload
        </button>
      </main>
    );
  }

  const current = questions[currentIndex];
  const options = [
    current.option_a,
    current.option_b,
    current.option_c,
    current.option_d,
  ];

  return (
    <main className="p-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">PGCET MCQ Quiz</h1>

      {finished ? (
        <div className="text-center">
          <p className="text-2xl mb-4">Quiz Complete!</p>
          <p className="text-xl">
            Score: {score} / {questions.length}
          </p>
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
          <p className="font-medium mb-4">{current.question}</p>

          <div className="space-y-3 mb-6">
            {options.map((opt, idx) => {
              const isCorrect = submitted && opt === current.answer;
              const isSelectedWrong =
                submitted &&
                opt === selectedOption &&
                selectedOption !== current.answer;

              return (
                <label
                  key={idx}
                  className={`flex items-center space-x-2 p-2 rounded cursor-pointer
                    ${isCorrect ? 'bg-green-100' : ''}
                    ${isSelectedWrong ? 'bg-red-100' : ''}`}
                >
                  <input
                    type="radio"
                    name="option"
                    value={opt}
                    checked={selectedOption === opt}
                    disabled={submitted}
                    onChange={() => setSelectedOption(opt)}
                    className="form-radio"
                  />
                  <span
                    className={`${
                      isCorrect
                        ? 'text-green-600 font-semibold'
                        : ''
                    } ${
                      isSelectedWrong
                        ? 'text-red-600 font-semibold'
                        : ''
                    }`}
                  >
                    {opt}
                  </span>
                </label>
              );
            })}
          </div>

          {submitted && selectedOption !== current.answer && (
            <p className="text-green-600 mb-4">
              Correct answer: {current.answer}
            </p>
          )}

          <button
            onClick={handleSubmitOrNext}
            disabled={!selectedOption && !submitted}
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50"
          >
            {!submitted
              ? 'Submit'
              : currentIndex + 1 === questions.length
              ? 'Finish'
              : 'Next'}
          </button>
        </div>
      )}
    </main>
  );
}
