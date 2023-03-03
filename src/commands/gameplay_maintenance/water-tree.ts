import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { client } from '../..';
import serverModel from '../../oldModels/serverModel';
import { userModel, getUserData } from '../../oldModels/userModel';
import { UserData } from '../../typings/data/user';
import { SlashCommand } from '../../typings/handle';
import { hasNameAndSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { getMapData, getSmallerNumber, respond } from '../../utils/helperFunctions';
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
	sendCommand: async (interaction, userData, serverData) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!isInGuild(interaction) || !hasNameAndSpecies(userData, interaction)) { return; } // This is always a reply

		/* Checks if the profile is resting, on a cooldown or passed out. */
		const restEmbed = await isInvalid(interaction, userData);
		if (restEmbed === false) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (userData.quid.profile.sapling.exists === false) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${userData.quid.name} has already fetched water when ${userData.quid.pronounAndPlural(0, 'remember')} that ${userData.quid.pronounAndPlural(0, 'has', 'have')} nothing to water.*`)
					.setFooter({ text: 'Go exploring to find a ginkgo tree to water!' })],
				ephemeral: true,
			});
			return;
		}

		const usesRedClover = interaction.options.getBoolean('use_red_clover') === true;
		if (usesRedClover && serverData.inventory.specialPlants['red clover'] <= 0) {

			// This is always a reply
			await respond(interaction, {
				content: messageContent,
				embeds: [...restEmbed, new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*${userData.quid.name} searches for a red clover, but can't find one in the storage...*`)
					.setFooter({ text: 'Red clovers prevent your tree from losing health when it has not been watered for too long. Go adventuring to find a red clover, and make sure to store it away. Run the command again without this option enabled to water your tree without using a red clover.' })],
				ephemeral: true,
			});
			return;
		}
		else if (usesRedClover) {

			serverData = serverModel.findOneAndUpdate(
				s => s._id === serverData!._id,
				(s) => {
					s.inventory.specialPlants['red clover'] -= 1;
				},
			);
		}

		const currentTimestamp = interaction.createdTimestamp;
		const timeDifference = Math.abs(currentTimestamp - (userData.quid.profile.sapling.nextWaterTimestamp ?? 0));
		const timeDifferenceInMinutes = Math.round(timeDifference / oneMinute);

		let experiencePoints = getSmallerNumber(userData.quid.profile.sapling.waterCycles, userData.quid.profile.levels * 5);
		let healthPoints = 0;

		const embed = new EmbedBuilder()
			.setColor(userData.quid.color)
			.setAuthor({
				name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
				iconURL: quid.avatarURL,
			});

		/* This is the first of three `if` statements that check the time difference between the current timestamp and the timestamp of the perfect watering time. If the time difference is less than or equal to 30 minutes, the sapling's health is increased by a number between 1 and 4, the number of watering cycles is increased by 1, the experience points are set to the number of watering cycles, the health points are set to a number between 1 and 6, and the embed's description and footer are set. */
		if (timeDifference <= thirtyMinutes) {

			const saplingHealthPoints = 4 - Math.round(timeDifferenceInMinutes / 10);
			userData.quid.profile.sapling.health += saplingHealthPoints;
			userData.quid.profile.sapling.waterCycles += 1;

			healthPoints = pullFromWeightedTable({ 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 }) + getRandomNumber(Math.round(userData.quid.profile.sapling.waterCycles / 4));
			if (userData.quid.profile.health + healthPoints > userData.quid.profile.maxHealth) { healthPoints = userData.quid.profile.maxHealth - userData.quid.profile.health; }

			embed.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/main/pictures/ginkgo_tree/Perfect.png');
			embed.setDescription(`*${userData.quid.name} waters the seedling, and it look it's at the perfect time. The ginkgo tree looks healthy, the leaves have a strong green color, and a pleasant fragrance emanates from them. The ${userData.quid.getDisplayspecies()} feels warm and safe from the scent.*`);
			embed.setFooter({ text: `+${experiencePoints} XP (${userData.quid.profile.experience + experiencePoints}/${userData.quid.profile.levels * 50})${healthPoints > 0 ? `\n+${healthPoints} health (${userData.quid.profile.health + healthPoints}/${userData.quid.profile.maxEnergy})` : ''}\n\n+${saplingHealthPoints} health for ginkgo sapling\nCome back to water it in 24 hours.` });
		}
		/* This is the second of three `if` statements that check the time difference between the current timestamp and the timestamp of the perfect watering time. If the time difference is less than or equal to 3 hours, the number of watering cycles is increased by 1, the experience points are set to the number of watering cycles, and the embed's description and footer are set. */
		else if (timeDifference <= threeHours || usesRedClover) {

			if (timeDifference <= threeHours) { userData.quid.profile.sapling.waterCycles += 1; }

			embed.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/main/pictures/ginkgo_tree/Good.png');
			embed.setDescription(`*${userData.quid.name} waters the seedling, and it look like the sapling needs it. Although the ginkgo tree looks healthy, with leaves of beautiful green color and a light scent, the soil seems to be already quite dry.*`);
			embed.setFooter({ text: `+${experiencePoints} XP (${userData.quid.profile.experience + experiencePoints}/${userData.quid.profile.levels * 50})\n\nCome back to water the ginkgo sapling in 24 hours.` });
		}
		/* Checking if the sapling is overdue for watering, and if it is, it is calculating how much health it has lost. */
		else {

			experiencePoints = 0;
			const weeksAlive = Math.floor(userData.quid.profile.sapling.waterCycles / 7);
			const overdueHours = Math.ceil(timeDifference / oneHour) - 3;
			const percentage = (overdueHours * 3) / 100;
			const lostHealthPoints = Math.round(userData.quid.profile.sapling.health * percentage) + weeksAlive;
			userData.quid.profile.sapling.health -= (userData.quid.profile.sapling.health - lostHealthPoints > 0 ? lostHealthPoints : userData.quid.profile.sapling.health - lostHealthPoints > -weeksAlive ? userData.quid.profile.sapling.health - 1 : userData.quid.profile.sapling.health);

			embed.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/main/pictures/ginkgo_tree/Miss.png');
			if (currentTimestamp < (userData.quid.profile.sapling.nextWaterTimestamp || 0)) {

				embed.setDescription(`*The soil is already soggy when ${userData.quid.name} adds more water to it. The leaves are yellow-brown, the stem is muddy and has a slight mold. Next time the ${userData.quid.getDisplayspecies()} should wait a little with the watering.*`);
			}
			else {

				embed.setDescription(`*${userData.quid.name} decides to see if the ginkgo tree needs watering, and sure enough: the leaves are drooping, some have lost color, and many of them fell on the ground. It is about time that the poor tree gets some water.*`);
			}
			embed.setFooter({ text: `-${lostHealthPoints} health for ginkgo tree\nCome back to water it in 24 hours.` });
		}

		userData.quid.profile.sapling.nextWaterTimestamp = currentTimestamp + twentyFourHours;
		userData.quid.profile.sapling.lastMessageChannelId = interaction.channelId;
		userData.quid.profile.sapling.sentReminder = false;

		await userData.update(
			(u) => {
				const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
				p.sapling = userData!.quid!.profile.sapling;
				p.experience += experiencePoints;
				p.health += healthPoints;
			},
		);

		const levelUpEmbed = await checkLevelUp(interaction, userData, serverData);
		// This is always a reply
		await respond(interaction, {
			content: messageContent,
			embeds: [...restEmbed, embed, ...levelUpEmbed],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId(`user-settings_reminders_water_${userData.settings.reminders.water === true ? 'off' : 'on'}_@${userData._id}`)
					.setLabel(`Turn water reminders ${userData.settings.reminders.water === true ? 'off' : 'on'}`)
					.setStyle(ButtonStyle.Secondary))],
		});

		if (userData.settings.reminders.water) { await sendReminder(userData); }

		if (userData.quid.profile.sapling.health <= 0) {

			// This is always a followUp
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(userData.quid.color)
					.setAuthor({
						name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
						iconURL: quid.avatarURL,
					})
					.setDescription(`*No matter what ${userData.quid.name} does, all the leaves on the ginkgo tree have either fallen off, or are dark brown and hang limply. It's time to say goodbye to the tree.*`)
					.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/main/pictures/ginkgo_tree/Dead.png')],
			});

			await userData.update(
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(u.servers, interaction.guildId).currentQuid ?? '').profiles, interaction.guildId);
					p.sapling = { exists: false, health: 50, waterCycles: 0, nextWaterTimestamp: null, lastMessageChannelId: null, sentReminder: false, sentGentleReminder: false };
				},
			);
		}
	},
};

