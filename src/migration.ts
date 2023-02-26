import { Sequelize } from 'sequelize-typescript';
// import { userModel } from './models/userModel';
// import serverModel from './models/serverModel';
import Server from './models/server';
import path from 'path';
import { readdirSync, readFileSync } from 'fs';
import Den from './models/den';
import ShopRole from './models/shopRole';
import ProxyLimits from './models/proxyLimits';
import User from './models/user';
import DiscordUser from './models/discordUser';
import ServerToDiscordUser from './models/serverToDiscordUser';
import Quid from './models/quid';
import Group from './models/group';
import GroupToServer from './models/groupToServer';
import QuidToServer from './models/quidToServer';
import TemporaryStatIncrease from './models/temporaryStatIncrease';
import QuidToServerToShopRole from './models/quidToServerToShopRole';
import GroupToQuid from './models/groupToQuid';
import UserToServer from './models/userToServer';
import Friendship from './models/friendship';
const { database_password } = require('../config.json');

const tablePath = path.join(__dirname, './models/');
const sequelize = new Sequelize('pnp', 'postgres', database_password, {
	host: 'localhost',
	dialect: 'postgres',
	define: {
		freezeTableName: true,
	},
	models: readdirSync(tablePath).map(el => tablePath + el),
});

(async () => {

	await sequelize.sync();

	const serverPath = path.join(__dirname, '../database/servers');
	const allServerFileNames = readdirSync(serverPath).filter(f => f.endsWith('.json'));
	for (const fileName of allServerFileNames) {
		const server = JSON.parse(readFileSync(`${serverPath}/${fileName}`, 'utf-8'));

		const sleepingDen = await Den.create({
			structure: server.dens.sleepingDens.structure,
			bedding: server.dens.sleepingDens.bedding,
			thickness: server.dens.sleepingDens.thickness,
			evenness: server.dens.sleepingDens.evenness,
		});
		const medicineDen = await Den.create({
			structure: server.dens.medicineDen.structure,
			bedding: server.dens.medicineDen.bedding,
			thickness: server.dens.medicineDen.thickness,
			evenness: server.dens.medicineDen.evenness,
		});
		const foodDen = await Den.create({
			structure: server.dens.foodDen.structure,
			bedding: server.dens.foodDen.bedding,
			thickness: server.dens.foodDen.thickness,
			evenness: server.dens.foodDen.evenness,
		});

		const channelLimits = await ProxyLimits.create({
			setToWhitelist: server.proxySettings.channels.setTo === 1,
			whitelist: server.proxySettings.channels.whitelist,
			blacklist: server.proxySettings.channels.blacklist,
		});

		const roleLimits = await ProxyLimits.create({
			setToWhitelist: server.proxySettings.roles.setTo === 1,
			whitelist: server.proxySettings.roles.whitelist,
			blacklist: server.proxySettings.roles.blacklist,
		});

		await Server.create({
			id: server.serverId,
			name: server.name,
			nextPossibleAttackTimestamp: server.nextPossibleAttack,
			visitChannelId: server.visitChannelId,
			currentlyVisitingChannelId: server.currentlyVisiting,
			skills: server.skills,
			proxy_logChannelId: server.proxySettings.logChannelId,
			proxy_requireTag: server.proxySettings.tagRequired,
			proxy_requireTagInDisplayname: server.proxySettings.tagInDisplayname,
			proxy_possibleTags: server.proxySettings.requiredInTag,
			proxy_channelLimitsId: channelLimits.id,
			proxy_roleLimitsId: roleLimits.id,
			inventory: Object.entries(Object.assign({}, ...Object.values(server.inventory))).flatMap(([key, value]) => Array(value).fill(key)),
			sleepingDenId: sleepingDen.id,
			medicineDenId: medicineDen.id,
			foodDenId: foodDen.id,
		});

		await Promise.all(server.roles.map((r: any) => ShopRole.create({
			id: r.roleId,
			serverId: server.serverId,
			wayOfEarning: r.wayOfEarning,
			requirementNumber: typeof r.requirement === 'number' ? r.requirement : null,
			requirementRank: typeof r.requirement === 'number' ? null : r.requirement,
		})));
	}

	const userPath = path.join(__dirname, '../database/profiles');
	const allUserFileNames = readdirSync(userPath).filter(f => f.endsWith('.json'));
	const allMentions: Record<string, Record<string, number[]>> = {};
	for (const fileName of allUserFileNames) {

		const user = JSON.parse(readFileSync(`${userPath}/${fileName}`, 'utf-8'));

		const newUser = await User.create({
			id: user._id,
			advice_resting: user.advice.resting,
			advice_eating: user.advice.eating,
			advice_drinking: user.advice.drinking,
			advice_passingOut: user.advice.passingout,
			advice_coloredButtons: user.advice.coloredbuttons,
			advice_sapling: user.advice.ginkgosapling,
			reminders_water: user.settings.reminders.water,
			reminders_resting: user.settings.reminders.resting,
			proxy_globalAutoproxy: user.settings.proxy.global.autoproxy,
			proxy_globalStickymode: user.settings.proxy.global.stickymode,
			proxy_lastGlobalProxiedQuidId: null,
			accessibility_replaceEmojis: user.settings.accessibility.replaceEmojis,
			tag: user.tag.global,
			lastPlayedVersion: user.lastPlayedVersion,
			antiproxy_startsWith: user.antiproxy.startsWith,
			antiproxy_endsWith: user.antiproxy.endsWith,
		});

		for (const [discordUserId, server] of Object.entries(user.userIds)) {

			await DiscordUser.create({
				id: discordUserId,
				userId: user._id,
			});

			for (const [serverId, information] of Object.entries(server!)) {

				await ServerToDiscordUser.create({
					discordUserId: discordUserId,
					serverId: serverId,
					isMember: information.isMember,
					lastUpdatedTimestamp: information.lastUpdatedTimestamp,
				});
			}
		}

		for (const [groupId, group] of Object.entries(user.groups) as [string, any][]) {

			await Group.create({
				id: groupId,
				userId: user._id,
				name: group.name,
				tag: group.tag.global,
			});

			for (const [serverId, tag] of Object.entries(group.tag.servers) as [string, string][]) {

				await GroupToServer.create({
					groupId: groupId,
					serverId: serverId,
					tag: tag,
				});
			}
		}

		for (const [quidId, quid] of Object.entries(user.quids) as [string, any][]) {

			allMentions[quidId] = quid.mentions;

			await Quid.create({
				id: quidId,
				userId: user._id,
				mainGroupId: quid.mainGroup,
				name: quid.name,
				nickname: quid.nickname.global,
				species: quid.species,
				displayedSpecies: quid.displayedSpecies,
				description: quid.description,
				avatarURL: quid.avatarURL,
				pronouns_en: quid.pronounSets,
				proxy_startsWith: quid.proxy.startsWith,
				proxy_endsWith: quid.proxy.endsWith,
				color: quid.color,
			});

			// quidToServer
			for (const profile of Object.values(quid.profiles) as any[]) {

				const quidToServer = await QuidToServer.create({
					quidId: quidId,
					serverId: profile.serverId,
					rank: profile.rank,
					levels: profile.levels,
					experience: profile.experience,
					health: profile.health,
					energy: profile.energy,
					hunger: profile.hunger,
					thirst: profile.thirst,
					maxHealth: profile.maxHealth,
					maxEnergy: profile.maxEnergy,
					maxHunger: profile.maxHunger,
					maxThirst: profile.maxThirst,
					hasQuest: profile.hasQuest,
					unlockedRanks: profile.unlockedRanks,
					tutorials_play: profile.tutorials.play,
					tutorials_explore: profile.tutorials.explore,
					currentRegion: profile.currentRegion,
					sapling_exists: profile.sapling.exists,
					sapling_health: profile.sapling.health,
					sapling_waterCycles: profile.sapling.waterCycles,
					sapling_nextWaterTimestamp: profile.sapling.nextWaterTimestamp,
					sapling_lastChannelId: profile.sapling.lastMessageChannelId,
					sapling_sentReminder: profile.sapling.sentReminder,
					sapling_sentGentleReminder: profile.sapling.sentGentleReminder,
					injuries_wounds: profile.injuries.wounds,
					injuries_infections: profile.injuries.infections,
					injuries_cold: profile.injuries.cold,
					injuries_sprains: profile.injuries.sprains,
					injuries_poison: profile.injuries.poison,
					inventory: Object.entries(Object.assign({}, ...Object.values(profile.inventory))).flatMap(([key, value]) => Array(value).fill(key)),
					skills_global: JSON.stringify(profile.skills.global),
					skills_personal: JSON.stringify(profile.skills.global),
					lastActiveTimestamp: profile.lastActiveTimestamp,
					passedOutTimestamp: profile.passedOutTimestamp,
				});

				// temporaryStatIncrease
				for (const [timestamp, statKind] of Object.entries(profile.temporaryStatIncrease)) {

					await TemporaryStatIncrease.create({
						quidToServerId: quidToServer.id,
						startedTimestamp: Number(timestamp),
						type: statKind,
					});
				}

				for (const shopRole of profile.roles) {

					await QuidToServerToShopRole.create({
						quidToServerId: quidToServer.id,
						shopRoleId: shopRole.roleId,
					});
				}
			}
		}

		// groupToQuid
		for (const groupQuid of user.group_quid) {

			await GroupToQuid.create({
				groupId: groupQuid.groupId,
				quidId: groupQuid.quidId,
			});
		}

		for (const [serverId, server] of Object.entries(user.servers) as [string, any][]) {

			if (serverId === 'DMs') {

				newUser.proxy_lastGlobalProxiedQuidId = server.lastProxied;
				await newUser.save();
				continue;
			}

			// userToServer
			await UserToServer.create({
				userId: user._id,
				serverId: serverId,
				lastProxiedQuidId: server.lastProxied,
				activeQuidId: server.currentQuid,
				autoproxy_setToWhitelist: user.settings.proxy.servers[serverId]?.autoproxy.setTo === 2 ? true : user.settings.proxy.servers[serverId]?.autoproxy.setTo === 3 ? false : null,
				autoproxy_whitelist: user.settings.proxy.servers[serverId]?.autoproxy.channels.whitelist ?? [],
				autoproxy_blacklist: user.settings.proxy.servers[serverId]?.autoproxy.channels.blacklist ?? [],
				stickymode_setTo: user.settings.proxy.servers[serverId]?.stickymode === 2 ? true : user.settings.proxy.servers[serverId]?.stickymode === 3 ? false : null,
				tag: user.tag.servers[serverId] ?? '',
				lastInteraction_timestamp: server.lastInteractionTimestamp,
				lastInteraction_channelId: server.lastInteractionChannelId,
				resting_messageId: server.restingMessageId,
				resting_channelId: server.restingChannelId,
				componentDisabling_channelId: server.componentDisablingChannelId,
				componentDisabling_messageId: server.componentDisablingMessageId,
				hasCooldown: server.hasCooldown,
			});
		}
	}

	// edit friendship, for this all friendships must be collected from above
	for (const [id_1, relationships] of Object.entries(allMentions)) {

		for (const [id_2, mentions_array] of Object.entries(relationships)) {

			const mentions_array_2 = allMentions[id_2]?.[id_1] ?? [];

			await Friendship.create({
				quidId_1: id_1,
				quidId_2: id_2,
				quid_1_mentions: mentions_array,
				quid_2_mentions: mentions_array_2,
			});

			delete allMentions[id_2]?.[id_1];
		}
	}

	// voteCache needs to be added to the User model
	// webhookCache needs to be added, where the messageId is the main ID and there is only one other column which is a quidId (this is a one to many relationship)
	// bannedList needs to be added
	// errorStacks needs to be created (but not migrated), but this table should also have "isReported" and "version" columns. This way, repeating errors don't need to be stored twice, if the same error happens several times within the same version, it can just use the same id. When someone reports it, it gets updated, and every other person that tries to report it gets a message saying it's already been reported, and if the error occurs after it's been reported, it can just say a known error has occured and a fix is being worked on. also if i click reject. it isReported goes back to false
})();