import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import userModel from '../../models/userModel';
import { CustomClient, Profile, Quid, SlashCommand, UserSchema } from '../../typedef';
import { hasName, hasSpecies, isInGuild } from '../../utils/checkUserState';
import { isInvalid } from '../../utils/checkValidity';
import { pronounAndPlural } from '../../utils/getPronouns';
import { getMapData, getQuidDisplayname, respond } from '../../utils/helperFunctions';
import { checkLevelUp } from '../../utils/levelHandling';
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
		.setDMPermission(false)
		.toJSON(),
	category: 'page3',
	position: 9,
	disablePreviousCommand: true,
	modifiesServerProfile: false, // This is technically true, but it's set to false because it's a task that you get reminded to do daily and does not reflect your actual activity
	sendCommand: async (client, interaction, userData, serverData, embedArray) => {

		/* This ensures that the user is in a guild and has a completed account. */
		if (!isInGuild(interaction)) { return; }
		if (serverData === null) { throw new Error('serverData is null'); }
		if (!hasName(interaction, userData)) { return; }

		/* Gets the current active quid and the server profile from the account */
		let quidData = getMapData(userData.quids, getMapData(userData.currentQuid, interaction.guildId));
		let profileData = getMapData(quidData.profiles, interaction.guildId);
		if (!hasSpecies(interaction, quidData)) { return; }

		/* Checks if the profile is on a cooldown or passed out. */
		if (await isInvalid(interaction, userData, quidData, profileData, embedArray)) { return; }

		const messageContent = remindOfAttack(interaction.guildId);

		if (profileData.sapling.exists === false) {

			await respond(interaction, {
				content: messageContent,
				embeds: [...embedArray, new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
					.setDescription(`*${quidData.name} has already fetched water when ${pronounAndPlural(quidData, 0, 'remember')} that ${pronounAndPlural(quidData, 0, 'has', 'have')} nothing to water.*`)
					.setFooter({ text: 'Go exploring to find a ginkgo tree to water!' })],
				ephemeral: true,
			}, false);
			return;
		}

		const currentTimestamp = interaction.createdTimestamp;
		const timeDifference = Math.abs(currentTimestamp - (profileData.sapling.nextWaterTimestamp ?? 0));
		const timeDifferenceInMinutes = Math.round(timeDifference / oneMinute);

		let experiencePoints = 0;
		let healthPoints = 0;

		const embed = new EmbedBuilder()
			.setColor(quidData.color)
			.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL });

		/* This is the first of three `if` statements that check the time difference between the current timestamp and the timestamp of the perfect watering time. If the time difference is less than or equal to 30 minutes, the sapling's health is increased by a number between 1 and 4, the number of watering cycles is increased by 1, the experience points are set to the number of watering cycles, the health points are set to a number between 1 and 6, and the embed's description and footer are set. */
		if (timeDifference <= thirtyMinutes) {

			const saplingHealthPoints = 4 - Math.round(timeDifferenceInMinutes / 10);
			profileData.sapling.health += saplingHealthPoints;
			profileData.sapling.waterCycles += 1;

			experiencePoints = profileData.sapling.waterCycles;
			healthPoints = pullFromWeightedTable({ 1: 5, 2: 4, 3: 3, 4: 2, 5: 1 }) + getRandomNumber(Math.round(profileData.sapling.waterCycles / 4));
			if (profileData.health + healthPoints > profileData.maxHealth) { healthPoints = profileData.maxHealth - profileData.health; }

			embed.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/main/pictures/ginkgo_tree/Perfect.png');
			embed.setDescription(`*${quidData.name} waters the seedling, and it look it's at the perfect time. The ginkgo tree looks healthy, the leaves have a strong green color, and a pleasant fragrance emanates from them. The ${quidData.displayedSpecies || quidData.species} feels warm and safe from the scent.*`);
			embed.setFooter({ text: `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50})${healthPoints > 0 ? `\n+${healthPoints} health (${profileData.health + healthPoints}/${profileData.maxEnergy})` : ''}\n\n+${saplingHealthPoints} health for ginkgo sapling\nCome back to water it in 24 hours.` });
		}
		/* This is the second of three `if` statements that check the time difference between the current timestamp and the timestamp of the perfect watering time. If the time difference is less than or equal to 3 hours, the number of watering cycles is increased by 1, the experience points are set to the number of watering cycles, and the embed's description and footer are set. */
		else if (timeDifference <= threeHours) {

			profileData.sapling.waterCycles += 1;
			experiencePoints = profileData.sapling.waterCycles;

			embed.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/main/pictures/ginkgo_tree/Good.png');
			embed.setDescription(`*${quidData.name} waters the seedling, and it look like the sapling needs it. Although the ginkgo tree looks healthy, with leaves of beautiful green color and a light scent, the soil seems to be already quite dry.*`);
			embed.setFooter({ text: `+${experiencePoints} XP (${profileData.experience + experiencePoints}/${profileData.levels * 50})\n\nCome back to water the ginkgo sapling in 24 hours.` });
		}
		/* Checking if the sapling is overdue for watering, and if it is, it is calculating how much health it has lost. */
		else {

			const weeksAlive = Math.floor(profileData.sapling.waterCycles / 7);
			const overdueHours = Math.ceil(timeDifference / oneHour) - 3;
			const percentage = (overdueHours * 3) / 100;
			const lostHealthPoints = Math.round(profileData.sapling.health * percentage) + weeksAlive;
			profileData.sapling.health -= (profileData.sapling.health - lostHealthPoints > 0 ? lostHealthPoints : profileData.sapling.health - lostHealthPoints > -weeksAlive ? profileData.sapling.health - 1 : profileData.sapling.health);

			embed.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/main/pictures/ginkgo_tree/Miss.png');
			if (currentTimestamp < (profileData.sapling.nextWaterTimestamp || 0)) {

				embed.setDescription(`*The soil is already soggy when ${quidData.name} adds more water to it. The leaves are yellow-brown, the stem is muddy and has a slight mold. Next time the ${quidData.displayedSpecies || quidData.species} should wait a little with the watering.*`);
			}
			else {

				embed.setDescription(`*${quidData.name} decides to see if the ginkgo tree needs watering, and sure enough: the leaves are drooping, some have lost color, and many of them fell on the ground. It is about time that the poor tree gets some water.*`);
			}
			embed.setFooter({ text: `-${lostHealthPoints} health for ginkgo tree\nCome back to water it in 24 hours.` });
		}

		profileData.sapling.nextWaterTimestamp = currentTimestamp + twentyFourHours;
		profileData.sapling.lastMessageChannelId = interaction.channelId;
		profileData.sapling.sentReminder = false;

		userData = await userModel.findOneAndUpdate(
			u => u._id === userData!._id,
			(u) => {
				const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
				p.sapling = profileData.sapling;
				p.experience += experiencePoints;
				p.health += healthPoints;
			},
		);
		quidData = getMapData(userData.quids, quidData._id);
		profileData = getMapData(quidData.profiles, profileData.serverId);

		const levelUpCheck = await checkLevelUp(interaction, userData, quidData, profileData, serverData);
		profileData = levelUpCheck.profileData;
		await respond(interaction, {
			content: messageContent,
			embeds: [...embedArray, embed, ...levelUpCheck.levelUpEmbed ? [levelUpCheck.levelUpEmbed] : []],
			components: [new ActionRowBuilder<ButtonBuilder>()
				.setComponents(new ButtonBuilder()
					.setCustomId(`settings_reminders_water_${userData.settings.reminders.water === true ? 'off' : 'on'}`)
					.setLabel(`Turn water reminders ${userData.settings.reminders.water === true ? 'off' : 'on'}`)
					.setStyle(ButtonStyle.Secondary))],
		}, true);

		if (userData.settings.reminders.water) { await sendReminder(client, userData, quidData, profileData); }

		if (profileData.sapling.health <= 0) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(quidData.color)
					.setAuthor({ name: getQuidDisplayname(userData, quidData, interaction.guildId), iconURL: quidData.avatarURL })
					.setDescription(`*No matter what ${quidData.name} does, all the leaves on the ginkgo tree have either fallen off, or are dark brown and hang limply. It's time to say goodbye to the tree.*`)
					.setImage('https://raw.githubusercontent.com/MaksiRose/paw-and-paper/main/pictures/ginkgo_tree/Dead.png')],
			}, false);

			userData = await userModel.findOneAndUpdate(
				u => u._id === userData!._id,
				(u) => {
					const p = getMapData(getMapData(u.quids, getMapData(u.currentQuid, interaction.guildId)).profiles, interaction.guildId);
					p.sapling = { exists: false, health: 50, waterCycles: 0, nextWaterTimestamp: null, lastMessageChannelId: null, sentReminder: false, sentGentleReminder: false };
				},
			);
			quidData = getMapData(userData.quids, quidData._id);
			profileData = getMapData(quidData.profiles, profileData.serverId);
		}
	},
};

