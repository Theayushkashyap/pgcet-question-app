import axios from 'axios';
import { load } from 'cheerio';

export interface Question {
  text: string;
  options: string[];
  answer: string;
  source: string;
}

export async function fetchQuestionsFromSource(url: string): Promise<Question[]> {
  try {
    const { data } = await axios.get<string>(url, { timeout: 5000 });
    const $ = load(data);
    const questions: Question[] = [];

    // ←– **You must update these selectors** to whatever your actual source HTML uses.
    $('.question-block').each((_, el) => {
      const text    = $(el).find('.q-text').text().trim();
      const options = ['.optA', '.optB', '.optC', '.optD']
        .map(sel => $(el).find(sel).text().trim());
      const answer  = $(el).find('.answer').text().trim();

      if (text && options.every(o => o) && answer) {
        questions.push({ text, options, answer, source: url });
      }
    });

    return questions;
  } catch (err: any) {
    console.error(`Error fetching/parsing ${url}:`, err.message);
    return [];
  }
}
