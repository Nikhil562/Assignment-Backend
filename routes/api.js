const express = require('express');
const axios = require('axios');
const Transaction = require('../models/Transaction');
const router = express.Router();

router.get('/initialize', async (req, res) => {
  try {
    const response = await axios.get('https://s3.amazonaws.com/roxiler.com/product_transaction.json');
    await Transaction.insertMany(response.data);
    res.status(200).send('Database initialized');
  } catch (error) {
    res.status(500).send('Error initializing database');
  }
});

router.get('/transactions', async (req, res) => {
  const { page = 1, perPage = 10, search = '' } = req.query;
  const query = {
    $or: [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { price: { $regex: search, $options: 'i' } }
    ]
  };
  const transactions = await Transaction.find(query)
    .skip((page - 1) * perPage)
    .limit(Number(perPage));
  res.json(transactions);
});

router.get('/statistics', async (req, res) => {
  const { month } = req.query;
  const monthStart = new Date(`${month} 1, 2023`);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  const stats = await Transaction.aggregate([
    { $match: { dateOfSale: { $gte: monthStart, $lt: monthEnd } } },
    { $group: { _id: null, totalAmount: { $sum: '$price' }, soldItems: { $sum: { $cond: ['$sold', 1, 0] } }, notSoldItems: { $sum: { $cond: ['$sold', 0, 1] } } } }
  ]);
  res.json(stats[0]);
});


router.get('/bar-chart', async (req, res) => {
  const { month } = req.query;
  const monthStart = new Date(`${month} 1, 2023`);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  const priceRanges = [
    { range: '0-100', min: 0, max: 100 },
    { range: '101-200', min: 101, max: 200 },
    { range: '201-300', min: 201, max: 300 },
    { range: '301-400', min: 301, max: 400 },
    { range: '401-500', min: 401, max: 500 },
    { range: '501-600', min: 501, max: 600 },
    { range: '601-700', min: 601, max: 700 },
    { range: '701-800', min: 701, max: 800 },
    { range: '801-900', min: 801, max: 900 },
    { range: '901-above', min: 901, max: Infinity }
  ];
  const results = await Promise.all(priceRanges.map(async ({ range, min, max }) => {
    const count = await Transaction.countDocuments({ price: { $gte: min, $lte: max }, dateOfSale: { $gte: monthStart, $lt: monthEnd } });
    return { range, count };
  }));
  res.json(results);
});


router.get('/pie-chart', async (req, res) => {
  const { month } = req.query;
  const monthStart = new Date(`${month} 1, 2023`);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  const categories = await Transaction.aggregate([
    { $match: { dateOfSale: { $gte: monthStart, $lt: monthEnd } } },
    { $group: { _id: '$category', count: { $sum: 1 } } }
  ]);
  res.json(categories);
});

router.get('/combined', async (req, res) => {
  const { month } = req.query;
  const [transactions, statistics, barChart, pieChart] = await Promise.all([
    axios.get(`http://localhost:3000/api/transactions?month=${month}`),
    axios.get(`http://localhost:3000/api/statistics?month=${month}`),
    axios.get(`http://localhost:3000/api/bar-chart?month=${month}`),
    axios.get(`http://localhost:3000/api/pie-chart?month=${month}`)
  ]);
  res.json({
    transactions: transactions.data,
    statistics: statistics.data,
    barChart: barChart.data,
    pieChart: pieChart.data
  });
});

module.exports = router;
