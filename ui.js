import { world, system, Player } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

import { getScore } from "../npcfiles/shop";
import { Bountys } from "../npcfiles/bountys";
import { MainForm as MainFormBP} from "../npcfiles/bp";
import { PrestigeNPC } from "../npcfiles/prestige";
import { achievementsForm } from "../BA/form/achievementsForm";
import { cosmeticui } from "./cosmetics";
import { DonationsUI } from "../npcfiles/donations";
import { inventoryView } from "./inv-see";

// =================== PLAYER SETTINGS STORAGE ===================
const playerSettings = new Map();

function getPlayerSettings(player) {
    if (!playerSettings.has(player.name)) {
        playerSettings.set(player.name, {
            pvpEnabled: true,
            damageNumbers: true,
            autoRespawn: true,
            chatTimestamps: true,
            showParticles: true,
            flightMode: false,
            nightVision: false,
            speedBoost: false,
            jumpBoost: false,
            scoreboardVisible: true,
            joinMessages: true,
            killMessages: true
        });
    }
    return playerSettings.get(player.name);
}

function savePlayerSettings(player, settings) {
    playerSettings.set(player.name, settings);
}

// =================== PLOT SYSTEM ===================
const plots = new Map();
const PLOT_RADIUS = 16;
const MAX_PLOT_MEMBERS = 3;

function isPlotOverlapping(x, z) {
    for (const plot of plots.values()) {
        const dx = Math.abs(x - plot.x);
        const dz = Math.abs(z - plot.z);
        if (dx <= PLOT_RADIUS * 2 && dz <= PLOT_RADIUS * 2) return true;
    }
    return false;
}

function getPlayerPlot(player) {
    return [...plots.values()].find(
        p => p.owner === player.name || p.members.includes(player.name)
    );
}

function claimPlot(player) {
    if (getPlayerPlot(player)) {
        player.sendMessage("§cYou already have a plot.");
        return;
    }

    const x = Math.floor(player.location.x);
    const z = Math.floor(player.location.z);

    if (isPlotOverlapping(x, z)) {
        player.sendMessage("§cThis area is already claimed.");
        return;
    }

    const id = Date.now();

    plots.set(id, {
        id,
        owner: player.name,
        x,
        z,
        members: [],
        name: `${player.name}'s Plot`
    });

    player.sendMessage("§aPlot claimed successfully!");
    player.playSound("random.levelup");
}

// =================== MAIN MOLTEN MENU ===================
world.afterEvents.itemUse.subscribe((event) => {
    if (!(event.source instanceof Player)) return;
    if (event.itemStack.typeId == "minecraft:recovery_compass") MoltenMenu(event.source);
});

function MoltenMenu(player) {
    const settings = getPlayerSettings(player);
    const isStaff = getScore(player, "staff") > 0;
    
    new ActionFormData()
        .title("§4§lMOLTEN §c§lSKYGEN")
        .body(`\n§7Welcome §e${player.name}§7!\n§7Balance: §6${getScore(player, "money") || 0} coins`)
        .button("§cDuels Arena\n§7PvP Combat", "textures/ui/icon_combat")
        .button("§6Money Transfer\n§7Send money", "textures/ui/icon_money")
        .button("§ePlayer Stats\n§7Your information", "textures/ui/icon_profile")
        .button("§aPlots System\n§7Manage land", "textures/ui/icon_plot")
        .button("§bServer Info\n§7Server status", "textures/ui/icon_server")
        .button("§dGame Settings\n§7Preferences", "textures/ui/settings_glyph_color_2x")
        .button(isStaff ? "§4Staff Panel\n§7Staff tools" : "§8Staff Panel\n§7Locked", "textures/items/staff.png")
        .show(player).then((r) => {
            if (r.canceled) return;
            switch(r.selection) {
                case 0: DuelsMenu(player); break;
                case 1: MoneyTransferMenu(player); break;
                case 2: PlayerStats(player); break;
                case 3: PlotSystemMenu(player); break;
                case 4: ServerInfoMenu(player); break;
                case 5: GameSettingsMenu(player); break;
                case 6: 
                    if (isStaff) StaffPanel(player);
                    else {
                        player.sendMessage("§cYou need staff permissions to access this!");
                        player.playSound("note.bass", {pitch: 0.8});
                    }
                    break;
            }
        });
}

