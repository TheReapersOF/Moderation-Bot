const config = require('../config/config');

const regionMapping = {
    'na': { 
        roleId: config.naRoleId,
        waitlistRoleId: config.naWaitlistRoleId
    },
    'eu': { 
        roleId: config.euRoleId,
        waitlistRoleId: config.euWaitlistRoleId
    },
    'as/au': { 
        roleId: config.asAuRoleId,
        waitlistRoleId: config.asAuWaitlistRoleId
    },
    'za': { 
        roleId: config.zaRoleId,
        waitlistRoleId: config.zaWaitlistRoleId
    }
};

async function getUserRegion(member) {
    const hasVerifiedTester = member.roles.cache.has(config.verifiedTesterRoleId);
    
    for (const [regionKey, regionData] of Object.entries(regionMapping)) {
        if (member.roles.cache.has(regionData.roleId)) {
            return {
                hasVerifiedTester,
                region: regionKey,
                regionName: regionMapping[regionKey].name
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

module.exports = {
    getUserRegion,
    assignWaitlistRole
};
