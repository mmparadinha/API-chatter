import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import dayjs from 'dayjs';
import Joi from 'joi';

const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();
dayjs().format();

//Server connection
const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;

mongoClient.connect().then(() => {
    db = mongoClient.db("projeto12");
});


//Get participants and messages
app.get('/participants', async function (req, res) {
    try {
        const participants = await db.collection('participants').find().toArray();
        res.send(participants);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
});

app.get('/messages', async function (req, res) {
    const { limit } = req.query;
    const { user } = req.headers;

    const loggedIn = await db.collection('participants').find({name: `${user}`}).toArray();
    if (loggedIn.length === 0) return res.status(422).send('Please login again');

    const messages = await db.collection('messages').find().toArray();
    const messagesUser = messages.filter(message => (message.from === user || message.to === 'Todos' || message.to === user));

    if (limit) {
        res.send(messagesUser.slice(-limit));
    } else {
        res.send(messagesUser);
    }
});

//Post participants and messages
app.post('/participants', async function (req, res) {
    const schemaUsername = Joi.string().alphanum().required();
    const { value, error } = schemaUsername.validate(req.body.name);
    const loggedIn = await db.collection('participants').find({name: `${value}`}).toArray();

    if (loggedIn.length !== 0) return res.status(409).send('Name already in use');
    if (error) return res.status(422).send(error.details[0].message);

    try {
        db.collection('participants').insertOne({
            name: value,
            lastStatus: Date.now()
        })
        db.collection('messages').insertOne({
            from: value,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        })
        res.sendStatus(201);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    } 
});

app.post('/messages', async function (req, res) {
    const { to, text, type } = req.body;
    const { user } = req.headers;
    const schemaMessage = Joi.object ({
        to: Joi.string().alphanum().required(),
        text: Joi.string().required(),
        type: Joi.string().required().valid('message', 'private_message')
    });

    const loggedIn = await db.collection('participants').find({name: `${user}`}).toArray();
    if (loggedIn.length === 0) return res.status(422).send('Please login again');

    const { value, error } = schemaMessage.validate({
        to: to,
        text: text,
        type: type,
    });
    if (error) return res.status(422).send(error.details[0].message);

    try {
        db.collection('messages').insertOne({
            from: user,
            to: to,
            text: text,
            type: type,
            time: dayjs().format('HH:mm:ss')
        });
        res.sendStatus(201);
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    } 
});

//Status
app.post('/status', async function (req, res) {
    const { user } = req.headers;

    if (!user) {
        res.sendStatus(404);
    } else {
        try {
            db.collection('participants').updateOne(
                {name: user},
                {$set: {lastStatus: Date.now()}}
            );
            res.sendStatus(200);
        } catch (error) {
            console.error(error);
            res.sendStatus(500);
        }
    }
});

app.listen(5000, console.log('Listening at 5000!'));