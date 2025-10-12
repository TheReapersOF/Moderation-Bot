require('dotenv').config();

module.exports = {
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
