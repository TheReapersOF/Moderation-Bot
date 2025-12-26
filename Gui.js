import { world, system, Player, EquipmentSlot } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

import { getScore } from "../npcfiles/shop";
import { Bountys } from "../npcfiles/bountys";
import { MainForm as MainFormBP} from "../npcfiles/bp";
import { PrestigeNPC } from "../npcfiles/prestige";
import { achievementsForm } from "../BA/form/achievementsForm";
import { cosmeticui } from "./cosmetics";
import { DonationsUI } from "../npcfiles/donations";
import { inventoryView } from "./inv-see";

// =================== PLOT SYSTEM ===================
const plots = new Map();
const PLOT_RADIUS = 16;
const MAX_PLOT_MEMBERS = 1; // owner + 1

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
        player.sendMessage("§cYou are already in a plot.");
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
        members: []
    });

    player.sendMessage("§aPlot claimed successfully.");
}

function addPlotMember(owner, target) {
    const plot = [...plots.values()].find(p => p.owner === owner.name);
    if (!plot) {
        owner.sendMessage("§cYou do not own a plot.");
        return;
    }

    if (plot.members.length >= MAX_PLOT_MEMBERS) {
        owner.sendMessage("§cYour plot is full.");
        return;
    }

    if (plot.members.includes(target.name)) {
        owner.sendMessage("§cPlayer already added.");
        return;
    }

    plot.members.push(target.name);
    owner.sendMessage(`§aAdded ${target.name} to your plot.`);
    target.sendMessage(`§aYou were added to ${owner.name}'s plot.`);
}

function PlotGUI(player) {
    new ActionFormData()
        .title("§6Plots")
        .button("§aClaim Plot")
        .button("§eAdd Member")
        .button("§cBack")
        .show(player)
        .then(r => {
            if (r.canceled) return;

            if (r.selection === 0) claimPlot(player);
            if (r.selection === 1) openAddMemberGUI(player);
            if (r.selection === 2) Other(player);
        });
}

function openAddMemberGUI(owner) {
    const plot = [...plots.values()].find(p => p.owner === owner.name);
    if (!plot) {
        owner.sendMessage("§cYou do not own a plot.");
        return;
    }

    const players = world.getAllPlayers()
        .filter(p => p.name !== owner.name)
        .map(p => p.name);

    if (players.length === 0) {
        owner.sendMessage("§cNo players online.");
        return;
    }

    new ModalFormData()
        .title("Add Plot Member")
        .dropdown("Select Player", players)
        .show(owner)
        .then(r => {
            if (r.canceled) return;
            const targetName = players[r.formValues[0]];
            const target = world.getPlayers({ name: targetName })[0];
            if (target) addPlotMember(owner, target);
        });
}

// =================== CHEST ITEM HELP ===================
function SlotGrab(slot, x, y, z) {
    const chestLocation = { x, y, z };
    const chest = world.getDimension('overworld').getBlock(chestLocation);
    const chestInventory = chest.getComponent("minecraft:inventory").container;
    return chestInventory.getItem(slot);
}

// =================== MAIN GUI ===================
world.afterEvents.itemUse.subscribe((event) => {
    if (!(event.source instanceof Player)) return;
    if (event.itemStack.typeId == "minecraft:recovery_compass") MainForm(event.source);
});

function MainForm(player) {
    new ActionFormData()
    .title(`§c§h§e§s§6Molten Skygen GUI`)
    .body(`\n§gThis is the Main GUI of Molten Skygen\n\n`)
    .button(`§eQuick Actions\n§7Quick Needs!`, `textures/ui/recipe_book_icon`)
    .button(`§eOther\n§7Other Stuff!`, `textures/ui/icon_random`)
    .button(`§eStaff Only!\n§7Staff Controls!`, `textures/items/staff.png`)
    .button(`§cExit\n§7Close the GUI`, `textures/items/back.png`)
    .show(player).then((r) => {
        if (r.canceled) return;
        if (r.selection === 0) QuickActions(player);
        if (r.selection === 1) Other(player);
        if (r.selection === 2) {
            if (getScore(player, `Staff`) == 0) {
                player.sendMessage(`§cYou do not have access to this Menu.`);
                player.playSound(`note.bass`, {pitch: 0.8});
            } else ModGUI(player);
        }
    });
}

// =================== STAFF GUI ===================
function ModGUI(player) {
    new ActionFormData()
    .title(`§6Staff GUI`)
    .body(`\n§gThis is the Mod GUI for Staff on Bubbles KitPvP.\n\n`)
    .button(`§eStaff Roles\n§7Click to Select!`, `textures/ui/icon_random`)
    .button(`§eView Inventorys\n§7View Inv's!`, `textures/ui/strength_effect.png`)
    .button(`§eClear Chat\n§7Clear Chat!`, `textures/ui/confirm`)
    .button(`§cBack\n§7Back to Main GUI`, `textures/items/back.png`)
    .show(player).then((r) => {
        if (r.canceled) return;
        if (r.selection == 0) StaffRoles(player);
        if (r.selection == 1) {
            const inventory = player.getComponent("inventory").container;
            inventoryView(player, inventory);
        }
        if (r.selection == 2) {
            for (const plr of world.getAllPlayers()) {
                world.sendMessage("\n".repeat(1068));
                plr.playSound("random.orb");
            }
            world.sendMessage(`§c${player.name} §ehas cleared chat.`);
        }
        if (r.selection == 3) MainForm(player);
    });
}

