const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('../config/config');

const regionMapping = {
    'na': { name: 'NA' },
    'eu': { name: 'EU' },
    'as/au': { name: 'AS/AU' },
    'za': { name: 'ZA' }
};

function createVerifyEmbed() {
    const embed = new EmbedBuilder()
        .setTitle('📝 Evaluation Testing Waitlist')
        .setDescription(`Upon applying, you will be added to a waitlist channel.
Here you will be pinged when a tester of your region is available.
If you are HT3 or higher, a high ticket will be created.

• Region should be the region of the server you wish to test on
• Username should be the name of the account you will be testing on

**🛑 Failure to provide authentic information will result in a denied test.**`)
        .setColor(0x3498db)
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('verify_account')
                .setLabel('Verify Account')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId('enter_waitlist')
                .setLabel('Enter Waitlist')
                .setStyle(ButtonStyle.Primary)
        );

    return { embeds: [embed], components: [row] };
}

function createConfirmationEmbed(username, userId) {
    const embed = new EmbedBuilder()
        .setTitle('Confirm Username')
        .setDescription('Confirm that you have entered the right Username')
        .addFields({ name: 'Minecraft Username', value: `\`${username}\`` })
        .setColor(0xF1C40F)
        .setTimestamp();

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`confirm_username_${userId}`)
                .setLabel('Confirm')
                .setStyle(ButtonStyle.Success)
        );

    return { embeds: [embed], components: [row] };
}

function createVerifiedEmbed(username) {
    return new EmbedBuilder()
        .setTitle('Verified Username')
        .setDescription('You have successfully verified your Minecraft Username.')
        .setColor(0x2ECC71)
        .setTimestamp();
}

function createNotVerifiedEmbed() {
    return new EmbedBuilder()
        .setTitle('No Account Linked')
        .setDescription('Please link an account first. Click the "Verify Account" button.')
        .setColor(0xE74C3C)
        .setTimestamp();
}

function createWaitlistSuccessEmbed(region, preferredServer) {
    const regionName = regionMapping[region.toLowerCase()]?.name || region.toUpperCase();
    
    const embed = new EmbedBuilder()
        .setTitle('✅ Waitlist Registration')
        .setDescription(`You have been added to the ${regionName} waitlist!`)
        .addFields(
            { name: 'Region', value: regionName, inline: true },
            { name: 'Preferred Server', value: preferredServer || 'Not specified', inline: true }
        )
        .setColor(0x2ECC71)
        .setTimestamp();

    return { embeds: [embed] };
}

function createQueueEmbed(region, queues) {
    const regionData = queues[region];
    
    const embed = new EmbedBuilder()
        .setTitle('Snow Tiers (APP)')
        .setDescription(`## Tester(s) Available!\n\n⏱️ The queue updates every 1 minute.\nUse /leave if you wish to be removed from the waitlist or queue.`)
        .setColor(0x00AE86)
        .setTimestamp();

    let queueText = regionData.queue.length > 0 
        ? regionData.queue.map((user, index) => `${index + 1}. <@${user.id}>`).join('\n')
        : 'Empty';

    let testersText = regionData.testers.length > 0
        ? regionData.testers.map((user, index) => `${index + 1}. <@${user.id}>`).join('\n')
        : 'No active testers';

    embed.addFields(
        { name: '**Queue:**', value: queueText, inline: false },
        { name: '**Active Testers:**', value: testersText, inline: false }
    );

    const row = new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId(`join_queue_${region}`)
                .setLabel('Join Queue')
                .setStyle(ButtonStyle.Primary)
        );

    return { embeds: [embed], components: [row] };
}

function createNoTestersEmbed(region, lastStopTimestamps) {
    const regionName = regionMapping[region]?.name || region.toUpperCase();
    const lastStopTime = lastStopTimestamps[region];
    
    const embed = new EmbedBuilder()
        .setTitle(config.serverName)
        .setDescription('## No Testers Online\nNo testers for your region are available at this time.\nYou will be pinged when a tester is available.\nCheck back later!')
        .setColor(0xE74C3C)
        .setTimestamp();

    if (lastStopTime) {
        embed.addFields({
            name: 'Last testing session:',
            value: `<t:${Math.floor(lastStopTime.getTime() / 1000)}:F>`
        });
    }

    return { embeds: [embed] };
}

function createUserInfoEmbed(user, waitlistData, verifiedUsers, userTestHistory) {
    const minecraftUsername = verifiedUsers.get(user.id) || 'Not provided';
    const regionName = regionMapping[waitlistData?.region]?.name || 'Unknown';
    const preferredServer = waitlistData?.preferredServer || 'Not specified';
    
    const testHistory = userTestHistory.get(user.id);
    let previousTest = 'N/A';
    
    if (testHistory && testHistory.lastTest) {
        previousTest = `<t:${Math.floor(testHistory.lastTest.getTime() / 1000)}:F>`;
    }

    return new EmbedBuilder()
        .setTitle(`${minecraftUsername}'s Information`)
        .setColor(0x3498db)
        .addFields(
            { name: 'User', value: `<@${user.id}>`, inline: true },
            { name: 'Region', value: regionName, inline: true },
            { name: 'Minecraft Username', value: minecraftUsername, inline: false },
            { name: 'Preferred Server', value: preferredServer, inline: true },
            { name: 'Previous Test', value: previousTest, inline: true }
        )
        .setTimestamp();
}

function createTestingSessionEmbed(user, tester) {
    return new EmbedBuilder()
        .setDescription(`<@${user.id}> is being tested by <@${tester.id}>`)
        .setColor(0x2ECC71)
        .setTimestamp();
}

module.exports = {
    createVerifyEmbed,
    createConfirmationEmbed,
    createVerifiedEmbed,
    createNotVerifiedEmbed,
    createWaitlistSuccessEmbed,
    createQueueEmbed,
    createNoTestersEmbed,
    createUserInfoEmbed,
    createTestingSessionEmbed
};