// =================== MONEY TRANSFER ===================
function MoneyTransferMenu(player) {
    const players = world.getAllPlayers()
        .filter(p => p.name !== player.name)
        .map(p => p.name);
    
    if (players.length === 0) {
        player.sendMessage("§cNo other players online.");
        return;
    }
    
    const playerMoney = getScore(player, "money") || 0;
    
    if (playerMoney <= 0) {
        player.sendMessage("§cYou don't have any money to transfer!");
        return;
    }
    
    new ModalFormData()
        .title("§6Money Transfer")
        .dropdown("§7Select Player", players)
        .slider("§7Amount", 1, Math.min(playerMoney, 50000), 1, 100)
        .show(player).then(result => {
            if (result.canceled) return;
            
            const targetName = players[result.formValues[0]];
            const amount = Math.floor(result.formValues[1]);
            const target = world.getPlayers({name: targetName})[0];
            
            if (!target) {
                player.sendMessage("§cPlayer not found!");
                return;
            }
            
            if (amount > playerMoney) {
                player.sendMessage("§cYou don't have enough money!");
                return;
            }
            
            // Transfer money
            const moneyObj = world.scoreboard.getObjective("money");
            if (moneyObj) {
                moneyObj.addScore(player, -amount);
                moneyObj.addScore(target, amount);
                
                player.sendMessage(`§aSent §6${amount} coins §ato §e${targetName}`);
                target.sendMessage(`§aReceived §6${amount} coins §afrom §e${player.name}`);
                
                player.playSound("random.orb");
            } else {
                player.sendMessage("§cMoney system not available!");
            }
        });
}

// =================== DUELS ARENA ===================
function DuelsMenu(player) {
    const wins = getScore(player, "wins") || 0;
    const losses = getScore(player, "losses") || 0;
    const winrate = wins + losses > 0 ? ((wins / (wins + losses)) * 100).toFixed(1) : 0;
    
    new ActionFormData()
        .title("§cDuels Arena")
        .body(`\n§7Your Duel Stats:\n§eWins: §6${wins}\n§eLosses: §6${losses}\n§eWin Rate: §6${winrate}%`)
        .button("§c1v1 Classic\n§7Standard duel", "textures/ui/icon_sword")
        .button("§6Ranked Duel\n§7Compete for rank", "textures/ui/icon_trophy")
        .button("§eTeam Battle\n§72v2 or 3v3", "textures/ui/icon_users")
        .button("§cBack", "textures/ui/back")
        .show(player).then((r) => {
            if (r.canceled) return;
            if (r.selection === 3) MoltenMenu(player);
            else {
                player.sendMessage("§eDuel system coming soon!");
                player.playSound("random.click");
            }
        });
}

// =================== PLAYER STATS ===================
function PlayerStats(player) {
    const money = getScore(player, "money") || 0;
    const kills = getScore(player, "kills") || 0;
    const deaths = getScore(player, "deaths") || 0;
    const kdr = deaths > 0 ? (kills / deaths).toFixed(2) : kills.toFixed(2);
    const level = getScore(player, "level") || 1;
    const playtime = getScore(player, "playtime") || 0;
    const hours = Math.floor(playtime / 60);
    const minutes = playtime % 60;
    
    new ActionFormData()
        .title(`§a${player.name}'s Stats`)
        .body(`\n§7Statistics:\n\n§eLevel: §6${level}\n§eMoney: §6${money}\n§eKills: §6${kills}\n§eDeaths: §6${deaths}\n§eK/D: §6${kdr}\n§ePlaytime: §6${hours}h ${minutes}m`)
        .button("§cAchievements\n§7Your progress", "textures/ui/icon_trophy")
        .button("§6Battlepass\n§7Season rewards", "textures/ui/icon_battlepass")
        .button("§ePrestige\n§7Rank up system", "textures/ui/icon_prestige")
        .button("§cBack", "textures/ui/back")
        .show(player).then((r) => {
            if (r.canceled) return;
            switch(r.selection) {
                case 0: achievementsForm(player); break;
                case 1: MainFormBP(player); break;
                case 2: PrestigeNPC(player); break;
                case 3: MoltenMenu(player); break;
            }
        });
}