export async function sendReminder(
	client: CustomClient,
	userData: UserSchema,
	quidData: Quid<true>,
	profileData: Profile,
): Promise<void> {

	// This makes sure no reminders are running and are repeated
	stopReminder(quidData._id, profileData.serverId);

	if (typeof profileData.sapling.lastMessageChannelId !== 'string') {

		await removeChannel(userData._id, quidData._id, profileData.serverId);
		return;
	}

	userMap.set(quidData._id + profileData.serverId, setTimeout(async () => {
		try {

			userData = await userModel.findOne(u => u._id === userData._id);
			quidData = getMapData(userData.quids, quidData._id);
			profileData = getMapData(quidData.profiles, profileData.serverId);

			if (typeof profileData.sapling.lastMessageChannelId !== 'string') {

				await removeChannel(userData._id, quidData._id, profileData.serverId);
				return;
			}

			if (profileData.sapling.exists && userData.settings.reminders.water && !profileData.sapling.sentReminder) {

				userData = await userModel.findOneAndUpdate(
					u => u._id === userData._id,
					(u) => {
						const p = getMapData(getMapData(u.quids, quidData._id).profiles, profileData.serverId);
						p.sapling.sentReminder = true;
					},
				);
				quidData = getMapData(userData.quids, quidData._id);
				profileData = getMapData(quidData.profiles, profileData.serverId);

				const channel = await client.channels.fetch(profileData.sapling.lastMessageChannelId!);
				if (!channel || !channel.isTextBased() || channel.isDMBased()) { throw new Error('lastMessageChannelId is undefined, not a text based channel or a DM channel'); }

				/* This has to be changed when multiple users are introduced. First idea is to also store, as part of the sapling object, which user last watered. Then, if that user fails, try again for all the other users. */
				await channel.guild.members.fetch(userData.userId[0] || '');
				const isInactive = userData.currentQuid[profileData.serverId] !== quidData._id;

				await channel.send({
					content: `<@${userData.userId[0]}>`,
					embeds: [new EmbedBuilder()
						.setColor(quidData.color)
						.setAuthor({ name: getQuidDisplayname(userData, quidData, profileData.serverId), iconURL: quidData.avatarURL })
						.setDescription('It is time to `/water-tree` your tree!')
						.setFooter(isInactive ? { text: '⚠️ CAUTION! The quid associated with this reminder is currently inactive. Type "/profile" and select the quid from the drop-down list before watering your tree.' } : null)],
				});
			}
		}
		catch (error) {

			await removeChannel(userData._id, quidData._id, profileData.serverId);
			console.error(error);
		}
	}, (profileData.sapling.nextWaterTimestamp ?? Date.now()) - Date.now()));
}

export function stopReminder(
	quidId: string,
	serverId: string,
): void {

	if (userMap.has(quidId + serverId)) { clearTimeout(userMap.get(quidId + serverId)); }
}

async function removeChannel(
	userUuid: string,
	quidId: string,
	serverId: string,
): Promise<void> {

	await userModel.findOneAndUpdate(
		u => u._id === userUuid,
		(u) => {
			const p = getMapData(getMapData(u.quids, quidId).profiles, serverId);
			p.sapling.lastMessageChannelId = null;
		},
	).catch((error) => { console.log(error); });
}