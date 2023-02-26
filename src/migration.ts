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
import Webhook from './models/webhook';
import BannedUsers from './models/bannedUsers';
import BannedServers from './models/bannedServers';
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

	await sequelize.sync({ force: true });

	const serverPath = path.join(__dirname, '../database/servers');
	const allServerFileNames = readdirSync(serverPath).filter(f => f.endsWith('.json'));
	const serverList: string[] = [];
	for (const fileName of allServerFileNames) {

		const server = JSON.parse(readFileSync(`${serverPath}/${fileName}`, 'utf-8'));

		if (serverList.includes(server.serverId)) { continue; }
		serverList.push(server.serverId);

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

		await Promise.all(server.shop.map((r: any) => ShopRole.create({
			id: r.roleId,
			serverId: server.serverId,
			wayOfEarning: r.wayOfEarning,
			requirementNumber: typeof r.requirement === 'number' ? r.requirement : null,
			requirementRank: typeof r.requirement === 'number' ? null : r.requirement,
		})));
	}

	const voteCache = JSON.parse(readFileSync(path.join(__dirname, '../database/voteCache.json'), 'utf-8'));

	const userPath = path.join(__dirname, '../database/profiles');
	const allUserFileNames = readdirSync(userPath).filter(f => f.endsWith('.json'));
	const allMentions: Record<string, Record<string, number[]>> = {};
	const userList: string[] = [];
	const discordUserList: string[] = [];
	const quidList: string[] = [];
	for (const fileName of allUserFileNames) {

		const user = JSON.parse(readFileSync(`${userPath}/${fileName}`, 'utf-8'));
		if (userList.includes(user._id)) { continue; }
		userList.push(user._id);

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
			lastRecordedTopVote: voteCache[`id_${user.userId[0]}`]?.lastRecordedTopVote ?? 0,
			nextRedeemableTopVote: voteCache[`id_${user.userId[0]}`]?.nextRedeemableTopVote ?? 0,
			lastRecordedDiscordsVote: voteCache[`id_${user.userId[0]}`]?.lastRecordedDiscordsVote ?? 0,
			nextRedeemableDiscordsVote: voteCache[`id_${user.userId[0]}`]?.nextRedeemableDiscordsVote ?? 0,
			lastRecordedDblVote: voteCache[`id_${user.userId[0]}`]?.lastRecordedDblVote ?? 0,
			nextRedeemableDblVote: voteCache[`id_${user.userId[0]}`]?.nextRedeemableDblVote ?? 0,
		});

		for (const [discordUserId, server] of Object.entries(user.userIds)) {

			if (discordUserList.includes(discordUserId)) { continue; }
			discordUserList.push(discordUserId);

			await DiscordUser.create({
				id: discordUserId,
				userId: user._id,
			});

			for (const [serverId, information] of Object.entries(server!)) {

				if (!serverList.includes(serverId)) { continue; }
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

				if (!serverList.includes(serverId)) { continue; }
				await GroupToServer.create({
					groupId: groupId,
					serverId: serverId,
					tag: tag,
				});
			}
		}

		for (const [quidId, quid] of Object.entries(user.quids) as [string, any][]) {

			if (quidList.includes(quidId)) { continue; }
			quidList.push(quidId);

			allMentions[quidId] = quid.mentions;

			const newPronouns = (quid.pronounSets as string[][]).filter(set => set.length === 6);
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
				pronouns_en: newPronouns,
				noPronouns_en: quid.pronounSets.length > newPronouns.length,
				proxy_startsWith: quid.proxy.startsWith,
				proxy_endsWith: quid.proxy.endsWith,
				color: quid.color,
			});

			// quidToServer
			for (const profile of Object.values(quid.profiles) as any[]) {

				if (!serverList.includes(profile.serverId)) { continue; }
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
			if (!serverList.includes(serverId)) { continue; }

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

	const webhookCache = JSON.parse(readFileSync(path.join(__dirname, '../database/webhookCache.json'), 'utf-8'));
	for (const [messageId, quidId] of Object.entries(webhookCache) as [string, string][]) {

		const newQuidId = quidId.split('_')[1];
		if (newQuidId === undefined) { continue; }
		if (!quidList.includes(newQuidId)) { continue; }

		await Webhook.create({
			id: messageId,
			quidId: newQuidId,
		});
	}

	// edit friendship, for this all friendships must be collected from above
	for (const [id_1, relationships] of Object.entries(allMentions)) {

		if (!quidList.includes(id_1)) { continue; }
		for (const [id_2, mentions_array] of Object.entries(relationships)) {

			if (!quidList.includes(id_2)) { continue; }
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

	const bannedList = JSON.parse(readFileSync(path.join(__dirname, '../database/bannedList.json'), 'utf-8'));
	for (const userId of bannedList.users) {

		await BannedUsers.create({
			id: userId,
		});
	}
	for (const serverId of bannedList.servers) {

		await BannedServers.create({
			id: serverId,
		});
	}
})();