// =================== PLOT SYSTEM ===================
function PlotSystemMenu(player) {
    const plot = getPlayerPlot(player);
    
    new ActionFormData()
        .title("§aPlot System")
        .body(plot ? 
            `\n§7Your Plot: §e${plot.name}\n§7Owner: §e${plot.owner}\n§7Members: §e${plot.members.length}/${MAX_PLOT_MEMBERS}` :
            `\n§7You don't have a plot yet.\n§eClaim one to build freely!`)
        .button(plot ? "§aManage Plot\n§7Settings" : "§aClaim Plot\n§7Get land", "textures/ui/icon_plot")
        .button(plot ? "§eTeleport Home\n§7Go to plot" : "§ePlot Rules\n§7Read rules", "textures/ui/icon_teleport")
        .button("§cBack", "textures/ui/back")
        .show(player).then((r) => {
            if (r.canceled) return;
            if (r.selection === 2) MoltenMenu(player);
            else if (r.selection === 0) {
                if (plot) PlotSettingsMenu(player);
                else claimPlot(player);
            } else if (r.selection === 1) {
                if (plot) {
                    player.teleport({x: plot.x, y: 100, z: plot.z});
                    player.sendMessage("§aTeleported to your plot!");
                } else {
                    player.sendMessage("§ePlot Rules: Max 3 members per plot");
                }
            }
        });
}

function PlotSettingsMenu(player) {
    const plot = getPlayerPlot(player);
    if (!plot) return;
    
    new ActionFormData()
        .title("§6Plot Settings")
        .body(`\n§7Plot: §e${plot.name}\n§7Members: §e${plot.members.length}/${MAX_PLOT_MEMBERS}`)
        .button("§aAdd Member\n§7Invite player", "textures/ui/icon_add")
        .button("§cRemove Member\n§7Kick player", "textures/ui/icon_remove")
        .button("§eRename Plot\n§7Change name", "textures/ui/icon_edit")
        .button("§cBack", "textures/ui/back")
        .show(player).then((r) => {
            if (r.canceled) return;
            if (r.selection === 3) PlotSystemMenu(player);
            else if (r.selection === 0) AddPlotMemberMenu(player);
            else if (r.selection === 1) RemovePlotMemberMenu(player);
            else if (r.selection === 2) RenamePlotMenu(player);
        });
}

function AddPlotMemberMenu(owner) {
    const plot = getPlayerPlot(owner);
    if (!plot) return;
    
    const players = world.getAllPlayers()
        .filter(p => p.name !== owner.name && !plot.members.includes(p.name))
        .map(p => p.name);
    
    if (players.length === 0) {
        owner.sendMessage("§cNo players available to add.");
        return;
    }
    
    new ModalFormData()
        .title("Add Plot Member")
        .dropdown("Select Player", players)
        .show(owner).then(r => {
            if (r.canceled) return;
            const targetName = players[r.formValues[0]];
            const target = world.getPlayers({name: targetName})[0];
            if (target) {
                plot.members.push(target.name);
                owner.sendMessage(`§aAdded §e${target.name} §ato your plot.`);
                target.sendMessage(`§aYou were added to §e${owner.name}'s §aplot.`);
            }
        });
}

function RemovePlotMemberMenu(owner) {
    const plot = getPlayerPlot(owner);
    if (!plot || plot.members.length === 0) {
        owner.sendMessage("§cNo members to remove.");
        return;
    }
    
    new ModalFormData()
        .title("Remove Plot Member")
        .dropdown("Select Member", plot.members)
        .show(owner).then(r => {
            if (r.canceled) return;
            const memberName = plot.members[r.formValues[0]];
            plot.members = plot.members.filter(m => m !== memberName);
            owner.sendMessage(`§cRemoved §e${memberName} §cfrom your plot.`);
            
            const member = world.getPlayers({name: memberName})[0];
            if (member) member.sendMessage(`§cYou were removed from §e${owner.name}'s §cplot.`);
        });
}

