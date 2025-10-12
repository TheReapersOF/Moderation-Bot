const { queueMessages, queues, lastStopTimestamps } = require('../data/storage');
const { createQueueEmbed, createNoTestersEmbed } = require('./embedCreator');
const config = require('../config/config');

const regionMapping = {
    'na': { channelId: config.naChannelId },
    'eu': { channelId: config.euChannelId },
    'as_au': { channelId: config.asAuChannelId },
    'za': { channelId: config.zaChannelId }
};

async function updateQueueEmbed(region, client) {
    const channelId = regionMapping[region]?.channelId;
    if (!channelId) return;

    const channel = await client.channels.fetch(channelId);
    const queueData = createQueueEmbed(region, queues);

    if (queueMessages[region]) {
        try {
            const message = await channel.messages.fetch(queueMessages[region]);
            await message.edit(queueData);
        } catch (error) {
            const newMessage = await channel.send(queueData);
            queueMessages[region] = newMessage.id;
        }
    } else {
        const message = await channel.send(queueData);
        queueMessages[region] = message.id;
    }
}

async function stopQueue(region, client) {
    const channelId = regionMapping[region]?.channelId;
    if (!channelId) return false;

    try {
        const channel = await client.channels.fetch(channelId);
        
        if (queueMessages[region]) {
            try {
                const message = await channel.messages.fetch(queueMessages[region]);
                await message.delete();
            } catch (error) {
                console.log(`Queue message for ${region} not found`);
            }
            queueMessages[region] = null;
        }

        lastStopTimestamps[region] = new Date();
        const noTestersEmbed = createNoTestersEmbed(region, lastStopTimestamps);
        await channel.send(noTestersEmbed);

        queues[region].testers = [];
        queues[region].queue = [];

        return true;
    } catch (error) {
        console.error(`Error stopping queue for ${region}:`, error);
        return false;
    }
}

module.exports = {
    updateQueueEmbed,
    stopQueue
};
