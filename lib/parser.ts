import axios from 'axios';
import { load } from 'cheerio';

export interface Question {
  text: string;
  options: string[];
  answer: string;
  source: string;
}

/**
 * Fetches and parses multiple-choice questions from a given HTML source URL.
 * Expects each question block to match the `.question-block` selector,
 * with inner elements for question text, options, and answer.
 */
export async function fetchQuestionsFromSource(url: string): Promise<Question[]> {
  const questions: Question[] = [];

  try {
    const response = await axios.get<string>(url, {
      timeout: 5000,
      responseType: 'text',
    });

    const $ = load(response.data);

    $('.question-block').each((_, element) => {
      const text = $(element).find('.q-text').text().trim();

      const optionSelectors = ['.optA', '.optB', '.optC', '.optD'];
      const options = optionSelectors
        .map((sel) => $(element).find(sel).text().trim())
        .filter((opt) => opt.length > 0);

      const answer = $(element).find('.answer').text().trim();

      // Only push fully-formed questions
      if (
        text &&
        options.length === optionSelectors.length &&
        answer
      ) {
        questions.push({ text, options, answer, source: url });
      }
    });
  } catch (err: unknown) {
    if (axios.isAxiosError(err)) {
      console.error(`Axios error fetching ${url}:`, err.message);
    } else if (err instanceof Error) {
      console.error(`Error parsing ${url}:`, err.message);
    } else {
      console.error(`Unknown error fetching ${url}:`, err);
    }
  }

  return questions;
}