function RenamePlotMenu(player) {
    const plot = getPlayerPlot(player);
    if (!plot) return;
    
    new ModalFormData()
        .title("Rename Plot")
        .textField("New Plot Name", plot.name)
        .show(player).then(r => {
            if (r.canceled) return;
            const newName = r.formValues[0].trim();
            if (newName.length > 0 && newName.length <= 30) {
                plot.name = newName;
                player.sendMessage(`§aPlot renamed to §e${newName}§a!`);
            } else {
                player.sendMessage("§cName must be 1-30 characters!");
            }
        });
}

// =================== SERVER INFO ===================
let lastTick = Date.now();
let tps = 20;
let timeArray = [];

system.runInterval(()=>{
    if(timeArray.length===20) timeArray.shift();
    timeArray.push(Math.round(1000/(Date.now()-lastTick)*1)/1);
    tps = timeArray.reduce((a,b)=>a+b)/timeArray.length;
    lastTick = Date.now();
}, 1000);

function ServerInfoMenu(player) {
    const onlinePlayers = world.getAllPlayers().length;
    const date = new Date();
    
    new ActionFormData()
        .title("§bServer Information")
        .body(`\n§7Server Status:\n§eOnline Players: §6${onlinePlayers}/100\n§eServer TPS: §6${tps.toFixed(1)}\n§eServer Time: §6${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`)
        .button("§cServer Rules\n§7Read rules", "textures/ui/icon_rules")
        .button("§6Online Staff\n§7View staff", "textures/items/staff.png")
        .button("§cBack", "textures/ui/back")
        .show(player).then((r) => {
            if (r.canceled) return;
            switch(r.selection) {
                case 0: showServerRules(player); break;
                case 1: showOnlineStaff(player); break;
                case 2: MoltenMenu(player); break;
            }
        });
}

function showServerRules(player) {
    new ActionFormData()
        .title("§cServer Rules")
        .body(`\n§4§lSERVER RULES:\n\n§71. No hacking/cheating\n§72. No harassment\n§73. No advertising\n§74. No exploiting bugs\n§75. Respect all players\n§76. Follow staff instructions`)
        .button("§cBack", "textures/ui/back")
        .show(player).then((r) => {
            if (r.selection === 0) ServerInfoMenu(player);
        });
}

function showOnlineStaff(player) {
    const staff = world.getAllPlayers().filter(p => getScore(p, "staff") > 0);
    
    if (staff.length === 0) {
        player.sendMessage("§eNo staff members online.");
        return;
    }
    
    const staffList = staff.map(s => {
        const rank = getScore(s, "staff");
        const rankName = ["Trainee", "Moderator", "Admin", "Manager", "Owner"][rank-1] || "Staff";
        return `§e${s.name} §7- §6${rankName}`;
    }).join('\n');
    
    new ActionFormData()
        .title("§6Online Staff")
        .body(`\n§7Staff online:\n\n${staffList}`)
        .button("§cBack", "textures/ui/back")
        .show(player).then((r) => {
            if (r.selection === 0) ServerInfoMenu(player);
        });
}

// =================== GAME SETTINGS ===================
function GameSettingsMenu(player) {
    const settings = getPlayerSettings(player);
    
    new ActionFormData()
        .title("§dGame Settings")
        .body(`\n§7Toggle game features:`)
        .button("§cFlight Mode\n§7Toggle flight", "textures/ui/icon_fly")
        .button("§6Night Vision\n§7See in dark", "textures/ui/icon_nightvision")
        .button("§eSpeed Boost\n§7Move faster", "textures/ui/icon_speed")
        .button("§aJump Boost\n§7Jump higher", "textures/ui/icon_jump")
        .button("§bMore Settings\n§7More options", "textures/ui/settings_glyph_color_2x")
        .button("§cBack", "textures/ui/back")
        .show(player).then((r) => {
            if (r.canceled) return;
            if (r.selection === 5) MoltenMenu(player);
            else if (r.selection === 4) GameplaySettingsMenu(player);
            else {
                switch(r.selection) {
                    case 0: toggleFlight(player); break;
                    case 1: toggleNightVision(player); break;
                    case 2: toggleSpeedBoost(player); break;
                    case 3: toggleJumpBoost(player); break;
                }
            }
        });
}

