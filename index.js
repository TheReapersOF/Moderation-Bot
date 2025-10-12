require('dotenv').config();
const fs = require('fs');
const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    PermissionsBitField,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    REST,
    Routes
} = require('discord.js');

const config = JSON.parse(fs.readFileSync('./config.json', 'utf8'));

// Initialize client
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// Configuration from environment variables
const botConfig = {
    guildId: process.env.GUILD_ID,
    serverName: process.env.SERVER_NAME,
    verifiedTesterRoleId: process.env.VERIFIED_TESTER_ROLE_ID,
    naRoleId: process.env.NA_ROLE_ID,
    euRoleId: process.env.EU_ROLE_ID,
    asAuRoleId: process.env.AS_AU_ROLE_ID,
    zaRoleId: process.env.ZA_ROLE_ID,
    naCategoryId: process.env.NA_CATEGORY_ID,
    euCategoryId: process.env.EU_CATEGORY_ID,
    asAuCategoryId: process.env.AS_AU_CATEGORY_ID,
    zaCategoryId: process.env.ZA_CATEGORY_ID,
    naChannelId: process.env.NA_CHANNEL_ID,
    euChannelId: process.env.EU_CHANNEL_ID,
    asAuChannelId: process.env.AS_AU_CHANNEL_ID,
    zaChannelId: process.env.ZA_CHANNEL_ID,
    naWaitlistRoleId: process.env.NA_WAITLIST_ROLE_ID,
    euWaitlistRoleId: process.env.EU_WAITLIST_ROLE_ID,
    asAuWaitlistRoleId: process.env.AS_AU_WAITLIST_ROLE_ID,
    zaWaitlistRoleId: process.env.ZA_WAITLIST_ROLE_ID,
    requestTestChannelId: process.env.REQUEST_TEST_CHANNEL_ID,
    token: process.env.BOT_TOKEN
};

// Storage
const queues = {
    na: { testers: [], queue: [] },
    eu: { testers: [], queue: [] },
    as_au: { testers: [], queue: [] },
    za: { testers: [], queue: [] }
};

const queueMessages = {
    na: null,
    eu: null,
    as_au: null,
    za: null
};

const lastStopTimestamps = {
    na: null,
    eu: null,
    as_au: null,
    za: null
};

const verifiedUsers = new Map();
const waitlistUsers = new Map();
const userTestHistory = new Map();

// Region mapping
const regionMapping = {
    'na': { 
        name: 'NA', 
        roleId: botConfig.naRoleId,
        waitlistRoleId: botConfig.naWaitlistRoleId,
        categoryId: botConfig.naCategoryId,
        channelId: botConfig.naChannelId
    },
    'eu': { 
        name: 'EU', 
        roleId: botConfig.euRoleId,
        waitlistRoleId: botConfig.euWaitlistRoleId,
        categoryId: botConfig.euCategoryId,
        channelId: botConfig.euChannelId
    },
    'as/au': { 
        name: 'AS/AU', 
        roleId: botConfig.asAuRoleId,
        waitlistRoleId: botConfig.asAuWaitlistRoleId,
        categoryId: botConfig.asAuCategoryId,
        channelId: botConfig.asAuChannelId
    },
    'za': { 
        name: 'ZA', 
        roleId: botConfig.zaRoleId,
        waitlistRoleId: botConfig.zaWaitlistRoleId,
        categoryId: botConfig.zaCategoryId,
        channelId: botConfig.zaChannelId
    }
};

// Embed Creators
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

