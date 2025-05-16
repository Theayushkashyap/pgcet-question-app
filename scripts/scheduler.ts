import cron from 'node-cron';
import axios from 'axios';

const url = `${process.env.DEPLOYED_URL}/api/fetch-questions`;

cron.schedule('0 2 * * *', async () => {
  try {
    const res = await axios.get(url);
    console.log('Fetched:', res.data);
  } catch (err) {
    console.error('Fetch error:', err);
  }
});

// Run once immediately if you like:
// (async () => { await axios.get(url); })();
