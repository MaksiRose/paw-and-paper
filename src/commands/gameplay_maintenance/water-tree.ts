import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Op } from 'sequelize';
import { client } from '../..';
import DiscordUser from '../../models/discordUser';
import DiscordUserToServer from '../../models/discordUserToServer';
import Quid from '../../models/quid';
import QuidToServer from '../../models/quidToServer';
import User from '../../models/user';
import UserToServer from '../../models/userToServer';
import { SlashCommand } from '../../typings/handle';
import { updateAndGetMembers } from '../../utils/checkRoleRequirements';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { getDisplayname, getDisplayspecies, pronounAndPlural } from '../../utils/getQuidInfo';
import { respond } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
import { hasPermission } from '../../utils/permissionHandler';
import { getRandomNumber, pullFromWeightedTable } from '../../utils/randomizers';
import { remindOfAttack } from '../gameplay_primary/attack';

const oneMinute = 60_000;
const thirtyMinutes = oneMinute * 30;
const oneHour = thirtyMinutes * 2;
const threeHours = oneHour * 3;
const twentyFourHours = threeHours * 8;
const userMap: Map<string, NodeJS.Timeout> = new Map();

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('water-tree')
		.setDescription('If you have a ginkgo sapling, you can water it using this command.')
		.addBooleanOption(option =>
			option.setName('use_red_clover')
				.setDescription('This will prevent your tree from losing health when not being watered for a long time'))
		.setDMPermission(false)
		.toJSON(),
	category: 'page3',
	position: 9,
	disablePreviousCommand: true,
	modifiesServerProfile: false, // This is technically true, but it's set to false because it's a task that you get reminded to do daily and does not reflect your actual activity
	sendCommand: async (interaction, { user, quid, userToServer, quidToServer, server }) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (server === undefined) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(quid, { interaction, hasQuids: quid !== undefined || (user !== undefined && (await Quid.count({ where: { userId: user.id } })) > 0) })) { return; } // This is always a reply
		if (!user) { throw new TypeError('user is undefined'); }
		if (!userToServer) { throw new TypeError('userToServer is undefined'); }
		if (!quidToServer) { throw new TypeError('quidToServer is undefined'); }

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, user, userToServer, quid, quidToServer);
		if (restEmbed === false) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (quidToServer.sapling_exists === false) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${quid.name} has already fetched water when ${pronounAndPlural(quid, 0, 'remember')} that ${pronounAndPlural(quid, 0, 'has', 'have')} nothing to water.*`)
					.setFooter({ text: 'Go exploring to find a ginkgo tree to water!' })],
				ephemeral: true,
			});
			return;
		}

		const usesRedClover = interaction.options.getBoolean('use_red_clover') === true;
		if (usesRedClover && !server.inventory.includes('red clover')) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${quid.name} searches for a red clover, but can't find one in the storage...*`)
					.setFooter({ text: 'Red clovers prevent your tree from losing health when it has not been watered for too long. Go adventuring to find a red clover, and make sure to store it away. Run the command again without this option enabled to water your tree without using a red clover.' })],
				ephemeral: true,
			});
			return;
		}
		else if (usesRedClover) {

			const itemIndex = server.inventory.findIndex(i => i === 'red clover');
			if (itemIndex < 0) { throw new Error('item does not exist in server.inventory'); }
			await server.update({ inventory: server.inventory.filter((_, idx) => idx !== itemIndex) });
		}

		const currentTimestamp = interaction.createdTimestamp;
		const timeDifference = Math.abs(currentTimestamp - (quidToServer.sapling_nextWaterTimestamp ?? 0));
		const timeDifferenceInMinutes = Math.round(timeDifference / oneMinute);

		let experiencePoints = Math.min(quidToServer.sapling_waterCycles, quidToServer.levels * 5);
		let healthPoints = 0;

		const embed = new EmbedBuilder()
			.setColor(quid.color)
			.setAuthor({
				name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
				iconURL: quid.avatarURL,
			});

		/* This is the first of three `if` statements that check the time difference between the current timestamp and the timestamp of the perfect watering time. If the time difference is less than or equal to 30 minutes, the sapling's health is increased by a number between 1 and 4, the number of watering cycles is increased by 1, the experience points are set to the number of watering cycles, the health points are set to a number between 1 and 6, and the embed's description and footer are set. */
		if (timeDifference <= thirtyMinutes) {

			const saplingHealthPoints = 4 - Math.round(timeDifferenceInMinutes / 10);
			quidToServer.sapling_health += saplingHealthPoints;
			quidToServer.sapling_waterCycles += 1;

			healthPoints = pullFromWeightedTable({ 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 }) + getRandomNumber(Math.round(quidToServer.sapling_waterCycles / 4));
			if (quidToServer.health + healthPoints > quidToServer.maxHealth) { healthPoints = quidToServer.maxHealth - quidToServer.health; }

			embed.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/main/pictures/ginkgo_tree/Perfect.png');
			embed.setDescription(`*${quid.name} waters the seedling, and it look it's at the perfect time. The ginkgo tree looks healthy, the leaves have a strong green color, and a pleasant fragrance emanates from them. The ${getDisplayspecies(quid)} feels warm and safe from the scent.*`);
			embed.setFooter({ text: `+${experiencePoints} XP (${quidToServer.experience + experiencePoints}/${quidToServer.levels * 50})${healthPoints > 0 ? `\n+${healthPoints} health (${quidToServer.health + healthPoints}/${quidToServer.maxEnergy})` : ''}\n\n+${saplingHealthPoints} health for ginkgo sapling\nCome back to water it in 24 hours.` });
		}
		/* This is the second of three `if` statements that check the time difference between the current timestamp and the timestamp of the perfect watering time. If the time difference is less than or equal to 3 hours, the number of watering cycles is increased by 1, the experience points are set to the number of watering cycles, and the embed's description and footer are set. */
		else if (timeDifference <= threeHours || usesRedClover) {

			if (timeDifference <= threeHours) { quidToServer.sapling_waterCycles += 1; }

			embed.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/main/pictures/ginkgo_tree/Good.png');
			embed.setDescription(`*${quid.name} waters the seedling, and it look like the sapling needs it. Although the ginkgo tree looks healthy, with leaves of beautiful green color and a light scent, the soil seems to be already quite dry.*`);
			embed.setFooter({ text: `+${experiencePoints} XP (${quidToServer.experience + experiencePoints}/${quidToServer.levels * 50})\n\nCome back to water the ginkgo sapling in 24 hours.` });
		}
		/* Checking if the sapling is overdue for watering, and if it is, it is calculating how much health it has lost. */
		else {

			experiencePoints = 0;
			const weeksAlive = Math.floor(quidToServer.sapling_waterCycles / 7);
			const overdueHours = Math.ceil(timeDifference / oneHour) - 3;
			const percentage = (overdueHours * 3) / 100;
			const lostHealthPoints = Math.round(quidToServer.sapling_health * percentage) + weeksAlive;
			quidToServer.sapling_health -= (quidToServer.sapling_health - lostHealthPoints > 0 ? lostHealthPoints : quidToServer.sapling_health - lostHealthPoints > -weeksAlive ? quidToServer.sapling_health - 1 : quidToServer.sapling_health);

			embed.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/main/pictures/ginkgo_tree/Miss.png');
			if (currentTimestamp < (quidToServer.sapling_nextWaterTimestamp || 0)) {

				embed.setDescription(`*The soil is already soggy when ${quid.name} adds more water to it. The leaves are yellow-brown, the stem is muddy and has a slight mold. Next time the ${getDisplayspecies(quid)} should wait a little with the watering.*`);
			}
			else {

				embed.setDescription(`*${quid.name} decides to see if the ginkgo tree needs watering, and sure enough: the leaves are drooping, some have lost color, and many of them fell on the ground. It is about time that the poor tree gets some water.*`);
			}
			embed.setFooter({ text: `-${lostHealthPoints} health for ginkgo tree\nCome back to water it in 24 hours.` });
		}

		await quidToServer.update({
			sapling_health: quidToServer.sapling_health,
			sapling_waterCycles: quidToServer.sapling_waterCycles,
			sapling_lastChannelId: interaction.channelId,
			sapling_nextWaterTimestamp: currentTimestamp + twentyFourHours,
			sapling_sentReminder: false,
			sapling_sentGentleReminder: false,
			experience: quidToServer.experience + experiencePoints,
			health: quidToServer.health + healthPoints,
		});

		const members = await updateAndGetMembers(user.id, interaction.guild);
		const levelUpEmbed = await checkLevelUp(interaction, quid, quidToServer, members);

		// This is always a reply
		await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed, ...levelUpEmbed],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId(`user-settings_reminders_water_${user.reminders_water === true ? 'off' : 'on'}_@${user.id}`)
					.setLabel(`Turn water reminders ${user.reminders_water === true ? 'off' : 'on'}`)
					.setStyle(ButtonStyle.Secondary))],
		});

		if (user.reminders_water) { await sendReminder(quidToServer); }

		if (quidToServer.sapling_health <= 0) {

			// This is always a followUp
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction.guildId, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*No matter what ${quid.name} does, all the leaves on the ginkgo tree have either fallen off, or are dark brown and hang limply. It's time to say goodbye to the tree.*`)
					.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/main/pictures/ginkgo_tree/Dead.png')],
			});

			await quidToServer.update({
				sapling_exists: false,
				sapling_health: 50,
				sapling_waterCycles: 0,
				sapling_nextWaterTimestamp: null,
				sapling_lastChannelId: null,
				sapling_sentReminder: false,
				sapling_sentGentleReminder: false,
			});
		}
	},
};