function StaffRoles(player) {
    new ActionFormData()
    .title(`§6Staff Roles`)
    .body(`\n§gSelect your staff role below!\n\n`)
    .button(`§eTrainee\n§7Level One`, `textures/items/utilites.png`)
    .button(`§eModerator\n§7Level Two`, `textures/items/utilites.png`)
    .button(`§eAdmin\n§7Level Three`, `textures/items/utilites.png`)
    .button(`§eManager\n§7Level Four`, `textures/items/utilites.png`)
    .button(`§eOwner\n§7Level Five`, `textures/items/utilites.png`)
    .button(`§cBack\n§7Back to Main GUI`, `textures/items/back.png`)
    .show(player).then((r)=> {
        if (r.canceled) return;
        switch(r.selection) {
            case 0: if(getScore(player,"Staff")==1){world.scoreboard.getObjective("PresetRanks").setScore(player,9); player.sendMessage("§eEquipped Trainee Role"); player.playSound("random.orb")} else {player.sendMessage("§eNo Access"); player.playSound("note.bass",{pitch:0.8})} break;
            case 1: if(getScore(player,"Staff")==2){world.scoreboard.getObjective("PresetRanks").setScore(player,10); player.sendMessage("§eEquipped Moderator Role"); player.playSound("random.orb")} else {player.sendMessage("§eNo Access"); player.playSound("note.bass",{pitch:0.8})} break;
            case 2: if(getScore(player,"Staff")==3){world.scoreboard.getObjective("PresetRanks").setScore(player,11); player.sendMessage("§eEquipped Admin Role"); player.playSound("random.orb")} else {player.sendMessage("§eNo Access"); player.playSound("note.bass",{pitch:0.8})} break;
            case 3: if(getScore(player,"Staff")==4){world.scoreboard.getObjective("PresetRanks").setScore(player,12); player.sendMessage("§eEquipped Manager Role"); player.playSound("random.orb")} else {player.sendMessage("§eNo Access"); player.playSound("note.bass",{pitch:0.8})} break;
            case 4: if(getScore(player,"Staff")==5){world.scoreboard.getObjective("PresetRanks").setScore(player,13); player.sendMessage("§eEquipped Owner Role"); player.playSound("random.orb")} else {player.sendMessage("§eNo Access"); player.playSound("note.bass",{pitch:0.8})} break;
            case 5: ModGUI(player); break;
        }
    });
}

// =================== QUICK ACTIONS ===================
function QuickActions(player) {
    new ActionFormData()
    .title("§6Quick Actions")
    .button("§eBattlepass\n§7Gain Rewards!", "textures/ui/icon_blackfriday")
    .button("§eAchivements\n§7Claim EXP!", "textures/ui/icon_best3")
    .button("§eUtilites\n§7More Actions!", "textures/items/utilites.png")
    .button("§cBack\n§7Back to Main GUI", "textures/items/back.png")
    .show(player).then(r=>{
        if(r.selection===0) MainFormBP(player);
        if(r.selection===1) achievementsForm(player);
        if(r.selection===2) UT(player);
        if(r.selection===3) MainForm(player);
    });
}

// =================== UTILITIES ===================
function MoneyT(player){
    const players = world.getAllPlayers().map(plr => plr.name);
    const form = new ModalFormData()
        .title("§6Money Transfer")
        .dropdown("Select a player", players)
        .textField("Enter Amount", "0");
    form.show(player).then(result=>{
        const [dropdown, textField] = result.formValues;
        const target = world.getPlayers({name: players[dropdown]})[0];
        if(!target) return;
        if(isNaN(textField)) return player.sendMessage("§cNumbers only");
        const amount = parseInt(textField);
        if(amount > getScore(player,"money")) return player.sendMessage("§cInsufficient funds");
        if(target.name===player.name) return player.sendMessage("§cCannot send to self");
        player.runCommandAsync(`scoreboard players remove @s money ${amount}`);
        target.runCommandAsync(`scoreboard players add @s money ${amount}`);
        player.sendMessage(`§aSent ${amount} to ${target.name}`);
        target.sendMessage(`§aReceived ${amount} from ${player.name}`);
    });
}

function UT(player) {
    new ActionFormData()
    .title("§6Utilites")
    .button("§eMoney Transfer\n§7Send Money!", "textures/items/TransferMoney.png")
    .button("§eDaily Quests\n§7Do Quests Daily!", "textures/items/coin.png")
    .button("§eBounties\n§7Make a target!", "textures/items/crossbow_firework")
    .button("§ePrestige\n§7Level Up!", "textures/ui/icon_deals")
    .button("§cBack\n§7Back to Main GUI", "textures/items/back.png")
    .show(player).then(r=>{
        if(r.selection===0) MoneyT(player);
        if(r.selection===1) DailyQuests(player);
        if(r.selection===2) Bountys(player);
        if(r.selection===3) PrestigeNPC(player);
        if(r.selection===4) QuickActions(player);
    });
}

