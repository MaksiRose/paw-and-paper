import { generateId } from 'crystalid';
import { AttachmentBuilder, SlashCommandBuilder } from 'discord.js';
import { Op } from 'sequelize';
import { request } from 'undici';
import { speciesInfo } from '../../cluster';
import BannedUser from '../../models/bannedUser';
import DiscordUser from '../../models/discordUser';
import DiscordUserToServer from '../../models/discordUserToServer';
import Friendship from '../../models/friendship';
import Group from '../../models/group';
import GroupToQuid from '../../models/groupToQuid';
import GroupToServer from '../../models/groupToServer';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import QuidToServerToShopRole from '../../models/quidToServerToShopRole';
import Server from '../../models/server';
import ShopRole from '../../models/shopRole';
import TemporaryStatIncrease from '../../models/temporaryStatIncrease';
import User, { ProxySetTo } from '../../models/user';
import UserToServer, { AutoproxySetTo } from '../../models/userToServer';
import Webhook from '../../models/webhook';
import { CurrentRegionType, RankType, StatIncreaseType } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { addCommasAndAnd, getMessageId, isObject, keyInObject, now, respond, valueInObject } from '../../utils/helperFunctions';
import { createId } from '../quid_customization/name';
const { version } = require('../../../package.json');

const snowflakeCheck = /^\d{16,20}(?![\d\D])$/;

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('data')
		.setDescription('Import or export data into or from your account')
		.setDMPermission(false)
		.addSubcommand(option =>
			option.setName('import')
				.setDescription('Import data into your account or create an account based on imported data')
				.addAttachmentOption(option =>
					option.setName('attachment')
						.setDescription('JSON file to import data from')
						.setRequired(true)))
		.addSubcommand(option =>
			option.setName('export')
				.setDescription('Export data from your account'))
		.toJSON(),
	category: 'page3',
	position: 2,
	disablePreviousCommand: true,
	modifiesServerProfile: true,
	sendCommand: async (interaction, { user, discordUser }) => {

		if (interaction.options.getSubcommand(true) === 'export') {

			if (!user) { return; }
			const bufferedUserData = await exportData(user);

			// Reply
			await respond(interaction, {
				content: 'Exported data: ',
				files: [new AttachmentBuilder(bufferedUserData)
					.setName('userData.json')],
			});
			return;
		}

		const bannedUser = await BannedUser.findByPk(interaction.user.id);
		if (bannedUser !== null) {

			// This should always be a reply
			await respond(interaction, {
				content: 'I am sorry to inform you that you have been banned from using this bot.',
				ephemeral: true,
			});
			return;
		}

		const attachment = interaction.options.getAttachment('attachment');
		if (!attachment) {

			// This is always a reply
			await respond(interaction, {
				content: 'Please attach a file to import data from!',
				ephemeral: true,
			});
			return;
		}

		const mimeType = attachment.contentType;
		if (!mimeType || mimeType.toLowerCase().includes('json') === false) {

			// This is always a reply
			await respond(interaction, {
				content: 'The attachment you uploaded is not a json file!',
				ephemeral: true,
			});
			return;
		}

		const { statusCode, body } = await request(attachment.url);

		if (statusCode !== 200) {

			// This is always a reply
			await respond(interaction, {
				content: 'The attachment couldn\'t be fetched!',
				ephemeral: true,
			});
			return;
		}

		const data = await body.json().catch(() => { return null; });

		if (!isObject(data)) {

			// This is always a reply
			await respond(interaction, {
				content: 'The attachment is not valid json!',
				ephemeral: true,
			});
			return;
		}

		// This is always a reply
		const botReply = await respond(interaction, {
			content: 'Loading...',
		});

		const updates = {
			createdAccount: false,
			updatedAccount: false,
			startedServerInfo: 0,
			endedServerInfo: 0,
		};

		if (!user) {

			user = await User.create({
				id: generateId(),
				lastPlayedVersion: `${version.split('.').slice(0, -1).join('.')}`,
			});
			updates.createdAccount = true;
		}

		if (isObject(data.user)) {

			await user.update({
				accessibility_replaceEmojis: typeof data.user.accessibility_replaceEmojis === 'boolean' ? data.user.accessibility_replaceEmojis : undefined,
				advice_coloredButtons: typeof data.user.advice_coloredButtons === 'boolean' ? data.user.advice_coloredButtons : undefined,
				advice_drinking: typeof data.user.advice_drinking === 'boolean' ? data.user.advice_drinking : undefined,
				advice_eating: typeof data.user.advice_eating === 'boolean' ? data.user.advice_eating : undefined,
				advice_passingOut: typeof data.user.advice_passingOut === 'boolean' ? data.user.advice_passingOut : undefined,
				advice_resting: typeof data.user.advice_resting === 'boolean' ? data.user.advice_resting : undefined,
				advice_sapling: typeof data.user.advice_sapling === 'boolean' ? data.user.advice_sapling : undefined,
				antiproxies: Array.isArray(data.user.antiproxies) && data.user.antiproxies.every((v): v is string[] => Array.isArray(v) && v.length === 2 && v.every((v2): v2 is string => typeof v2 === 'string')) ? data.user.antiproxies : undefined,
				lastPlayedVersion: typeof data.user.lastPlayedVersion === 'string' ? data.user.lastPlayedVersion : undefined,
				lastRecordedDblVote: typeof data.user.lastRecordedDblVote === 'number' ? data.user.lastRecordedDblVote : undefined,
				lastRecordedDiscordsVote: typeof data.user.lastRecordedDiscordsVote === 'number' ? data.user.lastRecordedDiscordsVote : undefined,
				lastRecordedTopVote: typeof data.user.lastRecordedTopVote === 'number' ? data.user.lastRecordedTopVote : undefined,
				nextRedeemableDblVote: typeof data.user.nextRedeemableDblVote === 'number' ? data.user.nextRedeemableDblVote : undefined,
				nextRedeemableDiscordsVote: typeof data.user.nextRedeemableDiscordsVote === 'number' ? data.user.nextRedeemableDiscordsVote : undefined,
				nextRedeemableTopVote: typeof data.user.nextRedeemableTopVote === 'number' ? data.user.nextRedeemableTopVote : undefined,
				proxy_editing: typeof data.user.proxy_editing === 'boolean' ? data.user.proxy_editing : undefined,
				proxy_keepInMessage: typeof data.user.proxy_keepInMessage === 'boolean' ? data.user.proxy_keepInMessage : undefined,
				proxy_setTo: valueInObject(ProxySetTo, data.user.proxy_setTo) ? data.user.proxy_setTo : undefined,
				reminders_resting: typeof data.user.reminders_resting === 'boolean' ? data.user.reminders_resting : undefined,
				reminders_water: typeof data.user.reminders_water === 'boolean' ? data.user.reminders_water : undefined,
				tag: typeof data.user.tag === 'string' ? data.user.tag : undefined,
			});
			updates.updatedAccount = true;
		}

		if (Array.isArray(data.userToServers)) {

			for (const userToServer of data.userToServers) {

				updates.startedServerInfo += 1;
				if (isObject(userToServer) && typeof userToServer.id === 'string' && typeof userToServer.serverId === 'string' && snowflakeCheck.test(userToServer.serverId)) {

					const server = await Server.findByPk(userToServer.serverId, { attributes: ['id'] });
					if (server === null) { continue; }

					const [uts] = await UserToServer.findOrCreate({ where: { id: userToServer.id }, defaults: { id: generateId(), userId: user.id, serverId: userToServer.serverId } });
					await uts.update({
						autoproxy_setTo: valueInObject(AutoproxySetTo, userToServer.autoproxy_setTo) ? userToServer.autoproxy_setTo : undefined,
						autoproxy_setToWhitelist: typeof userToServer.autoproxy_setToWhitelist === 'boolean' ? userToServer.autoproxy_setToWhitelist : undefined,
						autoproxy_whitelist: Array.isArray(userToServer.autoproxy_whitelist) && userToServer.autoproxy_whitelist.every((v): v is string => typeof v === 'string') ? userToServer.autoproxy_whitelist : undefined,
						autoproxy_blacklist: Array.isArray(userToServer.autoproxy_blacklist) && userToServer.autoproxy_blacklist.every((v): v is string => typeof v === 'string') ? userToServer.autoproxy_blacklist : undefined,
						tag: typeof userToServer.tag === 'string' ? userToServer.tag : undefined,
						lastInteraction_timestamp: typeof userToServer.lastInteraction_timestamp === 'number' || userToServer.lastInteraction_timestamp === null ? userToServer.lastInteraction_timestamp : undefined,
						lastInteraction_channelId: typeof userToServer.lastInteraction_channelId === 'string' || userToServer.lastInteraction_channelId === null ? userToServer.lastInteraction_channelId : undefined,
						resting_messageId: typeof userToServer.resting_messageId === 'string' || userToServer.resting_messageId === null ? userToServer.resting_messageId : undefined,
						resting_channelId: typeof userToServer.resting_channelId === 'string' || userToServer.resting_channelId === null ? userToServer.resting_channelId : undefined,
						hasCooldown: typeof userToServer.hasCooldown === 'boolean' ? userToServer.hasCooldown : undefined,
					})
						.then(() => { updates.endedServerInfo += 1; })
						.catch(() => { return null; });

				}
			}
		}

		const discordUserIds: string[] = [interaction.user.id];

		if (!discordUser) {

			discordUser = await DiscordUser.create({ id: interaction.user.id, userId: user.id });

			if (interaction.inGuild()) {

				await DiscordUserToServer.create({ id: generateId(), discordUserId: interaction.user.id, serverId: interaction.guildId, isMember: true, lastUpdatedTimestamp: now() });
			}
		}

		if (Array.isArray(data.discordUsers)) {

			for (const du of data.discordUsers) {

				if (isObject(du) && typeof du.id === 'string' && snowflakeCheck.test(du.id)) {

					const [, created] = await DiscordUser.findOrCreate({ where: { id: du.id }, defaults: { id: du.id, userId: user.id } })
						.catch(() => { return [null, false]; });
					if (created) { discordUserIds.push(du.id); }
				}
			}
		}

		// pluralkit
		if (Array.isArray(data.accounts)) {

			for (const account of data.accounts) {

				if (typeof account === 'number') {

					const id = String(account);
					if (snowflakeCheck.test(id) === false) { continue; }

					const [, created] = await DiscordUser.findOrCreate({ where: { id: id }, defaults: { id: id, userId: user.id } })
						.catch(() => { return [null, false]; });
					if (created) { discordUserIds.push(id); }
				}
			}
		}

		if (Array.isArray(data.discordUsersToServers)) {

			for (const discordUserToServer of data.discordUsersToServers) {

				if (isObject(discordUserToServer) && typeof discordUserToServer.id === 'string' && typeof discordUserToServer.discordUserId === 'string' && snowflakeCheck.test(discordUserToServer.discordUserId) && typeof discordUserToServer.serverId === 'string' && snowflakeCheck.test(discordUserToServer.serverId)) {

					const du = await DiscordUser.findByPk(discordUserToServer.discordUserId, { attributes: ['id'] });
					if (!du) { continue; }
					const s = await Server.findByPk(discordUserToServer.serverId, { attributes: ['id'] });
					if (!s) { continue; }

					const [duts] = await DiscordUserToServer.findOrCreate({ where: { id: discordUserToServer.id }, defaults: { id: generateId(), discordUserId: discordUserToServer.discordUserId, serverId: discordUserToServer.serverId } })
						.catch(() => { return [null]; });
					await duts?.update({
						isMember: typeof discordUserToServer.isMember === 'boolean' ? discordUserToServer.isMember : undefined,
						lastUpdatedTimestamp: typeof discordUserToServer.lastUpdatedTimestamp === 'number' ? discordUserToServer.lastUpdatedTimestamp : undefined,
					})
						.catch(() => { return null; });
				}
			}
		}

		const quidIdTransfer: { oldId: string, newId: string; }[] = [];
		if (Array.isArray(data.quids)) {

			for (const quid of data.quids) {

				if (isObject(quid) && typeof quid.id === 'string' && typeof quid.name === 'string' && quid.name.length > 0) {

					const otherQG = await Quid.findByPk(quid.id, { attributes: ['id'] }) ?? await Group.findByPk(quid.id, { attributes: ['id'] });

					let q = await Quid.create({ id: otherQG ? await createId() : quid.id, userId: user.id, name: quid.name })
						.catch(() => { return null; });
					q = await q?.update({
						nickname: typeof quid.nickname === 'string' ? quid.nickname : undefined,
						species: typeof quid.species === 'string' && keyInObject(speciesInfo, quid.species) ? quid.species : undefined,
						displayedSpecies: typeof quid.displayedSpecies === 'string' ? quid.displayedSpecies : undefined,
						description: typeof quid.description === 'string' ? quid.description : undefined,
						avatarURL: typeof quid.avatarURL === 'string' ? quid.avatarURL : undefined,
						pronouns_en: Array.isArray(quid.pronouns_en) && quid.pronouns_en.every((v): v is string[] => Array.isArray(v) && v.length === 6 && v.every((v2): v2 is string => typeof v2 === 'string')) ? quid.pronouns_en : undefined,
						noPronouns_en: typeof quid.noPronouns_en === 'boolean' ? quid.noPronouns_en : undefined,
						proxies: Array.isArray(quid.proxies) && quid.proxies.every((v): v is string[] => Array.isArray(v) && v.length === 2 && v.every((v2): v2 is string => typeof v2 === 'string')) ? quid.proxies : undefined,
						color: typeof quid.color === 'string' && quid.color.startsWith('#') ? quid.color as `#${string}` : undefined,
					})
						.catch(() => { return null; }) ?? null;
					if (!q) { continue; }

					quidIdTransfer.push({ oldId: quid.id, newId: q.id });

					if (isObject(data.user)) {
						if (data.user.lastGlobalActiveQuidId === quid.id) { user.lastGlobalActiveQuidId = q.id; }
						if (data.user.proxy_lastGlobalProxiedQuidId === quid.id) { user.proxy_lastGlobalProxiedQuidId = q.id; }
						await user.save()
							.catch(() => { return null; });
					}

					if (Array.isArray(data.userToServers)) {
						for (const userToServer of data.userToServers) {
							if (isObject(userToServer) && typeof userToServer.serverId === 'string' && snowflakeCheck.test(userToServer.serverId)) {

								const server = await Server.findByPk(userToServer.serverId, { attributes: ['id'] });
								if (server === null) { continue; }

								const uts = await UserToServer.findOne({ where: { userId: user.id, serverId: userToServer.serverId } });
								if (!uts) { continue; }

								if (userToServer.lastProxiedQuidId === quid.id) { uts.lastProxiedQuidId = q.id; }
								if (userToServer.activeQuidId === quid.id) { uts.activeQuidId = q.id; }
								await uts.save()
									.catch(() => { return null; });
							}
						}
					}
				}
			}
		}

		// pluralkit
		if (Array.isArray(data.members)) {

			for (const member of data.members) {

				if (isObject(member) && typeof member.id === 'string' && typeof member.name === 'string' && member.name.length > 0) {

					let q = await Quid.create({ id: await createId(), userId: user.id, name: member.name })
						.catch(() => { return null; });
					q = await q?.update({
						nickname: typeof member.display_name === 'string' ? member.display_name : undefined,
						description: (typeof member.description === 'string' ? member.description : '') + (typeof member.birthday === 'string' ? `\nBirthday: ${member.birthday}` : '') + (typeof member.pronouns === 'string' ? `\nPronouns: ${member.pronouns}` : ''),
						avatarURL: typeof member.avatar_url === 'string' ? member.avatar_url : undefined,
						proxies: Array.isArray(member.proxy_tags) && member.proxy_tags.every((v): v is {prefix: string | null, suffix: string | null} => isObject(v) && (typeof v.prefix === 'string' || v.prefix === null) && (typeof v.suffix === 'string' || v.suffix === null)) ? member.proxy_tags.map(v => [v.prefix ?? '', v.suffix ?? '']) : undefined,
						color: typeof member.color === 'string' ? `#${member.color}` : undefined,
					})
						.catch(() => { return null; }) ?? null;

					if (!q) { continue; }

					quidIdTransfer.push({ oldId: member.id, newId: q.id });
				}
			}
		}

		// tupperbox
		if (Array.isArray(data.tuppers)) {

			for (const tupper of data.tuppers) {

				if (isObject(tupper) && typeof tupper.id === 'number' && typeof tupper.name === 'string' && tupper.name.length > 0) {

					let q = await Quid.create({ id: await createId(), userId: user.id, name: tupper.name })
						.catch(() => { return null; });
					q = await q?.update({
						nickname: typeof tupper.nick === 'string' ? tupper.nick : undefined,
						description: (typeof tupper.description === 'string' ? tupper.description : '') + (typeof tupper.birthday === 'string' ? `\nBirthday: ${tupper.birthday}` : ''),
						avatarURL: typeof tupper.avatar_url === 'string' ? tupper.avatar_url : undefined,
						proxies: Array.isArray(tupper.brackets) && tupper.brackets.length === 2 && tupper.brackets.every((v): v is string => typeof v === 'string') ? [tupper.brackets] : undefined,
					})
						.catch(() => { return null; }) ?? null;

					if (!q) { continue; }

					quidIdTransfer.push({ oldId: String(tupper.id), newId: q.id });
				}

				if (isObject(tupper) && typeof tupper.user_id === 'string' && !discordUserIds.includes(tupper.user_id)) {

					const [, created] = await DiscordUser.findOrCreate({ where: { id: tupper.user_id }, defaults: { id: tupper.user_id, userId: user.id } })
						.catch(() => { return [null, false]; });
					if (created) { discordUserIds.push(tupper.user_id); }
				}
			}
		}

		if (Array.isArray(data.webhooks)) {

			for (const webhook of data.webhooks) {

				if (isObject(webhook) && typeof webhook.id === 'string' && snowflakeCheck.test(webhook.id) && typeof webhook.quidId === 'string' && typeof webhook.discordUserId === 'string' && snowflakeCheck.test(webhook.discordUserId)) {

					const newQuidId = quidIdTransfer.find(obj => obj.oldId === webhook.quidId)?.newId;
					const newQuid = await Quid.findByPk(newQuidId ?? webhook.quidId, { attributes: ['id'] });
					if (!newQuid) { continue; }

					if (!discordUserIds.includes(webhook.discordUserId)) {

						const [, created] = await DiscordUser.findOrCreate({ where: { id: webhook.discordUserId }, defaults: { id: webhook.discordUserId, userId: user.id } })
							.catch(() => { return [null, false]; });
						if (created) { discordUserIds.push(webhook.discordUserId); }
						else { continue; }
					}

					const [w] = await Webhook.findOrCreate({ where: { id: webhook.id }, defaults: { id: webhook.id, discordUserId: webhook.discordUserId, quidId: newQuidId ?? webhook.quidId } })
						.catch(() => { return [null]; });
					await w?.update({ discordUserId: webhook.discordUserId, quidId: newQuidId ?? webhook.quidId })
						.catch(() => { return null; });
				}
			}
		}

		if (Array.isArray(data.friendships)) {

			for (const friendship of data.friendships) {

				if (isObject(friendship) && typeof friendship.quidId1 === 'string' && typeof friendship.quidId2 === 'string') {

					const newQuidId1 = quidIdTransfer.find(obj => obj.oldId === friendship.quidId1)?.newId;
					const newQuid1 = await Quid.findByPk(newQuidId1 ?? friendship.quidId1, { attributes: ['id'] });
					if (!newQuid1) { continue; }

					const newQuidId2 = quidIdTransfer.find(obj => obj.oldId === friendship.quidId2)?.newId;
					const newQuid2 = await Quid.findByPk(newQuidId2 ?? friendship.quidId2, { attributes: ['id'] });
					if (!newQuid2) { continue; }

					await Friendship.create({
						id: generateId(),
						quidId1: newQuidId1 ?? friendship.quidId1,
						quidId2: newQuidId2 ?? friendship.quidId2,
						quid1_mentions: Array.isArray(friendship.quid1_mentions) && friendship.quid1_mentions.every((v): v is number => typeof v === 'number') ? friendship.quid1_mentions : [],
						quid2_mentions: Array.isArray(friendship.quid2_mentions) && friendship.quid2_mentions.every((v): v is number => typeof v === 'number') ? friendship.quid2_mentions : [],
					})
						.catch(() => { return null; });
				}
			}
		}

		const quidToServerIdTransfer: { oldId: string, newId: string; }[] = [];
		if (Array.isArray(data.quidsToServers)) {

			for (const quidToServer of data.quidsToServers) {

				if (isObject(quidToServer) && typeof quidToServer.id === 'string' && typeof quidToServer.quidId === 'string' && typeof quidToServer.serverId === 'string' && snowflakeCheck.test(quidToServer.serverId)) {

					const newQuidId = quidIdTransfer.find(obj => obj.oldId === quidToServer.quidId)?.newId;
					const newQuid = await Quid.findByPk(newQuidId ?? quidToServer.quidId, { attributes: ['id'] });
					if (!newQuid) { continue; }

					const s = await Server.findByPk(quidToServer.serverId, { attributes: ['id'] });
					if (!s) { continue; }

					let qts = await QuidToServer.create({ id: generateId(), quidId: newQuidId ?? quidToServer.quidId, serverId: quidToServer.serverId })
						.catch(() => { return null; });
					qts = await qts?.update({
						nickname: typeof quidToServer.nickname === 'string' ? quidToServer.nickname : undefined,
						rank: typeof quidToServer.rank === 'string' && valueInObject(RankType, quidToServer.rank) ? quidToServer.rank : undefined,
						levels: typeof quidToServer.levels === 'number' ? quidToServer.levels : undefined,
						experience: typeof quidToServer.experience === 'number' ? quidToServer.experience : undefined,
						health: typeof quidToServer.health === 'number' ? quidToServer.health : undefined,
						energy: typeof quidToServer.energy === 'number' ? quidToServer.energy : undefined,
						hunger: typeof quidToServer.hunger === 'number' ? quidToServer.hunger : undefined,
						thirst: typeof quidToServer.thirst === 'number' ? quidToServer.thirst : undefined,
						maxHealth: typeof quidToServer.maxHealth === 'number' ? quidToServer.maxHealth : undefined,
						maxEnergy: typeof quidToServer.maxEnergy === 'number' ? quidToServer.maxEnergy : undefined,
						maxHunger: typeof quidToServer.maxHunger === 'number' ? quidToServer.maxHunger : undefined,
						maxThirst: typeof quidToServer.maxThirst === 'number' ? quidToServer.maxThirst : undefined,
						hasQuest: typeof quidToServer.hasQuest === 'boolean' ? quidToServer.hasQuest : undefined,
						unlockedRanks: typeof quidToServer.unlockedRanks === 'number' ? quidToServer.unlockedRanks : undefined,
						tutorials_play: typeof quidToServer.tutorials_play === 'boolean' ? quidToServer.tutorials_play : undefined,
						tutorials_explore: typeof quidToServer.tutorials_explore === 'boolean' ? quidToServer.tutorials_explore : undefined,
						currentRegion: typeof quidToServer.currentRegion === 'string' && valueInObject(CurrentRegionType, quidToServer.currentRegion) ? quidToServer.currentRegion : undefined,
						sapling_exists: typeof quidToServer.sapling_exists === 'boolean' ? quidToServer.sapling_exists : undefined,
						sapling_health: typeof quidToServer.sapling_health === 'number' ? quidToServer.sapling_health : undefined,
						sapling_waterCycles: typeof quidToServer.sapling_waterCycles === 'number' ? quidToServer.sapling_waterCycles : undefined,
						sapling_nextWaterTimestamp: typeof quidToServer.sapling_nextWaterTimestamp === 'number' ? quidToServer.sapling_nextWaterTimestamp : undefined,
						sapling_lastChannelId: typeof quidToServer.sapling_lastChannelId === 'string' ? quidToServer.sapling_lastChannelId : undefined,
						sapling_sentReminder: typeof quidToServer.sapling_sentReminder === 'boolean' ? quidToServer.sapling_sentReminder : undefined,
						sapling_sentGentleReminder: typeof quidToServer.sapling_sentGentleReminder === 'boolean' ? quidToServer.sapling_sentGentleReminder : undefined,
						injuries_wounds: typeof quidToServer.injuries_wounds === 'number' ? quidToServer.injuries_wounds : undefined,
						injuries_infections: typeof quidToServer.injuries_infections === 'number' ? quidToServer.injuries_infections : undefined,
						injuries_cold: typeof quidToServer.injuries_cold === 'boolean' ? quidToServer.injuries_cold : undefined,
						injuries_sprains: typeof quidToServer.injuries_sprains === 'number' ? quidToServer.injuries_sprains : undefined,
						injuries_poison: typeof quidToServer.injuries_poison === 'boolean' ? quidToServer.injuries_poison : undefined,
						inventory: Array.isArray(quidToServer.inventory) && quidToServer.inventory.every((v): v is string => typeof v === 'string') ? quidToServer.inventory : undefined,
						lastActiveTimestamp: typeof quidToServer.lastActiveTimestamp === 'number' ? quidToServer.lastActiveTimestamp : undefined,
						passedOutTimestamp: typeof quidToServer.passedOutTimestamp === 'number' ? quidToServer.passedOutTimestamp : undefined,
					})
						.catch(() => { return null; }) ?? null;

					if (!qts) { continue; }

					quidToServerIdTransfer.push({ oldId: quidToServer.id, newId: qts.id });
				}
			}
		}

		if (Array.isArray(data.quidsToServersToShopRoles)) {

			for (const quidToServerToShopRole of data.quidsToServersToShopRoles) {

				if (isObject(quidToServerToShopRole) && typeof quidToServerToShopRole.quidToServerId === 'string' && typeof quidToServerToShopRole.shopRoleId === 'string' && snowflakeCheck.test(quidToServerToShopRole.shopRoleId)) {

					const newQuidToServerId = quidToServerIdTransfer.find(obj => obj.oldId === quidToServerToShopRole.quidToServerId)?.newId;
					const newQuidToServer = await QuidToServer.findByPk(newQuidToServerId ?? quidToServerToShopRole.quidToServerId, { attributes: ['id'] });
					if (!newQuidToServer) { continue; }

					const sr = await ShopRole.findByPk(quidToServerToShopRole.shopRoleId, { attributes: ['id'] });
					if (!sr) { continue; }

					await QuidToServerToShopRole.create({ id: generateId(), quidToServerId: newQuidToServerId ?? quidToServerToShopRole.quidToServerId, shopRoleId: quidToServerToShopRole.shopRoleId })
						.catch(() => { return null; });
				}
			}
		}

		if (Array.isArray(data.temporaryStatIncreases)) {

			for (const temporaryStatIncrease of data.temporaryStatIncreases) {

				if (isObject(temporaryStatIncrease) && typeof temporaryStatIncrease.quidToServerId === 'string' && typeof temporaryStatIncrease.startedTimestamp === 'number' && valueInObject(StatIncreaseType, temporaryStatIncrease.type)) {

					const newQuidToServerId = quidToServerIdTransfer.find(obj => obj.oldId === temporaryStatIncrease.quidToServerId)?.newId;
					const newQuidToServer = await QuidToServer.findByPk(newQuidToServerId ?? temporaryStatIncrease.quidToServerId, { attributes: ['id'] });
					if (!newQuidToServer) { continue; }

					await TemporaryStatIncrease.create({
						id: generateId(),
						quidToServerId: newQuidToServerId ?? temporaryStatIncrease.quidToServerId,
						startedTimestamp: temporaryStatIncrease.startedTimestamp,
						type: temporaryStatIncrease.type,
					})
						.catch(() => { return null; });
				}
			}
		}

		const groupIdTransfer: { oldId: string, newId: string; }[] = [];
		if (Array.isArray(data.groups)) {

			for (const group of data.groups) {

				if (isObject(group) && typeof group.id === 'string' && typeof group.userId === 'string' && typeof group.name === 'string' && typeof group.tag === 'string') {

					const otherQG = await Quid.findByPk(group.id, { attributes: ['id'] }) ?? await Group.findByPk(group.id, { attributes: ['id'] });

					const g = await Group.create({ id: otherQG ? await createId() : group.id, userId: user.id, name: group.name, tag: group.tag })
						.catch(() => { return null; });

					if (!g) { continue; }

					groupIdTransfer.push({ oldId: group.id, newId: g.id });
				}
				// pluralkit
				// tupperbox
				else if (isObject(group) && typeof group.name === 'string') {

					const g = await Group.create({ id: await createId(), userId: user.id, name: group.name, tag: typeof group.tag === 'string' ? group.tag : '' })
						.catch(() => { return null; });

					if (!g) { continue; }

					groupIdTransfer.push({ oldId: String(group.id), newId: g.id });

					if (Array.isArray(group.members) && group.members.every((v): v is string => typeof v === 'string')) {

						for (const gm of group.members) {

							const newQuidId = quidIdTransfer.find(obj => obj.oldId === gm)?.newId;
							const newQuid = await Quid.findByPk(newQuidId ?? gm, { attributes: ['id'] });
							if (!newQuid) { continue; }

							await GroupToQuid.create({
								id: generateId(),
								groupId: g.id,
								quidId: newQuidId ?? gm,
							})
								.catch(() => { return null; });
						}
					}
				}
			}
		}

		if (Array.isArray(data.groupsToServers)) {

			for (const groupToServer of data.groupsToServers) {

				if (isObject(groupToServer) && typeof groupToServer.groupId === 'string' && typeof groupToServer.serverId === 'string' && snowflakeCheck.test(groupToServer.serverId) && typeof groupToServer.tag === 'string') {

					const newGroupId = groupIdTransfer.find(obj => obj.oldId === groupToServer.groupId)?.newId;
					const newGroup = await Group.findByPk(newGroupId ?? groupToServer.groupId, { attributes: ['id'] });
					if (!newGroup) { continue; }

					const s = await Server.findByPk(groupToServer.serverId, { attributes: ['id'] });
					if (!s) { continue; }

					await GroupToServer.create({ id: generateId(), groupId: newGroupId ?? groupToServer.groupId, serverId: groupToServer.serverId, tag: groupToServer.tag })
						.catch(() => { return null; });
				}
			}
		}

		if (Array.isArray(data.groupsToQuids)) {

			for (const groupToQuid of data.groupsToQuids) {

				if (isObject(groupToQuid) && typeof groupToQuid.groupId === 'string' && typeof groupToQuid.quidId === 'string') {

					const newGroupId = groupIdTransfer.find(obj => obj.oldId === groupToQuid.groupId)?.newId;
					const newGroup = await Group.findByPk(newGroupId ?? groupToQuid.groupId, { attributes: ['id'] });
					if (!newGroup) { continue; }

					const newQuidId = quidIdTransfer.find(obj => obj.oldId === groupToQuid.quidId)?.newId;
					const newQuid = await Quid.findByPk(newQuidId ?? groupToQuid.quidId, { attributes: ['id'] });
					if (!newQuid) { continue; }

					await GroupToQuid.create({
						id: generateId(),
						groupId: newGroupId ?? groupToQuid.groupId,
						quidId: newQuidId ?? groupToQuid.quidId,
					})
						.catch(() => { return null; });
				}
			}
		}

		// tupperbox
		if (Array.isArray(data.tuppers)) {

			for (const tupper of data.tuppers) {

				if (isObject(tupper) && typeof tupper.group_id === 'number' && typeof tupper.id === 'number') {

					const newGroupId = groupIdTransfer.find(obj => obj.oldId === String(tupper.group_id))?.newId;
					const newGroup = await Group.findByPk(newGroupId ?? String(tupper.group_id), { attributes: ['id'] });
					if (!newGroup) { continue; }

					const newQuidId = quidIdTransfer.find(obj => obj.oldId === String(tupper.id))?.newId;
					const newQuid = await Quid.findByPk(newQuidId ?? String(tupper.id), { attributes: ['id'] });
					if (!newQuid) { continue; }

					await GroupToQuid.create({
						id: generateId(),
						groupId: newGroupId ?? String(tupper.group_id),
						quidId: newQuidId ?? String(tupper.id),
					})
						.catch(() => { return null; });
				}
			}
		}

		const changes = [
			updates.createdAccount ? 'created account' : '',
			updates.updatedAccount ? 'updated account' : '',
			updates.startedServerInfo > 0 ? `added info for ${updates.endedServerInfo} servers (${updates.startedServerInfo - updates.endedServerInfo} more failed)` : '',
			discordUserIds.length > 0 ? `added ${discordUserIds.length} discord accounts` : '',
			quidIdTransfer.length > 0 ? `added ${quidIdTransfer.length} quids` : '',
			groupIdTransfer.length > 0 ? `added ${groupIdTransfer.length} groups` : '',
		];
		// This is always an editReply to the original reply
		await respond(interaction, {
			content: `Data was imported: ${addCommasAndAnd(changes.filter(v => v.length > 0))}.`,
		}, 'update', getMessageId(botReply));
		return;
	},
};