function toggleFlight(player) {
    const settings = getPlayerSettings(player);
    settings.flightMode = !settings.flightMode;
    savePlayerSettings(player, settings);
    
    if (settings.flightMode) {
        player.addEffect("levitation", 999999, { amplifier: 1, showParticles: false });
        player.sendMessage("§aFlight mode §aENABLED§a!");
    } else {
        player.removeEffect("levitation");
        player.sendMessage("§cFlight mode §cDISABLED§c!");
    }
    player.playSound("random.click");
}

function toggleNightVision(player) {
    const settings = getPlayerSettings(player);
    settings.nightVision = !settings.nightVision;
    savePlayerSettings(player, settings);
    
    if (settings.nightVision) {
        player.addEffect("night_vision", 999999, { amplifier: 0, showParticles: false });
        player.sendMessage("§aNight Vision §aENABLED§a!");
    } else {
        player.removeEffect("night_vision");
        player.sendMessage("§cNight Vision §cDISABLED§c!");
    }
    player.playSound("random.click");
}

function toggleSpeedBoost(player) {
    const settings = getPlayerSettings(player);
    settings.speedBoost = !settings.speedBoost;
    savePlayerSettings(player, settings);
    
    if (settings.speedBoost) {
        player.addEffect("speed", 999999, { amplifier: 1, showParticles: false });
        player.sendMessage("§aSpeed Boost §aENABLED§a!");
    } else {
        player.removeEffect("speed");
        player.sendMessage("§cSpeed Boost §cDISABLED§c!");
    }
    player.playSound("random.click");
}

function toggleJumpBoost(player) {
    const settings = getPlayerSettings(player);
    settings.jumpBoost = !settings.jumpBoost;
    savePlayerSettings(player, settings);
    
    if (settings.jumpBoost) {
        player.addEffect("jump_boost", 999999, { amplifier: 1, showParticles: false });
        player.sendMessage("§aJump Boost §aENABLED§a!");
    } else {
        player.removeEffect("jump_boost");
        player.sendMessage("§cJump Boost §cDISABLED§c!");
    }
    player.playSound("random.click");
}

function GameplaySettingsMenu(player) {
    const settings = getPlayerSettings(player);
    
    new ActionFormData()
        .title("§6Gameplay Settings")
        .body(`\n§7Toggle settings:`)
        .button("§cToggle PvP\n§7Allow combat", "textures/ui/icon_pvp")
        .button("§6Damage Numbers\n§7Show damage", "textures/ui/icon_damage")
        .button("§eAuto Respawn\n§7Auto respawn", "textures/ui/icon_respawn")
        .button("§cBack", "textures/ui/back")
        .show(player).then((r) => {
            if (r.canceled) return;
            if (r.selection === 3) GameSettingsMenu(player);
            else {
                switch(r.selection) {
                    case 0: settings.pvpEnabled = !settings.pvpEnabled; player.sendMessage(`§ePvP ${settings.pvpEnabled ? '§aenabled' : '§cdisabled'}§e!`); break;
                    case 1: settings.damageNumbers = !settings.damageNumbers; player.sendMessage(`§eDamage numbers ${settings.damageNumbers ? '§ashown' : '§chidden'}§e!`); break;
                    case 2: settings.autoRespawn = !settings.autoRespawn; player.sendMessage(`§eAuto respawn ${settings.autoRespawn ? '§aenabled' : '§cdisabled'}§e!`); break;
                }
                savePlayerSettings(player, settings);
                player.playSound("random.click");
            }
        });
}

// =================== STAFF PANEL ===================
function StaffPanel(player) {
    const staffLevel = getScore(player, "staff");
    const rankNames = ["Trainee", "Moderator", "Admin", "Manager", "Owner"];
    const staffRank = rankNames[staffLevel - 1] || "Staff";
    
    new ActionFormData()
        .title(`§4Staff Panel - ${staffRank}`)
        .body(`\n§7Welcome §e${player.name}§7!\n§7Staff Level: §6${staffRank}`)
        .button("§cPlayer Management\n§7Manage players", "textures/ui/icon_users")
        .button("§6Server Control\n§7Server commands", "textures/ui/icon_server")
        .button("§eInventory Viewer\n§7View inventories", "textures/ui/strength_effect.png")
        .button("§cBack", "textures/ui/back")
        .show(player).then((r) => {
            if (r.canceled) return;
            switch(r.selection) {
                case 0: PlayerManagement(player); break;
                case 1: ServerControl(player); break;
                case 2: StaffInventoryViewer(player); break;
                case 3: MoltenMenu(player); break;
            }
        });
}