export async function sendReminder(
	userData: UserData<never, never>,
): Promise<void> {

	// This makes sure no reminders are running and are repeated
	stopReminder(userData.quid._id, userData.quid.profile.serverId);

	if (typeof userData.quid.profile.sapling.lastMessageChannelId !== 'string') {

		await removeChannel(userData);
		return;
	}

	userMap.set(userData.quid._id + userData.quid.profile.serverId, setTimeout(async () => {
		try {

			const _userData = await userModel.findOne(u => u._id === userData._id);
			const newUserData = getUserData(_userData, userData.quid.profile.serverId, getMapData(_userData.quids, userData.quid._id));
			if (!hasNameAndSpecies(newUserData)) { return; }
			userData = newUserData;

			if (typeof userData.quid.profile.sapling.lastMessageChannelId !== 'string') {

				removeChannel(userData);
				return;
			}

			if (userData.quid.profile.sapling.exists && userData.settings.reminders.water && !userData.quid.profile.sapling.sentReminder) {

				userData.update(
					(u) => {
						const p = getMapData(getMapData(u.quids, userData.quid._id).profiles, userData.quid.profile.serverId);
						p.sapling.sentReminder = true;
					},
				);

				const channel = await client.channels.fetch(userData.quid.profile.sapling.lastMessageChannelId!);
				if (!channel || !channel.isTextBased() || channel.isDMBased()) { throw new Error('lastMessageChannelId is undefined, not a text based channel or a DM channel'); }

				const member = channel.guild.members.me || await channel.guild.members.fetchMe({ force: false });

				if (await hasPermission(member || channel.client.user.id, channel.id, 'ViewChannel') === false || await hasPermission(member || channel.client.user.id, channel.id, channel.isThread() ? 'SendMessagesInThreads' : 'SendMessages') === false || await hasPermission(member || channel.client.user.id, channel.id, 'EmbedLinks') === false) { return; } // Needed for channel.send call

				/* This has to be changed when multiple users are introduced. First idea is to also store, as part of the sapling object, which user last watered. Then, if that user fails, try again for all the other users. */
				const isInactive = _userData.servers[userData.quid.profile.serverId]?.currentQuid !== userData.quid._id;

				await channel.send({
					content: `<@${Object.keys(userData.userIds)[0]}>`,
					embeds: [new EmbedBuilder()
						.setColor(userData.quid.color)
						.setAuthor({
							name: await getDisplayname(quid, { serverId: interaction?.guildId ?? undefined, userToServer, quidToServer, user }),
							iconURL: quid.avatarURL,
						})
						.setDescription('It is time to `/water-tree` your tree!')
						.setFooter(isInactive ? { text: '⚠️ CAUTION! The quid associated with this reminder is currently inactive. Type "/profile" and select the quid from the drop-down list before watering your tree.' } : null)],
				});
			}
		}
		catch (error) {

			removeChannel(userData);
			console.error(error);
		}
	}, (userData.quid.profile.sapling.nextWaterTimestamp ?? Date.now()) - Date.now()));
}

export function stopReminder(
	quidId: string,
	serverId: string,
): void {

	if (userMap.has(quidId + serverId)) { clearTimeout(userMap.get(quidId + serverId)); }
}

function removeChannel(
	userData: UserData<never, never>,
): void {

	try {

		userData.update(
			(u) => {
				const p = getMapData(getMapData(u.quids, userData.quid._id).profiles, userData.quid.profile.serverId);
				p.sapling.lastMessageChannelId = null;
			},
		);
	}
	catch (error) {

		console.log(error);
	}
}