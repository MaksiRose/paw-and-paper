import { EmbedBuilder, GuildMember, SlashCommandBuilder } from 'discord.js';
import { readFileSync, writeFileSync } from 'fs';
import { respond, userDataServersObject } from '../../utils/helperFunctions';
import { checkLevelRequirements, checkRankRequirements } from '../../utils/checkRoleRequirements';
import { getRandomNumber } from '../../utils/randomizers';
import { generateId } from 'crystalid';
import { SlashCommand } from '../../typings/handle';
import { BanList, GivenIdList } from '../../typings/data/general';
import { userModel, getUserData } from '../../models/userModel';
import { CurrentRegionType, RankType } from '../../typings/data/user';
import { commonPlantsInfo, materialsInfo, rarePlantsInfo, specialPlantsInfo, speciesInfo, uncommonPlantsInfo } from '../..';
const { version } = require('../../../package.json');
const { default_color, error_color } = require('../../../config.json');

export const command: SlashCommand = {
	data: new SlashCommandBuilder()
		.setName('name')
		.setDescription('Start your adventure! (Re-)name a quid.')
		.addStringOption(option =>
			option.setName('name')
				.setDescription('The name that you want your quid to have.')
				.setMaxLength(24) // A normal name should only have 24 characters, but a displayname/nickname should still have 32 characters max length.
				.setRequired(true))
		.toJSON(),
	category: 'page1',
	position: 0,
	disablePreviousCommand: false,
	modifiesServerProfile: false,
	sendCommand: async (interaction, userData, serverData) => {

		let newAccount = false;
		/* This is checking if the user has any data saved in the database. If they don't, it will create a new user. */
		if (!userData) {

			newAccount = true;
			/* Checking if the user is banned from using the bot. */
			const bannedList = JSON.parse(readFileSync('./database/bannedList.json', 'utf-8')) as BanList;
			if (bannedList.users.includes(interaction.user.id)) {

				// This should always be a reply
				await respond(interaction, {
					content: 'I am sorry to inform you that you have been banned from using this bot.',
					ephemeral: true,
				});
				return;
			}

			const _userData = await userModel.create({
				userId: [interaction.user.id],
				userIds: {
					[interaction.user.id]: interaction.inGuild() ? {
						[interaction.guildId]: { isMember: true, lastUpdatedTimestamp: Date.now() },
					} : {},
				},
				tag: {
					global: '',
					servers: {},
				},
				advice: { resting: false, drinking: false, eating: false, passingout: false, coloredbuttons: false, ginkgosapling: false },
				settings: {
					reminders: { water: true, resting: true },
					proxy: {
						global: { autoproxy: false, stickymode: false },
						servers: {},
					},
					accessibility: { replaceEmojis: false },
				},
				quids: {},
				currentQuid: {},
				servers: {},
				lastPlayedVersion: `${version.split('.').slice(0, -1).join('.')}`,
				antiproxy: { startsWith: '', endsWith: '' },
				groups: {},
				group_quid: [],
				_id: generateId(),
			});
			userData = getUserData(_userData, interaction.guildId ?? 'DMs', _userData.quids[_userData.servers[interaction.guildId ?? 'DMs']?.currentQuid ?? '']);
		}

		const name = interaction.options.getString('name');

		/* This is checking if the user has inputted a name for their quid. If they haven't, it will send them an error message. If they have, it will check if the name is too long. If it is, it will send them an error message. */
		if (!name) {

			// This should always be a reply
			await respond(interaction, {
				embeds: [new EmbedBuilder()
					.setColor(error_color)
					.setTitle('Please input a name for your quid.')],
				ephemeral: true,
			});
			return;
		}

		/* This is checking if the user has a quid in the database. If they don't, it will create a new user. */
		const _id = userData.servers.get(interaction.guildId || 'DMs')?.currentQuid || await createId();


		await userData.update(
			(u) => {
				const q = u.quids[_id];
				if (!q) {

					u.quids[_id] = {
						_id: _id,
						name: name,
						nickname: {
							global: '',
							servers: {},
						},
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
								tutorials: { play: false, explore: false },
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
								lastActiveTimestamp: 0,
								passedOutTimestamp: 0,
							},
						} : {},
						mainGroup: null,
					};
				}
				else { q.name = name; }

				// eslint-disable-next-line deprecation/deprecation
				u.currentQuid[interaction.guildId || 'DMs'] = _id;
				u.servers[interaction.guildId || 'DMs'] = {
					...userDataServersObject(u, interaction.guildId || 'DMs'),
					currentQuid: _id,
				};
			},
		);

		// This should always be a reply
		await respond(interaction, {
			embeds: [new EmbedBuilder()
				.setColor(default_color)
				.setTitle(userData.quid === undefined ? `You successfully created the quid ${name}!` : `You successfully renamed your quid to ${name}!`)
				.setDescription(newAccount === false ? null : '__What is a quid?__\nTo avoid using limiting words like "character" or "person", Paw and Paper uses the made-up word quid. It is based off of the word [Quiddity](https://en.wikipedia.org/wiki/Quiddity), which means "what makes something what it is". Quid then means "someone who is what they are", which is vague on purpose because it changes based on what they are.')
				.setFooter(userData.quid === undefined ? { text: 'To continue setting up your profile for the RPG, type "/species". For other options, review "/help".' } : null)],
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
export async function createId(): Promise<string> {

	const legend = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'm', 'n', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
	let _id = '';

	for (let index = 0; index < 6; index++) { _id += legend[getRandomNumber(legend.length)]; }

	const givenIds = JSON.parse(readFileSync('./database/givenIds.json', 'utf-8')) as GivenIdList;

	if (givenIds.includes(_id)) { return await createId(); }

	givenIds.push(_id);
	writeFileSync('./database/givenIds.json', JSON.stringify(givenIds, null, '\t'));

	return _id;
}