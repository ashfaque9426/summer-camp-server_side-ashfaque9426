const express = require('express');
const app = express();
const jwt = require('jsonwebtoken');
require("dotenv").config();
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 5000;

// middlewares
app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
    res.send("Summer School Server is running");
});

app.listen(port, () => console.log(`Summer School server is running on Port: ${port}`));