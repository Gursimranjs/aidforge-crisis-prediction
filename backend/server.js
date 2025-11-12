const express = require('express');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Configuration
const DATABRICKS_URL = process.env.DATABRICKS_URL;
const DATABRICKS_TOKEN = process.env.DATABRICKS_TOKEN;

// Feature names in correct order
const FEATURE_NAMES = [
  'refugee_applications',
  'refugee_population',
  'crisis_intensity',
  'life_expectancy',
  'child_mortality_per_1000',
  'gdp_per_capita',
  'economic_vulnerability',
  'region_numeric',
  'risk_numeric'
];

// Region mapping
const REGION_MAP = {
  'South Asia': 1,
  'Middle East': 2,
  'Sub-Saharan Africa': 3,
  'Latin America': 4,
  'Europe & Central Asia': 5,
  'East Asia & Pacific': 6,
  'North Africa': 7
};

// Baseline risk mapping
const RISK_MAP = {
  'Critical': 4,
  'High Risk': 3,
  'Medium Risk': 2,
  'Low Risk': 1
};

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    message: 'AidForge API is running',
    timestamp: new Date().toISOString()
  });
});

// Predict endpoint
app.post('/api/predict', async (req, res) => {
  try {
    const {
      refugee_applications,
      refugee_population,
      crisis_intensity,
      life_expectancy,
      child_mortality_per_1000,
      gdp_per_capita,
      economic_vulnerability,
      region,
      baseline_risk,
      country,
      year
    } = req.body;

    // Validate required fields
    if (!country || !year) {
      return res.status(400).json({
        error: 'Missing required fields: country and year are required'
      });
    }

    // Transform region and risk to numeric
    const region_numeric = REGION_MAP[region] || 0;
    const risk_numeric = RISK_MAP[baseline_risk] || 0;

    // Prepare features in correct order
    const features = [
      parseFloat(refugee_applications) || 0,
      parseFloat(refugee_population) || 0,
      parseFloat(crisis_intensity) || 0,
      parseFloat(life_expectancy) || 0,
      parseFloat(child_mortality_per_1000) || 0,
      parseFloat(gdp_per_capita) || 0,
      parseFloat(economic_vulnerability) || 0,
      region_numeric,
      risk_numeric
    ];

    console.log('Sending prediction request for:', country, year);
    console.log('Features:', features);

    // Call Databricks Model Serving
    const response = await axios.post(
      DATABRICKS_URL,
      {
        dataframe_records: [
          {
            refugee_applications: features[0],
            refugee_population: features[1],
            crisis_intensity: features[2],
            life_expectancy: features[3],
            child_mortality_per_1000: features[4],
            gdp_per_capita: features[5],
            economic_vulnerability: features[6],
            region_numeric: features[7],
            risk_numeric: features[8]
          }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer ${DATABRICKS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // Handle different response formats from Databricks
    let prediction = response.data.predictions[0];

    // If prediction is an array, get first element
    if (Array.isArray(prediction)) {
      prediction = prediction[0];
    }

    // Convert to number
    const predictionValue = parseFloat(prediction);

    // Calculate priority level
    let priority = 'LOW';
    if (predictionValue > 60) priority = 'CRITICAL';
    else if (predictionValue > 50) priority = 'URGENT';
    else if (predictionValue > 40) priority = 'HIGH';
    else if (predictionValue > 30) priority = 'MEDIUM';

    res.json({
      success: true,
      country,
      year,
      predicted_score: parseFloat(predictionValue.toFixed(1)),
      priority,
      input_features: {
        refugee_applications: features[0],
        refugee_population: features[1],
        crisis_intensity: features[2],
        life_expectancy: features[3],
        child_mortality_per_1000: features[4],
        gdp_per_capita: features[5],
        economic_vulnerability: features[6],
        region,
        baseline_risk
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Prediction error:', error.response?.data || error.message);
    res.status(500).json({
      error: 'Prediction failed',
      details: error.response?.data || error.message
    });
  }
});

// Batch predict endpoint for multiple countries
app.post('/api/predict/batch', async (req, res) => {
  try {
    const { predictions } = req.body;

    if (!predictions || !Array.isArray(predictions)) {
      return res.status(400).json({ error: 'Invalid input: predictions array required' });
    }

    const results = [];

    for (const prediction of predictions) {
      try {
        const region_numeric = REGION_MAP[prediction.region] || 0;
        const risk_numeric = RISK_MAP[prediction.baseline_risk] || 0;

        const features = [
          parseFloat(prediction.refugee_applications) || 0,
          parseFloat(prediction.refugee_population) || 0,
          parseFloat(prediction.crisis_intensity) || 0,
          parseFloat(prediction.life_expectancy) || 0,
          parseFloat(prediction.child_mortality_per_1000) || 0,
          parseFloat(prediction.gdp_per_capita) || 0,
          parseFloat(prediction.economic_vulnerability) || 0,
          region_numeric,
          risk_numeric
        ];

        const response = await axios.post(
          DATABRICKS_URL,
          {
            dataframe_records: [{
              refugee_applications: features[0],
              refugee_population: features[1],
              crisis_intensity: features[2],
              life_expectancy: features[3],
              child_mortality_per_1000: features[4],
              gdp_per_capita: features[5],
              economic_vulnerability: features[6],
              region_numeric: features[7],
              risk_numeric: features[8]
            }]
          },
          {
            headers: {
              'Authorization': `Bearer ${DATABRICKS_TOKEN}`,
              'Content-Type': 'application/json'
            }
          }
        );

        let score = response.data.predictions[0];

        // If score is an array, get first element
        if (Array.isArray(score)) {
          score = score[0];
        }

        const scoreValue = parseFloat(score);

        let priority = 'LOW';
        if (scoreValue > 60) priority = 'CRITICAL';
        else if (scoreValue > 50) priority = 'URGENT';
        else if (scoreValue > 40) priority = 'HIGH';
        else if (scoreValue > 30) priority = 'MEDIUM';

        results.push({
          country: prediction.country,
          year: prediction.year,
          predicted_score: parseFloat(scoreValue.toFixed(1)),
          priority,
          region: prediction.region
        });

      } catch (err) {
        console.error(`Error predicting for ${prediction.country}:`, err.message);
        results.push({
          country: prediction.country,
          error: 'Prediction failed'
        });
      }
    }

    res.json({
      success: true,
      results,
      total: results.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Batch prediction error:', error);
    res.status(500).json({ error: 'Batch prediction failed', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 AidForge API Backend running on http://localhost:${PORT}`);
  console.log(`📊 Databricks endpoint: ${DATABRICKS_URL ? 'Configured' : 'NOT CONFIGURED'}`);
});
