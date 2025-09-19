require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(bodyParser.json());

const port = 5001;

app.post('/api/openai', async (req, res) => {
  const { prompt } = req.body;

  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
      }
    );

    const aiResponse = response.data.choices[0].message.content.trim();
    res.json({ response: aiResponse });
  } catch (error) {
    if (error.response) {
      console.error(
        `Psychic API returned ${error.response.status}:`,
        error.response.data ?? error.response.statusText
      );
      // Mirror the downstream status and message
      return res
        .status(error.response.status)
        .json({ error: error.response.data || error.response.statusText });
    }

    // 2. The request was made but no response was received
    if (error.request) {
      console.error('No response from Psychic API:', error.request);
      return res
        .status(502) // Bad Gateway
        .json({ error: 'No response from Psychic service' });
    }

    // 3. Something went wrong setting up the request (e.g. bad URL, config error)
    console.error('Error constructing request to Psychic:', error.message);
    return res
      .status(500)
      .json({ error: 'Internal server error' });
    }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
