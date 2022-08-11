import { EmbedBuilder, GuildMember, SlashCommandBuilder } from 'discord.js';
import { readFileSync, writeFileSync } from 'fs';
import { respond } from '../../utils/helperFunctions';
import userModel from '../../models/userModel';
import { BanList, commonPlantsInfo, CurrentRegionType, GivenIdList, materialsInfo, RankType, rarePlantsInfo, SlashCommand, specialPlantsInfo, speciesInfo, uncommonPlantsInfo } from '../../typedef';
import { checkLevelRequirements, checkRankRequirements } from '../../utils/checkRoleRequirements';
import { getMapData } from '../../utils/helperFunctions';
import { generateRandomNumber } from '../../utils/randomizers';
const { version } = require('../../../package.json');
const { default_color, error_color } = require('../../../config.json');

const name: SlashCommand['name'] = 'name';
const description: SlashCommand['description'] = 'Start your adventure! (Re-)name a quid.';
export const command: SlashCommand = {
	name: name,
	description: description,
	data: new SlashCommandBuilder()
		.setName(name)
		.setDescription(description)
		.addStringOption(option =>
			option.setName('name')
				.setDescription('The name that you want your quid to have.')
				.setMaxLength(24) // A normal name should only have 24 characters, but a displayname/nickname should still have 32 characters max length.
				.setRequired(true))
		.toJSON(),
	disablePreviousCommand: false,
	sendCommand: async (client, interaction, userData, serverData) => {

		/* This is checking if the user has any data saved in the database. If they don't, it will create a new user. */
		if (!userData) {

			/* Checking if the user is banned from using the bot. */
			const bannedList = JSON.parse(readFileSync('./database/bannedList.json', 'utf-8')) as BanList;
			if (bannedList.users.includes(interaction.user.id)) {

				await respond(interaction, {
					content: 'I am sorry to inform you that you have been banned from using this bot.',
					ephemeral: true,
				}, true)
					.catch((error) => {
						if (error.httpStatus !== 404) { throw new Error(error); }
					});
				return;
			}

			userData = await userModel.create({
				userId: [interaction.user.id],
				advice: { resting: false, drinking: false, eating: false, passingout: false, coloredbuttons: false },
				settings: { reminders: { water: true, resting: true } },
				quids: {},
				currentQuid: {},
				serverProxySettings: {},
				globalProxySettings: {
					autoproxy: false,
					stickymode: false,
				},
				lastPlayedVersion: `${version.split('.').slice(0, -1).join('.')}`,
				uuid: '',
			});
		}

		const name = interaction.options.getString('name');

		/* This is checking if the user has inputted a name for their quid. If they haven't, it will send them an error message. If they have, it will check if the name is too long. If it is, it will send them an error message. */
		if (!name) {

			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please input a name for your quid.')],
				ephemeral: true,
			}, true)
				.catch((error) => {
					if (error.httpStatus !== 404) { throw new Error(error); }
				});
			return;
		}

		/* This is checking if the user has a quid in the database. If they don't, it will create a new user. */
		const _id = userData.currentQuid[interaction.guildId || 'DM'] || await createId();


		userData = await userModel.findOneAndUpdate(
			u => u.uuid === userData?.uuid,
			(u) => {
				let q = u.quids[_id];
				if (!q) {

					q = {
						_id: _id,
						name: name,
						species: '',
						displayedSpecies: '',
						description: '',
						avatarURL: 'https://cdn.discordapp.com/embed/avatars/1.png',
						pronounSets: [['they', 'them', 'their', 'theirs', 'themselves', 'plural']],
						proxy: {
							startsWith: '',
							endsWith: '',
						},
						color: default_color,
						mentions: {},
						profiles: interaction.inGuild() ? {
							[interaction.guildId]: {
								serverId: interaction.guildId,
								rank: RankType.Youngling,
								levels: 1,
								experience: 0,
								health: 100,
								energy: 100,
								hunger: 100,
								thirst: 100,
								maxHealth: 100,
								maxEnergy: 100,
								maxHunger: 100,
								maxThirst: 100,
								temporaryStatIncrease: {},
								isResting: false,
								hasQuest: false,
								currentRegion: CurrentRegionType.Ruins,
								unlockedRanks: 0,
								sapling: { exists: false, health: 50, waterCycles: 0, nextWaterTimestamp: null, lastMessageChannelId: null, sentReminder: false, sentGentleReminder: false },
								injuries: { wounds: 0, infections: 0, cold: false, sprains: 0, poison: false },
								inventory: {
									commonPlants: Object.fromEntries(Object.keys(commonPlantsInfo).map(k => [k, 0]).sort()) as Record<keyof typeof commonPlantsInfo, number>,
									uncommonPlants: Object.fromEntries(Object.keys(uncommonPlantsInfo).map(k => [k, 0]).sort()) as Record<keyof typeof uncommonPlantsInfo, number>,
									rarePlants: Object.fromEntries(Object.keys(rarePlantsInfo).map(k => [k, 0]).sort()) as Record<keyof typeof rarePlantsInfo, number>,
									specialPlants: Object.fromEntries(Object.keys(specialPlantsInfo).map(k => [k, 0]).sort()) as Record<keyof typeof specialPlantsInfo, number>,
									meat: Object.fromEntries(Object.keys(speciesInfo).map(k => [k, 0]).sort()) as Record<keyof typeof speciesInfo, number>,
									materials: Object.fromEntries(Object.keys(materialsInfo).map(k => [k, 0]).sort()) as Record<keyof typeof materialsInfo, number>,
								},
								roles: [],
								skills: { global: {}, personal: {} },
							},
						} : {},
					};
				}
				else { q.name = name; }

				u.currentQuid[interaction.guildId || 'DM'] = _id;
			},
		);
		const quidData = getMapData(userData.quids, _id);

		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setTitle(quidData === null ? `You successfully created the quid ${name}!` : `You successfully renamed your quid to ${name}!`)
				.setFooter(quidData === null ? { text: 'To continue setting up your profile for the RPG, type "/species". For other options, review "/help".' } : null)],
		}, true)
			.catch((error) => {
				if (error.httpStatus !== 404) { throw new Error(error); }
			});

		/* This is checking if the user is in a guild, if the server has data saved in the database, and if the guildmember data is cached. If all of these are true, it will check if the user has reached the requirements to get roles based on their rank and level. */
		if (interaction.inGuild() && serverData && (interaction.member instanceof GuildMember)) {

			await checkRankRequirements(serverData, interaction, interaction.member, RankType.Youngling);
			await checkLevelRequirements(serverData, interaction, interaction.member, 1);
		}
	},
};

/**
 * Creates a unique 6-character ID.
 */
const createId = async (): Promise<string> => {

	const legend = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'm', 'n', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
	let uuid = '';

	for (let index = 0; index < 6; index++) { uuid += legend[generateRandomNumber(legend.length)]; }

	const givenIds = JSON.parse(readFileSync('./database/givenIds.json', 'utf-8')) as GivenIdList;

	if (givenIds.includes(uuid)) { return await createId(); }

	givenIds.push(uuid);
	writeFileSync('./database/givenIds.json', JSON.stringify(givenIds, null, '\t'));

	return uuid;
};