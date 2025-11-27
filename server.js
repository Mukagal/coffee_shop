const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
require("dotenv").config();

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); 

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use('/api/webhook', express.raw({ type: 'application/json' })); 
app.use(express.json());
app.use(express.static('public'));


const menuItems = {
    'espresso': { name: 'Espresso', price: 350 },
    'cappuccino': { name: 'Cappuccino', price: 475 },
    'caramel-latte': { name: 'Caramel Latte', price: 525 },
    'cold-brew': { name: 'Cold Brew', price: 450 },
    'mocha': { name: 'Mocha', price: 500 },
    'flat-white': { name: 'Flat White', price: 450 }
};

app.post('/api/create-payment-intent', async (req, res) => {
    try {
        const { items } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ error: 'No items provided' });
        }

        let totalAmount = 0;
        const orderItems = [];

        items.forEach(item => {
            const menuItem = menuItems[item.id];
            if (menuItem) {
                totalAmount += menuItem.price * item.quantity;
                orderItems.push({
                    name: menuItem.name,
                    quantity: item.quantity,
                    price: menuItem.price
                });
            }
        });

        if (totalAmount === 0) {
            return res.status(400).json({ error: 'Invalid items' });
        }

        const paymentIntent = await stripe.paymentIntents.create({
            amount: totalAmount,
            currency: 'usd',
            metadata: {
                items: JSON.stringify(orderItems)
            },
            automatic_payment_methods: {
                enabled: true,
            },
        });

        res.json({
            clientSecret: paymentIntent.client_secret,
            amount: totalAmount,
            orderItems: orderItems
        });

    } catch (error) {
        console.error('Payment intent error:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/config', (req, res) => {
    res.json({
        publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
    });
});

app.post('/api/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
        console.log("Webhook verified:", event.type);
    } catch (err) {
        console.error("Webhook verification failed:", err.message);
        return res.status(400).send("Webhook signature verification failed");
    }

    if (event.type === "payment_intent.succeeded") {
        const payment = event.data.object;
        console.log("Payment success:", payment.id);
        await logOrder(payment);
    }

    res.sendStatus(200);
});


app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;

        if (!name || !email || !message) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email format' });
        }

        const timestamp = new Date().toISOString();
        const messageEntry = {
            timestamp,
            name,
            email,
            message
        };

        const formattedMessage = `
========================================
Date: ${timestamp}
Name: ${name}
Email: ${email}
Message: ${message}
========================================

`;

        const messagesFile = path.join(__dirname, 'messages.txt');
        await fs.appendFile(messagesFile, formattedMessage);

        await saveMessageAsJSON(messageEntry);

        console.log('Message saved:', { name, email });

        res.json({ 
            success: true, 
            message: 'Thank you! Your message has been received.' 
        });

    } catch (error) {
        console.error('Error saving message:', error);
        res.status(500).json({ error: 'Failed to save message. Please try again.' });
    }
});

app.get('/api/messages', async (req, res) => {
    try {
        const messagesFile = path.join(__dirname, 'messages.json');
        
        try {
            await fs.access(messagesFile);
        } catch {
            return res.json({ messages: [] });
        }

        const data = await fs.readFile(messagesFile, 'utf-8');
        const messages = JSON.parse(data);
        
        res.json({ messages });
    } catch (error) {
        console.error('Error reading messages:', error);
        res.status(500).json({ error: 'Failed to retrieve messages' });
    }
});

async function saveMessageAsJSON(messageEntry) {
    const messagesFile = path.join(__dirname, 'messages.json');
    let messages = [];

    try {
        const data = await fs.readFile(messagesFile, 'utf-8');
        messages = JSON.parse(data);
    } catch (error) {
        messages = [];
    }

    messages.push(messageEntry);

    await fs.writeFile(messagesFile, JSON.stringify(messages, null, 2));
}

async function logOrder(paymentIntent) {
    const ordersFile = path.join(__dirname, 'orders.txt');
    const timestamp = new Date().toISOString();
    
    const orderLog = `
========================================
Order Date: ${timestamp}
Payment ID: ${paymentIntent.id}
Amount: $${(paymentIntent.amount / 100).toFixed(2)}
Status: ${paymentIntent.status}
Items: ${paymentIntent.metadata.items}
========================================

`;

    await fs.appendFile(ordersFile, orderLog);
}

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Messages will be saved to messages.txt and messages.json`);
    console.log(`Orders will be logged to orders.txt`);
});