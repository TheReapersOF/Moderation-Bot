require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config/config');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Load event handlers
const interactionCreate = require('./events/interactionCreate');
const modalSubmit = require('./events/modalSubmit');
const ready = require('./events/ready');

client.on('interactionCreate', interactionCreate.execute);
client.on('interactionCreate', modalSubmit.execute);
client.once('ready', ready.execute.bind(null, client));

client.login(config.token); 