async function exportData(
	user: User,
) {

	const discordUsers = await DiscordUser.findAll({ where: { userId: user.id } });
	const discordUserIdIn = { [Op.in]: discordUsers.map(du => du.id) };

	const quids = await Quid.findAll({ where: { userId: user.id } });
	const quidIdIn = { [Op.in]: quids.map(q => q.id) };

	const quidsToServers = await QuidToServer.findAll({ where: { quidId: quidIdIn } });
	const quidsToServersIdIn = { [Op.in]: quidsToServers.map(qts => qts.id) };

	const groups = await Group.findAll({ where: { userId: user.id } });
	const groupIdIn = { [Op.in]: groups.map(g => g.id) };

	const userData = {
		user: user,
		userToServers: await UserToServer.findAll({ where: { userId: user.id } }),
		discordUsers: discordUsers,
		discordUsersToServers: await DiscordUserToServer.findAll({ where: { discordUserId: discordUserIdIn } }),
		quids: quids,
		webhooks: await Webhook.findAll({ where: { quidId: quidIdIn } }),
		friendships: await Friendship.findAll({ where: { [Op.or]: [ { quidId1: quidIdIn }, { quidId2: quidIdIn }] } }),
		quidsToServers: quidsToServers,
		quidsToServersToShopRoles: await QuidToServerToShopRole.findAll({ where: { quidToServerId: quidsToServersIdIn } }),
		temporaryStatIncreases: await TemporaryStatIncrease.findAll({ where: { quidToServerId: quidsToServersIdIn } }),
		groups: groups,
		groupsToServers: await GroupToServer.findAll({ where: { groupId: groupIdIn } }),
		groupsToQuids: await GroupToQuid.findAll({ where: { [Op.or]: [{ quidId: quidIdIn }, { groupId: groupIdIn }] } }),
	};
	return Buffer.from(JSON.stringify(userData, null, 2));
}