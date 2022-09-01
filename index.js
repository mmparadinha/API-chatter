import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { MongoClient } from 'mongodb';
import dayjs from 'dayjs';
import joi from 'joi';

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
app.get('/participants', async function(req, res) {
    try {
        const participants = await db.collection('participants').find().toArray();
        res.send(participants);
    } catch (error) {
        console.error(error);
    }
});

app.get('/messages', async function(req, res) {
    try {
        const messages = await db.collection('messages').find().toArray();
        res.send(messages);
    } catch (error) {
        console.error(error);
    }
});

//Post participants and messages
app.post('/participants', async function(req, res) {
    const { name } = req.body;

    

    try {
        await db.collection('participants').insertOne({
            name: name,
            lastStatus: Date.now()
        })
        await db.collection('messages').insertOne({
            from: name,
            to: 'Todos',
            text: 'entra na sala...',
            type: 'status',
            time: dayjs().format('HH:mm:ss')
        })
        res.sendStatus(201);
    } catch (error) {
        console.error(error);
    }
});




app.listen(5000, console.log('Listening at 5000!'));