export async function sendReminder(
	quidToServer: QuidToServer,
): Promise<void> {

	// This makes sure no reminders are running and are repeated
	stopReminder(quidToServer.quidId, quidToServer.serverId);

	if (typeof quidToServer.sapling_lastChannelId !== 'string') {

		await removeChannel(quidToServer);
		return;
	}

	userMap.set(quidToServer.quidId + quidToServer.serverId, setTimeout(async () => {
		try {

			const quid = await Quid.findByPk(quidToServer.quidId, { rejectOnEmpty: true });
			const user = await User.findByPk(quid.userId, { rejectOnEmpty: true });
			quidToServer = await QuidToServer.findByPk(quidToServer.id, { rejectOnEmpty: true });

			if (typeof quidToServer.sapling_lastChannelId !== 'string') {

				await removeChannel(quidToServer);
				return;
			}

			if (quidToServer.sapling_exists && user.reminders_water && !quidToServer.sapling_sentReminder) {

				await quidToServer.update({ sapling_sentReminder: true });

				const channel = await client.channels.fetch(quidToServer.sapling_lastChannelId!);
				if (!channel || !channel.isTextBased() || channel.isDMBased()) { throw new Error('lastMessageChannelId is undefined, not a text based channel or a DM channel'); }

				const member = channel.guild.members.me || await channel.guild.members.fetchMe({ force: false });

				if (await hasPermission(member || channel.client.user.id, channel.id, 'ViewChannel') === false || await hasPermission(member || channel.client.user.id, channel.id, channel.isThread() ? 'SendMessagesInThreads' : 'SendMessages') === false || await hasPermission(member || channel.client.user.id, channel.id, 'EmbedLinks') === false) { return; } // Needed for channel.send call

				/* This has to be changed when multiple users are introduced. First idea is to also store, as part of the sapling object, which user last watered. Then, if that user fails, try again for all the other users. */
				const userToServer = await UserToServer.findOne({ where: { userId: user.id, serverId: quidToServer.serverId }, rejectOnEmpty: true });
				const isInactive = userToServer.activeQuidId !== quid.id;

				const discordUsers = await DiscordUser.findAll({ where: { userId: user.id } });
				const discordUserToServer = await DiscordUserToServer.findOne({
					where: {
						serverId: quidToServer.serverId,
						isMember: true,
						discordUserId: { [Op.in]: discordUsers.map(du => du.id) },
					},
				});

				await channel.send({
					content: `<@${discordUserToServer?.discordUserId ?? discordUsers[0]?.id ?? 'error'}>`,
					embeds: [new EmbedBuilder()
						.setColor(quid.color)
						.setAuthor({
							name: await getDisplayname(quid, { serverId: quidToServer.serverId, userToServer, quidToServer, user }),
							iconURL: quid.avatarURL,
						})
						.setDescription('It is time to `/water-tree` your tree!')
						.setFooter(isInactive ? { text: '⚠️ CAUTION! The quid associated with this reminder is currently inactive. Type "/profile" and select the quid from the drop-down list before watering your tree.' } : null)],
				});
			}
		}
		catch (error) {

			await removeChannel(quidToServer);
			console.error(error);
		}
	}, (quidToServer.sapling_nextWaterTimestamp ?? Date.now()) - Date.now()));
}

export function stopReminder(
	quidId: string,
	serverId: string,
): void {

	if (userMap.has(quidId + serverId)) { clearTimeout(userMap.get(quidId + serverId)); }
}

async function removeChannel(
	quidToServer: QuidToServer,
): Promise<void> { await quidToServer.update({ sapling_lastChannelId: null }).catch(console.error); }