function DailyQuests(player) {
    player.sendMessage("§eDaily quests are not implemented yet.");
}

// =================== OTHER GUI ===================
function Other(player) {
    new ActionFormData()
    .title("§6Misc")
    .button("§eServer Info\n§7Server Info!", "textures/ui/mashup_PaintBrush")
    .button("§eDiscord Kit\n§7Find Code in Disc!", "textures/ui/icon_recipe_equipment")
    .button("§eStarter Kit\n§7Click to get the Kit!", "textures/items/chainmail_chestplate")
    .button("§eRules\n§7Server Rules!", "textures/items/book_writable")
    .button("§ePlots\n§7Manage your plot", "textures/ui/icon_recipe_construction")
    .button("§cBack\n§7Back to Main GUI", "textures/items/back.png")
    .show(player).then(r=>{
        if(r.canceled) return;
        if(r.selection===0) SI(player);
        if(r.selection===1) DK(player);
        if(r.selection===2) starterKit(player);
        if(r.selection===3) Rules(player);
        if(r.selection===4) PlotGUI(player);
        if(r.selection===5) MainForm(player);
    });
}

function starterKit(player){
    const equipSlot = [EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet];
    if (!equipSlot.some(slot=>player.getComponent("equippable").getEquipment(slot)) &&
        !player.getComponent("inventory").container.getItem(0) &&
        !player.getComponent("inventory").container.getItem(1)) {
        player.getComponent("equippable").setEquipment(EquipmentSlot.Head, SlotGrab(0,4999,4,500));
        player.getComponent("equippable").setEquipment(EquipmentSlot.Chest, SlotGrab(1,4999,4,500));
        player.getComponent("equippable").setEquipment(EquipmentSlot.Legs, SlotGrab(2,4999,4,500));
        player.getComponent("equippable").setEquipment(EquipmentSlot.Feet, SlotGrab(3,4999,4,500));
        player.getComponent("inventory").container.addItem(SlotGrab(4,4999,4,500));
        player.getComponent("inventory").container.addItem(SlotGrab(5,4999,4,500));
    } else {
        player.sendMessage("§7Armor or first 2 hotbar slots are filled");
        player.playSound("note.bass",{pitch:0.8});
    }
}

// =================== DISCORD KIT ===================
function DK(player) {
    const form = new ModalFormData();
    form.title("§6Discord Kit");
    form.textField("Enter Discord Code", "§ePut The Code Here!");
    form.show(player).then(r=>{
        if(r.canceled) return;
        if(r.formValues[0]==="bubsreturned" && !player.hasTag("DKClaimed")){
            world.scoreboard.getObjective("Money").addScore(player,5000);
            player.sendMessage("§aClaimed!");
            player.playSound("random.levelup");
            player.addTag("DKClaimed");
        } else if(player.hasTag("DKClaimed") && r.formValues[0]==="bubsreturned"){
            player.sendMessage("§cAlready claimed!");
            player.playSound("note.bass",{pitch:0.8});
        } else {
            player.sendMessage("§cWrong code!");
            player.playSound("note.bass",{pitch:0.8});
        }
    });
}

// =================== RULES ===================
function Rules(player){
    new ActionFormData()
    .title("§6Rules")
    .button("§gServer Rules", "textures/items/book_enchanted")
    .button("§gPvP Rules", "textures/items/book_enchanted")
    .button("§eBack", "textures/items/back.png")
    .show(player).then(r=>{
        if(r.canceled) return;
        if(r.selection===0) ServerRules(player);
        if(r.selection===1) PVPRules(player);
        if(r.selection===2) Other(player);
    });
}

function ServerRules(player){
    new ActionFormData()
    .title("§6Server Rules")
    .body("§71. No Cheats\n§72. No Stat Farming\n§73. No Toxicity\n§74. No Chat Spam\n§75. No Racism\n§76. No Pretending Staff\n§77. No Scamming")
    .button("§eBack", "textures/items/back.png")
    .show(player).then(r=>{if(r.selection===0) Rules(player)});
}

function PVPRules(player){
    new ActionFormData()
    .title("§6PvP Rules")
    .body("§71. No misc items in PvP except Fishing Rod\n§72. CPS Limit 15\n§73. No stealing loot")
    .button("§eBack", "textures/items/back.png")
    .show(player).then(r=>{if(r.selection===0) Rules(player)});
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

function SI(player){
    new ActionFormData()
    .title("§6Server Info")
    .button("§eTPS", "textures/items/goat_horn")
    .button("§eUpdates", "textures/items/book_written")
    .button("§eDonations", "textures/ui/confirm")
    .button("§cBack", "textures/items/back.png")
    .show(player).then(r=>{
        if(r.selection===0) player.sendMessage(`§6${tps.toFixed