function PlayerManagement(player) {
    const players = world.getAllPlayers().map(p => p.name);
    
    if (players.length === 0) {
        player.sendMessage("§cNo players online.");
        return;
    }
    
    new ModalFormData()
        .title("Player Management")
        .dropdown("Select Player", players)
        .dropdown("Action", ["Kick", "Ban", "Mute", "Teleport", "Clear Inventory"])
        .textField("Reason", "Violating rules")
        .show(player).then(r => {
            if (r.canceled) return;
            
            const targetName = players[r.formValues[0]];
            const action = ["Kick", "Ban", "Mute", "Teleport", "Clear Inventory"][r.formValues[1]];
            const reason = r.formValues[2];
            const target = world.getPlayers({name: targetName})[0];
            
            if (!target) {
                player.sendMessage("§cPlayer not found!");
                return;
            }
            
            switch(action) {
                case "Kick":
                    target.runCommandAsync(`kick "${reason}"`);
                    world.sendMessage(`§c${target.name} was kicked by ${player.name}`);
                    break;
                    
                case "Ban":
                    target.runCommandAsync(`ban "${reason}"`);
                    world.sendMessage(`§c${target.name} was banned by ${player.name}`);
                    break;
                    
                case "Mute":
                    target.addTag("muted");
                    target.sendMessage(`§cYou have been muted by ${player.name}`);
                    player.sendMessage(`§aMuted ${target.name}`);
                    break;
                    
                case "Teleport":
                    target.teleport(player.location);
                    target.sendMessage(`§aTeleported to ${player.name}`);
                    player.sendMessage(`§aTeleported ${target.name} to you`);
                    break;
                    
                case "Clear Inventory":
                    const inventory = target.getComponent("inventory").container;
                    for (let i = 0; i < inventory.size; i++) {
                        inventory.setItem(i);
                    }
                    target.sendMessage(`§cYour inventory was cleared by ${player.name}`);
                    player.sendMessage(`§aCleared ${target.name}'s inventory`);
                    break;
            }
            
            player.playSound("random.orb");
        });
}

function ServerControl(player) {
    new ActionFormData()
        .title("§6Server Control")
        .body(`\n§7Server management:`)
        .button("§cClear Chat\n§7Clear global chat", "textures/ui/confirm")
        .button("§6Broadcast\n§7Send announcement", "textures/ui/icon_broadcast")
        .button("§cBack", "textures/ui/back")
        .show(player).then(r => {
            if (r.canceled) return;
            if (r.selection === 2) StaffPanel(player);
            else if (r.selection === 0) {
                for (const plr of world.getAllPlayers()) {
                    world.sendMessage("\n".repeat(1068));
                    plr.playSound("random.orb");
                }
                world.sendMessage(`§c${player.name} §ehas cleared chat.`);
            } else if (r.selection === 1) {
                new ModalFormData()
                    .title("Broadcast Message")
                    .textField("Message", "Server announcement...")
                    .show(player).then(r => {
                        if (r.canceled) return;
                        const message = r.formValues[0];
                        world.sendMessage(`§6[ANNOUNCEMENT] §e${message}`);
                    });
            }
        });
}

function StaffInventoryViewer(player) {
    const players = world.getAllPlayers()
        .filter(p => p.name !== player.name)
        .map(p => p.name);
    
    if (players.length === 0) {
        player.sendMessage("§cNo other players online.");
        return;
    }
    
    new ModalFormData()
        .title("Inventory Viewer")
        .dropdown("Select Player", players)
        .show(player).then(r => {
            if (r.canceled) return;
            const targetName = players[r.formValues[0]];
            const target = world.getPlayers({name: targetName})[0];
            if (target) {
                const inventory = target.getComponent("inventory").container;
                inventoryView(player, inventory);
            }
        });
}

// Export main function
export { MoltenMenu };
```
