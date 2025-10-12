const { ChannelType, PermissionsBitField } = require('discord.js');
const config = require('../config/config');
const { createUserInfoEmbed, createTestingSessionEmbed } = require('./embedCreator');

const regionMapping = {
    'na': { categoryId: config.naCategoryId },
    'eu': { categoryId: config.euCategoryId },
    'as_au': { categoryId: config.asAuCategoryId },
    'za': { categoryId: config.zaCategoryId }
};

async function createTicket(user, region, tester, waitlistUsers, verifiedUsers, userTestHistory, client) {
    const guild = await client.guilds.fetch(config.guildId);
    const categoryId = regionMapping[region]?.categoryId;
    if (!categoryId) throw new Error(`No category found for region: ${region}`);

    const category = await guild.channels.fetch(categoryId);
    const waitlistData = waitlistUsers.get(user.id);
    
    const ticketChannel = await guild.channels.create({
        name: `ticket-${user.username}-${region.toUpperCase()}`,
        type: ChannelType.GuildText,
        parent: category.id,
        permissionOverwrites: [
            {
                id: guild.id,
                deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
                id: user.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
            },
            {
                id: tester.id,
                allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages],
            },
        ],
    });

    const userInfoEmbed = createUserInfoEmbed(user, waitlistData, verifiedUsers, userTestHistory);
    const testingSessionEmbed = createTestingSessionEmbed(user, tester);
    
    await ticketChannel.send({ embeds: [userInfoEmbed, testingSessionEmbed] });

    const now = new Date();
    const userHistory = userTestHistory.get(user.id) || { firstTest: now, lastTest: now, testCount: 0 };
    userHistory.lastTest = now;
    userHistory.testCount += 1;
    if (!userHistory.firstTest) userHistory.firstTest = now;
    userTestHistory.set(user.id, userHistory);

    return ticketChannel;
}

module.exports = {
    createTicket
}; 