function createQueueEmbed(region) {
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

function createNoTestersEmbed(region) {
    const regionName = regionMapping[region]?.name || region.toUpperCase();
    const lastStopTime = lastStopTimestamps[region];
    
    const embed = new EmbedBuilder()
        .setTitle(botConfig.serverName)
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

function createUserInfoEmbed(user, waitlistData) {
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

// Utility Functions
async function updateQueueEmbed(region) {
    const channelId = regionMapping[region]?.channelId;
    if (!channelId) return;

    const channel = await client.channels.fetch(channelId);
    const queueData = createQueueEmbed(region);

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

async function stopQueue(region) {
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
        const noTestersEmbed = createNoTestersEmbed(region);
        await channel.send(noTestersEmbed);

        queues[region].testers = [];
        queues[region].queue = [];

        return true;
    } catch (error) {
        console.error(`Error stopping queue for ${region}:`, error);
        return false;
    }
}

async function getUserRegion(member) {
    const hasVerifiedTester = member.roles.cache.has(botConfig.verifiedTesterRoleId);
    
    for (const [regionKey, regionData] of Object.entries(regionMapping)) {
        if (member.roles.cache.has(regionData.roleId)) {
            return {
                hasVerifiedTester,
                region: regionKey,
                regionName: regionData.name
            };
        }
    }
    
    return { hasVerifiedTester, region: null, regionName: null };
}

async function assignWaitlistRole(member, region) {
    const regionLower = region.toLowerCase();
    const regionConfig = regionMapping[regionLower];
    
    if (!regionConfig) return false;

    try {
        for (const [key, regionData] of Object.entries(regionMapping)) {
            if (regionData.waitlistRoleId && member.roles.cache.has(regionData.waitlistRoleId)) {
                await member.roles.remove(regionData.waitlistRoleId);
            }
        }

        if (regionConfig.waitlistRoleId) {
            await member.roles.add(regionConfig.waitlistRoleId);
        }
        return true;
    } catch (error) {
        console.error('Error assigning waitlist role:', error);
        return false;
    }
}

async function createTicket(user, region, tester) {
    const guild = await client.guilds.fetch(botConfig.guildId);
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

    const userInfoEmbed = createUserInfoEmbed(user, waitlistData);
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

function hasVerifiedAccount(userId) {
    return verifiedUsers.has(userId);
}

// Event Handlers
client.on('interactionCreate', async (interaction) => {
    // Slash Commands
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'start') {
            await interaction.deferReply({ ephemeral: true });

            const member = await interaction.guild.members.fetch(interaction.user.id);
            const userInfo = await getUserRegion(member);

            if (!userInfo.hasVerifiedTester) {
                await interaction.editReply({ content: '❌ You need the Verified Tester role to start testing!' });
                return;
            }

            if (!userInfo.region) {
                await interaction.editReply({ content: '❌ You need a region role (NA, EU, AS/AU, or ZA) to start testing!' });
                return;
            }

            const regionData = queues[userInfo.region];
            if (!regionData.testers.some(tester => tester.id === interaction.user.id)) {
                regionData.testers.unshift({ id: interaction.user.id, username: interaction.user.username });
            }

            try {
                await updateQueueEmbed(userInfo.region);
                await interaction.editReply({ content: `✅ Queue has been started in the ${userInfo.regionName} channel!` });
            } catch (error) {
                console.error('Error starting queue:', error);
                await interaction.editReply({ content: '❌ There was an error starting the queue. Please try again.' });
            }
        }

        if (interaction.commandName === 'stop') {
            await interaction.deferReply({ ephemeral: true });

            const member = await interaction.guild.members.fetch(interaction.user.id);
            const userInfo = await getUserRegion(member);

            if (!userInfo.hasVerifiedTester) {
                await interaction.editReply({ content: '❌ You need the Verified Tester role to stop the queue!' });
                return;
            }

            if (!userInfo.region) {
                await interaction.editReply({ content: '❌ You need a region role (NA, EU, AS/AU, or ZA) to stop the queue!' });
                return;
            }

            if (!queueMessages[userInfo.region]) {
                await interaction.editReply({ content: `❌ There is no active queue for ${userInfo.regionName}!` });
                return;
            }

            try {
                const success = await stopQueue(userInfo.region);
                if (success) {
                    await interaction.editReply({ content: `✅ ${userInfo.regionName} queue has been stopped and cleared!` });
                } else {
                    await interaction.editReply({ content: `❌ Failed to stop the ${userInfo.regionName} queue. Please try again.` });
                }
            } catch (error) {
                console.error('Error stopping queue:', error);
                await interaction.editReply({ content: '❌ There was an error stopping the queue. Please try again.' });
            }
        }

        if (interaction.commandName === 'verify') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                await interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
                return;
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                const channel = await client.channels.fetch(botConfig.requestTestChannelId);
                const verifyMessage = createVerifyEmbed();
                await channel.send(verifyMessage);
                
                await interaction.editReply({ content: '✅ Verify embed has been sent to the request test channel!' });
            } catch (error) {
                console.error('Error sending verify embed:', error);
                await interaction.editReply({ content: '❌ There was an error sending the verify embed. Please check the channel ID and bot permissions.' });
            }
        }

        if (interaction.commandName === 'next') {
            if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                await interaction.reply({ content: 'You do not have permission to use this command!', ephemeral: true });
                return;
            }

            await interaction.deferReply();

            const member = await interaction.guild.members.fetch(interaction.user.id);
            const userInfo = await getUserRegion(member);
            
            if (!userInfo.region) {
                await interaction.editReply({ content: '❌ You need a region role to use /next!' });
                return;
            }

            const region = userInfo.region;
            const regionData = queues[region];

            if (regionData.queue.length === 0) {
                await interaction.editReply({ content: `The ${userInfo.regionName} queue is empty!` });
                return;
            }

            const nextUser = regionData.queue.shift();
            
            try {
                const ticketChannel = await createTicket(nextUser, region, interaction.user);
                
                try {
                    const user = await client.users.fetch(nextUser.id);
                    await user.send(`🎫 Your testing session is ready! A ticket has been created: ${ticketChannel}`);
                } catch (error) {
                    console.log(`Could not DM user ${nextUser.username}`);
                }

                await updateQueueEmbed(region);
                await interaction.editReply({ content: `✅ ${nextUser.username} has been moved to a testing session. Ticket created: ${ticketChannel}` });

            } catch (error) {
                console.error('Error creating ticket:', error);
                await interaction.editReply({ content: 'There was an error creating the ticket. Please try again.' });
            }
        }

        if (interaction.commandName === 'leave') {
            await interaction.deferReply({ ephemeral: true });

            let found = false;
            let userRegion = null;

            for (const [region, regionData] of Object.entries(queues)) {
                const testerIndex = regionData.testers.findIndex(user => user.id === interaction.user.id);
                const queueIndex = regionData.queue.findIndex(user => user.id === interaction.user.id);
                
                if (testerIndex !== -1) {
                    regionData.testers.splice(testerIndex, 1);
                    found = true;
                    userRegion = region;
                    break;
                } else if (queueIndex !== -1) {
                    regionData.queue.splice(queueIndex, 1);
                    found = true;
                    userRegion = region;
                    break;
                }
            }
            
            if (!found) {
                await interaction.editReply({ content: 'You are not in any queue!' });
                return;
            }

            await updateQueueEmbed(userRegion);
            await interaction.editReply({ content: `You have been removed from the ${userRegion.toUpperCase()} queue!` });
        }
    }

    // Button Interactions
    if (interaction.isButton()) {
        if (interaction.customId === 'verify_account') {
            const modal = new ModalBuilder()
                .setCustomId('verify_modal')
                .setTitle('Verify Minecraft Account');

            const usernameInput = new TextInputBuilder()
                .setCustomId('minecraft_username')
                .setLabel('Minecraft Username')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter your Minecraft Username')
                .setRequired(true)
                .setMaxLength(16)
                .setMinLength(3);

            const firstActionRow = new ActionRowBuilder().addComponents(usernameInput);
            modal.addComponents(firstActionRow);

            await interaction.showModal(modal);
        }

        if (interaction.customId === 'enter_waitlist') {
            if (!hasVerifiedAccount(interaction.user.id)) {
                await interaction.reply({ embeds: [createNotVerifiedEmbed()], ephemeral: true });
                return;
            }

            const modal = new ModalBuilder()
                .setCustomId('waitlist_modal')
                .setTitle('Join Waitlist');

            const regionInput = new TextInputBuilder()
                .setCustomId('region')
                .setLabel('Region')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter your region (EU, NA, AS/AU or ZA)')
                .setRequired(true)
                .setMaxLength(10);

            const serverInput = new TextInputBuilder()
                .setCustomId('preferred_server')
                .setLabel('Preferred Server')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Preferred server')
                .setRequired(false)
                .setMaxLength(50);

            const firstActionRow = new ActionRowBuilder().addComponents(regionInput);
            const secondActionRow = new ActionRowBuilder().addComponents(serverInput);
            
            modal.addComponents(firstActionRow, secondActionRow);

            await interaction.showModal(modal);
        }

        if (interaction.customId.startsWith('confirm_username_')) {
            const userId = interaction.customId.replace('confirm_username_', '');
            
            if (interaction.user.id !== userId) {
                await interaction.reply({ content: '❌ You cannot confirm this username verification.', ephemeral: true });
                return;
            }

            await interaction.deferUpdate();

            const username = verifiedUsers.get(userId);
            if (!username) {
                await interaction.editReply({ content: '❌ Username data not found. Please verify again.', embeds: [], components: [] });
                return;
            }

            const verifiedEmbed = createVerifiedEmbed(username);
            await interaction.editReply({ embeds: [verifiedEmbed] });
        }

        if (interaction.customId.startsWith('join_queue_')) {
            const region = interaction.customId.replace('join_queue_', '');
            
            await interaction.deferReply({ ephemeral: true });

            if (!hasVerifiedAccount(interaction.user.id)) {
                await interaction.editReply({ embeds: [createNotVerifiedEmbed()] });
                return;
            }

            const member = await interaction.guild.members.fetch(interaction.user.id);
            const userInfo = await getUserRegion(member);
            
            if (!userInfo.hasVerifiedTester) {
                await interaction.editReply({ content: '❌ You need the Verified Tester role to join as a tester!' });
                return;
            }

            const regionData = queues[region];
            if (!regionData) {
                await interaction.editReply({ content: '❌ Invalid region queue!' });
                return;
            }

            const inTesters = regionData.testers.some(user => user.id === interaction.user.id);
            const inQueue = regionData.queue.some(user => user.id === interaction.user.id);
            
            if (inTesters || inQueue) {
                await interaction.editReply({ content: 'You are already in the queue!' });
                return;
            }

            if (userInfo.region === region) {
                if (regionData.testers.length >= config.MAX_TESTERS) {
                    await interaction.editReply({ content: 'The testers list is full! Please try again later.' });
                    return;
                }

                regionData.testers.push({ id: interaction.user.id, username: interaction.user.username });
                await interaction.editReply({ content: `✅ You have been added as a tester in the ${userInfo.regionName} queue! Position: ${regionData.testers.length}` });
            } else {
                const waitlistRoleId = regionMapping[region]?.waitlistRoleId;
                if (!waitlistRoleId || !member.roles.cache.has(waitlistRoleId)) {
                    await interaction.editReply({ content: `❌ You need the ${regionMapping[region]?.name} role or waitlist role to join this queue!` });
                    return;
                }

                if (regionData.queue.length >= config.MAX_QUEUE) {
                    await interaction.editReply({ content: 'The queue is full! Please try again later.' });
                    return;
                }

                regionData.queue.push({ id: interaction.user.id, username: interaction.user.username });
                await interaction.editReply({ content: `✅ You have been added to the ${regionMapping[region]?.name} queue! Position: ${regionData.queue.length}` });
            }

            await updateQueueEmbed(region);
        }
    }

    // Modal Submissions
    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'verify_modal') {
            await interaction.deferReply({ ephemeral: true });

            const username = interaction.fields.getTextInputValue('minecraft_username');
            verifiedUsers.set(interaction.user.id, username);
            
            const confirmationEmbed = createConfirmationEmbed(username, interaction.user.id);
            await interaction.editReply(confirmationEmbed);
        }

        if (interaction.customId === 'waitlist_modal') {
            await interaction.deferReply({ ephemeral: true });

            const region = interaction.fields.getTextInputValue('region');
            const preferredServer = interaction.fields.getTextInputValue('preferred_server');

            const regionLower = region.toLowerCase();
            const validRegions = ['eu', 'na', 'as/au', 'za'];
            
            if (!validRegions.includes(regionLower)) {
                await interaction.editReply({ content: '❌ Invalid region! Please use one of: EU, NA, AS/AU, ZA', ephemeral: true });
                return;
            }

            waitlistUsers.set(interaction.user.id, { region: regionLower, preferredServer: preferredServer });

            const member = await interaction.guild.members.fetch(interaction.user.id);
            const roleAssigned = await assignWaitlistRole(member, regionLower);

            if (!roleAssigned) {
                await interaction.editReply({ content: '❌ There was an error assigning your waitlist role. Please contact an administrator.', ephemeral: true });
                return;
            }

            const successEmbed = createWaitlistSuccessEmbed(regionLower, preferredServer);
            await interaction.editReply(successEmbed);
        }
    }
});

// Register Slash Commands
async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(botConfig.token);

    const commands = [
        {
            name: 'start',
            description: 'Start the testing queue in your regional channel'
        },
        {
            name: 'stop',
            description: 'Stop the testing queue in your regional channel'
        },
        {
            name: 'verify',
            description: 'Send the verification embed to the request test channel'
        },
        {
            name: 'next',
            description: 'Move the next user from queue to testing session'
        },
        {
            name: 'leave',
            description: 'Remove yourself from the queue'
        }
    ];

    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationGuildCommands(client.user.id, botConfig.guildId),
            { body: commands }
        );
        console.log('Slash commands registered successfully!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
}

// Bot Ready
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);
    await registerCommands();
    console.log('Bot is ready! Use /start in your server to begin.');
});

// Start Bot
client.login(botConfig.token);
